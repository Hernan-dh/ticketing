# Technical reference

This document describes the deployed MySQL architecture. The local file-backed mode intentionally keeps the original all-in-one domain model for development and automated API tests.

## Runtime topology

```text
Browser
  | HTTPS
  v
Caddy (host) --> 127.0.0.1:3001
                    |
                    v
              Express / Node.js
               |      |       |
               |      |       +--> Redis (rate limiting only)
               |      +----------> Grails catalog API
               +-----------------> MySQL 8.4
```

The Compose application port is bound to host loopback. Caddy is the public TLS endpoint and reverse-proxies to port 3001. MySQL, Redis and Grails have no published host ports.

## Component responsibilities

| Component | Responsibility | Authoritative data |
| --- | --- | --- |
| React | Catalog, seat selection, checkout, sales and admission UI | Browser state only |
| Backbone model | Observable selected-seat list | Current browser selection |
| PixiJS | Graphical seat map | None |
| Express | Validation, holds, checkout transaction, ticket issuance and admission | Transaction orchestration |
| Grails | Event catalog validation and creation | `catalog_events` |
| MySQL | Orders, payment references, tickets, encrypted contacts and serialized shared state | Durable application data |
| Redis | Fixed-window per-IP API request counter | Ephemeral counters |
| Caddy | TLS termination, security headers and reverse proxy | TLS material managed by Caddy |

## Storage modes

### Local mode

When `MYSQL_URL` is absent, `data/state.json` contains events, holds, orders, payment intents and tickets. Operations are serialized through an in-process promise queue and saved through a temporary-file rename. This mode supports only one Node process and is not a production topology.

### MySQL mode

When `MYSQL_URL` is present, normalized tables are authoritative for customers, contacts, payment methods, orders, payments and issued tickets. `ticketing_state.payload` remains authoritative only for:

- short-lived seat holds;
- the Node-side event cache;
- branding;
- integration configuration intent.

Every mutation of this JSON row uses `SELECT ... FOR UPDATE`. Sold-seat checks additionally read `issued_tickets`. Redis never decides inventory availability.

## Relational model

```text
catalog_events
      ^
      |             customers --> customer_contacts
      |                 |
      |                 +------> payment_methods
      |                 |
      +--------- sales_orders --> order_payments
      |                 |
      +--------- issued_tickets

customers --> privacy_consents       (schema present; workflow pending)
privacy_audit_log                    (schema present; writes pending)
```

| Table | Stored data | Important constraints |
| --- | --- | --- |
| `catalog_events` | Event JSON payload | Event ID primary key |
| `customers` | UUID, lookup HMAC and opaque pseudonym | No plaintext identity or payment data |
| `customer_profiles` | AES-GCM encrypted display name | One profile per customer |
| `customer_contacts` | AES-GCM ciphertext and key version | One active purpose per customer |
| `payment_methods` | Demo/provider reference and method type | Unique provider/reference pair |
| `sales_orders` | Customer, event, channel, currency, amount and status | Unique nullable `hold_id` for idempotency |
| `order_payments` | Provider reference, amount and payment state | References order and method |
| `issued_tickets` | Event, seat, token hash, medium and use time | Unique event/seat and token hash |
| `privacy_consents` | Consent metadata | Schema only; no API workflow yet |
| `privacy_audit_log` | Minimal audit metadata | Schema only; no application writes yet |
| `ticketing_state` | JSON compatibility state | Single row, ID `1` |

Money is stored as integer ARS units in unsigned `BIGINT` columns. The application never accepts or stores PAN, CVV, CBU, banking credentials or unfiltered provider payloads.

## Transaction flows

### Reservation

1. Validate event, channel and between one and eight distinct seats.
2. Lock `ticketing_state` with `SELECT ... FOR UPDATE`.
3. Remove expired holds and read sold seats from `issued_tickets`.
4. Reject any seat present in an active hold or issued ticket.
5. Calculate the total from the server-side event price.
6. Store a five-minute hold in `ticketing_state` and commit.

Non-web channels require the operator key. The public web channel does not.

### Checkout

1. Lock `ticketing_state` and start one MySQL transaction.
2. Look up `sales_orders.hold_id`. If it exists, reconstruct and return the original order and deterministic ticket tokens.
3. Validate that the hold is active, the email is syntactically valid and the demo method is allowed.
4. Upsert the referenced event payload.
5. Find or create the customer by email HMAC, then encrypt the name and delivery contact separately.
6. Insert `sales_orders` and `order_payments`.
7. Create one `issued_tickets` record per seat.
8. Remove the hold and commit all relational and JSON changes together.

Any failure rolls back the complete transaction. The unique event/seat constraint is the final protection against overselling; the unique hold identifier makes checkout retries idempotent.

### Admission

The submitted bearer token is SHA-256 hashed. Admission executes an atomic update constrained by event, hash and `used_at IS NULL`. One concurrent scanner can update the row; later attempts receive HTTP `409`. An unknown token or a token for another event receives `404`.

## Cryptographic handling

### Contacts

`CONTACT_ENCRYPTION_KEY` must contain at least 32 characters. Node hashes the configured value with SHA-256 to obtain a 256-bit AES key. Email contacts are encrypted using AES-256-GCM with a random 12-byte IV. The stored binary layout is:

```text
12-byte IV | 16-byte authentication tag | ciphertext
```

The email-derived customer display alias is `Cliente ` followed by the first 12 hexadecimal characters of an HMAC-SHA-256. The alias is deterministic within one deployment but cannot be used to recover the email without guessing candidates and possessing the deployment key.

### Tickets

`TICKET_TOKEN_KEY` must contain at least 32 characters. A ticket bearer token is HMAC-SHA-256 over its random UUID, encoded as base64url. Only SHA-256 of that bearer token is persisted. Keeping the token key stable permits idempotent checkout responses to reconstruct the original QR token.

Changing either secret without a planned migration is destructive: the contact key is required to decrypt existing contacts and the ticket key is required to reproduce issued QR credentials.

## Authorization and network controls

- Operator routes compare `x-admin-key` to `ADMIN_KEY` with a timing-safe comparison.
- The key is a shared demo credential stored in browser `sessionStorage`; it is not a production identity system.
- Grails POST requests require the internal `X-Service-Key` through its configured filter.
- Express limits JSON bodies to 32 KiB and sets `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- Redis rejects more than 300 API requests per IP/minute. This is abuse mitigation, not authorization.
- Caddy should supply TLS, `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin`.

## API behavior

| Route | Authorization | Durable effect |
| --- | --- | --- |
| `GET /api/health` | Public | None |
| `GET /api/payment-methods` | Public | None |
| `GET /api/events` | Public | Refreshes Node event cache from Grails |
| `POST /api/events` | Operator | Creates catalog event and caches it |
| `GET /api/events/:id/seats` | Public | None |
| `POST /api/holds` | Public for Web; operator otherwise | Creates JSON hold |
| `POST /api/checkout` | Public, demo flag required | Creates customer, contact, payment, order and tickets |
| `POST /api/scan` | Operator | Sets ticket `used_at` once |
| `GET /api/admin` | Operator | None |
| `GET /api/customers` | Operator | Returns pseudonyms and aggregate history |
| `POST /api/customers/:id/reveal` | Operator | Decrypts name/email and writes a privacy audit event |
| `PUT /api/brand` | Operator | Updates JSON branding |
| `PUT /api/integrations` | Operator | Adds JSON configuration intent |

Expected application errors use `400`, `401`, `404`, `409`, `429`, `502` or `503`. Unexpected errors are logged server-side and returned as a generic `500` without database details.

## Migrations and compatibility

Migrations are ordered as follows:

1. `001` (`infra/init.sql`): catalog table and original events.
2. `002_privacy_core.sql`: normalized privacy and transaction tables.
3. `003_activate_relational_store.sql`: unique checkout `hold_id`.
4. `004_normalize_demo_pseudonyms.sql`: consistent opaque aliases for historic demo customers.
5. `005_customer_profiles.sql`: customer lookup hashes, activity and encrypted names.

Compose mounts these files into MySQL's initialization directory for new volumes. MySQL runs them only on first initialization; existing deployments must apply each new migration explicitly and exactly once as described in [Operations](OPERATIONS.md).

## Known limitations

- Shared operator key instead of accounts, sessions and roles.
- Consent and audit tables exist but are not connected to application workflows.
- No implemented retention, erasure, export or key-rotation workflow.
- Holds remain in a single JSON row, limiting horizontal throughput.
- The payment provider is simulated; there are no webhooks, reconciliation or refunds.
- RFID is a display option only; UID association and hardware integration are pending.
- Health reports process configuration, not deep dependency readiness.
- MySQL/Redis/Grails integration tests run separately through `npm run test:integration`; Docker is required.
