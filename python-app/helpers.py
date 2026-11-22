import json
import re
import ast
import tempfile
import uuid
import zipfile
from fpdf import FPDF
import boto3
import os
from dotenv import load_dotenv
import textwrap
import shutil
from openrouter_client import prompt_completion

load_dotenv()


s3 = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION") or "ap-southeast-2"
)


def clean_content(pdf_result):
    text = ""
    for page in pdf_result:
        text += list(page.values())[0] + "\n"
    return text


def clean_and_parse_json(text: str):
    if not text:
        return []

    if isinstance(text, (list, dict)):
        return text

    # Try direct parse
    try:
        return json.loads(text.strip())
    except Exception:
        pass

    # Try extracting markdown json code block
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text, re.IGNORECASE)
    if match:
        clean = match.group(1).strip()
        try:
            return json.loads(clean)
        except Exception:
            pass

    # Try finding top-level JSON array or object
    match = re.search(r'(\[[\s\S]*\]|\{[\s\S]*\})', text)
    if match:
        clean = match.group(1).strip()
        try:
            return json.loads(clean)
        except Exception:
            try:
                return ast.literal_eval(clean)
            except Exception:
                pass

    return []

def remove_non_latin(text):
    return re.sub(r'[^\x00-\xff]', '?', text)


def safe_wrap_line(line: str, width: int = 100):
    if len(line) > width and " " not in line:
        return "\n".join([line[i:i + width] for i in range(0, len(line), width)])
    else:
        return textwrap.fill(line, width=width)


def text_to_pdf_buffer(text: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()

    pdf.set_font("Arial", size=12)

    for line in text.split("\n"):
        wrapped = safe_wrap_line(line)
        clean_text = remove_non_latin(wrapped)
        pdf.multi_cell(0, 10, clean_text)

    pdf_bytes = pdf.output(dest='S').encode('latin1')
    return pdf_bytes



def upload_vectorstore_to_s3(persist_dir, bucket_name):
    zip_path = f"{persist_dir}.zip"
    shutil.make_archive(persist_dir, 'zip', persist_dir)
    s3_key = f"vectorstores/{os.path.basename(zip_path)}"
    s3.upload_file(zip_path, bucket_name, s3_key)
    os.remove(zip_path)
    return f"s3://{bucket_name}/{s3_key}"



def download_and_extract_vectorstore(s3_uri, bucket_name):
    s3_key = s3_uri.replace(f"s3://{bucket_name}/", "")
    tmp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(tmp_dir, "vs.zip")
    s3.download_file(bucket_name, s3_key, zip_path)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(tmp_dir)
    return tmp_dir




def upload_pdf_to_s3(pdf_bytes: bytes, BUCKET_NAME, filename=None):
    if filename is None:
        filename = f"pdfs/{uuid.uuid4()}.pdf"

    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=filename,
        Body=pdf_bytes,
        ContentType='application/pdf',
        # ACL='public-read' 
    )

    presigned_url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET_NAME, 'Key': filename},
        ExpiresIn=86400 
    )
    # file_url = f"https://{BUCKET_NAME}.s3.amazonaws.com/{filename}"
    return presigned_url





_STORE_RE = re.compile(r"^(?:\./)?vectorstores/([0-9a-fA-F-]{36})$")


def resolve_store_dir(persist_dir):
    """Only accept vector store ids this backend created (./vectorstores/<uuid>), never arbitrary paths."""
    match = _STORE_RE.match(str(persist_dir or "").strip().replace("\\", "/"))
    if not match:
        return None
    return f"./vectorstores/{match.group(1).lower()}"


def get_bucket():
    """The S3 bucket is fixed server-side; clients never choose which bucket is read."""
    bucket = os.getenv("AWS_S3_BUCKET")
    if not bucket:
        raise RuntimeError("AWS_S3_BUCKET is not set in environment.")
    return bucket


def is_valid_pdf_key(key):
    key = str(key or "")
    return key.startswith("pdf/") and ".." not in key and len(key) <= 1024





def get_links(pages, source_key=None):
    """
    Builds everything for an uploaded PDF:
      1. indexes the ORIGINAL page text (page-tagged chunks) — this is what PDF chat searches;
      2. writes study notes separately from that index, citing pages;
      3. stores the notes PDF and the index in S3.
    Returns S3 keys (so fresh links can be generated later) plus a short-lived link for immediate use.
    """
    from rag import build_page_index, notes_from_index, open_store

    try:
        bucket = get_bucket()
        persist_dir = f"./vectorstores/{uuid.uuid4()}"
        print(f"[get_links] Indexing {len(pages)} original page(s) at {persist_dir}...")
        chunks = build_page_index(pages, persist_dir)

        store, _ = open_store(persist_dir)
        notes, notes_status = notes_from_index(store)

        notes_key = f"pdfs/{uuid.uuid4()}.pdf"
        pdf_url = upload_pdf_to_s3(text_to_pdf_buffer(notes), bucket, notes_key)
        upload_vectorstore_to_s3(persist_dir, bucket)

        return {
            "pdf_url": pdf_url,
            "notes_key": notes_key,
            "source_key": source_key,
            "vectorstore": persist_dir,
            "notes_status": notes_status,  # "ai" or "extracted_text" (AI unavailable — clearly labelled)
            "pages": len(pages),
            "chunks": chunks,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
