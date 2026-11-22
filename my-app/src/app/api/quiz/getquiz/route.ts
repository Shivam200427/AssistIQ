import { NextRequest, NextResponse } from "next/server";
import Quiz from "../../lib/Quiz";
import { isValidObjectId } from "mongoose";
import { connectDB } from "../../utils/db";

export async function POST(req:NextRequest){
    try{
        const {id} = await req.json();
        if (typeof id !== "string" || !isValidObjectId(id)) {
            return NextResponse.json({ "message": "Invalid quiz id" }, { status: 400 });
        }
        await connectDB();
        const quiz =  await Quiz.findById(id);
        if (!quiz) {
            return NextResponse.json({ "message": "Quiz not found" }, { status: 404 });
        }
        return NextResponse.json({"quiz":quiz},{status:200});
    }catch(err:any){
        console.error("Get quiz error:", err?.message);
        return NextResponse.json({ "message": "Could not load quiz" }, { status: 500 })
    }
}
