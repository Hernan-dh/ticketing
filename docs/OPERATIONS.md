# Operations

## Verification and documentation

```powershell
npm run verify
npm run docs:changelog
npm run docs:decision -- "Short decision title"
npm run hooks:install
```

On Windows, `npm run verify` requires the Python launcher (`py -3`). The Git hook uses `scripts/verify.sh`, which also looks for a project virtual environment, `python3`, `python`, and then `py -3`.

`npm run verify` invokes Python 3 and runs whitespace checks, checks required documentation, scans for likely private files and secrets, runs Node tests and builds the browser bundle. The pre-commit hook runs the same verifier once enabled. GitHub Actions invokes `python scripts/verify.py` directly because the Windows `py` launcher is not available on its Linux runner.

## Commit publication

```powershell
# Proposal and verification only; does not change Git state.
npm run publish:preview -- --title "docs: add documentation automation" --description "Document the automated verification and publishing workflow."

# Human-confirmed commit and push.
npm run publish -- --title "docs: add documentation automation" --description "Document the automated verification and publishing workflow."
```

When no title and description are passed, `publish` uses `GEMINI_API_KEY` and optionally `GEMINI_COMMIT_MODELS` (comma-separated) or `GEMINI_COMMIT_MODEL` from the local `.env`, then uses `GROQ_API_KEY` and `OPENROUTER_API_KEY` if configured. Each request waits up to 15 seconds by default; set `COMMIT_GENERATION_TIMEOUT` to override it. The proposal receives at most 24,000 characters containing changed paths, tracked diffs and the text of new files, and must describe the intent and behavior of the change. If no provider is configured or every provider fails, publication stops instead of producing a generic commit; `--title` and `--description` remain available for a manual proposal. Preview verifies once without changing Git. Publication stages the selected paths, verifies that exact state once, and commits with `--no-verify` because the identical pre-commit verifier has just succeeded; this prevents repeated production builds. The command only publishes after the literal `PUBLISH` confirmation and does not force push.

`.env` stays ignored. Never put real `ADMIN_KEY`, `SERVICE_KEY`, database credentials or provider keys in a commit, documentation, terminal recording or issue.

## Runtime

See [README](../README.md) for running the demo and Compose stack. Use `.env.example` as the non-secret reference for Compose configuration. Grails needs Java 17; Compose needs Docker. Before a deployment, run `npm run verify`, build the Compose stack, configure distinct production secrets and keep MySQL/Redis private to the application network.

### Replacing the deployed data with demonstration data

`scripts/seed-demo.mjs` replaces the complete event catalog and transactional state with fictional demonstration data: events, orders, tickets, checked-in tickets and simulated provider settings. It is intentionally guarded because it deletes the current catalog and state. It must only be used on a demonstration deployment, after a verified backup.

```bash
cd /srv/projects/ticketing
sudo docker compose exec -T -e CONFIRM_DEMO_RESET=ticketing-demo app node scripts/seed-demo.mjs --reset
```

The dataset uses `example.test` addresses and simulated payment labels only. It stores no cards, payment credentials or real customer data.

### Privacy-core schema migration

The relational privacy schema is in `infra/migrations/002_privacy_core.sql`. Take and verify a backup before applying it. The migration is additive and creates no personal data by itself:

```bash
cd /srv/projects/ticketing
sudo docker compose exec -T mysql sh -c 'exec mysql -uticketing -p"$MYSQL_PASSWORD" ticketing' < infra/migrations/002_privacy_core.sql
```

Do not enable contact collection until application-level encryption and role-based access are deployed. The schema deliberately contains provider references only; it has no fields for card data or identity documents.

Before activating the relational application version on an existing deployment, apply the idempotency migration after `002_privacy_core.sql`:

```bash
sudo docker compose exec -T mysql sh -c 'exec mysql -uticketing -p"$MYSQL_PASSWORD" ticketing' < infra/migrations/003_activate_relational_store.sql
```

Set independent random values of at least 32 characters for `CONTACT_ENCRYPTION_KEY` and `TICKET_TOKEN_KEY`, then recreate the application container. Keep both values stable and backed up: changing the contact key prevents contact recovery, while changing the ticket key prevents regenerated QR tokens from matching previously issued tickets. Fresh Compose volumes apply migrations `002` and `003` automatically.
