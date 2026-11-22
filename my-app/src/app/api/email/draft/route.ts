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
                const response = await axios.post(`${backendUrl}/draftmail`, body, { timeout: 8000 });
                if (response.data?.draftmail) {
                    return NextResponse.json(response.data, { status: 200 });
                }
            } catch (bErr: any) {
                console.log("Python backend draft failed, falling back to direct Groq:", bErr?.message);
            }
        }

        // 2. Direct Groq call
        if (!getGroqKey()) {
            return NextResponse.json({ draftmail: "No AI API key configured." }, { status: 200 });
        }

        const prompt = `Write a clean and professional reply email based on the message below.
No bold, no italics, no markdown, no emojis.
Keep sentences clear, polite, and concise.
If the email requests something, acknowledge it and respond appropriately.
If the request is unclear, politely ask for clarification.

Format:
Subject: (suggest a clear subject based on context)
Message:
(Write the reply email in plain text paragraphs)

Email to Respond To:
${cleanEmailContent(body)}

Now write the reply:`;

        const draftmail = (await groqChat(prompt, { temperature: 0.5 })) || "Thank you for reaching out. We will get back to you shortly.";
        return NextResponse.json({ draftmail }, { status: 200 });

    } catch (err: any) {
        console.error("Email draft route error:", err?.message);
        return NextResponse.json({ message: "Email draft generation failed." }, { status: 500 });
    }
}
