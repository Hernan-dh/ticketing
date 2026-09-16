# Ticketing

A ticketing MVP with a bilingual Spanish/English interface, configurable branding, event catalog, seat map, five-minute holds, QR issuance, and online single-use admission validation. It supports a local Node.js demo and a full Grails, MySQL, and Redis stack.

## Run the local demo on Windows

Requires Node.js 22 or newer:

```powershell
cd C:\Users\herna\Projects\ticketing
npm.cmd install
$env:ALLOW_DEMO_PAYMENTS = 'true'
npm.cmd run dev
```

Open http://localhost:5173. The server prints a temporary **operator key** in the terminal. Enter it under Sales, Access control, My brand, or Integrations. Set `ADMIN_KEY` before startup for a persistent key. It is stored in the tab's `sessionStorage`; never embed it in code or share it with buyers.

Use the `ES`/`EN` header button to switch languages. The preference controls UI copy, dates, and currency formatting and is persisted in the browser.

The demo stores state in `data/state.json`. Run only one instance in this mode. Docker Compose reads `.env`; npm commands use process environment variables.

### Demo workflow

1. Open an event and select up to eight seats.
2. Hold them for five minutes across all sales channels.
3. Enter an email and select **Simulate payment and issue**. No charge or email is sent.
4. Save or print the QR tickets.
5. Under Access control, authenticate, choose the event, and scan the token. Only its first use succeeds.
6. Review sales, update branding and integrations, or create an event.

## Full stack

Requires Docker with Compose. Grails builds with JDK 17 and Gradle 8.14.3.

```powershell
Copy-Item .env.example .env
# Replace every placeholder with a distinct random value.
docker compose up --build
```

Open http://localhost:3001. The catalog can remain unavailable until Grails finishes starting. MySQL and Redis are not exposed to the host; the app is published on loopback only. `ALLOW_DEMO_PAYMENTS=true` enables simulated issuance.

| Technology | Responsibility |
|---|---|
| React | Catalog, checkout, operations, branding, and integrations |
| PixiJS 8 | Seat-map rendering and selection |
| Backbone.js | Observable seat-selection model |
| Node.js / Express | Holds, issuance, authorization, and check-in API |
| Grails 7 | MySQL-backed event catalog service |
| MySQL 8.4 | Transactional inventory, sales, ticket, and catalog persistence |
| Redis 7.4 | Per-IP request limiting |

Grails owns `catalog_events`; Node synchronizes it when queried. Events cannot be edited or deleted in this MVP. Orders, payment references and tickets use normalized MySQL tables; ticket contact addresses are encrypted and the sales view uses customer pseudonyms. QR tokens are never stored directly. Short-lived holds, branding and integration settings remain in the JSON `ticketing_state` row, with `SELECT ... FOR UPDATE` serializing reservations across Node instances.

## Scope and limitations

### Demo payments

The API exposes `GET /api/payment-methods` with `demo_card` and `demo_transfer`. A checkout may send `paymentMethod`; when omitted it uses `demo_card` for backwards compatibility. Every issued order receives a `demo_paid` payment intent with an opaque reference. This application never accepts card numbers, CVV, CBU, bank credentials or payment proofs.

| Capability | Status |
|---|---|
| Four sales channels | Shared inventory; non-web channels require an operator key |
| Branding | One configurable name and color per installation |
| Digital and paper tickets | Browser-printable QR tickets |
| RFID | UID association and reader integration remain pending |
| Reserved seating | Rectangular map up to 20 × 20; free-form venue editing remains pending |
| Access control | Atomic, online, single-use validation |
| Payments | Simulated; gateway, webhooks, reconciliation, and refunds remain pending |
| Integrations | Provider intent is stored; adapters and execution remain pending |
| Users | Shared demo key; roles, sessions, auditing, and tenant isolation remain pending |

This is not production-ready. Before production, complete integrations, move short-lived holds to a dedicated store, protect public holds, and configure TLS, secret rotation, backups, observability, and load tests. A QR is a bearer credential: the first presentation wins. Never store card numbers.

## API

Operator endpoints require `x-admin-key`. Grails requires `X-Service-Key` inside the Compose network.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Storage mode and health |
| GET / POST | `/api/events` | List or create events |
| GET | `/api/events/:id/seats` | Sold and held seats |
| POST | `/api/holds` | Create a seat hold |
| POST | `/api/checkout` | Simulate payment and issue tickets |
| POST | `/api/scan` | Validate a ticket |
| GET | `/api/admin` | Operator sales and metrics |
| PUT | `/api/brand` | Update branding |
| PUT | `/api/integrations` | Register a provider |

## Verification

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run verify
npm.cmd run docs:changelog
npm.cmd run hooks:install
npx.cmd playwright test
```

The Node suite covers inventory conflicts, expiration, server pricing, idempotency, invalid tokens, duplicate admission, validation, permissions, concurrency, and persistence. The browser test covers Pixi, checkout, QR issuance, admission, JavaScript errors, and mobile width. MySQL, Redis, and Grails require additional integration verification.

References: [Grails 7 upgrading](https://grails.apache.org/docs/7.0.2/guide/upgrading.html), [Grails requirements](https://grails.apache.org/docs/7.0.2/guide/gettingStarted.html), and [PixiJS 8 Application](https://pixijs.com/8.x/guides/components/application).

## Documentation and publishing

Operational documentation lives in [`docs/`](docs/). `npm run docs:changelog` generates `CHANGELOG.md`, `npm run docs:decision -- "Title"` creates an ADR, and `npm run hooks:install` enables pre-commit verification.

`npm run publish:preview` verifies and proposes Conventional Commit metadata without changing Git. `npm run publish` requires `PUBLISH` before committing and pushing. Manual metadata and provider configuration are documented in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).
