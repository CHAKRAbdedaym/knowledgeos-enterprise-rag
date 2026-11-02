# Dependency and model choices

Dependencies come from PyPI, npm and official Docker image repositories; no downloaded shell installers are executed. Exact Python resolution is retained in backend requirements lock files and JavaScript resolution in package-lock.json. Re-run tests before upgrades. Version pinning supports repeatability; it is not a security audit.

| Component | Purpose | Upstream license family |
|---|---|---|
| React, Vite, Tailwind, Radix/shadcn patterns, Motion, TanStack Query, Recharts | Application UI | MIT |
| Lucide | Icons | ISC |
| Inter and Space Grotesk through Fontsource | Self-hosted fonts | SIL OFL 1.1 |
| FastAPI, SQLAlchemy, Alembic, Pydantic, HTTPX | API/persistence/validation | MIT |
| LangChain Core and langchain-qdrant | Document/embedding interfaces and vector adapter | MIT |
| Qdrant, FastEmbed, ONNX Runtime | Vector storage and CPU embedding execution | Apache-2.0 / Apache-2.0 / MIT |
| all-MiniLM-L6-v2 | Local semantic encoder | Apache-2.0 model card |
| pypdf | PDF extraction without a copyleft PDF runtime | BSD-3-Clause |
| PostgreSQL | Transactional metadata | PostgreSQL License |
| psycopg / binary distribution | PostgreSQL driver | LGPL-3.0 and bundled library notices |
| pytest | Test runner | MIT |

Consult installed distribution notices for exact versions and transitive licenses before redistributing a binary product. The KnowledgeOS application icon is original SVG code. The requested IAWEB.DEV wordmark is an unmodified third-party asset downloaded from the public site; its source and exclusion from the project’s MIT license are recorded in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). The included company knowledge remains fictional; the visual reference does not imply endorsement or an official deployment.

Implementation references checked during development:

- [LangChain Qdrant integration](https://docs.langchain.com/oss/python/integrations/vectorstores/qdrant): current QdrantVectorStore API and cosine search.
- [Qdrant FastEmbed](https://qdrant.tech/documentation/fastembed/): CPU embeddings via ONNX.
- [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): embedding model characteristics and license.
- [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy](https://docs.sqlalchemy.org/en/20/) and [Alembic](https://alembic.sqlalchemy.org/en/latest/): typed API and versioned persistence.

A supported model name is configured at runtime for external generation. No subscription, API balance or model availability is assumed by the repository.

Administrator password hashing uses argon2-cffi (MIT) and its pinned bindings; passwords use Argon2id. See the [upstream API](https://argon2-cffi.readthedocs.io/en/stable/api.html).
