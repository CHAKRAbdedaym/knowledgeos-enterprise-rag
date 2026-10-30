import logging
from fastapi import HTTPException
from sqlalchemy import delete, select
from app.models import Chunk, Document, uid
from app.ingestion import split_pages

logger = logging.getLogger("knowledgeos")


def check_embedding_revision(db, vectors):
    vectors.ensure_embeddings()
    revisions = set(db.scalars(select(Document.embedding_revision).where(Document.status == "indexed")).all())
    if revisions and revisions != {vectors.revision}:
        raise HTTPException(409, "Embedding artifact changed. Restore the original model cache or rebuild the index in a new collection.")


def index_document(db, document, vectors, settings):
    document.status = "indexing"
    document.error = None
    db.commit()
    try:
        check_embedding_revision(db, vectors)
        vectors.delete(document.id)
        db.execute(delete(Chunk).where(Chunk.document_id == document.id))
        chunks = [
            Chunk(id=uid(), document_id=document.id, **part)
            for part in split_pages(document.pages, settings.chunk_size, settings.chunk_overlap)
        ]
        db.add_all(chunks)
        db.flush()
        vectors.add(document, chunks)
        document.chunk_count = len(chunks)
        document.embedding_revision = vectors.revision
        document.status = "indexed"
        db.commit()
    except Exception:
        logger.error("document_indexing_failed", extra={"document_id": document.id})
        db.rollback()
        try:
            vectors.delete(document.id)
        except Exception:
            logger.error("vector_cleanup_failed", extra={"document_id": document.id})
        db.execute(delete(Chunk).where(Chunk.document_id == document.id))
        document = db.get(Document, document.id)
        document.status = "failed"
        document.chunk_count = 0
        document.error = "Indexing failed. Check Qdrant and model availability, then retry reindexing."
        db.commit()
    return document
