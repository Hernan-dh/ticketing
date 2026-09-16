# Privacy controls

Ticketing is currently a demonstration product. This document defines the target baseline for its MySQL deployment; it does not by itself establish legal compliance.

## Data boundaries

| Purpose | Minimum data | Storage boundary | Retention |
| --- | --- | --- | --- |
| Issue and recover tickets | internal customer ID; encrypted delivery contact only when delivery is requested | customer/contact store, separate from orders | configured operational period, then delete or anonymise |
| Take payment | provider reference, method type, state and amount | payment store | accounting period required by the operator |
| Admit a guest | random ticket token, event and seat | ticket store | event and dispute period |
| Operate the service | pseudonymous actor ID, action, timestamp and outcome | audit store | limited security retention |

Do not collect identity documents, birth dates, postal addresses, card numbers, CVV, bank credentials or free-form payment payloads unless a documented feature and legal basis require them.

## Privacy by default

- Use synthetic `example.test` data outside production; never copy production data into development, demos or screenshots.
- Encrypt contact values before persistence with `PII_ENCRYPTION_KEY`; keep the key out of source control, logs and backups where practical.
- Use randomly generated UUIDs and opaque ticket tokens. Do not expose database sequence IDs.
- Keep payment data tokenised at the payment provider. The application stores no card data.
- Give service accounts only their required database and network access; separate sales, access-control and administration roles.
- Log action metadata only. Never log contact values, authentication secrets, QR tokens or provider credentials.
- Define and test deletion/anonymisation and restoration procedures before accepting real customer data.

## Demo data

Demo orders must use fictional names, non-deliverable addresses and simulated payment labels. Public figures are not used as customers or evidence of a commercial relationship.
