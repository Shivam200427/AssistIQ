from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from utils import generate_question
from helpers import clean_and_parse_json, clean_content, get_bucket, is_valid_pdf_key
from ocr import extract_pdf

from routes.email import email
from routes.uplaod_pdf import uplaodpdf
from routes.pdf_comp import pdf_comp

app = Flask(__name__)
# Set CORS_ORIGINS (comma separated) to lock the API to your frontend, e.g. http://localhost:3000
CORS(app, origins=[o.strip() for o in (os.getenv("CORS_ORIGINS") or "*").split(",") if o.strip()])

app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

# Active Services:
# 1. Email Summarizer
app.register_blueprint(email)

# 2. PDF Notes Extractor & Interactive PDF Chat
app.register_blueprint(uplaodpdf)
app.register_blueprint(pdf_comp)

# 3. Quiz Generator
@app.route('/generate_questions', methods=['POST'])
def generate_ques():
    try:
        req = request.get_json(force=True) or {}
        prompt = str(req.get('prompt') or "")[:500]
        key = req.get("key") or ""
        count = min(max(int(req.get("count") or 5), 3), 20)
        difficulty = str(req.get("difficulty") or "mixed")
        if difficulty not in ("easy", "medium", "hard", "mixed"):
            difficulty = "mixed"
        request_text = (
            f"{prompt}\nWrite exactly {count} questions. Difficulty: "
            f"{'a mix of easy, medium and hard' if difficulty == 'mixed' else difficulty}."
        )

        if not key:
            questions = clean_and_parse_json(generate_question(request_text, "no content"))
            return jsonify({"status": "success", "source": "topic", "questions": questions}), 200

        if not is_valid_pdf_key(key):
            return jsonify({"status": "error", "message": "Invalid document key"}), 400

        content = clean_content(extract_pdf(get_bucket(), key)).strip()
        if len(content) < 50:
            # Never write "document" questions without a document.
            return jsonify({"status": "error", "message": "No readable text was found in this PDF."}), 422
        questions = clean_and_parse_json(generate_question(request_text, content[:60000]))
        if not questions:
            return jsonify({"status": "error", "message": "The AI returned no questions."}), 502
        return jsonify({"status": "success", "source": "document", "questions": questions}), 200

    except Exception as e:
        print(f"Quiz generation error: {e}")
        return jsonify({
            "status": "error",
            "message": "Quiz generation failed"
        }), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "service": "AssistIQ Backend",
        "active_features": ["email_summarizer", "pdf_notes_extractor", "quiz_generator"]
    }), 200


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
