-- Apply once to an existing MySQL deployment before enabling the relational store.
-- This schema deliberately excludes card PAN, CVV, identity-document and address fields.
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  pseudonym VARCHAR(80) NOT NULL,
  status ENUM('active','erased') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  erased_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  purpose ENUM('ticket_delivery','account_recovery') NOT NULL,
  ciphertext VARBINARY(1024) NOT NULL,
  key_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY customer_contact_purpose (customer_id, purpose),
  CONSTRAINT customer_contacts_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  provider VARCHAR(60) NOT NULL,
  provider_reference VARCHAR(255) NOT NULL,
  method_type VARCHAR(40) NOT NULL,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  UNIQUE KEY payment_provider_reference (provider, provider_reference),
  CONSTRAINT payment_methods_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ARS',
  total_amount BIGINT UNSIGNED NOT NULL,
  payment_status ENUM('demo_paid','pending','paid','refunded') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sales_orders_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT sales_orders_event_fk FOREIGN KEY (event_id) REFERENCES catalog_events(id)
);

CREATE TABLE IF NOT EXISTS order_payments (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  payment_method_id CHAR(36) NULL,
  provider_reference VARCHAR(255) NOT NULL,
  amount BIGINT UNSIGNED NOT NULL,
  status ENUM('demo_paid','pending','paid','failed','refunded') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT order_payments_order_fk FOREIGN KEY (order_id) REFERENCES sales_orders(id),
  CONSTRAINT order_payments_method_fk FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);

CREATE TABLE IF NOT EXISTS issued_tickets (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  seat VARCHAR(8) NOT NULL,
  token_hash BINARY(32) NOT NULL,
  medium VARCHAR(20) NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL,
  UNIQUE KEY ticket_event_seat (event_id, seat),
  UNIQUE KEY ticket_token_hash (token_hash),
  CONSTRAINT issued_tickets_order_fk FOREIGN KEY (order_id) REFERENCES sales_orders(id),
  CONSTRAINT issued_tickets_event_fk FOREIGN KEY (event_id) REFERENCES catalog_events(id)
);

CREATE TABLE IF NOT EXISTS privacy_consents (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  purpose VARCHAR(80) NOT NULL,
  policy_version VARCHAR(32) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at TIMESTAMP NULL,
  CONSTRAINT privacy_consents_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS privacy_audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_pseudonym VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(40) NOT NULL,
  resource_id CHAR(36) NULL,
  outcome ENUM('success','denied','failure') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX privacy_audit_created_at (created_at)
);
