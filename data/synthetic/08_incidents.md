# Incident management

> **SYNTHETIC — portfolio reconstruction.** This document is entirely fictional, created to demonstrate KnowledgeOS. It is not actual IAWEB.DEV material and does not represent its policies, employees or customers. All names, rules, durations and values belong only to this demonstration scenario. Do not use this text as professional or legal advice.

Fictional version: 1.0 · Reviewed: 2026-10-01 · Next review: 2027-01-01

## Report promptly

An incident threatens or harms availability, integrity or confidentiality. The reporter records time in UTC, affected system, symptoms and known impact. Secrets and customer files do not belong in an open incident channel. Suspicious behavior is reported before complete proof exists. The on-duty role acknowledges the report and appoints an incident coordinator. One incident board holds observations and decisions. A report should preserve what was actually observed and avoid turning an unverified explanation into an established cause.

## Severity levels

SEV1 means a complete outage of a critical production service or a confirmed data leak. SEV2 means major degradation without an acceptable workaround. SEV3 means limited inconvenience with an available workaround. Severity is revised as facts change. It determines communication and staffing, not personal blame. The SLA document defines response targets during covered business hours. The incident team records why a severity changed so that a later review can distinguish new evidence from an arbitrary downgrade.

## Roles and containment

The coordinator maintains the timeline and assigns actions. The technical lead diagnoses the failure. The security contact handles compromise risks. The communication owner gives factual updates. Containment can involve revoking a token, isolating a laptop or stopping a job. A disruptive action records expected impact and its approving owner. A SEV1 receives an update every 30 minutes while being handled. Updates separate confirmed facts, hypotheses and the next information time rather than promising an unsupported restoration date.

## Recovery and learning

Recovery checks service behavior and data integrity, followed by increased observation. An apparently healthy service is insufficient if an attacker still has access. Evidence is preserved within authorized access; staff do not investigate other people’s accounts independently. A SEV1 or SEV2 review occurs within five working days of stabilization. It records impact, timeline, established causes and preventive actions with owners and deadlines. Regulatory or contractual notification duties require a separate real-world analysis and are not determined by this fictional procedure.

## Applying and maintaining this guidance

Before acting, verify the scope, version and responsible role. Record an exception with its rationale, owner, expiration and next review. Report a contradiction to the document owner rather than silently combining incompatible instructions. A useful request states the expected result, observed situation and decision needed, without including secrets. Keep approved decisions in the relevant project or restricted administrative record. To revise this note, propose a reviewed change and update related references. These examples support retrieval experiments and portfolio interviews; they do not provide evidence of an actual deployment, real customer outcome or operating certification.

## Worked example

A production outage initially appears limited, then evidence shows the critical service is fully unavailable. The coordinator upgrades severity, records the new facts and adjusts communication. The review later explains this sequence without treating the initial uncertainty as concealment.
