# AssistIQ

**AssistIQ is an AI study assistant.** It summarizes your Outlook inbox, turns any PDF into structured notes you can chat with, generates quizzes you can take on your own or play live with a whole class, and gives you **Planly** — a study dashboard with timers, tasks, a calendar, analytics, notes, habits and focus sounds.

| | Link |
|---|---|
| 🌐 **App** | https://assistiq-two.vercel.app |
| ⚙️ **Backend health check** | https://assistiq-backend-idbq.onrender.com/health |
| 📦 **Repository** | https://github.com/Shivam200427/AssistIQ |

> The backend runs on Render's free plan and sleeps after 15 minutes without traffic. The first PDF action after a break can take about a minute while it wakes up. After that, responses are fast.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [API reference](#api-reference)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

---

## Features

### 📧 Email Summarizer — `/EmailSummarizer`
- Sign in with a Microsoft / Outlook account. The app reads your 50 most recent emails through Microsoft Graph.
- For the selected email, AssistIQ gives you:
  - a **bullet-point summary**: the purpose, key details and any action needed
  - a **suggested reply**, which you can edit and copy
  - the **dates, deadlines and meetings** mentioned in it
- Filter the inbox by keywords.
- **Demo inbox:** try every feature without signing in.

### 📄 PDF Notes Extractor — `/pdfNotesExtractor`
- Upload a typed or scanned PDF of up to 4 MB (Vercel accepts request bodies up to 4.5 MB). Scanned pages are read with Tesseract OCR.
- AssistIQ writes **long-form study notes** and opens them as a new PDF next to a study panel:
  - **Chat with PDF:** ask questions and get answers grounded in the document (RAG)
  - **Short notes:** a quick bullet digest
  - **Project ideas:** practical projects based on the content
  - **Quiz topics:** one click turns a topic into a quiz
  - **Concept map:** an interactive graph of the key ideas and how they relate

### 📝 Quiz Generator — `/quizgenerator`
- Creates multiple-choice questions from a **topic** or from an **uploaded PDF**. PDF quizzes only use what's in the document.
- Pick your answers, submit, and see your score with an explanation for each question.

### 🗓️ Planly — `/planly`
A study dashboard with nine tabs. Everything is saved in your browser on every change, works offline, and can be installed as an app.

| Area | What you get |
|---|---|
| **Timers** | Pomodoro with custom focus/break lengths and long breaks, a study stopwatch that tracks time per subject, and a countdown (to a duration or a clock time). **Timer sync** links timers so starting one starts the others. Sound alerts and **desktop notifications** fire even when the tab is in the background, and the tab title shows the time left. |
| **Tasks** | Drag-and-drop **kanban** (To do / In progress / Done — mouse, touch and keyboard) with pinning, sorting, difficulty levels, **tags** and **due dates**. **Assignments** group tasks by project or course with progress bars. **AI task creation** turns a goal like “prepare for my OS mid-sem on Friday” into dated tasks. |
| **Calendar** | Month, week and day views showing tasks and focus sessions together. **Google Calendar export** downloads an `.ics` file (Google Calendar → Settings → Import), plus per-task “Add to Google Calendar” links. |
| **Analytics** | Focus time, pomodoros, sessions and tasks per day, when you study by hour, and focus by subject — with a 7/14/30/90-day range and a data-table view. **Streaks** and a consistency heatmap, plus **shareable streak cards**: a branded PNG you can download or share to Discord, WhatsApp and more. |
| **Notes** | Rich-text **Markdown notes** (TipTap): type `# `, `- `, `[] `, `**bold**`, `> ` and it formats live. Search, auto-titles, and `.md` download. |
| **Habits** | Daily habit tracker with a weekly check-in grid, per-habit streaks and a 12-week history. |
| **Sounds** | **Ambient noise generator**: brown, pink and white noise, rain, ocean waves, wind, fireplace and stream — all synthesised in the browser with Tone.js (no audio files), each with its own volume. Save and load **presets**. |
| **Scratchpad** | A zero-friction notepad on the Timers page. Start a line with `[] ` (or tap the box) to make it a checklist item. Saved on every keystroke. |
| **Settings** | **Dark/light mode**, a custom **accent colour**, Pomodoro intervals, and **data export** as JSON (backup/restore), CSV (tasks, sessions, habits) or a PDF report. |

**Offline / install:** Planly is a PWA. After one visit it opens without a connection (only AI task creation needs the internet), and browsers offer **Install app**.

### 🎮 Live Quiz Arena — `/quizgenerator/arena/[pin]`
- **Host:** click **Host Live Arena** on the quiz generator, or on any generated quiz. You get a 6-digit PIN and a QR code. In the lobby you can add, edit or delete questions, then start the game and move through the questions.
- **Players:** open `/quizgenerator/join` and enter the PIN and a nickname.
- **Scoring:** a correct answer earns 50–100% of the question's points depending on speed, plus a streak bonus.
- **Live leaderboard:** shows the answer split for each question, then a final podium. The host can export results as CSV and view past games.

---

## How it works

```text
                     ┌──────────────────────────────────────────────┐
  Browser ─────────▶ │  Next.js app  (my-app · Vercel)              │
     │               │  • pages / UI                                │
     │               │  • API routes: auth, email, quiz, live quiz, │
     │               │    PDF upload                                │
     │               └───────┬───────────┬───────────┬──────────────┘
     │                       │           │           │
     │                  MongoDB       AWS S3       Groq LLM
     │             (quizzes, docs,   (uploaded   (summaries, drafts,
     │               live games)      PDFs)       topic quizzes)
     │                       │           ▲
     │                       ▼           │
     │               ┌───────────────────┴──────────────────────────┐
     └─────────────▶ │  Flask backend  (python-app · Render)        │
       (PDF chat,    │  • PDF text extraction (PyMuPDF + Tesseract) │
     concept map)    │  • notes generation → PDF → S3               │
                     │  • ChromaDB vector store per document,       │
                     │    backed up to S3 as a zip                  │
                     │  • LLM: Groq, falls back to OpenRouter       │
                     └──────────────────────────────────────────────┘
```

**PDF pipeline:**
1. The browser uploads the PDF to `/api/uploadpdf`.
2. The Next.js route checks the file and stores it in S3.
3. The Flask backend extracts the text and uses OCR on pages without a text layer.
4. The LLM writes study notes, which are rendered to a new PDF and stored in S3.
5. The notes are split into chunks and embedded, and the vector store is zipped to S3.
6. The study panel queries that vector store for chat, short notes, project ideas, quiz topics and the concept map.

**Live quiz:**
- MongoDB is the single source of truth. Every change is one atomic, conditional update, so games stay consistent across Vercel's serverless instances, and simultaneous answers are never lost or counted twice.
- Each screen refreshes the game state every 2 seconds. A live push stream (SSE) speeds this up when it's available.

---

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Framer Motion, React Flow, react-pdf-viewer, lucide-react |
| Planly | Zustand (persisted state), dnd-kit (kanban), Recharts (charts), TipTap (notes), Tone.js (sound synthesis), jsPDF (reports), a service worker + web manifest (PWA) |
| Frontend API | Next.js route handlers, Mongoose, AWS SDK v3, axios |
| Backend | Flask, gunicorn, PyMuPDF, pypdf, Tesseract (pytesseract), fpdf |
| AI / RAG | Groq (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`), OpenRouter fallback, LangChain, ChromaDB, all-MiniLM-L6-v2 embeddings (ONNX, no torch needed) |
| Data | MongoDB Atlas, AWS S3, optional Redis cache for LLM responses |
| Hosting | Vercel (frontend), Render with Docker (backend) |

---

## Project structure

```text
.
├── my-app/                         # Next.js frontend + API routes (deployed to Vercel)
│   ├── public/                     # feature card images, Planly icons, manifest.webmanifest, sw.js
│   └── src/
│       ├── app/
│       │   ├── home/               # landing page
│       │   ├── EmailSummarizer/    # Outlook inbox + AI panel
│       │   ├── pdfNotesExtractor/  # PDF upload → study viewer
│       │   ├── planly/             # Planly dashboard: PlanlyApp.tsx, components/, lib/ (store, timers, sounds, utils)
│       │   ├── quizgenerator/      # quiz creation, quiz page, results
│       │   │   ├── [id]/           # take a quiz
│       │   │   ├── arena/[pin]/    # live quiz (host + player views)
│       │   │   └── join/           # join a live quiz with a PIN
│       │   ├── components/         # navbar, PDF viewer, study tools, etc.
│       │   └── api/
│       │       ├── auth/           # Microsoft OAuth: callback, checklogin, logout
│       │       ├── emails/         # inbox from Microsoft Graph
│       │       ├── email/          # summarize, draft, events
│       │       ├── quiz/           # generate, getquiz, selectoption
│       │       ├── livequiz/       # create, history, [pin]/state|stream|action, engine.ts
│       │       ├── planly/         # ai-tasks (goal → tasks via Groq)
│       │       ├── uploadpdf/      # PDF upload + document lookup
│       │       ├── lib/            # Mongoose models: Quiz, Document, LiveGame
│       │       └── utils/          # db, s3, ai (Groq), upload validation
│       └── types/
├── python-app/                     # Flask backend (deployed to Render)
│   ├── app.py                      # app setup, /generate_questions, /health
│   ├── routes/
│   │   ├── email.py                # /summarize_email, /draftmail, /getevents
│   │   ├── uplaod_pdf.py           # /upload_pdf
│   │   └── pdf_comp.py             # /askquestion, /conceptmap
│   ├── helpers.py                  # notes → PDF, S3 upload, input validation
│   ├── utils.py                    # embeddings, vector store, RAG
│   ├── ocr.py                      # PDF text extraction + OCR
│   ├── openrouter_client.py        # Groq → OpenRouter LLM client with caching
│   ├── prompts.py                  # quiz prompt
│   ├── Dockerfile
│   └── requirements.txt
├── render.yaml                     # Render Blueprint for the backend
└── start_assist_iq.bat             # starts both apps locally (Windows)
```

---

## Running locally

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.12**
- A **MongoDB** connection string (for example, a free MongoDB Atlas cluster)
- An **AWS S3** bucket, plus an access key allowed to `GetObject` and `PutObject` on it
- A **Groq** API key ([console.groq.com](https://console.groq.com)). An OpenRouter key is an optional fallback.
- *(Optional)* A **Microsoft Entra app registration**, for the Outlook features
- *(Optional)* **Tesseract OCR**, for scanned PDFs: [Windows installer](https://github.com/UB-Mannheim/tesseract/wiki), `brew install tesseract`, or `apt install tesseract-ocr`

### 1. Clone

```bash
git clone https://github.com/Shivam200427/AssistIQ.git
cd AssistIQ
```

### 2. Backend

```bash
cd python-app
python -m venv venv
venv\Scripts\activate            # macOS / Linux: source venv/bin/activate
pip install -r requirements.txt
# create python-app/.env (see below)
python app.py                    # → http://127.0.0.1:5000/health
```

The first run downloads the embedding model, about 80 MB.

### 3. Frontend

```bash
cd my-app
npm install
# create my-app/.env (see below)
npm run dev                      # → http://localhost:3000
```

**Windows shortcut:** `start_assist_iq.bat` starts both apps in separate windows.

---

## Environment variables

> Never commit `.env` files. They are excluded by `.gitignore`, `.vercelignore` and `.dockerignore`.

### Frontend: `my-app/.env`

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | Flask backend URL: `http://127.0.0.1:5000` locally, your Render URL in production |
| `MONGO_URL` | ✅ | MongoDB connection string |
| `AWS_REGION` | ✅ | S3 bucket region, e.g. `ap-southeast-2` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | ✅ | AWS credentials |
| `AWS_S3_BUCKET` | ✅ | Bucket name |
| `Next_GROP_API_KEY` | ✅ | Groq API key (`GROQ_API_KEY` also works) |
| `GROQ_MODEL` | — | Groq model to try first, before the built-in fallbacks |
| `SESSION_SECRET` | ✅ | Random string (32+ characters) used to sign student sessions. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Sign-in & Outlook | From your Entra app registration |
| `CALLBACK_URL` | Outlook only | `http://localhost:3000/api/auth/callback` locally, `https://<your-domain>/api/auth/callback` in production |
| `SCOPES` | Sign-in & Outlook | `openid profile email Mail.Read Mail.Send Calendars.ReadWrite` (ReadWrite is needed for "Add to calendar"; also grant it in the Microsoft app registration) |

### Backend: `python-app/.env`

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key (main LLM) |
| `OPENROUTER_API_KEY` | — | Fallback LLM provider |
| `OPENROUTER_MODEL` | — | OpenRouter model to try first |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | ✅ | AWS credentials |
| `AWS_REGION` | ✅ | S3 bucket region |
| `AWS_S3_BUCKET` | ✅ | Same bucket as the frontend |
| `CORS_ORIGINS` | — | Comma-separated allowed origins, e.g. `https://assistiq-two.vercel.app`. Defaults to `*` |
| `TESSERACT_CMD` | — | Path to the Tesseract binary, if it isn't on `PATH` |
| `REDIS_URL` | — | Enables a shared cache for LLM responses |
| `PORT` | — | Port to listen on. Defaults to `5000`; Render sets this automatically |

---

## Deployment

### Backend → Render (Docker)

The repo includes a Render Blueprint, [`render.yaml`](render.yaml), that builds [`python-app/Dockerfile`](python-app/Dockerfile).

1. On [dashboard.render.com](https://dashboard.render.com), choose **New → Blueprint** and select this repository.
2. Enter the secret values when asked: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.
   - `CORS_ORIGINS`, `AWS_REGION` and `AWS_S3_BUCKET` are already set in `render.yaml`. Change them if your domain or bucket is different.
3. Click **Apply**. The first build takes about 5–10 minutes.
4. Check that `https://<service>.onrender.com/health` returns `{"status": "ok"}`.

**What the image does:**
- installs Tesseract
- pre-downloads the embedding model, so the first request isn't slowed down
- runs gunicorn with 1 worker and a 300-second timeout

It uses about 220 MB of memory at rest and about 400 MB while processing a PDF, so it fits the **free plan** (512 MB). Pushes to `main` redeploy it automatically.

### Frontend → Vercel

1. Import the repo into Vercel and set the **Root Directory** to `my-app`. Or run `vercel deploy --prod` from inside `my-app`.
2. Under **Settings → Environment Variables**, add every frontend variable listed above, with:
   - `NEXT_PUBLIC_BACKEND_URL` = your Render URL
   - `CALLBACK_URL` = `https://<your-domain>/api/auth/callback`
3. Add the same callback URL as a **Web redirect URI** in your Microsoft app registration.
4. **Redeploy** after changing `NEXT_PUBLIC_BACKEND_URL`. It's built into the browser code, so it only takes effect on a new build.

The PDF upload and quiz routes are allowed to run for up to 300 seconds (`maxDuration`), so they can wait for the backend to process large PDFs.

---

## API reference

### Next.js API routes (`my-app/src/app/api`)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/auth/callback` | Starts Microsoft sign-in, or completes it when called with `?code=` |
| GET | `/api/auth/checklogin` | `200` if signed in to Outlook, `401` if not |
| GET | `/api/auth/logout` | Clears the Outlook session |
| GET | `/api/emails` | Latest 50 inbox emails from Microsoft Graph |
| POST | `/api/email/summarize` | Email summary (backend first, then Groq directly) |
| POST | `/api/email/draft` | Suggested reply (backend first, then Groq directly) |
| POST | `/api/email/events` | Dates and deadlines in an email (backend) |
| POST | `/api/quiz/generate` | Create a quiz from `prompt` and an optional `pdf` (multipart form) |
| POST | `/api/quiz/getquiz` | Load a quiz by `id` |
| POST | `/api/quiz/selectoption` | Save a chosen answer |
| POST | `/api/uploadpdf` | Upload a PDF → `{ link, persist }` (notes PDF + vector store id) |
| GET | `/api/uploadpdf?pdfurl=` | Look up the vector store for a notes PDF |
| POST | `/api/livequiz/create` | New live game → `{ pin, hostToken }` |
| GET | `/api/livequiz/[pin]/state` | Current game state (the host gets full data via the `x-host-token` header) |
| GET | `/api/livequiz/[pin]/stream` | Server-sent events for live updates |
| POST | `/api/livequiz/[pin]/action` | `JOIN`, `SUBMIT_ANSWER`, and host-only actions: `START_GAME`, `END_QUESTION`, `SHOW_LEADERBOARD`, `NEXT_QUESTION`, `UPDATE_QUESTIONS` |
| GET | `/api/livequiz/history` | The 30 most recent finished games |
| POST | `/api/planly/ai-tasks` | `{ goal, count, today, assignment? }` → suggested tasks with difficulty, tags and due dates |

### Flask backend (`python-app`)

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Status check |
| POST | `/upload_pdf` | `{ key }` of a PDF in S3 → notes PDF URL + vector store id |
| POST | `/askquestion` | `{ question, store }` → answer from the document |
| POST | `/conceptmap` | `{ store }` → `{ nodes, edges }` concept graph |
| POST | `/generate_questions` | `{ prompt, key? }` → quiz questions |
| POST | `/summarize_email` | Email summary |
| POST | `/draftmail` | Suggested reply |
| POST | `/getevents` | Dates and deadlines in an email |

---

## Accounts, data and migrations

- **Student identity** is the Microsoft account: after sign-in the server keeps the Microsoft account id in a signed, httpOnly session cookie (`SESSION_SECRET`). Saving quiz answers, creating quizzes, the mistakes notebook and documents uploaded while signed in all require that session.
- **Quiz attempts** live in their own `quizattempts` collection, one per student per attempt; correct answers are only returned after that student submits.
- **Documents** store S3 keys, and a fresh short-lived link is generated each time notes are opened.

Before deploying this version, back up and run the migrations **at the same time as the deploy** (the old code reads answers from quiz documents):

```bash
mongodump --uri "$MONGO_URL" --out ../Edumate-backups/mongo-$(date +%Y%m%d)
cd my-app
node --env-file=.env scripts/migrate-quiz-attempts.mjs --dry-run   # review, then run without --dry-run
node --env-file=.env scripts/backfill-document-keys.mjs --dry-run  # review, then run without --dry-run
```

## Security

- **Quiz privacy:** each student's answers are a separate attempt checked against the signed session; nobody can read or change another student's attempt, and answer keys stay hidden until you submit.
- **PDF chat:** answers come only from the original PDF pages and cite them as [p. N]; if the document doesn't support an answer, the chat says so instead of guessing.
- **Live quiz integrity:**
  - Host actions need the secret token that's issued when the game is created.
  - Each player gets a private token when joining; answering or rejoining as that player requires it.
  - Players can't see correct answers, or other players' results, until each question ends.
  - Answer time is measured on the server, and each player can answer each question once.
- **Outlook sign-in:** a one-time state value protects against login CSRF. Redirects only go to pages on the same site. Tokens are kept in an `httpOnly` cookie.
- **Protection against malicious content (XSS):** email HTML is shown in a sandboxed iframe with scripts disabled, and AI-generated text is always shown as plain text.
- **Backend input checks:**
  - It only reads from the configured S3 bucket and only accepts `pdf/…` file keys.
  - It only opens vector stores it created itself.
  - Error responses don't reveal internal details.
- **Uploads:** must be real PDFs (checked by their first bytes), 4 MB or less, with cleaned file names.
- **CORS:** in production the backend only accepts browser requests from the frontend's domain.

---

## Troubleshooting

| Problem | What to check |
|---|---|
| The first PDF action is slow or times out | The Render free plan was asleep. Wait a minute and try again, or open `/health` first to wake it up |
| "PDF upload failed" | `NEXT_PUBLIC_BACKEND_URL` is set and the site was redeployed; the backend `/health` responds; both apps use the same S3 bucket and credentials |
| Email summary says no AI key | `Next_GROP_API_KEY` is set in the frontend environment |
| AI calls return 404 | The Groq model may have been retired. Set `GROQ_MODEL` to a model listed in your Groq console |
| Outlook sign-in fails or redirects to localhost | `CALLBACK_URL` matches your domain and is added to the Microsoft app's redirect URIs |
| Scanned PDF comes out empty | Tesseract is installed locally, or set `TESSERACT_CMD` (it's already included in the Docker image) |
| Browser console shows CORS errors from the backend | `CORS_ORIGINS` on Render includes your frontend's exact domain |

### Tests and checks

```bash
cd my-app && npm test            # API tests against an in-memory MongoDB (no real services are called)
npx tsc --noEmit && npx next build
cd ../python-app && pip install pytest && python -m pytest tests -q   # PDF chat citation/abstention tests
```

---

## Known limitations

- **No user accounts yet.** Everything is stored under a shared `demo` user, so anyone with a quiz's link can open it.
- **"Add to calendar" doesn't work.** The button in the email panel has no matching server route, and the Outlook sign-in only asks for read access to the calendar (`Calendars.Read`).
- **Free-plan wake-up delay** on the backend, as described above.
