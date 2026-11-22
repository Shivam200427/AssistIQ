import json
from flask import request, jsonify, Blueprint
from openrouter_client import prompt_completion
from helpers import resolve_store_dir
from rag import answer_with_citations, open_store, retrieve, abstain

pdf_comp = Blueprint('pdf_comp', __name__)

LEGACY_MESSAGE = (
    "This document was processed before page citations were added, so I can't point to source pages for it. "
    "Re-upload the PDF to get answers with page references."
)


def _context(hits):
    return "\n\n".join(f"[p. {h['page']}]\n{h['text']}" for h in hits)


@pdf_comp.route('/askquestion', methods=['POST'])
def ask_question():
    """
    mode "qa" (default, used by Chat): strict, page-cited answer or an explicit abstention.
    mode "summary": short notes from retrieved passages, with page citations.
    mode "ideas": suggestions (project ideas, quiz topics) inspired by the document — not factual claims.
    """
    try:
        req = request.get_json() or {}
        question = str(req.get('question') or "").strip()[:2000]
        mode = req.get("mode") or "qa"
        persist_dir = resolve_store_dir(req.get("store"))
        if not persist_dir:
            return jsonify({"message": "A valid document reference is required"}), 400
        if not question:
            return jsonify({"message": "Ask a question about the document."}), 400

        store, cited = open_store(persist_dir)

        if mode == "qa":
            if not cited:
                result = abstain("legacy_index")
                result["answer"] = LEGACY_MESSAGE
                return jsonify(result), 200
            return jsonify(answer_with_citations(question, retrieve(store, question, k=5))), 200

        hits = retrieve(store, question, k=8) if cited else [
            {"page": 0, "text": d.page_content, "score": 1.0} for d in store.similarity_search(question, k=8)
        ]
        if mode == "summary":
            instructions = (
                "Write concise study notes (headings + bullet points) using ONLY the excerpts. "
                + ("End each bullet with the page it came from, like [p. 4]. Only cite pages shown in the excerpts." if cited else "")
            )
        else:
            instructions = "Use the excerpts as inspiration. Follow the user's requested output format exactly."
        prompt = f"{instructions}\n\nExcerpts:\n{_context(hits) if cited else chr(10).join(h['text'] for h in hits)}\n\nRequest: {question}"
        answer = (prompt_completion(prompt, temperature=0.3) or "").strip()
        if not answer:
            return jsonify({"message": "The AI service returned an empty response. Please try again.", "retryable": True}), 502
        return jsonify({"answer": answer, "mode": mode, "cited": cited, "pages_used": sorted({h["page"] for h in hits if h["page"]})}), 200

    except Exception as e:
        print("askquestion error:", e)
        return jsonify({"message": "The document couldn't be searched right now. Please try again.", "retryable": True}), 500


def cluster_to_concepts(texts):
    combined_text = "\n".join(texts[:6])
    prompt = f"""
Extract key concepts and relationships from the text.

Return JSON ONLY in this exact structure:
{{
  "nodes": ["Concept1", "Concept2"],
  "edges": [
     ["Concept1", "relation", "Concept2"]
  ]
}}
TEXT:
{combined_text}
"""
    raw = prompt_completion(prompt, temperature=0.1).strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    data = json.loads(raw)  # raises -> caller reports a real error instead of a fake map

    nodes, edges = [], []
    for node in data.get("nodes", []):
        if isinstance(node, str) and node not in nodes:
            nodes.append(node)
    for edge in data.get("edges", []):
        if isinstance(edge, list) and len(edge) == 3:
            edges.append({"source": edge[0], "label": edge[1], "target": edge[2]})
    return {"nodes": [{"id": n, "label": n} for n in nodes], "edges": edges}


@pdf_comp.route("/conceptmap", methods=["POST"])
def concept_map_route():
    req = request.get_json() or {}
    persist_dir = resolve_store_dir(req.get("store"))
    if not persist_dir:
        return jsonify({"error": "A valid store is required"}), 400
    try:
        store, _ = open_store(persist_dir)
        docs = store.similarity_search("main ideas, key concepts and how they relate", k=6)
        result = cluster_to_concepts([d.page_content for d in docs])
        if not result["nodes"]:
            return jsonify({"error": "No concepts could be extracted from this document.", "retryable": True}), 422
        return jsonify(result), 200
    except Exception as e:
        print("conceptmap error:", e)
        return jsonify({"error": "The concept map couldn't be generated. Please try again.", "retryable": True}), 502
