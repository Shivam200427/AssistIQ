import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import { cleanEmailContent, getGroqKey, getRemoteBackendUrl, groqChat } from "../../utils/ai";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // 1. Try Python backend if it is deployed remotely
        const backendUrl = getRemoteBackendUrl();
        if (backendUrl) {
            try {
                const response = await axios.post(`${backendUrl}/summarize_email`, body, { timeout: 8000 });
                if (response.data?.summary) {
                    return NextResponse.json(response.data, { status: 200 });
                }
            } catch (bErr: any) {
                console.log("Python backend summarize failed, falling back to direct Groq:", bErr?.message);
            }
        }

        // 2. Direct Groq call
        if (!getGroqKey()) {
            return NextResponse.json({ summary: "No AI API key found. Please check your Next_GROP_API_KEY configuration." }, { status: 200 });
        }

        const prompt = `Summarize the email in simple clear bullet points. Do not use any bold, italic, or special formatting.
Do not add explanations. Keep it short and readable.

Format:
- Main purpose of the email
- Important details
- Any action required (or write: No action required)

Email Content:
${cleanEmailContent(body)}`;

        const summary = (await groqChat(prompt, { temperature: 0.3 })) || "No summary could be generated.";
        return NextResponse.json({ summary }, { status: 200 });

    } catch (err: any) {
        console.error("Email summarize route error:", err?.message);
        return NextResponse.json({ message: "Email summarization failed." }, { status: 500 });
    }
}
