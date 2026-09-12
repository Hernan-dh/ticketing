# Continuous documentation and safe publishing

Date: 2026-09-12
Status: accepted

## Context

Ticketing combines a browser app, a Node.js inventory service, a Grails catalog service, MySQL, Redis and external providers. Operational decisions must be recoverable from the repository, while changes need consistent validation and deliberate publication.

## Decision

Keep architecture, operations and ADRs in the repository. Generate the changelog and ADR drafts deterministically from local Git history. Use one dependency-free Node.js verifier from development, a pre-commit hook and GitHub Actions. The publishing command verifies changes, can request a bounded Conventional Commit proposal from Gemini, and requires the user to type `PUBLISH` before staging, committing and pushing.

## Consequences

- Code and documentation evolve in the same change.
- Publishing always requires explicit human confirmation.
- Verification requires only Node.js and installed project dependencies.
- Secret scanning is preventive and does not replace review.
