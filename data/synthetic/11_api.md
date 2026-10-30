# Business API conventions

> **SYNTHETIC — portfolio reconstruction.** This document is entirely fictional, created to demonstrate KnowledgeOS. It is not actual IAWEB.DEV material and does not represent its policies, employees or customers. All names, rules, durations and values belong only to this demonstration scenario. Do not use this text as professional or legal advice.

Fictional version: 1.0 · Reviewed: 2026-10-01 · Next review: 2027-01-01

## Scope

This document describes a fictional customer-project business API under /v1. It does not specify the KnowledgeOS portfolio application, whose actual routes use /api. Resource names are plural and identifiers opaque. JSON is UTF-8 except explicitly documented multipart uploads. Timestamps use ISO 8601 with a time zone; technical logs use UTC. Keeping these scopes separate avoids mistaking an example customer convention for an implementation promise about an unrelated service or interface.

## Validation and pagination

Validate input type, length, format and allowed values at the API boundary. A pagination limit is bounded between 1 and 100. Large collections may use an opaque cursor. Filters and sortable fields are documented and allowlisted. An empty search is a valid result. Browser validation does not replace server validation. Sensitive fields are never added to a response merely because they exist in a database model. Request limits should protect the service while returning a useful, stable error.

## Statuses and errors

Successful creation returns 201, reading 200 and content-free deletion 204. Invalid input returns 422, missing resources 404 and business conflicts or version conflicts 409. Errors contain a stable code, a comprehensible message and request_id. They never expose a stack trace or secret. Support uses request_id to locate logs instead of asking users for complete confidential exports. Clients distinguish an expected rejection from a temporary service failure so that they do not retry invalid data indefinitely.

## Access and evolution

Authentication alone does not authorize access to a resource. Sensitive operations check role and scope. Costly mutations may use a documented idempotency key: the same key and content return the original result. Concurrent updates use version checks or equivalent protection. Compatible changes add optional fields; breaking changes require versioning and an agreed transition. Logs measure latency, status and correlation without sensitive bodies. Contract examples use synthetic data. Release notes explain impact and rollback; rate limits include clear client retry guidance.

## Applying and maintaining this guidance

Before acting, verify the scope, version and responsible role. Record an exception with its rationale, owner, expiration and next review. Report a contradiction to the document owner rather than silently combining incompatible instructions. A useful request states the expected result, observed situation and decision needed, without including secrets. Keep approved decisions in the relevant project or restricted administrative record. To revise this note, propose a reviewed change and update related references. These examples support retrieval experiments and portfolio interviews; they do not provide evidence of an actual deployment, real customer outcome or operating certification.

## Worked example

A client repeats a costly mutation after a network timeout. A documented idempotency key lets the server identify the prior operation. Without that contract, the client first checks the resource state instead of assuming the original request failed.
