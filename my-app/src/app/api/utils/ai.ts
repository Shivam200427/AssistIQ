import axios from "axios";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Tried in order; Groq retires models over time, so a 404/400 just moves on to the next one.
// Set GROQ_MODEL in .env to put a preferred model first.
const GROQ_MODELS = [process.env.GROQ_MODEL, "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"].filter(
  (m, i, all): m is string => Boolean(m) && all.indexOf(m) === i
);

export function getGroqKey(): string | undefined {
  return process.env.Next_GROP_API_KEY || process.env.GROQ_API_KEY;
}

/**
 * The Python backend is only used when it is deployed somewhere other than this machine;
 * locally the Next.js routes call Groq directly for lower latency.
 */
export function getRemoteBackendUrl(): string | null {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl || backendUrl.includes("127.0.0.1") || backendUrl.includes("localhost")) return null;
  return backendUrl;
}

export async function groqChat(
  prompt: string,
  options: { temperature?: number; json?: boolean; timeout?: number } = {}
): Promise<string> {
  const groqKey = getGroqKey();
  if (!groqKey) throw new Error("No AI API key configured.");

  let lastError: unknown = null;
  for (const model of GROQ_MODELS) {
    try {
      const res = await axios.post(
        GROQ_URL,
        {
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: options.temperature ?? 0.5,
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          timeout: options.timeout ?? 30000,
        }
      );
      const content = res.data?.choices?.[0]?.message?.content || "";
      if (content.trim()) return content;
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;
      // Auth errors won't be fixed by another model.
      if (status === 401 || status === 403) throw err;
      console.log(`Groq model ${model} failed (${status || err?.message}), trying next model...`);
    }
  }
  if (lastError) throw lastError;
  return "";
}

export function cleanEmailContent(data: any): string {
  const selected = data?.SelectedEmail || data;
  let content = "";
  if (typeof selected === "object" && selected !== null) {
    if (selected.body?.content) content = selected.body.content;
    else if (selected.bodyPreview) content = selected.bodyPreview;
    else content = JSON.stringify(selected);
  } else {
    content = String(selected);
  }
  // Strip HTML tags
  content = content.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  content = content.replace(/<[^>]+>/g, " ");
  content = content.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return content.replace(/\s+/g, " ").trim().slice(0, 4000);
}
