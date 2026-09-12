# Agent instructions

## Continuous documentation

- Document lasting functional, technical, or operational decisions in the same task.
- Update `docs/ARCHITECTURE.md` when components, integrations, trust boundaries, or data flows change.
- Update `docs/OPERATIONS.md` when configuration, deployment, verification, diagnostics, or recovery changes.
- Create an ADR in `docs/decisions/` only when relevant alternatives exist and the decision is not evident from the code.
- Do not document cosmetic changes, trivial fixes, or refactors without behavioral changes.
- Never include tokens, credentials, `.env` values, personal data, or private information in versioned files or diagnostic output.

## Publishing

- Run `npm run verify` before proposing publication.
- Do not create commits or push without explicit user authorization.
- Never force-push.
