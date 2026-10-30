import io
from pathlib import Path
from pypdf import PdfReader


class InvalidDocument(ValueError):
    pass


def extract(filename: str, data: bytes, max_chars: int) -> tuple[str, list[dict]]:
    suffix = Path(filename).suffix.lower()
    if suffix not in {".txt", ".md", ".pdf"}:
        raise InvalidDocument("Supported file types: .pdf, .txt, .md")
    if not data:
        raise InvalidDocument("The uploaded file is empty")
    if suffix == ".pdf":
        if not data.startswith(b"%PDF-"):
            raise InvalidDocument("File signature does not match PDF")
        try:
            reader = PdfReader(io.BytesIO(data), strict=False)
            if reader.is_encrypted:
                raise InvalidDocument("Encrypted PDFs are unsupported")
            if len(reader.pages) > 500:
                raise InvalidDocument("PDF exceeds the 500 page limit")
            page_texts = []
            total = 0
            for page in reader.pages:
                text = page.extract_text() or ""
                total += len(text)
                if total > max_chars:
                    raise InvalidDocument("Extracted text exceeds the character limit")
                page_texts.append(text)
        except InvalidDocument:
            raise
        except Exception as exc:
            raise InvalidDocument("PDF could not be parsed") from exc
    else:
        if data.startswith((b"%PDF-", b"PK\x03\x04", b"\x89PNG", b"\xff\xd8")) or b"\x00" in data:
            raise InvalidDocument("File signature does not match plain text")
        try:
            page_texts = [data.decode("utf-8-sig")]
        except UnicodeDecodeError as exc:
            raise InvalidDocument("Text files must use UTF-8 encoding") from exc
    if sum(map(len, page_texts)) > max_chars:
        raise InvalidDocument("Extracted text exceeds the character limit")
    if not any(t.strip() for t in page_texts):
        raise InvalidDocument("No extractable text found. Scanned PDFs require OCR before upload.")
    pages, offset = [], 0
    for index, text in enumerate(page_texts):
        pages.append({"page": index + 1 if suffix == ".pdf" else None, "text": text, "start_offset": offset})
        offset += len(text) + 2
    return "\n\n".join(page_texts), pages


def split_pages(pages: list[dict], chunk_size: int, overlap: int) -> list[dict]:
    chunks = []
    for page in pages:
        text = page["text"]
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            if end < len(text):
                boundary = max(text.rfind("\n", start + chunk_size // 2, end), text.rfind(" ", start + chunk_size // 2, end))
                if boundary > start:
                    end = boundary
            if text[start:end].strip():
                chunks.append(
                    {
                        "text": text[start:end],
                        "page": page["page"],
                        "start_offset": page["start_offset"] + start,
                        "end_offset": page["start_offset"] + end,
                    }
                )
            if end == len(text):
                break
            start = max(start + 1, end - overlap)
    return chunks
