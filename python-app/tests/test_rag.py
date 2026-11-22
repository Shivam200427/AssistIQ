"""
PDF chat must search the original pages, cite real pages, and abstain when the document doesn't
support an answer. The LLM is stubbed so these tests are deterministic and need no network;
the embeddings are the real (local ONNX) model.
Run:  cd python-app && python -m pytest tests -q
"""
import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import rag  # noqa: E402

PAGES = [
    {"page": 1, "text": "Photosynthesis happens in chloroplasts. Chlorophyll absorbs mostly red and blue light and reflects green light. The light reactions in the thylakoid membranes produce ATP and NADPH, and water is split releasing oxygen."},
    {"page": 2, "text": "The Calvin cycle takes place in the stroma. It fixes carbon dioxide using the enzyme RuBisCO and uses ATP and NADPH to make G3P, which builds glucose."},
    {"page": 3, "text": "Cellular respiration happens in mitochondria. Glycolysis occurs in the cytoplasm and produces pyruvate. The Krebs cycle and electron transport chain produce most of the ATP."},
]


@pytest.fixture()
def store_dir(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    rag._store_cache.clear()
    d = f"./vectorstores/{uuid.uuid4()}"
    rag.build_page_index(PAGES, d)
    return d


class StubLLM:
    def __init__(self, reply):
        self.reply = reply
        self.calls = 0
        self.prompts = []

    def __call__(self, prompt, temperature=0.0, **_):
        self.calls += 1
        self.prompts.append(prompt)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def test_index_is_built_from_original_pages_with_page_numbers(store_dir):
    store, cited = rag.open_store(store_dir)
    assert cited is True
    rows = rag.all_chunks_in_page_order(store)
    assert {r["page"] for r in rows} == {1, 2, 3}
    assert any("RuBisCO" in r["text"] for r in rows)  # original wording, not AI notes


def test_retrieval_finds_the_right_page(store_dir):
    store, _ = rag.open_store(store_dir)
    assert rag.retrieve(store, "Which enzyme fixes carbon dioxide?")[0]["page"] == 2
    assert rag.retrieve(store, "Where does glycolysis happen?")[0]["page"] == 3


def test_grounded_answer_cites_real_retrieved_pages(store_dir):
    store, _ = rag.open_store(store_dir)
    hits = rag.retrieve(store, "What light does chlorophyll absorb?")
    llm = StubLLM("Chlorophyll absorbs mostly red and blue light [p. 1].")
    result = rag.answer_with_citations("What light does chlorophyll absorb?", hits, llm=llm)
    assert result["grounded"] is True
    assert [c["page"] for c in result["citations"]] == [1]
    assert "red and blue" in result["citations"][0]["excerpt"]
    # The model was only shown page-tagged excerpts from the document.
    assert "[p. 1]" in llm.prompts[0]


def test_off_topic_question_abstains_without_calling_the_model(store_dir):
    store, _ = rag.open_store(store_dir)
    hits = rag.retrieve(store, "Who won the 2018 FIFA World Cup?")
    llm = StubLLM("France won [p. 2].")
    result = rag.answer_with_citations("Who won the 2018 FIFA World Cup?", hits, llm=llm)
    assert result["grounded"] is False
    assert result["citations"] == []
    assert result["answer"] == rag.ABSTAIN_MESSAGE
    assert result["reason"] == "no_relevant_passages"
    assert llm.calls == 0


def test_invented_page_citation_is_refused(store_dir):
    store, _ = rag.open_store(store_dir)
    hits = rag.retrieve(store, "Where does the Calvin cycle occur?", k=2)
    allowed = {h["page"] for h in hits}
    fake = next(p for p in (7, 42, 99) if p not in allowed)
    result = rag.answer_with_citations("Where?", hits, llm=StubLLM(f"In the stroma [p. {fake}]."))
    assert result["grounded"] is False and result["citations"] == []
    assert result["reason"] == "answer_cited_unretrieved_pages"
    assert str(fake) not in result["answer"]


def test_uncited_answer_is_refused(store_dir):
    store, _ = rag.open_store(store_dir)
    hits = rag.retrieve(store, "Where does the Calvin cycle occur?")
    result = rag.answer_with_citations("Where?", hits, llm=StubLLM("In the stroma."))
    assert result["grounded"] is False and result["reason"] == "answer_had_no_citations"


def test_model_reporting_insufficient_evidence_abstains(store_dir):
    store, _ = rag.open_store(store_dir)
    hits = rag.retrieve(store, "What is the molecular weight of RuBisCO?")
    result = rag.answer_with_citations("What is the molecular weight of RuBisCO?", hits, llm=StubLLM(rag.NOT_ENOUGH))
    assert result["grounded"] is False and result["citations"] == []


def test_citation_parsing():
    assert rag.extract_cited_pages("a [p. 1] b [pp. 2, 4] c [p. 6-8] d [page 10]") == {1, 2, 4, 6, 7, 8, 10}
    assert rag.extract_cited_pages("no citations here") == set()


def test_notes_come_from_the_index_and_drop_fake_citations(store_dir):
    store, _ = rag.open_store(store_dir)
    llm = StubLLM("# Photosynthesis\n- Chlorophyll absorbs red/blue light [p. 1]\n- Made-up fact [p. 9]")
    notes, status = rag.notes_from_index(store, llm=llm)
    assert status == "ai"
    assert "[p. 1]" in notes and "[p. 9]" not in notes
    assert "RuBisCO" in llm.prompts[0]  # notes prompt is built from the original page text


def test_notes_fallback_is_clearly_labelled(store_dir):
    store, _ = rag.open_store(store_dir)
    notes, status = rag.notes_from_index(store, llm=StubLLM(RuntimeError("AI down")))
    assert status == "extracted_text"
    assert notes.startswith("NOTE: AI notes could not be generated")
    assert "Page 2" in notes


def test_chat_route_cites_and_abstains(store_dir, monkeypatch):
    from flask import Flask
    from routes.pdf_comp import pdf_comp

    app = Flask(__name__)
    app.register_blueprint(pdf_comp)
    client = app.test_client()

    monkeypatch.setattr(rag, "prompt_completion", StubLLM("Glycolysis occurs in the cytoplasm [p. 3]."))
    # answer_with_citations captured the default at import time; route passes none, so patch the default too.
    monkeypatch.setattr(rag.answer_with_citations, "__defaults__", (rag.prompt_completion, None))
    res = client.post("/askquestion", json={"question": "Where does glycolysis happen?", "store": store_dir})
    body = res.get_json()
    assert res.status_code == 200 and body["grounded"] is True
    assert body["citations"][0]["page"] == 3

    res = client.post("/askquestion", json={"question": "What is the capital of France?", "store": store_dir})
    body = res.get_json()
    assert body["grounded"] is False and body["citations"] == []


def test_legacy_notes_index_never_returns_uncited_answers(tmp_path, monkeypatch):
    """Documents indexed before this change (AI-notes index, no page numbers) get an honest message."""
    import chromadb
    from chromadb.config import Settings
    from langchain_chroma import Chroma
    from flask import Flask
    from routes.pdf_comp import pdf_comp

    monkeypatch.chdir(tmp_path)
    rag._store_cache.clear()
    d = f"./vectorstores/{uuid.uuid4()}"
    client = chromadb.PersistentClient(path=d, settings=Settings(anonymized_telemetry=False))
    Chroma(client=client, collection_name=rag.LEGACY_COLLECTION, embedding_function=rag.get_embedding_model()).add_texts(["Old AI-written notes about photosynthesis."])

    app = Flask(__name__)
    app.register_blueprint(pdf_comp)
    body = app.test_client().post("/askquestion", json={"question": "What is photosynthesis?", "store": d}).get_json()
    assert body["grounded"] is False and body["citations"] == []
    assert "Re-upload" in body["answer"]


def test_document_quiz_refuses_to_run_without_document_text(monkeypatch):
    """A PDF quiz must never silently become a 'no content' topic quiz."""
    import app as app_module

    monkeypatch.setattr(app_module, "extract_pdf", lambda bucket, key: [{1: "   "}])
    monkeypatch.setattr(app_module, "get_bucket", lambda: "test-bucket")
    called = []
    monkeypatch.setattr(app_module, "generate_question", lambda *a, **k: called.append(a) or "[]")
    res = app_module.app.test_client().post("/generate_questions", json={"prompt": "cells", "key": "pdf/x/1/a.pdf", "count": 5})
    assert res.status_code == 422
    assert "No readable text" in res.get_json()["message"]
    assert called == []


# ---------------------------------------------------------------- regression: CV-style documents
CV_PAGES = [
    {"page": 1, "text": "Shivam Jain\nB.Tech Computer Science and Engineering | Software Engineer\nGreater Noida, India"},
    {"page": 1, "text": "EDUCATION\nBennett University, Greater Noida, India\nSep 2023 - May 2027 (expected)\nB.Tech in Computer Science"},
    {"page": 1, "text": "PROJECTS\nClinical Pilot - Multi-Agent Clinical Decision Support (team project). Built agents that triage patient notes.\nNudge - a habit app. Code: github.com/example/Nudge"},
    {"page": 1, "text": "TECHNICAL SKILLS\nLanguages: Python, C++, TypeScript, JavaScript, HTML, CSS"},
    {"page": 1, "text": "LEADERSHIP AND ACTIVITIES\nManagement Head, NEP SAARTHI (2025-2026).\nVolunteer, KARTAVYA."},
]


@pytest.fixture()
def cv_store(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    rag._store_cache.clear()
    d = f"./vectorstores/{uuid.uuid4()}"
    # Each entry is its own chunk; join them as one page like a real one-page CV.
    rag.build_page_index([{"page": 1, "text": "\n\n".join(p["text"] for p in CV_PAGES)}], d)
    store, _ = rag.open_store(d)
    return store


def test_relevant_section_below_the_cutoff_still_reaches_the_model(cv_store):
    """The PROJECTS section scored under the relevance cut-off and used to be dropped, so the chat refused."""
    q = "What projects has he worked on?"
    llm = StubLLM("He built Clinical Pilot, a multi-agent clinical decision support system [p. 1].")
    result = rag.answer_with_citations(q, rag.retrieve(cv_store, q, k=6), llm=llm, store=cv_store)
    assert "PROJECTS" in llm.prompts[0] and "Clinical Pilot" in llm.prompts[0]
    assert result["grounded"] is True and [c["page"] for c in result["citations"]] == [1]


def test_summary_request_uses_the_whole_document(cv_store):
    q = "summarize this document"
    llm = StubLLM("- Computer science student at Bennett University [p. 1]\n- Built Clinical Pilot [p. 1]")
    result = rag.answer_with_citations(q, rag.retrieve(cv_store, q, k=6), llm=llm, store=cv_store)
    assert result["grounded"] is True
    for section in ("EDUCATION", "PROJECTS", "TECHNICAL SKILLS", "LEADERSHIP"):
        assert section in llm.prompts[0]
    assert "bullet points" in llm.prompts[0]


def test_off_topic_question_on_a_cv_still_abstains_without_the_model(cv_store):
    q = "Who won the 2018 FIFA World Cup?"
    llm = StubLLM("France [p. 1].")
    result = rag.answer_with_citations(q, rag.retrieve(cv_store, q, k=6), llm=llm, store=cv_store)
    assert result["grounded"] is False and result["citations"] == [] and llm.calls == 0


def test_summary_requests_are_recognised():
    for q in ["summarize this document", "Give me an overview", "What is this PDF about?", "key points please", "tl;dr"]:
        assert rag.is_summary_request(q), q
    for q in ["What projects has he worked on?", "Where does glycolysis happen?"]:
        assert not rag.is_summary_request(q), q
