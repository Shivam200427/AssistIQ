from flask import request, jsonify, Blueprint
from ocr import extract_pdf
from helpers import get_links, get_bucket, is_valid_pdf_key
from rag import pages_from_extract

uplaodpdf = Blueprint('uplaodpdf', __name__)


@uplaodpdf.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    try:
        req = request.get_json() or {}
        key = req.get("key") or ""
        if not is_valid_pdf_key(key):
            return jsonify({"error": "Invalid document key"}), 400

        pages = pages_from_extract(extract_pdf(get_bucket(), key))
        if not pages:
            return jsonify({"error": "No readable text was found in this PDF.", "stage": "extract"}), 422

        pdf_link = get_links(pages, source_key=key)
        if pdf_link.get("error"):
            return jsonify({"error": "Could not build notes and the search index for this PDF.", "stage": "index"}), 500

        return jsonify({"pdflink": pdf_link}), 200
    except Exception as e:
        print(f"upload_pdf error: {e}")
        return jsonify({"error": "Could not process this PDF"}), 500
