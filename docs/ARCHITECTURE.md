# Architecture

## Components

```text
Browser
  | React + Backbone + PixiJS
  v
Node.js / Express -------------------- Redis
  | reservations, orders, access       rate limiting
  v
MySQL <------------------------------ Grails catalog API
  inventory state                       event catalog
```

- `src/`: React user interface; PixiJS renders the seat plan and Backbone keeps the selected seats observable.
- `server/`: Express API for holds, checkout, QR ticket issuance, operator access and local/MySQL persistence.
- `grails/`: catalog service that validates and stores events.
- `infra/init.sql`: initial MySQL schema and seed events.
- `scripts/`: Python documentation, verification, hook installation and human-confirmed publishing automation.

## Trust boundaries

- Browser input, QR tokens and external integrations are untrusted input.
- `ADMIN_KEY`, `SERVICE_KEY` and database passwords come from environment variables and must not enter Git, logs or documentation.
- MySQL is the inventory authority; Redis is limited to request rate limiting.
- The optional commit-proposal request sends a size-limited Git diff to Gemini. It never sends API keys.

## Related decisions

- [Continuous documentation and safe publishing](decisions/0001-continuous-documentation-and-safe-publishing.md)
