from pydantic import BaseModel, Field, field_validator


class ConversationInput(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=160)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value):
        if not value.strip():
            raise ValueError("Title cannot be blank")
        return value.strip()


class QuestionInput(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int | None = Field(default=None, ge=1, le=10)
    score_threshold: float | None = Field(default=None, ge=0, le=1)

    @field_validator("question")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Question cannot be blank")
        return value.strip()


class Source(BaseModel):
    document_id: str
    title: str
    chunk_id: str
    text: str
    score: float
    page: int | None
    start_offset: int
    end_offset: int


class Trace(BaseModel):
    generation_ms: int | None = None
    usage: dict[str, int] | None = None
    attempts: int | None = None
    question: str
    latency_ms: int
    retrieval_ms: int
    provider: str
    model: str | None
    top_k: int
    score_threshold: float
    matched_chunks: int
    embedding_model: str
    embedding_revision: str


class DocumentResponse(BaseModel):
    employee_available: bool = False
    id: str
    title: str
    filename: str
    category: str
    tags: list[str]
    status: str
    chunk_count: int
    size_bytes: int
    page_count: int
    created_at: str
    updated_at: str
    error: str | None
    embedding_revision: str | None


class ChunkResponse(BaseModel):
    id: str
    text: str
    page: int | None
    start_offset: int
    end_offset: int


class DocumentDetailResponse(DocumentResponse):
    text: str
    chunks: list[ChunkResponse]


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    mode: str | None
    sources: list[Source]
    trace: Trace | None
    created_at: str


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: str


class ConversationDetailResponse(ConversationResponse):
    messages: list[MessageResponse]


class RetrievalResponse(BaseModel):
    question: str
    sources: list[Source]
    trace: Trace


class DeleteResponse(BaseModel):
    deleted: bool
    id: str


class CategoryCount(BaseModel):
    name: str
    count: int


class TrendCount(BaseModel):
    date: str
    count: int


class Activity(BaseModel):
    id: str
    type: str
    title: str
    description: str
    created_at: str


class DashboardResponse(BaseModel):
    documents: int
    chunks: int
    conversations: int
    queries: int
    categories: list[CategoryCount]
    query_trend: list[TrendCount]
    recent_documents: list[DocumentResponse]
    recent_activity: list[Activity]


class ReferencedDocument(BaseModel):
    id: str
    title: str
    count: int


class AnalyticsResponse(BaseModel):
    queries: int
    average_latency_ms: float
    average_chunks: float
    query_trend: list[TrendCount]
    most_referenced: list[ReferencedDocument]
    categories: list[CategoryCount]
