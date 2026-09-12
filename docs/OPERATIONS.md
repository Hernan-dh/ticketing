# Operations

## Verification and documentation

```powershell
npm run verify
npm run docs:changelog
npm run docs:decision -- "Short decision title"
npm run hooks:install
```

On Windows, `npm run verify` requires the Python launcher (`py -3`). The Git hook uses `scripts/verify.sh`, which also looks for a project virtual environment, `python3`, `python`, and then `py -3`.

`npm run verify` invokes Python 3 and runs whitespace checks, checks required documentation, scans for likely private files and secrets, runs Node tests and builds the browser bundle. The pre-commit hook runs the same verifier once enabled. GitHub Actions runs it for pushes and pull requests.

## Commit publication

```powershell
# Proposal and verification only; does not change Git state.
npm run publish:preview -- --title "docs: add documentation automation" --description "Document the automated verification and publishing workflow."

# Human-confirmed commit and push.
npm run publish -- --title "docs: add documentation automation" --description "Document the automated verification and publishing workflow."
```

When no title and description are passed, `publish` uses `GEMINI_API_KEY` and optionally `GEMINI_COMMIT_MODELS` (comma-separated) or `GEMINI_COMMIT_MODEL` from the local `.env`. It tries `gemini-2.5-flash`, `gemini-flash-latest` and `gemini-2.5-flash-lite` by default, then uses `GROQ_API_KEY` and `OPENROUTER_API_KEY` if configured. Each request waits up to eight seconds by default; set `COMMIT_GENERATION_TIMEOUT` to override it. If every optional provider fails, the script creates a valid local Conventional Commit proposal from the changed paths. The proposal receives at most 24,000 characters of changed paths and diff. The command displays its proposal and only publishes after the literal `PUBLISH` confirmation. It does not force push.

`.env` stays ignored. Never put real `ADMIN_KEY`, `SERVICE_KEY`, database credentials or provider keys in a commit, documentation, terminal recording or issue.

## Runtime

See [README](../README.md) for running the demo and Compose stack. Use `.env.example` as the non-secret reference for Compose configuration. Grails needs Java 17; Compose needs Docker. Before a deployment, run `npm run verify`, build the Compose stack, configure distinct production secrets and keep MySQL/Redis private to the application network.
