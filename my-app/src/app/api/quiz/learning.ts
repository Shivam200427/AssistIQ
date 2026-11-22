/**
 * The learning loop after a quiz: weak topics -> revision -> spaced re-quiz.
 * Everything here is computed from ONE student's own attempts.
 */

export interface TopicStat {
  topic: string;
  correct: number;
  total: number;
  accuracy: number; // 0..1
  weak: boolean;
}

export const WEAK_BELOW = 0.7;
/** Days until the next re-quiz, by how many times the quiz has been passed. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

function isCorrect(q: any, chosen: string | undefined) {
  return !!chosen && !!q.correctAnswer && chosen.toUpperCase() === String(q.correctAnswer).toUpperCase();
}

export function topicStats(quiz: any, answers: Record<string, string>): TopicStat[] {
  const by = new Map<string, { correct: number; total: number }>();
  for (const q of quiz.questions || []) {
    const topic = (q.topic || quiz.title || "General").trim();
    const s = by.get(topic) || { correct: 0, total: 0 };
    s.total++;
    if (isCorrect(q, answers[String(q._id)])) s.correct++;
    by.set(topic, s);
  }
  return [...by.entries()]
    .map(([topic, s]) => ({ topic, ...s, accuracy: s.total ? s.correct / s.total : 0, weak: s.total > 0 && s.correct / s.total < WEAK_BELOW }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

/**
 * Spaced re-quiz: a strong score moves to a longer interval, a weak score resets to tomorrow.
 * `passes` = how many earlier submitted attempts scored >= 80%.
 */
export function nextReviewDays(scorePct: number, passes: number): number {
  if (scorePct < 0.6) return REVIEW_INTERVALS[0];
  const step = scorePct >= 0.8 ? passes + 1 : passes;
  return REVIEW_INTERVALS[Math.min(Math.max(step, 0), REVIEW_INTERVALS.length - 1)];
}

export function mistakesOf(quiz: any, answers: Record<string, string>) {
  return (quiz.questions || [])
    .filter((q: any) => !isCorrect(q, answers[String(q._id)]))
    .map((q: any) => ({
      questionId: String(q._id),
      questionText: q.questionText,
      topic: q.topic || "",
      yourAnswer: answers[String(q._id)] || "",
      correctAnswer: q.correctAnswer,
      answers: (q.answers || []).map((a: any) => ({ label: a.label, option: a.option })),
      explanation: q.explanation || "",
    }));
}
