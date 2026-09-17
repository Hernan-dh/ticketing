# Automated testing plan

## Objectives

The suite must detect regressions in seat inventory, checkout, admission, privacy boundaries, customer profiles, browser rendering and deployment wiring without writing to the deployed environment.

## Test pyramid

| Level | Command | Scope | When |
| --- | --- | --- | --- |
| Domain | `npm run test:unit` | Pricing, hold expiry, inventory conflicts, checkout idempotency and token use rules | Every change |
| Local API | `npm run test:api` | Express authorization, persistence, concurrency and API responses with file storage | Every change |
| Static/build | `npm run verify` | Diff hygiene, secrets, docs, Node tests and production bundle | Every commit/PR |
| Browser | `npm run test:browser` | React, Pixi seat selection, totals, checkout, QR and responsive UI | Every PR/release |
| Isolated stack | `npm run test:integration` | Docker Compose, MySQL, Redis, Grails, encrypted customer profile, sales and double scan | Every PR/release |
| Deployment smoke | `npm run test:smoke` | Public health and catalog endpoints | After deployment |

`npm run test:all` runs verification, browser and isolated-stack tests. It requires Docker, Playwright's selected browser and enough local resources to build the stack.

## Isolation and safety

The integration runner creates a unique Docker Compose project, random named volumes and a loopback-only test port (default `3311`). It supplies synthetic credentials at process runtime and always runs `docker compose down --volumes --remove-orphans` in cleanup. It never reads `.env`, calls the deployed URL or shares the production Compose project.

Use `npm run test:integration -- --keep` only for debugging a failure; remove the retained project manually afterward. Set `TEST_PORT` if port 3311 is occupied.

The smoke test is read-only. It requires an explicit `SMOKE_BASE_URL` and only calls `/api/health` and `/api/events`:

```powershell
$env:SMOKE_BASE_URL = 'https://ticketing.example.test'
npm.cmd run test:smoke
```

## Required coverage

| Risk | Automated evidence |
| --- | --- |
| Oversell or expired hold | Unit and API concurrency tests |
| Incorrect client total | Unit server-price assertion and browser checkout-total assertion |
| Duplicate payment/tickets | Checkout retry test plus unique hold integration path |
| Reused QR | Parallel scan returns one `200` and one `409` |
| Contact/profile leak | Integration round-trip through authorized reveal only; dashboard uses pseudonym |
| Broken encryption schema | Integration checkout writes/reveals customer profile on real MySQL |
| Catalog/service wiring | Integration waits for Grails-backed `/api/events` |
| Public regression | Read-only smoke test after deployment |

## Release gate

1. `npm ci` and `npm run test:all` succeed on a clean checkout.
2. Apply migrations to a disposable database and run `npm run test:integration`.
3. Build the release image.
4. Deploy using the operations runbook.
5. Run `test:smoke` against the public URL.
6. Manually verify only flows that intentionally need human hardware or approval: RFID reader, payment-provider webhooks, backup restore and key-rotation rehearsal.

## CI recommendation

Run `npm run verify` on every push. Add `test:browser` and `test:integration` to pull requests once the CI runner has Docker and Playwright browser dependencies available. Keep smoke tests out of untrusted pull requests; trigger them only after deployment with an environment-protected URL.
