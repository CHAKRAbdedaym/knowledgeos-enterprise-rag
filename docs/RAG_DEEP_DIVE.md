# RAG deep dive

## What this implementation actually does

RAG separates finding evidence from composing prose. KnowledgeOS first embeds an uploaded document into numeric vectors and stores those vectors in Qdrant. At question time it embeds the question with the same model, searches the collection and maps the returned payloads back to stored documents. Without an LLM key, the product stops here and displays passages. With a provider configured, it sends only a bounded evidence set and bounded conversation history to the provider and validates the citation structure of its response.

This is a reconstructed demonstration with synthetic policies. It is not an evaluation of a real enterprise knowledge base.

## Extraction, normalization and traceability

PDF extraction uses pypdf, preserving a page number for each passage. Markdown and UTF-8 text are extracted as text; they have no invented PDF page numbers. Textless scans require external OCR. Empty, encrypted and malformed documents are rejected with useful messages.

Display text and character offsets refer to the stored extracted text, not byte offsets in a PDF file or screen coordinates. Chunking respects page boundaries and seeks a whitespace/newline boundary near its character limit. Embedding input can normalize whitespace without changing the preserved source passage. This distinction lets a user compare a citation with the document preview.

## Tokens, chunks and overlap

A token is a model-specific unit, often part of a word. Characters and tokens are different measures. The default chunk size is 900 characters with up to 150 characters of overlap. This is a transparent, CPU-friendly heuristic for the English synthetic corpus; it is not an exact guarantee against tokenizer truncation. The MiniLM tokenizer has a finite sequence limit. Dense text, unusual symbols and other languages may reach it sooner than ordinary English.

Overlap keeps facts near a split boundary available to a neighbor. It also duplicates some information, consumes storage and can produce adjacent results from the same document. Smaller chunks tend to isolate facts; larger chunks preserve context but can dilute similarity. These parameters must be evaluated rather than described as universally optimal.

## Embeddings

The default encoder is `sentence-transformers/all-MiniLM-L6-v2`, executed locally using FastEmbed and ONNX Runtime. Its output has 384 dimensions. The encoder maps semantically related text to nearby points. It does not turn a passage into a guaranteed factual answer and does not understand permissions.

The application uses the same encoder for questions and documents. It records model identity, dimensions and an artifact fingerprint. Existing collections must use compatible geometry. Switching to another embedding model requires rebuilding a collection; matching dimension counts alone do not make different models compatible.

The first embedding operation downloads model artifacts. This can be slower than later requests, so a demonstration should seed the corpus before opening the research screen. The model cache persists across container restarts.

## Vector search and scores

For vectors a and b, cosine similarity is `dot(a, b) / (norm(a) * norm(b))`. A higher cosine score means greater directional similarity, not a probability that the passage answers the question. Qdrant searches with cosine distance through LangChain's `QdrantVectorStore` integration.

The request validates `top_k` from 1 to 10 and `score_threshold` from 0 to 1. Defaults are 5 and 0.30. Raising the threshold can suppress weak matches but also discard useful paraphrases. Lowering it can retrieve irrelevant context. The trace exposes scores and the chosen controls so this tradeoff is inspectable.

SQL document status is authoritative: passages from incomplete or missing metadata records are excluded. Source payloads carry document ID, title, chunk ID, page, text and offsets. Historical answers retain source snapshots even if a document is later removed.

## Context and prompt construction

The inspectable system prompt explicitly treats documents and conversation history as untrusted data. It tells the generator to use only evidence, ignore instructions inside it, cite numeric evidence identifiers and return insufficient evidence when appropriate. User questions have a length limit; retrieval has a bounded number and size of chunks; only a bounded history enters generation. KnowledgeOS does not retrieve whole documents into a prompt.

Prompt instructions reduce risk but are not a complete prompt-injection defense. A malicious passage can still influence a model. There is no autonomous tool execution from model output. Authorization and document filtering would need to happen before retrieval in a multi-user product.

## Generation and honest fallback

`LLM_PROVIDER=none` returns real retrieved passages with an explicit retrieval-only label. No generated summary is implied. A configured OpenAI-compatible supported chat model or local Ollama model can produce grounded prose. The model must supply citation identifiers; the backend validates their bounds and appearance in the answer. Provider failures surface an error rather than silently inventing a response.

No retrieved evidence causes abstention. A provider can also declare insufficient evidence. A high similarity score by itself cannot reliably detect a question about a missing fact in an otherwise relevant policy. The retrieval-only screen therefore says that passages are relevant, not that they answer the question. Semantic entailment, contradiction detection and claim-level citation verification remain improvements.

Citation validation is structural: it prevents references to nonexistent retrieved entries. It does **not** prove that every sentence is entailed by the cited passage.

## Evaluating without inventing accuracy

`data/synthetic/evaluation.json` lists supported questions, expected source filenames and unsupported examples. `scripts/evaluate.py` calls the real retrieval API and reports retrieval hit rate at k against those declared expectations. This is a small, transparent smoke evaluation of this corpus, not a general accuracy benchmark.

Useful complementary checks are reciprocal rank, precision at k, duplicate-passage rate, passage coverage, no-evidence abstention, supported-claim ratio and end-to-end latency percentiles. Grounded answer quality needs human or carefully validated judge review; an automated score alone does not establish correctness. Record corpus hash, model fingerprint, threshold, top-k and runtime conditions alongside any comparison.

Evaluation itself creates query events. Dashboard totals include those actual requests. Do not populate charts with invented time series to make a screenshot look busier.

## Failure modes and tradeoffs

- OCR is absent; scans can have no extractable text.
- Tables, columns and PDF reading order may extract imperfectly.
- Character chunking can split a logical section or exceed token limits.
- Similarity can retrieve a related policy that omits the requested fact.
- Follow-up questions should be explicit: there is no standalone-question rewrite stage.
- Context may contain outdated, conflicting or malicious passages.
- Dense retrieval alone can miss exact acronyms and identifiers; hybrid retrieval is a future option.
- Provider timeouts, malformed JSON and unsupported model formats are real failure cases.
- Synchronous ingestion and single-process locks suit this small local corpus, not a distributed ingestion service.
- PostgreSQL and Qdrant do not share a distributed transaction. Retry and cleanup cover ordinary errors; a durable reconciliation worker is needed for crash consistency at scale.

The interview-worthy strength is the inspectable data path and honest operating modes, not an unsupported claim of perfect answers.
