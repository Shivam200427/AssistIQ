import os
import requests
from requests.adapters import HTTPAdapter
import env_config  # noqa: F401  (loads .env before other modules read it)
from redis_cache import build_cache_key, get_json, set_json

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

GROQ_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
]

DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL") or "liquid/lfm-3-1.7b:free"
FALLBACK_MODELS = [
    "liquid/lfm-3-1.7b:free",
    "particle-ai/particle-1:free",
    "nvidia/nemotron-3.5-lightning:free",
    "inclusionai/ling-3.2-flash:free",
    "google/gemma-4-26b-a4b-it:free",
]


def _build_session():
    """Create a fresh requests.Session with minimal retry overhead."""
    session = requests.Session()
    adapter = HTTPAdapter(
        max_retries=1,
        pool_connections=2,
        pool_maxsize=2,
        pool_block=False,
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


HTTP_SESSION = _build_session()


def _stringify_content(content):
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts).strip()

    return str(content).strip()


def _try_groq(messages, temperature=0.7, timeout=15):
    global HTTP_SESSION
    groq_key = os.getenv("GROQ_API_KEY") or os.getenv("Next_GROP_API_KEY") or os.getenv("GROP_API_KEY")
    if not groq_key:
        return None

    for model_name in GROQ_MODELS:
        cache_key = build_cache_key(
            "groq:chat",
            {
                "messages": messages,
                "temperature": temperature,
                "model": model_name,
            },
        )
        cached_response = get_json(cache_key)
        if isinstance(cached_response, str):
            return cached_response

        try:
            resp = HTTP_SESSION.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "messages": messages,
                    "temperature": temperature,
                },
                timeout=timeout,
            )
            if resp.status_code == 200:
                payload = resp.json()
                choices = payload.get("choices") or []
                if choices:
                    content = _stringify_content(choices[0].get("message", {}).get("content", ""))
                    if content:
                        set_json(cache_key, content)
                        return content
            else:
                print(f"Groq {model_name} returned {resp.status_code}: {resp.text[:100]}", flush=True)
        except Exception as exc:
            print(f"Groq {model_name} error ({exc}). Retrying next model...", flush=True)
            continue
    return None


def chat_completion(messages, temperature=0.7, model=None, timeout=15):
    global HTTP_SESSION

    # 1. Try Groq first for lightning-fast latency and reliability
    groq_content = _try_groq(messages, temperature=temperature, timeout=timeout)
    if groq_content:
        return groq_content

    # 2. Fall back to OpenRouter
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("No LLM provider available (GROQ_API_KEY or OPENROUTER_API_KEY).")

    resolved_model = model or os.getenv("OPENROUTER_MODEL") or DEFAULT_MODEL
    candidate_models = [resolved_model] + [m for m in FALLBACK_MODELS if m != resolved_model]
    candidate_models = candidate_models[:3]

    last_error = None
    for attempt_idx, target_model in enumerate(candidate_models):
        cache_key = build_cache_key(
            "openrouter:chat",
            {
                "messages": messages,
                "temperature": temperature,
                "model": target_model,
            },
        )
        cached_response = get_json(cache_key)
        if isinstance(cached_response, str):
            return cached_response

        try:
            response = HTTP_SESSION.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": target_model,
                    "messages": messages,
                    "temperature": temperature,
                },
                timeout=timeout,
            )

            response.raise_for_status()

            payload = response.json()
            choices = payload.get("choices") or []
            if not choices:
                raise RuntimeError("OpenRouter returned no choices.")

            message = choices[0].get("message", {})
            content = _stringify_content(message.get("content", ""))
            set_json(cache_key, content)
            return content

        except (requests.exceptions.ConnectionError, ConnectionResetError, requests.exceptions.Timeout) as exc:
            last_error = exc
            print(f"Model {target_model} connection/timeout ({exc}). Retrying next model...", flush=True)
            try:
                HTTP_SESSION.close()
            except Exception:
                pass
            HTTP_SESSION = _build_session()
            continue

        except Exception as exc:
            last_error = exc
            print(f"Model {target_model} failed ({exc}). Retrying next model...", flush=True)
            continue

    raise RuntimeError(f"All LLM candidate models failed. Last error: {last_error}")


def prompt_completion(prompt, temperature=0.7, model=None, system_prompt=None, timeout=20):
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    return chat_completion(messages, temperature=temperature, model=model, timeout=timeout)
