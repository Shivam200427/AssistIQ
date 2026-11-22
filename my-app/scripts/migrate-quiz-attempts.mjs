/**
 * Migration: move answers stored on shared Quiz documents (questions[].choosenAnswer) into
 * archived, owner-less QuizAttempt records, then remove them from the quiz.
 *
 * - Back up first:  mongodump --uri "$MONGO_URL" --out <folder outside the repo>
 * - Dry run:        node scripts/migrate-quiz-attempts.mjs --dry-run
 * - Apply:          node scripts/migrate-quiz-attempts.mjs
 *
 * Safe to run more than once: a quiz that already has a legacy attempt is skipped, and answers are
 * only removed from a quiz after its legacy attempt has been written and read back.
 * Legacy attempts have ownerId: null, so no student can read them — they are kept, not deleted.
 */
import { MongoClient } from "mongodb";

export async function migrateQuizAttempts(db, { dryRun = false, log = console.log } = {}) {
  const quizzes = db.collection("quizzes");
  const attempts = db.collection("quizattempts");
  const report = { scanned: 0, withAnswers: 0, migrated: 0, skippedExisting: 0, cleared: 0 };

  // $elemMatch + $exists: only questions that really have a saved answer ("$nin" alone also matches a missing field).
  const cursor = quizzes.find({ questions: { $elemMatch: { choosenAnswer: { $exists: true, $type: "string", $ne: "" } } } });
  for await (const quiz of cursor) {
    const answers = {};
    let score = 0;
    for (const q of quiz.questions || []) {
      if (q.choosenAnswer) {
        answers[String(q._id)] = String(q.choosenAnswer).toUpperCase();
        if (q.correctAnswer && String(q.correctAnswer).toUpperCase() === answers[String(q._id)]) score++;
      }
    }
    if (Object.keys(answers).length === 0) continue;
    report.withAnswers++;

    const existing = await attempts.findOne({ quizId: quiz._id, legacy: true });
    if (existing) {
      report.skippedExisting++;
    } else if (!dryRun) {
      const now = new Date();
      const { insertedId } = await attempts.insertOne({
        quizId: quiz._id,
        ownerId: null,
        status: "legacy",
        legacy: true,
        answers,
        score,
        total: (quiz.questions || []).length,
        submittedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      const check = await attempts.findOne({ _id: insertedId });
      if (!check || Object.keys(check.answers || {}).length !== Object.keys(answers).length) {
        throw new Error(`Verification failed for quiz ${quiz._id}; nothing was removed from it.`);
      }
      report.migrated++;
    } else {
      report.migrated++;
    }

    if (!dryRun) {
      await quizzes.updateOne({ _id: quiz._id }, { $unset: { "questions.$[].choosenAnswer": "" } });
      report.cleared++;
    }
    log(`${dryRun ? "[dry run] " : ""}quiz ${quiz._id}: ${Object.keys(answers).length} saved answer(s)`);
  }
  report.scanned = await quizzes.countDocuments();
  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("migrate-quiz-attempts.mjs")) {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.error("Set MONGO_URL first.");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const report = await migrateQuizAttempts(client.db(), { dryRun });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.close();
  }
}
