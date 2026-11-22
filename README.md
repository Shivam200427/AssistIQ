# AssistIQ

AssistIQ is an AI study assistant. It summarizes your Outlook email, turns PDFs into structured notes you can chat with, and generates quizzes you can take alone or play live with a class.

**Live app:** https://assistiq-two.vercel.app

## Features

| Feature | What it does |
|---|---|
| **Email Summarizer** | Connects to Outlook (Microsoft Graph), then summarizes each email, drafts a reply and pulls out dates and deadlines. Includes a demo inbox for trying it without signing in. |
| **PDF Notes Extractor** | Upload a PDF (typed or scanned) and get clean study notes as a new PDF, plus a study panel with: chat with the PDF (RAG), short notes, project ideas, quiz topics and a concept map. |
| **Quiz Generator** | Creates multiple-choice quizzes from a topic or an uploaded PDF, scores your answers and explains each one. |
| **Live Quiz Arena** | Host any quiz as a live game: players join with a 6-digit PIN or QR code, answer against the clock and see a live leaderboard. |

## Architecture

```text
Browser
  │
  ├── Next.js app (my-app, on Vercel)
  │     ├── pages and UI
  │     ├── API routes: auth, email, quiz, live quiz, PDF upload
  │     ├── MongoDB: quizzes, documents, live games
  │     ├── AWS S3: uploaded PDFs
  │     └── Groq: email summaries/drafts and topic quizzes
  │
  └── Flask backend (python-app, on Render)
        ├── PDF text extraction (PyMuPDF, Tesseract OCR for scanned pages)
        ├── notes generation and PDF export
        ├── ChromaDB vector stores (ONNX all-MiniLM-L6-v2 embeddings), backed up to S3
        └── Groq, with OpenRouter as fallback
```

## Project structure

```text
.
├── my-app/                 # Next.js 15 frontend + API routes
│   └── src/app/
│       ├── home/           # landing page
│       ├── EmailSummarizer/
│       ├── pdfNotesExtractor/
│       ├── quizgenerator/  # quiz, results, live arena (arena/[pin]) and join page
│       ├── components/
│       └── api/            # auth, emails, email/*, quiz/*, livequiz/*, uploadpdf
├── python-app/             # Flask backend
│   ├── app.py              # app entry point + /generate_questions, /health
│   ├── routes/             # email, PDF upload, PDF chat / concept map
│   ├── Dockerfile          # image used on Render
│   └── requirements.txt
├── render.yaml             # Render Blueprint for the backend
└── start_assist_iq.bat     # starts both apps locally on Windows
```

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Framer Motion, React Flow, react-pdf-viewer
- **Backend:** Flask, gunicorn, PyMuPDF, Tesseract, LangChain, ChromaDB (ONNX embeddings)
- **AI:** Groq (`openai/gpt-oss-120b` and fallbacks), OpenRouter as a backup
- **Data:** MongoDB (Mongoose), AWS S3, optional Redis cache
- **Hosting:** Vercel (frontend), Render (backend)

## Running locally

### Requirements

- Node.js 18+ and npm
- Python 3.12
- A MongoDB connection string
- An AWS S3 bucket with credentials allowing `PutObject` and `GetObject`
- A Groq API key (an OpenRouter key is optional, as a fallback)
- A Microsoft app registration, for the Outlook features only
- Tesseract, for scanned PDFs only (on Windows: install it, then set `TESSERACT_CMD`)

### 1. Backend

```bash
cd python-app
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python app.py                  # http://127.0.0.1:5000
```

Create `python-app/.env`:

```env
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key        # optional fallback
OPENROUTER_MODEL=liquid/lfm-3-1.7b:free       # optional

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=your_bucket

TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe   # only if not on PATH
CORS_ORIGINS=http://localhost:3000            # optional, defaults to *
REDIS_URL=redis://localhost:6379/0            # optional cache
```

### 2. Frontend

```bash
cd my-app
npm install
npm run dev                    # http://localhost:3000
```

Create `my-app/.env`:

```env
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:5000
MONGO_URL=mongodb+srv://...

AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=your_bucket

Next_GROP_API_KEY=your_groq_key
GROQ_MODEL=openai/gpt-oss-120b                # optional, tried first

MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
CALLBACK_URL=http://localhost:3000/api/auth/callback
SCOPES=openid profile email Mail.Read Mail.Send Calendars.Read
```

On Windows you can start both apps at once with `start_assist_iq.bat`.

## Deployment

### Backend on Render

The repo includes a Blueprint ([render.yaml](render.yaml)) that builds [python-app/Dockerfile](python-app/Dockerfile). The image installs Tesseract and pre-downloads the embedding model.

1. In Render, choose **New → Blueprint** and select this repository.
2. When asked, fill in `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.
3. When it's live, check `https://<your-service>.onrender.com/health`.

The backend uses about 220 MB of memory at rest and about 400 MB while processing a PDF, so it fits the free plan. On the free plan it sleeps after 15 idle minutes, and the first request after that takes about a minute.

### Frontend on Vercel

1. Import `my-app` as a Vercel project, or run `vercel deploy --prod` inside `my-app`.
2. Add the variables from `my-app/.env` in **Project → Settings → Environment Variables**, with:
   - `NEXT_PUBLIC_BACKEND_URL` = your Render URL
   - `CALLBACK_URL` = `https://<your-domain>/api/auth/callback`, also added as a redirect URI in the Microsoft app registration
3. Redeploy after changing `NEXT_PUBLIC_BACKEND_URL`. It is built into the browser code, so it only takes effect on a new build.

## Security notes

- **Live quiz:** host actions need a secret host token, which is issued when the game is created. Players can't see correct answers until each question ends. Answer time is measured on the server, and each player can answer each question once. Game state lives in MongoDB, so it stays consistent across serverless instances.
- **Outlook sign-in:** uses a one-time state check (protects against login CSRF) and only redirects to pages on the same site.
- **Rendering:** email HTML is shown in a sandboxed iframe, and AI output is rendered as plain text.
- **Backend input checks:** the backend only reads from the configured S3 bucket, only accepts `pdf/…` file keys and only opens vector stores it created.
- **Uploads:** must be real PDFs of 25 MB or less.
- **Secrets:** never commit `.env` files. They are excluded by `.gitignore`, `.vercelignore` and `.dockerignore`.

## Checks

```bash
cd my-app && npx tsc --noEmit && npx next build
python -m py_compile python-app/app.py python-app/helpers.py python-app/utils.py python-app/routes/*.py
```
