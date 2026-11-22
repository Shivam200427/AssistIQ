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

        if not key:
            question = generate_question(prompt, "no content")
            question = clean_and_parse_json(question)
            return jsonify({
                "status": "success",
                "questions": question,
            }), 200

        if not is_valid_pdf_key(key):
            return jsonify({"status": "error", "message": "Invalid document key"}), 400

        content = extract_pdf(get_bucket(), key)
        content = clean_content(content)
        question = generate_question(prompt, content)
        question = clean_and_parse_json(question)
        return jsonify({
            "status": "success",
            "questions": question,
        }), 200

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
