/**
 * Turns raw AI output into quiz questions, keeping only questions that are actually usable:
 * a real question stem, at least two distinct non-empty options, and an answer key that matches
 * one of the options. Nothing is guessed — an unknown answer key is never defaulted to "A".
 */

export interface CleanQuestion {
  questionText: string;
  answers: { label: string; option: string }[];
  correctAnswer: string;
  explanation: string;
  topic: string;
}

export interface ValidationResult {
  questions: CleanQuestion[];
  dropped: { index: number; reason: string }[];
}

const LABELS = ["A", "B", "C", "D", "E", "F"];

export function extractQuestionList(raw: any): any[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/) || raw.match(/\{[\s\S]*\}/);
      if (!match) return [];
      try {
        raw = JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
  }
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.questions)) return raw.questions;
    if (raw.questions && typeof raw.questions === "object") return extractQuestionList(raw.questions);
    if (Array.isArray(raw.data)) return raw.data;
  }
  return [];
}

function optionText(ans: any): string {
  if (typeof ans === "string") return ans.replace(/^\s*[A-F][.):\-]\s*/i, "").trim();
  if (ans && typeof ans === "object") return String(ans.option ?? ans.text ?? ans.value ?? "").trim();
  return "";
}

/** Resolves the answer key to one of the final labels, or null if it can't be matched. */
function resolveKey(item: any, rawAnswers: any[], options: string[]): string | null {
  const key = item?.correctAnswer ?? item?.answer ?? item?.correct ?? item?.correct_option;
  if (key === undefined || key === null || String(key).trim() === "") return null;
  const k = String(key).trim();

  // A letter like "B" / "b)" / "Option B"
  const letter = k.match(/^(?:option\s*)?([A-F])\s*[.):]?$/i);
  if (letter) {
    // The letter refers to the label the model gave that option, which may not be positional.
    const idx = rawAnswers.findIndex((a) => a && typeof a === "object" && String(a.label ?? a.key ?? "").toUpperCase() === letter[1].toUpperCase());
    const pos = idx !== -1 ? idx : LABELS.indexOf(letter[1].toUpperCase());
    return pos >= 0 && pos < options.length ? LABELS[pos] : null;
  }
  // A number (0- or 1-based index is ambiguous) is not trusted.
  if (/^\d+$/.test(k)) return null;
  // The full answer text
  const pos = options.findIndex((o) => o.toLowerCase() === k.toLowerCase());
  return pos >= 0 ? LABELS[pos] : null;
}

export function validateQuestions(rawList: any[], limit = 50): ValidationResult {
  const questions: CleanQuestion[] = [];
  const dropped: { index: number; reason: string }[] = [];

  rawList.forEach((item, index) => {
    if (!item || typeof item !== "object") return dropped.push({ index, reason: "not an object" });
    const stem = String(item.questionText ?? item.question ?? "").trim();
    if (stem.length < 5) return dropped.push({ index, reason: "missing question text" });

    const rawAnswers: any[] = Array.isArray(item.answers) ? item.answers : Array.isArray(item.options) ? item.options : Array.isArray(item.choices) ? item.choices : [];
    const options = rawAnswers.map(optionText);
    if (options.length < 2 || options.length > LABELS.length) return dropped.push({ index, reason: "needs 2-6 options" });
    if (options.some((o) => !o)) return dropped.push({ index, reason: "empty option" });
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return dropped.push({ index, reason: "duplicate options" });

    const correct = resolveKey(item, rawAnswers, options);
    if (!correct) return dropped.push({ index, reason: "missing or invalid answer key" });

    questions.push({
      questionText: stem.slice(0, 1000),
      answers: options.map((option, i) => ({ label: LABELS[i], option: option.slice(0, 500) })),
      correctAnswer: correct,
      explanation: String(item.explanation ?? "").trim().slice(0, 2000),
      topic: String(item.topic ?? item.concept ?? "").trim().slice(0, 60),
    });
  });

  return { questions: questions.slice(0, limit), dropped };
}
