"""
Source-grounded retrieval for PDF chat.

- The vector index is built from the ORIGINAL page text of the uploaded PDF (never from AI notes),
  and every chunk keeps the page number it came from.
- Answers are generated only from retrieved excerpts and must cite pages as [p. N].
- If retrieval finds nothing relevant, the model reports insufficient evidence, or the answer cites a
  page that was not in the retrieved excerpts, the chat abstains instead of answering.
- Study notes are generated separately, from the same page-tagged index, and also cite pages.
"""
import gc
import os
import re

import chromadb
from chromadb.config import Settings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from openrouter_client import prompt_completion
from utils import get_embedding_model

COLLECTION = "pdf_pages"          # page-tagged index (new)
LEGACY_COLLECTION = "pdf_store"   # old index built from AI notes, no page numbers
INDEX_VERSION = 2

# Cosine relevance below this means the document doesn't really talk about the question.
MIN_RELEVANCE = float(os.getenv("RAG_MIN_RELEVANCE", "0.25"))
NOT_ENOUGH = "NOT_ENOUGH_EVIDENCE"
ABSTAIN_MESSAGE = "I don't have enough evidence in this document to answer that."

_store_cache = {}


# ---------------------------------------------------------------- indexing

def pages_from_extract(result):
    """ocr.extract_pdf returns [{page_no: text}, ...]; normalise to [{"page": int, "text": str}]."""
    pages = []
    for item in result or []:
        for page_no, text in item.items():
            pages.append({"page": int(page_no), "text": text or ""})
    return [p for p in pages if p["text"].strip()]


def chunk_pages(pages, chunk_size=900, overlap=150):
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    docs = []
    for p in pages:
        for piece in splitter.split_text(p["text"]):
            if piece.strip():
                docs.append(Document(page_content=piece, metadata={"page": int(p["page"])}))
    return docs


def build_page_index(pages, persist_dir):
    """Indexes the original page text. Returns the number of chunks."""
    docs = chunk_pages(pages)
    if not docs:
        raise ValueError("The PDF has no readable text to index.")
    client = chromadb.PersistentClient(path=persist_dir, settings=Settings(anonymized_telemetry=False))
    store = Chroma(
        client=client,
        collection_name=COLLECTION,
        embedding_function=get_embedding_model(),
        persist_directory=persist_dir,
        collection_metadata={"hnsw:space": "cosine", "source": "original_pages", "version": INDEX_VERSION},
    )
    store.add_documents(docs)
    del store, client
    gc.collect()
    return len(docs)


def _restore_from_s3(persist_dir):
    from helpers import download_and_extract_vectorstore

    base = os.path.basename(persist_dir.rstrip("/\\"))
    bucket = os.getenv("AWS_S3_BUCKET")
    return download_and_extract_vectorstore(f"s3://{bucket}/vectorstores/{base}.zip", bucket)


def open_store(persist_dir):
    """Returns (store, cited) — cited=False for old notes-based indexes that have no page numbers."""
    if persist_dir in _store_cache:
        return _store_cache[persist_dir]
    path = persist_dir
    if not os.path.exists(path) or not os.listdir(path):
        path = _restore_from_s3(persist_dir)
    client = chromadb.PersistentClient(path=path, settings=Settings(anonymized_telemetry=False))
    names = {c.name if hasattr(c, "name") else c for c in client.list_collections()}
    cited = COLLECTION in names
    store = Chroma(
        client=client,
        collection_name=COLLECTION if cited else LEGACY_COLLECTION,
        embedding_function=get_embedding_model(),
        persist_directory=path,
    )
    _store_cache[persist_dir] = (store, cited)
    return store, cited


def all_chunks_in_page_order(store):
    data = store._collection.get(include=["documents", "metadatas"])
    rows = [
        {"page": int((m or {}).get("page", 0)), "text": d}
        for d, m in zip(data.get("documents") or [], data.get("metadatas") or [])
    ]
    return sorted(rows, key=lambda r: r["page"])


# ---------------------------------------------------------------- retrieval + answers

def retrieve(store, query, k=5):
    hits = store.similarity_search_with_relevance_scores(query, k=k)
    return [
        {"page": int(doc.metadata.get("page", 0)), "text": doc.page_content, "score": float(score)}
        for doc, score in hits
    ]


_CITE_RE = re.compile(r"\[(?:p|pp|page|pages)\.?\s*([0-9][0-9,\s\-–]*)\]", re.IGNORECASE)


def extract_cited_pages(answer):
    pages = set()
    for group in _CITE_RE.findall(answer or ""):
        for part in re.split(r"[,\s]+", group.strip()):
            if not part:
                continue
            if re.match(r"^\d+[-–]\d+$", part):
                a, b = re.split(r"[-–]", part)
                pages.update(range(int(a), int(b) + 1))
            elif part.isdigit():
                pages.add(int(part))
    return pages


def abstain(reason, hits=None):
    return {"answer": ABSTAIN_MESSAGE, "grounded": False, "citations": [], "reason": reason, "pages_searched": sorted({h["page"] for h in hits or []})}


def answer_with_citations(question, hits, llm=prompt_completion):
    """Answers strictly from `hits` (page-tagged excerpts) or abstains. Never returns an unverifiable citation."""
    relevant = [h for h in hits if h["score"] >= MIN_RELEVANCE]
    if not relevant:
        return abstain("no_relevant_passages", hits)

    excerpts = "\n\n".join(f"[p. {h['page']}]\n{h['text']}" for h in relevant)
    prompt = f"""You answer questions about a student's PDF using ONLY the excerpts below.
Each excerpt starts with its page number like [p. 3].

Rules:
- Use only facts stated in the excerpts. Do not use outside knowledge.
- After every sentence that states a fact, cite the page(s) it came from, exactly like [p. 3] or [p. 3, 5].
- Only cite page numbers that appear in the excerpts below.
- If the excerpts do not contain enough information to answer, reply with exactly: {NOT_ENOUGH}

Excerpts:
{excerpts}

Question: {question}

Answer (2-5 sentences, with citations):"""
    answer = (llm(prompt, temperature=0.1) or "").strip()

    if not answer or NOT_ENOUGH in answer:
        return abstain("model_reported_insufficient_evidence", relevant)
    cited = extract_cited_pages(answer)
    allowed = {h["page"] for h in relevant}
    if not cited:
        return abstain("answer_had_no_citations", relevant)
    if not cited.issubset(allowed):
        # A citation to a page we never showed the model is invented — refuse rather than mislead.
        return abstain("answer_cited_unretrieved_pages", relevant)

    citations = []
    for page in sorted(cited):
        excerpt = next(h["text"] for h in relevant if h["page"] == page)
        citations.append({"page": page, "excerpt": excerpt[:280]})
    return {"answer": answer, "grounded": True, "citations": citations, "reason": None, "pages_searched": sorted(allowed)}


# ---------------------------------------------------------------- notes

def notes_from_index(store, llm=prompt_completion, max_chars=24000):
    """Study notes generated from the page-tagged index. Returns (notes_text, status).
    status is "ai" when the model wrote them, or "extracted_text" when it was unavailable —
    in that case the notes are clearly labelled as raw extracted text, not AI notes."""
    rows = all_chunks_in_page_order(store)
    budget, parts = 0, []
    for r in rows:
        piece = f"[p. {r['page']}]\n{r['text']}"
        if budget + len(piece) > max_chars:
            break
        parts.append(piece)
        budget += len(piece)
    source = "\n\n".join(parts)
    prompt = f"""Write well-structured study notes from the document excerpts below.
- Keep the meaning accurate; do not add facts that are not in the excerpts.
- Use headings, bullet points and short paragraphs.
- End every bullet or paragraph with the page it came from, like [p. 4].
- Only cite page numbers that appear in the excerpts.
Return only the notes.

Excerpts:
{source}
"""
    try:
        notes = (llm(prompt, temperature=0.3) or "").strip()
    except Exception as exc:  # noqa: BLE001
        print(f"[notes] AI notes unavailable: {exc}")
        notes = ""
    if notes:
        allowed = {r["page"] for r in rows}
        # Drop citations to pages that don't exist in the document.
        notes = _CITE_RE.sub(lambda m: m.group(0) if extract_cited_pages(m.group(0)).issubset(allowed) else "", notes)
        return notes, "ai"

    fallback = "NOTE: AI notes could not be generated right now. Below is the text extracted from your PDF, by page.\n\n"
    fallback += "\n\n".join(f"Page {r['page']}\n{r['text']}" for r in rows)
    return fallback, "extracted_text"
