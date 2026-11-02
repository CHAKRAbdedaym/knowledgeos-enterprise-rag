# Gemini: secure configuration and live verification

## Current verified state

The backend has a real server-side Gemini REST adapter (`app/gemini.py`) using Google's `v1beta/models/{model}:generateContent` endpoint, header authentication and structured JSON output. Unit tests use HTTPX MockTransport: they do **not** prove account access. On 2026-11-02, the configured account returned HTTP 200 for the exact model metadata and produced a genuine grounded answer using actual MiniLM/Qdrant retrieval and canonical SQL passages. The local deployment now uses Gemini. Unit mocks remain separate from this live evidence. Remaining quota and billing tier could not be inspected through this key/API.

The preferred identifier is `gemini-3.5-flash-lite`. Google documents this model, structured output, pricing and rate limits in its official documentation:

- [Model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Generation API](https://ai.google.dev/api/generate-content)
- [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Quotas](https://ai.google.dev/gemini-api/docs/rate-limits)

Published free-tier pricing does not establish eligibility, remaining quota or availability for an individual project. Check the project's active limits in Google AI Studio. A successful request establishes access at that moment, not unlimited or permanently free usage. Do not change to a paid or alternative model without the owner's decision.

## Owner action: configure the secret locally

Create a Google AI Studio key for the intended project. Do not paste it into chat, a command argument, a screenshot or source code. In your own interactive terminal:

```sh
cd /home/timsilo/Desktop/hussin/knowledgeos-enterprise-rag
python3 scripts/configure_gemini.py
```

The prompt hides input and writes only `GEMINI_API_KEY` to ignored root `.env`, atomically, with mode 0600. It preserves the current provider and all other settings. No key is sent anywhere by this helper. Tell your collaborator only that configuration is ready, never the key itself.

Do not activate generation until account/model access and active quota are checked. After that verification, the backend configuration is:

```dotenv
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash-lite
```

Recreate the backend to load changed environment values:

```sh
docker compose up -d --no-deps --force-recreate backend
```

If an administrator previously persisted runtime provider defaults, **Settings → Server defaults** takes precedence for those fields. Select the verified provider/model there as well. The UI exposes configuration status only, never a key or a claim that a live request succeeded.

## Reproduce live verification after configuration

Run `make gemini-verify` for one explicit bounded real generation using actual indexed synthetic evidence. This command makes provider requests and may consume the project's quota. It never prints the key.

1. Retrieve model metadata using the key header, without printing the key or raw provider errors.
2. Confirm the selected identifier and `generateContent` support. Inspect AI Studio's current quota and billing tier; API success alone cannot prove these.
3. Make one bounded, genuine request using retrieved synthetic passages, validate citations and record only safe outcome/model/usage metadata.
4. Repeat the employee portal flow against the configured provider and confirm `grounded` or an honest abstention, never treat `retrieval_only` as generated text.
5. If access, 404, 429 or account eligibility blocks the requested model, report it and ask the owner to choose an available alternative before changing models.

## Failure behavior and privacy

A bounded total timeout and at most three attempts apply. Only 429/502/503/504 are retried with bounded exponential delay/jitter; a larger Retry-After is propagated to the caller rather than sleeping or retrying early. Transport/timeouts are not blindly replayed. Responses blocked by safety, truncated, malformed or with invalid citations fail safely. Quota errors return 429, timeouts 504, provider failures 503. No infinite loops or silent switch to a different paid model.

The context contains selected real passages and bounded conversation history. Instructions within these are untrusted. Citation validation checks numeric references and source membership, not claim-level factual entailment. Sensitive content is not logged intentionally; provider processing sends that content to Google. Use synthetic documents only in this portfolio and review free-tier data terms.

English MiniLM embeddings and the English corpus are unchanged. Multilingual Gemini generation does not fix poor French retrieval. No embedding migration or automatic reindexing was performed.


## Observed citation issue and correction

Initial real responses supplied valid citation numbers in the JSON array but omitted inline `[n]` markers from the answer. The existing validator correctly abstained. The prompt and Gemini output-schema descriptions now explicitly require inline citations in factual sentences. The successful live response passed the original validator, which was not weakened. Shape/source-membership validation still does not prove every sentence is entailed by its cited passage.
