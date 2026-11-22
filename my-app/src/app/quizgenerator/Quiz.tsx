"use client";
import axios from "axios";
import React, { useEffect, useState } from "react";
import Result from "./Result";
import Back from "../components/Back";
import { CheckCircle2, Paintbrush, Gamepad2 } from "lucide-react";
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
  createdAt: string;
  questions: Question[];
  s3PdfKey: string;
  title: string;
  updatedAt: string;
  userId: string;
  _id: string;
}

const Quiz = ({ quiz }: { quiz: Quiz }) => {
  const router = useRouter();
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: string }>({});
  const [quizid, setquizid] = useState<string>();
  const [submitquiz, setsubmitquiz] = useState(false);
  const [isHosting, setIsHosting] = useState(false);

  useEffect(() => {
    if (quiz) {
      setquizid(quiz._id);
    }
  }, [quiz]);

  const handleHostQuiz = async () => {
    try {
      setIsHosting(true);
      const res = await axios.post("/api/livequiz/create", {
        quizId: quiz._id,
        title: quiz.title,
      });
      if (res.data?.success && res.data?.pin) {
        localStorage.setItem(`livequiz_host_token_${res.data.pin}`, res.data.hostToken);
        router.push(`/quizgenerator/arena/${res.data.pin}?role=host`);
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to start live arena: " + (err?.response?.data?.error || err.message));
    } finally {
      setIsHosting(false);
    }
  };

  const handleChange = async (questionId: string, choosenAnswer: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [questionId]: choosenAnswer,
    }));

    try {
      await axios.post('/api/quiz/selectoption', { questionId, quizid, choosenAnswer });
    } catch (err) {
      console.error("Option select error:", err);
    }
  };

  if (submitquiz) {
    return <Result id={quiz._id} />;
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#070a12] w-full flex flex-col justify-center items-center p-8 text-center text-white font-body">
        <Back />
        <div className="bg-[#0d1527] p-8 rounded-3xl max-w-md border border-red-500/40 flex flex-col items-center gap-4 card-spray-shadow">
          <h2 className="text-xl font-black text-red-400 uppercase font-tag">NO QUESTIONS FOUND</h2>
          <p className="text-gray-300 text-xs leading-relaxed">
            We couldn't generate questions from the provided input. Please try with a clearer topic prompt or attach a PDF.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] hover:from-[#7dd3fc] hover:to-[#38bdf8] px-6 py-2.5 rounded-xl text-[#070a12] font-bold uppercase tracking-wider text-xs cursor-pointer font-tag"
          >
            TRY AGAIN // RESET
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(selectedOptions).length;

  return (
    <div className="min-h-screen bg-[#070a12] text-white font-body py-12 px-4 relative">
      <Back />

      <div className="max-w-4xl mx-auto pt-8 pb-4">
        {/* Quiz Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#16243f] mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#38bdf8] font-tag text-xs uppercase mb-2 transform -rotate-1">
              <Paintbrush className="w-3.5 h-3.5" />
              <span>✦ ACTIVE TEST ARENA ✦</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {quiz.title || "Interactive Assessment"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleHostQuiz}
              disabled={isHosting}
              className="bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-black uppercase tracking-wider px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer font-tag shadow-[0_0_15px_rgba(14,165,233,0.4)] disabled:opacity-50"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>{isHosting ? "LAUNCHING..." : "✦ HOST LIVE ARENA ✦"}</span>
            </button>

            <div className="flex items-center gap-3 bg-[#0d1527] border border-[#16243f] px-4 py-2.5 rounded-xl text-xs font-tag">
              <span className="text-gray-400">PROGRESS:</span>
              <span className="text-[#38bdf8] font-bold text-sm">
                {answeredCount} / {quiz.questions.length} answered
              </span>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="flex flex-col gap-6">
          {quiz.questions.map((ques, qIdx) => {
            const currentSelected = selectedOptions[ques._id];
            return (
              <div
                key={ques._id || qIdx}
                className="rounded-3xl bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow"
              >
                <div className="flex flex-col gap-4 p-5 sm:p-7 bg-[#0d1527] rounded-3xl border border-[#16243f]">
                  <div className="flex items-start gap-3 text-base sm:text-lg font-bold text-white leading-snug">
                    <span className="font-tag text-[#38bdf8] text-xl sm:text-2xl">
                      {String(qIdx + 1).padStart(2, "0")}.
                    </span>
                    <span>{ques.questionText || (ques as any).question}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 mt-2">
                    {Array.isArray(ques.answers) &&
                      ques.answers.map((opt, idx) => {
                        const isChosen = currentSelected === opt.label;
                        return (
                          <label
                            key={idx}
                            className={`flex items-center gap-3.5 cursor-pointer p-4 rounded-2xl border transition-all ${
                              isChosen
                                ? "bg-[#131e36] border-[#38bdf8] text-white shadow-[0_0_18px_rgba(14,165,233,0.3)]"
                                : "bg-black/40 border-[#16243f] hover:border-[#0ea5e9]/50 text-gray-300 hover:bg-[#11192e]"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${ques._id || qIdx}`}
                              value={opt.label}
                              checked={isChosen}
                              onChange={() => handleChange(ques._id, opt.label)}
                              className="w-4 h-4 accent-[#0ea5e9] cursor-pointer"
                            />
                            <span className="text-xs sm:text-sm font-medium leading-relaxed">
                              <strong className="text-[#38bdf8] mr-1.5 font-tag">{opt.label}.</strong>{" "}
                              {opt.option || (opt as any).text}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Action Bar */}
        <div className="mt-10 flex justify-center sticky bottom-6 z-40">
          <button
            onClick={() => setsubmitquiz(true)}
            className="w-full sm:w-auto min-w-[280px] bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-extrabold uppercase tracking-wider py-4 px-10 rounded-2xl shadow-[0_4px_30px_rgba(14,165,233,0.45)] text-sm sm:text-base transition-all duration-200 cursor-pointer flex items-center justify-center gap-3 font-tag"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>SUBMIT ASSESSMENT // GET SCORE</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Quiz;
