-- Give legacy and showcase customers the same opaque display format as live checkout customers.
UPDATE customers
SET pseudonym = CONCAT('Cliente ', LEFT(SHA2(CONCAT('ticketing:', id), 256), 12))
WHERE pseudonym LIKE 'Demo customer %'
   OR pseudonym LIKE 'Cliente demo %';
