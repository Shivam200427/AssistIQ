"use client";

import { usePlanly } from "./store";
import { addDays, dayKey } from "./utils";

export interface RevisionInput {
  quizId: string;
  quizTitle: string;
  weakTopics: string[];
  nextReviewDays: number;
  documentId?: string | null;
}

/**
 * Turns a quiz result into Study Planner tasks:
 *  - "Revise: <topic>" for each weak topic, due tomorrow (linking back to the source PDF when there is one);
 *  - one spaced "Re-quiz: <quiz>" task, due after the review interval, linking to the quiz.
 * Open tasks that already exist for the same quiz are not duplicated.
 */
export function addRevisionPlan(input: RevisionInput) {
  const st = usePlanly.getState();
  const quizLink = `/quizgenerator/${input.quizId}`;
  const sourceLink = input.documentId ? `/pdfNotesExtractor?doc=${input.documentId}` : quizLink;
  const open = st.tasks.filter((t) => t.status !== "done");
  const exists = (title: string) => open.some((t) => t.title === title);

  let assignmentId = st.assignments.find((a) => a.name === input.quizTitle)?.id || null;
  if (!assignmentId) assignmentId = st.addAssignment({ name: input.quizTitle.slice(0, 60), category: "Quiz revision", color: "#38bdf8" });

  const today = new Date();
  let added = 0;
  for (const topic of input.weakTopics.slice(0, 6)) {
    const title = `Revise: ${topic}`;
    if (exists(title)) continue;
    st.addTask({
      title,
      notes: `You missed questions on “${topic}” in ${input.quizTitle}.${input.documentId ? " Ask your PDF chat about it — answers cite the pages." : ""}`,
      assignmentId,
      due: dayKey(addDays(today, 1)),
      difficulty: "medium",
      tags: ["revision"],
      link: sourceLink,
    });
    added++;
  }
  const requiz = `Re-quiz: ${input.quizTitle}`;
  // Replace an older open re-quiz task for this quiz with the newly scheduled one.
  for (const t of open) if (t.title === requiz) st.deleteTask(t.id);
  st.addTask({
    title: requiz,
    notes: `Spaced review: retake the quiz to lock it in (scheduled ${input.nextReviewDays} day${input.nextReviewDays === 1 ? "" : "s"} out).`,
    assignmentId,
    due: dayKey(addDays(today, input.nextReviewDays)),
    difficulty: "easy",
    tags: ["re-quiz"],
    link: quizLink,
  });
  return { added: added + 1 };
}
