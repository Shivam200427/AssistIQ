"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Back from "../components/Back";
import { CheckCircle, XCircle, RotateCcw, Award, Gamepad2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface AnswerOption {
  label: string;
  option: string;
}

interface Question {
  _id: string;
  questionText: string;
  answers: AnswerOption[];
  correctAnswer: string;
  choosenAnswer: string;
  explanation: string;
}

interface Quiz {
  _id: string;
  title: string;
  questions: Question[];
}

const Result = ({ id }: { id: string }) => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHosting, setIsHosting] = useState(false);
  const router = useRouter();

  const handleHostLive = async () => {
    if (!quiz) return;
    try {
      setIsHosting(true);
      const res = await axios.post("/api/livequiz/create", {
        quizId: quiz._id,
        title: quiz.title,
      });
      if (res.data?.success && res.data?.pin) {
        router.push(`/quizgenerator/arena/${res.data.pin}?role=host`);
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to start live arena: " + (err?.response?.data?.error || err.message));
    } finally {
      setIsHosting(false);
    }
  };

  useEffect(() => {
    const fetchQuizResult = async () => {
      try {
        setLoading(true);
        const res = await axios.post("/api/quiz/getquiz", { id });
        if (res.data?.quiz) {
          setQuiz(res.data.quiz);
        }
      } catch (err) {
        console.error("Result fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQuizResult();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070a12] text-[#38bdf8] font-body flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold tracking-widest font-tag">[EVALUATING TEST SCORE...]</span>
      </div>
    );
  }

  if (!quiz || !quiz.questions) {
    return (
      <div className="min-h-screen bg-[#070a12] text-white flex flex-col justify-center items-center p-8 font-body">
        <Back />
        <p className="text-sm text-gray-400">Could not retrieve quiz results.</p>
      </div>
    );
  }

  const totalQuestions = quiz.questions.length;
  const correctCount = quiz.questions.filter(
    (q) => q.choosenAnswer && q.choosenAnswer.toUpperCase() === q.correctAnswer.toUpperCase()
  ).length;
  const percentage = Math.round((correctCount / totalQuestions) * 100) || 0;

  return (
    <div className="min-h-screen bg-[#070a12] text-white font-body py-12 px-4 relative">
      <Back />

      <div className="max-w-4xl mx-auto pt-8 pb-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#38bdf8] font-tag text-xs uppercase mb-3 transform -rotate-1">
            <Award className="w-3.5 h-3.5" />
            <span>✦ ASSESSMENT RESULTS ✦</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Quiz Report: <span className="font-tag text-[#38bdf8]">{quiz.title || "Study Test"}</span>
          </h1>
        </div>

        {/* Score Circle Card */}
        <div className="rounded-3xl bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow mb-10 max-w-md mx-auto">
          <div className="bg-[#0d1527] p-8 rounded-3xl flex flex-col items-center justify-center border border-[#16243f]">
            <div className="relative w-40 h-40">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="#16243f"
                  strokeWidth="12"
                  fill="transparent"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="#0ea5e9"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - percentage / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold text-white font-body">{percentage}%</span>
                <span className="text-[11px] text-[#38bdf8] font-tag tracking-wider">ACCURACY</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mt-6 pt-4 border-t border-[#16243f] text-center">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase">CORRECT</p>
                <p className="text-2xl font-black text-[#38bdf8]">{correctCount}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase">TOTAL</p>
                <p className="text-2xl font-black text-white">{totalQuestions}</p>
              </div>
            </div>

            <button
              onClick={() => router.push("/quizgenerator")}
              className="mt-6 w-full bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-bold uppercase tracking-wider py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer font-tag shadow-[0_4px_20px_rgba(14,165,233,0.3)]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RETAKE / NEW QUIZ</span>
            </button>

            <button
              onClick={handleHostLive}
              disabled={isHosting}
              className="mt-3 w-full bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/40 text-[#38bdf8] font-bold uppercase tracking-wider py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer font-tag shadow-[0_4px_20px_rgba(14,165,233,0.2)] disabled:opacity-50"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>{isHosting ? "LAUNCHING..." : "✦ HOST MULTIPLAYER ARENA ✦"}</span>
            </button>
          </div>
        </div>

        {/* Detailed Question Review */}
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl font-extrabold text-white tracking-tight border-b border-[#16243f] pb-3">
            Question-by-Question Breakdown
          </h2>

          {quiz.questions.map((q, idx) => {
            const isCorrect = q.choosenAnswer && q.choosenAnswer.toUpperCase() === q.correctAnswer.toUpperCase();
            return (
              <div
                key={q._id || idx}
                className="rounded-3xl bg-gradient-to-br from-[#0ea5e9]/20 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow"
              >
                <div className="bg-[#0d1527] p-5 sm:p-7 rounded-3xl border border-[#16243f] flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="font-tag text-lg text-[#38bdf8]">
                        {String(idx + 1).padStart(2, "0")}.
                      </span>
                      <span className="text-sm sm:text-base font-bold text-white leading-relaxed">
                        {q.questionText}
                      </span>
                    </div>
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0ea5e9]/20 border border-[#0ea5e9]/40 text-[#38bdf8] text-xs font-bold uppercase flex-shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" /> Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold uppercase flex-shrink-0">
                        <XCircle className="w-3.5 h-3.5" /> Incorrect
                      </span>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-2">
                    {Array.isArray(q.answers) &&
                      q.answers.map((ans, aIdx) => {
                        const isThisCorrect = ans.label.toUpperCase() === q.correctAnswer.toUpperCase();
                        const isThisChosen = q.choosenAnswer && ans.label.toUpperCase() === q.choosenAnswer.toUpperCase();

                        let rowStyle = "bg-black/30 border-[#16243f] text-gray-400";
                        if (isThisCorrect) {
                          rowStyle = "bg-[#131e36] border-[#0ea5e9] text-[#38bdf8] font-semibold";
                        } else if (isThisChosen && !isThisCorrect) {
                          rowStyle = "bg-red-500/10 border-red-500/50 text-red-300";
                        }

                        return (
                          <div
                            key={aIdx}
                            className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-center justify-between ${rowStyle}`}
                          >
                            <span>
                              <strong className="mr-2 font-tag">{ans.label}.</strong>
                              {ans.option}
                            </span>
                            {isThisCorrect && (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#0ea5e9]/20 text-[#38bdf8] border border-[#0ea5e9]/30">
                                Correct Answer
                              </span>
                            )}
                            {isThisChosen && !isThisCorrect && (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                Your Selection
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="mt-2 p-3.5 rounded-2xl bg-black/40 border border-[#16243f] text-xs text-gray-300 leading-relaxed">
                      <strong className="text-[#38bdf8] font-tag mr-1">✦ EXPLANATION:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Result;
