# Operations

## Verification

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run test:integration
npm.cmd run test:all
npm.cmd run build
npx.cmd playwright test
npm.cmd run verify
```

`npm run verify` requires Python 3. It checks whitespace, required documentation, likely secrets and private/generated files, then runs Node tests and the production build. `test:browser` covers the complete UI flow; `test:integration` builds a disposable Compose stack with MySQL, Redis and Grails. See the [automated testing plan](TESTING.md) for prerequisites and isolation guarantees.

Useful documentation commands:

```powershell
npm.cmd run docs:changelog
npm.cmd run docs:decision -- "Short decision title"
npm.cmd run hooks:install
```

## Configuration

Use `.env.example` only as a field reference. Generate a distinct random value for every secret and never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_KEY` | Compose | Shared demo operator credential |
| `SERVICE_KEY` | Compose | Express-to-Grails credential |
| `DB_PASSWORD` | Compose | Application database account |
| `MYSQL_ROOT_PASSWORD` | Compose | Database administration |
| `CONTACT_ENCRYPTION_KEY` | MySQL mode | Contact encryption and customer aliases |
| `TICKET_TOKEN_KEY` | MySQL mode | Deterministic QR bearer tokens |
| `ALLOW_DEMO_PAYMENTS` | Checkout | Must equal `true` for simulated issuance |
| `MYSQL_URL` | MySQL mode | Injected by Compose |
| `REDIS_URL` | Optional | Enables API rate limiting |
| `GRAILS_URL` | Optional | Enables catalog synchronization |

Contact and ticket keys must each contain at least 32 characters. Keep protected recovery copies. Do not rotate either value by editing `.env` alone; rotation requires a planned data and credential migration.

## Deployment

```bash
cd /srv/projects/ticketing
git pull --ff-only
sudo docker compose config --quiet
sudo docker compose up -d --build app
sudo docker compose ps
sudo docker compose logs --tail=100 app
curl -fsS http://127.0.0.1:3001/api/health
```

The application publishes only `127.0.0.1:3001`. A host reverse proxy terminates public TLS. Example Caddy configuration:

```caddyfile
ticketing.example.test {
    encode zstd gzip
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
    reverse_proxy 127.0.0.1:3001
}
```

Replace the example hostname. Allow inbound TCP 80/443 at host and provider firewalls. Do not publish ports 3001, 3306, 6379 or 8080 publicly.

## Backup and restore

Create a database dump before every schema migration or destructive data operation:

```bash
sudo docker compose exec -T mysql sh -c 'exec mysqldump --no-tablespaces -uticketing -p"$MYSQL_PASSWORD" ticketing' > "ticketing-$(date +%F-%H%M).sql"
test -s "$(ls -t ticketing-*.sql | head -1)"
```

Treat dumps as sensitive because they contain encrypted contacts and provider references. Restrict access and retain the matching encryption keys in protected recovery storage.

Restore only during a declared recovery window after confirming the exact backup target:

```bash
sudo docker compose stop app catalog
sudo docker compose exec -T mysql sh -c 'exec mysql -uticketing -p"$MYSQL_PASSWORD" ticketing' < verified-backup.sql
sudo docker compose start catalog app
```

Test restoration outside production before relying on a backup procedure.

## Schema migrations

New MySQL volumes execute `infra/init.sql` and migrations `002` through `005` automatically in filename order. MySQL initialization scripts run only when the data directory is empty. Existing deployments must apply each missing migration explicitly after a verified backup:

```bash
sudo docker compose exec -T mysql sh -c 'exec mysql -uticketing -p"$MYSQL_PASSWORD" ticketing' < infra/migrations/002_privacy_core.sql
sudo docker compose exec -T mysql sh -c 'exec mysql -uticketing -p"$MYSQL_PASSWORD" ticketing' < infra/migrations/003_activate_relational_store.sql
sudo docker compose exec -T mysql sh -c 'exec mysql -uticketing -p"$MYSQL_PASSWORD" ticketing' < infra/migrations/004_normalize_demo_pseudonyms.sql
sudo docker compose exec -T mysql sh -c 'exec mysql -uticketing -p"$MYSQL_PASSWORD" ticketing' < infra/migrations/005_customer_profiles.sql
```

Migration `003` is a one-time `ALTER TABLE` and must not be applied twice. Confirm the active column before deploying relational application code:

```bash
sudo docker compose exec -T mysql sh -c 'exec mysql -N -uticketing -p"$MYSQL_PASSWORD" ticketing -e "SHOW COLUMNS FROM sales_orders LIKE '\''hold_id'\'';"'
```

## Demonstration data

### Additive showcase seed

`scripts/seed-showcase.mjs` idempotently adds six fictional events, twenty-four normalized demo sales and thirty-nine tickets. It preserves existing data, encrypts distinct `example.test` contacts and fictional names, uses opaque aliases and stores only simulated payment references.

```bash
sudo docker compose exec -T -e CONFIRM_DEMO_SEED=ticketing-demo app node scripts/seed-showcase.mjs --append
```

Rerunning it updates showcase event payloads and aliases but does not duplicate orders or tickets.

### Legacy JSON reset

`scripts/seed-demo.mjs` predates the active relational store. It replaces the catalog and JSON compatibility state but does not populate normalized sales tables. Do not use it on the relational deployment. It remains guarded for legacy/local demonstrations:

```bash
sudo docker compose exec -T -e CONFIRM_DEMO_RESET=ticketing-demo app node scripts/seed-demo.mjs --reset
```

## Post-deployment verification

1. Confirm `/api/health` reports `storage: mysql` and Redis when configured.
2. Open the catalog and reserve a new, unsold seat.
3. Confirm the UI shows the selected seat and server-calculated total.
4. Complete a simulated checkout and confirm the sale uses an opaque customer alias.
5. Scan one issued token; the first scan must succeed and the second must return `409`.
6. Confirm recent application logs contain no unexpected errors.

Useful database checks:

```bash
sudo docker compose exec -T mysql sh -c 'exec mysql -N -uticketing -p"$MYSQL_PASSWORD" ticketing -e "SELECT COUNT(*) orders FROM sales_orders; SELECT COUNT(*) tickets FROM issued_tickets; SELECT COUNT(*) checked_in FROM issued_tickets WHERE used_at IS NOT NULL;"'
sudo docker compose exec -T mysql sh -c 'exec mysql -N -uticketing -p"$MYSQL_PASSWORD" ticketing -e "SELECT COUNT(*) invalid_aliases FROM customers WHERE pseudonym NOT REGEXP '\''^Cliente [0-9a-f]{12}$'\'';"'
```

## Diagnostics

```bash
sudo docker compose ps
sudo docker compose logs --since=15m app catalog mysql redis
sudo ss -ltnp | grep -E ':(80|443|3001)\b'
curl -vk --resolve ticketing.example.test:443:127.0.0.1 https://ticketing.example.test/api/health
```

An HTTP `500` requires application-log inspection; clients intentionally receive a generic message. A `409` from `/api/scan` normally means the ticket was already consumed. A `502` from `/api/events` means the Grails catalog failed or exceeded its five-second timeout.

## Commit publication

```powershell
npm.cmd run publish:preview -- --title "docs: update technical reference" --description "Keep architecture and operations aligned with the deployed system."
npm.cmd run publish -- --title "docs: update technical reference" --description "Keep architecture and operations aligned with the deployed system."
```

Publication verifies the selected state and requires the literal `PUBLISH` confirmation before committing and pushing. It never force-pushes. Provider-assisted commit proposals receive a size-limited diff, never environment values; see `scripts/publish.py` for the exact behavior.
