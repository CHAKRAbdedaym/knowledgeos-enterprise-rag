# Operational security policy

> **SYNTHETIC — portfolio reconstruction.** This document is entirely fictional, created to demonstrate KnowledgeOS. It is not actual IAWEB.DEV material and does not represent its policies, employees or customers. All names, rules, durations and values belong only to this demonstration scenario. Do not use this text as professional or legal advice.

Fictional version: 1.0 · Reviewed: 2026-10-01 · Next review: 2027-01-01

## Principles and classes

Security uses least privilege, traceability and minimal collection. Information classes are Public, Internal, Confidential and Restricted. Nonpublic customer information is at least Confidential; access secrets are Restricted. The data owner decides authorized recipients. If classification is unclear, temporarily use the higher class and request clarification. A classification label is not permission to disclose information. An exception must be explicit rather than inferred from convenience, seniority or a previous unrelated approval.

## Authentication and secrets

MFA is mandatory for professional accounts where supported. Secrets belong in an approved vault or protected environment variables. Local .env files are excluded from version control. Tokens must not appear in tickets, screenshots or prompts sent to outside providers. An exposed secret is revoked and replaced. Deleting a message or removing a commit does not make the old value safe. Security considers who could have accessed the value and which sessions or systems require additional checks.

## Workstations and exceptions

Devices use disk encryption and automatic locking after five minutes of inactivity. Critical patches are assessed within two working days and applied under an approved plan. Private resources require the VPN. Public networks are untrusted. A technical exception records its owner, rationale, expiration date and compensating control. Exceptions are reviewed monthly so that temporary permissions do not silently become permanent. Installing software from an unknown source is not an acceptable shortcut around a broken approved package.

## Data and reporting

A new tool receiving Confidential or Restricted data needs security review and data-owner approval. Hosting region, subprocessors and export options are considered. Before external sharing, check recipients, attachment metadata and link permissions. Demonstration datasets must be synthetic and labeled. Suspected phishing, leaks and unusual access are reported immediately under the incident procedure. Quarterly access review and quarterly restoration exercises are fictional operating requirements. They do not prove an actual audit, ISO certification or legal compliance for an existing organization.

## Applying and maintaining this guidance

Before acting, verify the scope, version and responsible role. Record an exception with its rationale, owner, expiration and next review. Report a contradiction to the document owner rather than silently combining incompatible instructions. A useful request states the expected result, observed situation and decision needed, without including secrets. Keep approved decisions in the relevant project or restricted administrative record. To revise this note, propose a reviewed change and update related references. These examples support retrieval experiments and portfolio interviews; they do not provide evidence of an actual deployment, real customer outcome or operating certification.

## Worked example

A developer accidentally commits a token. The first protective action is revocation and replacement, followed by an impact review. Removing the visible line is cleanup; it does not prove that nobody retained or used the old credential.
