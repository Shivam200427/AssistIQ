from dotenv import load_dotenv
from prompts import quizquestion_prompt
import threading
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from openrouter_client import prompt_completion


load_dotenv()
_embedding_lock = threading.Lock()
_embedding_model = None


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

def generate_question(prompt, content):
    final_prompt = quizquestion_prompt.format(prompt=prompt, content=content)
    return prompt_completion(final_prompt, temperature=0.4, timeout=180)
