import { NextResponse, NextRequest } from "next/server";
import Quiz from "../../lib/Quiz";
import { isValidObjectId, Types } from "mongoose";
import { connectDB } from "../../utils/db";

export async function POST(req: NextRequest) {
    try {
        const { quizid, questionId, choosenAnswer } = await req.json();
        if (typeof quizid !== "string" || typeof questionId !== "string" || !isValidObjectId(quizid) || !isValidObjectId(questionId)) {
            return NextResponse.json({ "message": "Invalid quiz or question id" }, { status: 400 });
        }
        if (typeof choosenAnswer !== "string" || choosenAnswer.length > 10) {
            return NextResponse.json({ "message": "Invalid answer" }, { status: 400 });
        }
        await connectDB();
        const res  = await Quiz.updateOne(
            { _id: new Types.ObjectId(quizid), "questions._id": new Types.ObjectId(questionId) },
            { $set: { "questions.$.choosenAnswer": choosenAnswer } }
        )

        return NextResponse.json({ "message": res}, { status: 200 });

    } catch (err: any) {
        console.error("Select option error:", err?.message);
        return NextResponse.json({ "message": "Could not save answer" }, { status: 500 })

    }
}