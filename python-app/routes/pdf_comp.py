import json
from flask import request, jsonify, Blueprint
from openrouter_client import prompt_completion
from utils import load_vector_store
from helpers import resolve_store_dir

pdf_comp = Blueprint('pdf_comp', __name__)

def ask_openrouter(question, context):
    prompt = f"""
   Use the PDF context to answer. 
    Context:
    {context}

    Question:
    {question}

    Answer clearly and simply.
    """
    return prompt_completion(prompt, temperature=0.3)

@pdf_comp.route('/askquestion', methods=['POST'])
def generate_ques():
    try:
        req = request.get_json() or {}
        question = str(req.get('question') or "")[:2000]
        persist_dir = resolve_store_dir(req.get("store"))

        if not persist_dir:
            return jsonify({"message": "A valid document reference is required", "answer": "Missing document reference."}), 400
        
        retriever = load_vector_store(persist_dir)
        docs = []
        try:
            docs = retriever.invoke(question)
        except Exception as ret_err:
            print("Retriever invoke warning:", ret_err)

        context = "\n\n".join([d.page_content for d in docs if getattr(d, 'page_content', None)])
        
        answer = None
        try:
            answer = ask_openrouter(question, context)
        except Exception as llm_err:
            print("ask_openrouter error, using context fallback:", llm_err)
            if context.strip():
                top_chunks = [d.page_content.strip() for d in docs if d.page_content.strip()][:3]
                answer = "Here is the relevant excerpt from your document:\n\n" + "\n\n---\n\n".join(top_chunks)
            else:
                answer = "Document indexed successfully. Ask a specific question about the document concepts."

        if not answer or (isinstance(answer, str) and not answer.strip()):
            if context.strip():
                top_chunks = [d.page_content.strip() for d in docs if d.page_content.strip()][:3]
                answer = "Relevant document information:\n\n" + "\n\n---\n\n".join(top_chunks)
            else:
                answer = "I could not find an answer in the uploaded document for this query."

        if isinstance(answer, (list, dict)):
            if isinstance(answer, list):
                answer = "\n".join(str(item) for item in answer)
            else:
                answer = str(answer)

        return jsonify({"answer": str(answer).strip()}), 200
    except Exception as e:
        print("askquestion error:", e)
        return jsonify({"message": "Could not answer from this document", "answer": "Notice: the document could not be searched right now."}), 500

def cluster_to_concepts(clustered_chunks):
    final_nodes = []
    final_edges = []

    for group_id, texts in clustered_chunks.items():
        combined_text = "\n".join(texts[:5])

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

        try:
            data = json.loads(raw)
        except Exception:
            continue

        for node in data.get("nodes", []):
            if node not in final_nodes:
                final_nodes.append(node)

        for edge in data.get("edges", []):
            if len(edge) == 3:
                final_edges.append({
                    "source": edge[0],
                    "label": edge[1],
                    "target": edge[2]
                })

    if not final_nodes:
        sample_concepts = ["Core Concept", "Key Principles", "Applications"]
        return {
            "nodes": [{"id": c, "label": c} for c in sample_concepts],
            "edges": [
                {"source": "Core Concept", "label": "explains", "target": "Key Principles"},
                {"source": "Key Principles", "label": "powers", "target": "Applications"}
            ]
        }

    return {
        "nodes": [{"id": n, "label": n} for n in final_nodes],
        "edges": final_edges
    }


@pdf_comp.route("/conceptmap", methods=["POST"])
def concept_map_route():
    req = request.get_json() or {}
    persist_dir = resolve_store_dir(req.get("store"))

    if not persist_dir:
        return jsonify({"error": "A valid store is required"}), 400

    retriever = load_vector_store(persist_dir)
    docs = retriever.invoke("give main ideas and explanation")
    chunks = [d.page_content for d in docs]

    clusters = {0: chunks}
    result = cluster_to_concepts(clusters)

    return jsonify(result), 200
