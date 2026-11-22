"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import Quiz from '../Quiz'
import { use } from "react";
// jrnfnj
export default function QuizPage( {params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);  
  const [quiz, setQuiz] = useState<any>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      const res = await axios.post("/api/quiz/getquiz", {id});
      setQuiz(res.data.quiz);
    };
    fetchQuiz();
  }, [id]);

  if (!quiz)
    return (
      <div className="min-h-screen bg-[#070a12] text-[#38bdf8] font-body flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold tracking-widest font-tag">[LOADING QUIZ ARENA...]</span>
      </div>
    );

  return <Quiz quiz={quiz} />;
}
