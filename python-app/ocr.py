import io
import os
import shutil

import boto3
import fitz
import pytesseract
from PIL import Image

import env_config  # noqa: F401


TESSERACT_CMD = os.getenv("TESSERACT_CMD") or shutil.which("tesseract")
if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD


s3 = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION") or "ap-southeast-2",
)


def extract_pdf(bucket, key):
    obj = s3.get_object(Bucket=bucket, Key=key)
    file_bytes = obj["Body"].read()

    result = []
    pdf = fitz.open(stream=file_bytes, filetype="pdf")

    for i in range(len(pdf)):
        page = pdf[i]
        extracted = page.get_text()

        if extracted.strip():
            result.append({i + 1: extracted})
        else:
            pix = page.get_pixmap(dpi=300)
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))
            text = pytesseract.image_to_string(img, lang="eng")
            result.append({i + 1: text})

    return result
