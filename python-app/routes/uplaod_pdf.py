from flask import request, jsonify, Blueprint
from ocr import extract_pdf
from helpers import clean_content, get_links, get_bucket, is_valid_pdf_key

uplaodpdf = Blueprint('uplaodpdf', __name__)


@uplaodpdf.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    try:
        req = request.get_json() or {}
        key = req.get("key") or ""
        if not is_valid_pdf_key(key):
            return jsonify({"error": "Invalid document key"}), 400

        content = extract_pdf(get_bucket(), key)
        content = clean_content(content)

        pdf_link = get_links(content)
        if pdf_link.get("error"):
            return jsonify({"error": "Could not generate notes from this PDF"}), 500

        return jsonify({"pdflink": pdf_link}), 200
    except Exception as e:
        print(f"upload_pdf error: {e}")
        return jsonify({"error": "Could not process this PDF"}), 500
