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
from utils import process_pdf_rag

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





def format_fallback_notes(transcript: str) -> str:
    """Format raw transcript into clean structured notes if LLM is temporarily unreachable."""
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', transcript) if s.strip()]
    if not sentences:
        return transcript or "No transcript content available."

    paragraphs = []
    chunk_size = 4
    for i in range(0, len(sentences), chunk_size):
        chunk = sentences[i:i + chunk_size]
        paragraphs.append(" ".join(chunk))

    notes = "# Lecture Study Notes\n\n## Overview\n"
    if paragraphs:
        notes += paragraphs[0] + "\n\n"

    notes += "## Key Concepts & Details\n"
    for idx, p in enumerate(paragraphs[1:], 1):
        notes += f"### Section {idx}\n- {p}\n\n"

    notes += "## Summary & Review\n"
    notes += "Key takeaway: Review the concepts discussed above for study and revision.\n"
    return notes


def genrate_notes(text):
    prompt = f"""
Generate well-structured study notes from the given text.

### Requirements:
- Keep meaning accurate.
- Use simple, easy language.
- Use **headings, bullet points, and short paragraphs**.
- Correct grammar and spelling.
- Make it visually clean and easy to revise.
- and this is not summarize notes it is long notes so make accordingly
### Text to summarise:
{text}

### Output:
Return **only the improved notes**, no explanation or extra comments .
"""
    try:
        notes = prompt_completion(prompt, temperature=0.7)
        if notes and notes.strip():
            return notes
    except Exception as e:
        print(f"[genrate_notes] LLM note generation failed ({e}). Using structured transcript fallback.")

    return format_fallback_notes(text)






def get_links(text):
    try:
        print("[get_links] Generating notes via LLM...")
        text = genrate_notes(text)
        if not text or not text.strip():
            raise RuntimeError("LLM returned empty notes content.")
        print(f"[get_links] Notes generated ({len(text)} chars). Converting to PDF...")

        pdf_bytes = text_to_pdf_buffer(text)
        BUCKET_NAME = os.getenv("AWS_S3_BUCKET")
        if not BUCKET_NAME:
            raise RuntimeError("AWS_S3_BUCKET is not set in environment.")

        print("[get_links] Uploading PDF to S3...")
        pdf_url = upload_pdf_to_s3(pdf_bytes, BUCKET_NAME)

        os.makedirs("./uploadfiles", exist_ok=True)
        tmp_pdf_path = f"./uploadfiles/{uuid.uuid4()}.pdf"
        with open(tmp_pdf_path, "wb") as f:
            f.write(pdf_bytes)

        persist_dir = f"./vectorstores/{uuid.uuid4()}"
        print(f"[get_links] Building vector store at {persist_dir}...")
        process_pdf_rag(tmp_pdf_path, persist_dir)

        print("[get_links] Uploading vector store to S3...")
        vectorstore_uri = upload_vectorstore_to_s3(persist_dir, BUCKET_NAME)

        os.remove(tmp_pdf_path)

        print("[get_links] Done successfully.")
        return {
            "pdf_url": pdf_url,
            "vectorstore": persist_dir,
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
    
