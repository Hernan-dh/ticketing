-- Required before deploying the application version that activates the relational store.
ALTER TABLE sales_orders
  ADD COLUMN hold_id CHAR(36) NULL AFTER id,
  ADD UNIQUE KEY sales_orders_hold_id (hold_id);
