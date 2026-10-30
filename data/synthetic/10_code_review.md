# Code review and quality

> **SYNTHETIC — portfolio reconstruction.** This document is entirely fictional, created to demonstrate KnowledgeOS. It is not actual IAWEB.DEV material and does not represent its policies, employees or customers. All names, rules, durations and values belong only to this demonstration scenario. Do not use this text as professional or legal advice.

Fictional version: 1.0 · Reviewed: 2026-10-01 · Next review: 2027-01-01

## Author preparation

The author uses a short-lived branch and a change small enough to understand in one review session. The description explains the concrete problem, resulting behavior and verification performed. Screenshots support visual changes. Migrations, configuration and data impact are disclosed. No secrets, customer exports or unnecessary generated files enter the repository. The author reads the diff before requesting review. A clear description lets a reviewer evaluate intent without reconstructing the entire conversation that led to the implementation.

## Approval rules

A pull request requires at least one approval from another developer and all required CI checks passing. Sensitive changes involving authentication, permissions or data processing also need the relevant specialist’s review. Authors cannot approve their own work. Blocking comments identify a functional defect, risk or required convention. Personal style suggestions are labeled as optional. A substantial revision triggers review of the affected parts. The reviewer should distinguish a measurable concern from a preference that does not justify delaying a delivery.

## Review method

Start from acceptance criteria, then follow data paths and failures. Check input limits, authorization, transactions and logs. For interfaces, examine accessibility, empty states and degraded service behavior. Tests should prove observable outcomes, especially rejection, duplicate handling and interrupted operations. Tests that merely repeat the implementation’s shape give weak evidence. A new dependency needs a reason and a compatible version. A generated-code contribution follows the same standards as manually written code and does not inherit trust from its tool.

## Integration and learning

The main branch stays deployable. Authors resolve conflicts and rerun relevant checks. Urgent fixes still receive a second review and a validation record. An exceptional deferred step needs an accepted risk, follow-up owner and deadline. Secrets never enter code to save emergency time. API changes update the contract; structural decisions document context, alternatives and consequences. Review builds shared understanding, not complete transfer of responsibility. Defects discovered after merge feed improvements in tests, conventions and training rather than personal blame.

## Applying and maintaining this guidance

Before acting, verify the scope, version and responsible role. Record an exception with its rationale, owner, expiration and next review. Report a contradiction to the document owner rather than silently combining incompatible instructions. A useful request states the expected result, observed situation and decision needed, without including secrets. Keep approved decisions in the relevant project or restricted administrative record. To revise this note, propose a reviewed change and update related references. These examples support retrieval experiments and portfolio interviews; they do not provide evidence of an actual deployment, real customer outcome or operating certification.

## Worked example

A reviewer finds that duplicate submission creates two records. The author adds a meaningful regression check, corrects the behavior and requests another review of the affected path. A passing formatting check alone would not validate the fix.
