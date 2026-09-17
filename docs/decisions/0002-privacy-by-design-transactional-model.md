# Privacy by design transactional model

## Status

Accepted

## Context

The MVP stores orders, tickets and contact email in a single JSON document. That makes transactional operations convenient for a demo, but does not provide purpose separation, granular retention, access controls or safe handling of personal data.

## Decision

The MySQL deployment will move operational data to relational records. Customer identity/contact data is separated from orders; the order retains only an internal customer identifier. Contact values are encrypted by the application with a deployment-only key and are never written to application logs, audit payloads or backups in plaintext. Payment processing stores only a provider reference and status; it never stores PAN, CVV, bank credentials or raw payment provider payloads.

Every production table will carry an explicit retention category. Holds expire automatically; contact information has an independent deletion/anonymisation workflow; immutable audit entries record a minimum action summary with actor pseudonyms. Demo data is fully synthetic and uses non-deliverable `example.test` addresses.

## Consequences

- Existing JSON state requires a one-time migration before production use.
- `CONTACT_ENCRYPTION_KEY` and `TICKET_TOKEN_KEY` become required deployment secrets. Rotation requires an explicit data and credential migration.
- Roles and authorization need to replace the shared operator key before any non-demo operation.
- Pseudonymisation reduces risk but does not remove data-protection obligations.

## Implementation note

The normalized checkout, encrypted contacts, hashed ticket credentials and pseudonymous sales view are active in the MySQL deployment. Consent capture, audit writes, retention enforcement, data-subject workflows and role-based authorization remain pending. The accepted direction therefore remains valid, but the complete target described above is not yet implemented.
