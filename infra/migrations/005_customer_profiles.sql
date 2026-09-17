ALTER TABLE customers
  ADD COLUMN subject_hash BINARY(32) NULL AFTER id,
  ADD COLUMN last_activity_at TIMESTAMP NULL AFTER created_at,
  ADD UNIQUE KEY customers_subject_hash (subject_hash);

CREATE TABLE IF NOT EXISTS customer_profiles (
  customer_id CHAR(36) PRIMARY KEY,
  display_name_ciphertext VARBINARY(1024) NOT NULL,
  key_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT customer_profiles_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id)
);
