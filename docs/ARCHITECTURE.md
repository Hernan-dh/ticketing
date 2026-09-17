# Architecture

## System overview

```text
Browser --HTTPS--> Caddy --loopback--> Express
                                      |  |  |
                                      |  |  +--> Redis rate limiting
                                      |  +-----> Grails event catalog
                                      +--------> MySQL
```

The React application uses Backbone for observable seat selection and PixiJS for the graphical map. Express owns reservations, checkout, ticket issuance, operator endpoints and admission. Grails validates and persists catalog events. MySQL is authoritative for normalized sales and tickets; Redis is used only for rate limiting.

## Data ownership

| Data | Authority |
| --- | --- |
| Catalog events | `catalog_events`, managed through Grails |
| Customers and encrypted contacts | `customers`, `customer_contacts` |
| Orders and simulated payments | `sales_orders`, `order_payments`, `payment_methods` |
| Sold seats and admission state | `issued_tickets` |
| Active holds, branding and integration intent | `ticketing_state` JSON |
| Request counters | Redis |

All checkout writes occur in one MySQL transaction. The single `ticketing_state` row is locked while reservations or checkout mutate shared state. Ticket admission is an atomic conditional update, so only the first concurrent scan succeeds.

## Trust boundaries

- Browser payloads, QR tokens and integration names are untrusted.
- `ADMIN_KEY`, `SERVICE_KEY`, database credentials, `CONTACT_ENCRYPTION_KEY` and `TICKET_TOKEN_KEY` are deployment secrets.
- Contact ciphertext is separated from orders. Sales endpoints return customer pseudonyms rather than contacts.
- Payment records contain simulated or provider references, never card or banking credentials.
- QR bearer values are not stored; only their SHA-256 hashes are persisted.
- Caddy is the public TLS boundary. Application, database, cache and catalog ports remain private or loopback-bound.

## Detailed reference

See [Technical reference](TECHNICAL_REFERENCE.md) for component responsibilities, schema relationships, transaction sequences, cryptographic formats, API behavior, migrations and known limitations. See [Privacy controls](PRIVACY.md) and [Operations](OPERATIONS.md) for policy boundaries and runbooks.

## Related decisions

- [Continuous documentation and safe publishing](decisions/0001-continuous-documentation-and-safe-publishing.md)
- [Privacy by design transactional model](decisions/0002-privacy-by-design-transactional-model.md)
