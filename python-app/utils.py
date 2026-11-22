from dotenv import load_dotenv
from chromadb.config import Settings
from prompts import quizquestion_prompt
from langchain_community.document_loaders import  PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import gc
import chromadb
import os
import threading
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from langchain_chroma import Chroma
from openrouter_client import prompt_completion


load_dotenv()
_embedding_lock = threading.Lock()
_embedding_model = None
_retriever_cache = {}


class OnnxEmbeddings:
    """all-MiniLM-L6-v2 via ChromaDB's bundled ONNX runtime.

    Produces the same vectors as the sentence-transformers model, without needing torch,
    so existing vector stores stay compatible and memory use stays small enough for Render.
    """

    def __init__(self):
        self.fn = DefaultEmbeddingFunction()

    def embed_documents(self, texts):
        return [vector.tolist() for vector in self.fn(list(texts))]

    def embed_query(self, text):
        return self.fn([text])[0].tolist()


def get_embedding_model():
    global _embedding_model

    if _embedding_model is not None:
        return _embedding_model

    with _embedding_lock:
        if _embedding_model is None:
            _embedding_model = OnnxEmbeddings()

    return _embedding_model

def process_pdf_rag(path, persist_dir):
    loader = PyPDFLoader(path, mode="single")
    docs = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    chunks = text_splitter.split_documents(docs)

    embedding = get_embedding_model()

    client = chromadb.PersistentClient(
        path=persist_dir,
        settings=Settings(anonymized_telemetry=False)
    )

    vector_store = Chroma(
        client=client,
        collection_name="pdf_store",
        embedding_function=embedding,
        persist_directory=persist_dir
    )

    vector_store.add_documents(chunks)  

    del vector_store
    del client
    gc.collect()

    return "ok"


def load_vector_store(persist_dir):
    cached_retriever = _retriever_cache.get(persist_dir)
    if cached_retriever is not None:
        return cached_retriever

    if not os.path.exists(persist_dir) or not os.listdir(persist_dir):
        base = os.path.basename(persist_dir.rstrip("/\\"))
        s3_key = f"vectorstores/{base}.zip"
        bucket = os.getenv("AWS_S3_BUCKET")
        from helpers import download_and_extract_vectorstore
        try:
            extracted_dir = download_and_extract_vectorstore(f"s3://{bucket}/{s3_key}", bucket)
            persist_dir = extracted_dir
        except Exception as e:
            print(f"Could not restore vectorstore from S3 ({s3_key}): {e}")

    embedding = get_embedding_model()

    client = chromadb.PersistentClient(
        path=persist_dir,
        settings=Settings(anonymized_telemetry=False)
    )

    vector_store = Chroma(
        client=client,
        collection_name="pdf_store",
        embedding_function=embedding,
        persist_directory=persist_dir
    )

    retriever = vector_store.as_retriever()
    _retriever_cache[persist_dir] = retriever
    return retriever

def generate_question(prompt, content):
    final_prompt = quizquestion_prompt.format(prompt=prompt, content=content)
    return prompt_completion(final_prompt, temperature=0.4, timeout=180)
