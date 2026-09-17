# Privacy controls

Ticketing is currently a demonstration product. This document defines the target baseline for its MySQL deployment; it does not by itself establish legal compliance.

## Implementation status

| Control | Status |
| --- | --- |
| Purpose-separated customer, contact, order, payment and ticket tables | Active in MySQL mode |
| AES-256-GCM contact encryption | Active |
| AES-256-GCM customer-name encryption | Active |
| Opaque deterministic customer aliases | Active |
| Hashed QR bearer credentials | Active |
| Atomic single-use admission | Active |
| Card and banking-data exclusion | Active by schema and API design |
| Consent recording and withdrawal | Schema present; workflow pending |
| Privacy audit trail | Customer-data reveals active; broader action coverage pending |
| Retention, erasure and export procedures | Pending |
| Individual users and role-based access | Pending; shared operator key is demo-only |
| Key rotation | Pending; keys must currently remain stable |

## Data boundaries

| Purpose | Minimum data | Storage boundary | Retention |
| --- | --- | --- | --- |
| Issue and recover tickets | internal customer ID; encrypted fictional/display name and delivery contact | customer profile/contact stores, separate from orders | configured operational period, then delete or anonymise |
| Take payment | provider reference, method type, state and amount | payment store | accounting period required by the operator |
| Admit a guest | random ticket token, event and seat | ticket store | event and dispute period |
| Operate the service | pseudonymous actor ID, action, timestamp and outcome | audit store | limited security retention |

Do not collect identity documents, birth dates, postal addresses, card numbers, CVV, bank credentials or free-form payment payloads unless a documented feature and legal basis require them.

## Privacy by default

- Use synthetic `example.test` data outside production; never copy production data into development, demos or screenshots.
- Encrypt contact values before persistence with `CONTACT_ENCRYPTION_KEY`; keep the key out of source control and logs, and retain a protected recovery copy.
- Use randomly generated UUIDs and HMAC-derived opaque ticket tokens. Persist only ticket-token hashes and do not expose database sequence IDs.
- Keep payment data tokenised at the payment provider. The application stores no card data.
- Give service accounts only their required database and network access; separate sales, access-control and administration roles.
- Log action metadata only. Never log contact values, authentication secrets, QR tokens or provider credentials.
- Define and test deletion/anonymisation and restoration procedures before accepting real customer data.

## Demo data

Demo orders must use fictional names, non-deliverable addresses and simulated payment labels. Public figures are not used as customers or evidence of a commercial relationship.

The additive showcase seed stores distinct encrypted `example.test` addresses and opaque aliases. It stores method categories and synthetic provider references, not payment credentials. Historic seeded aliases are normalized by migration `004`.
