import io
import pytest
from pypdf import PdfWriter
from app.ingestion import InvalidDocument, extract, split_pages


def test_chunk_offsets_reproduce_original_text():
    original = "Introduction\n" + "The security escalation policy requires notifying the incident commander. " * 40
    text, pages = extract("security.md", original.encode(), 100000)
    chunks = split_pages(pages, 250, 40)
    assert len(chunks) > 5
    for chunk in chunks:
        assert chunk["text"] == text[chunk["start_offset"] : chunk["end_offset"]]
        assert len(chunk["text"]) <= 250
    assert chunks[-1]["end_offset"] == len(text)
    assert all(b["start_offset"] < a["end_offset"] for a, b in zip(chunks, chunks[1:]))


@pytest.mark.parametrize(
    "filename,data", [("x.exe", b"abc"), ("x.txt", b"\x00hi"), ("x.pdf", b"not pdf"), ("x.txt", b"\xff"), ("x.md", b"%PDF-1.7")]
)
def test_reject_invalid_upload_signatures(filename, data):
    with pytest.raises(InvalidDocument):
        extract(filename, data, 100000)


def test_empty_and_scanned_pdf_explain_ocr():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(InvalidDocument, match="OCR"):
        extract("scan.pdf", output.getvalue(), 10000)


def test_text_limit_is_enforced():
    with pytest.raises(InvalidDocument, match="character limit"):
        extract("large.txt", b"a" * 101, 100)


def test_pdf_page_numbers_and_document_offsets():
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

    writer = PdfWriter()
    for content in ["Synthetic onboarding policy", "Security escalation requires notifying a commander"]:
        page = writer.add_blank_page(width=600, height=800)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 10 700 Td ({content}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    text, pages = extract("synthetic.pdf", output.getvalue(), 10000)
    chunks = split_pages(pages, 200, 20)
    assert [chunk["page"] for chunk in chunks] == [1, 2]
    assert "onboarding" in chunks[0]["text"] and "commander" in chunks[1]["text"]
    for chunk in chunks:
        assert text[chunk["start_offset"] : chunk["end_offset"]] == chunk["text"]
