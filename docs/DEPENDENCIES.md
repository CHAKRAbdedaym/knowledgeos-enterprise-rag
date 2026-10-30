# Dependency and model choices

Dependencies come from PyPI, npm and official Docker image repositories; no downloaded shell installers are executed. Exact Python resolution is retained in backend requirements lock files and JavaScript resolution in package-lock.json. Re-run tests before upgrades. Version pinning supports repeatability; it is not a security audit.

| Component | Purpose | Upstream license family |
|---|---|---|
| React, Vite, Tailwind, Radix/shadcn patterns, Motion, TanStack Query, Recharts | Application UI | MIT |
| Lucide | Icons | ISC |
| Inter through @fontsource/inter | Self-hosted font | SIL OFL 1.1 |
| FastAPI, SQLAlchemy, Alembic, Pydantic, HTTPX | API/persistence/validation | MIT |
| LangChain Core and langchain-qdrant | Document/embedding interfaces and vector adapter | MIT |
| Qdrant, FastEmbed, ONNX Runtime | Vector storage and CPU embedding execution | Apache-2.0 / Apache-2.0 / MIT |
| all-MiniLM-L6-v2 | Local semantic encoder | Apache-2.0 model card |
| pypdf | PDF extraction without a copyleft PDF runtime | BSD-3-Clause |
| PostgreSQL | Transactional metadata | PostgreSQL License |
| psycopg / binary distribution | PostgreSQL driver | LGPL-3.0 and bundled library notices |
| pytest | Test runner | MIT |

Consult installed distribution notices for exact versions and transitive licenses before redistributing a binary product. The repository contains no vendored commercial documents or brand image downloads. The logo is original SVG code. IAWEB.DEV is a context label for a fictional reconstructed dataset, not an endorsement.

Implementation references checked during development:

- [LangChain Qdrant integration](https://docs.langchain.com/oss/python/integrations/vectorstores/qdrant): current QdrantVectorStore API and cosine search.
- [Qdrant FastEmbed](https://qdrant.tech/documentation/fastembed/): CPU embeddings via ONNX.
- [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): embedding model characteristics and license.
- [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy](https://docs.sqlalchemy.org/en/20/) and [Alembic](https://alembic.sqlalchemy.org/en/latest/): typed API and versioned persistence.

A supported model name is configured at runtime for external generation. No subscription, API balance or model availability is assumed by the repository.
