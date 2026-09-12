CREATE TABLE IF NOT EXISTS catalog_events (
  id VARCHAR(36) PRIMARY KEY,
  payload JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT IGNORE INTO catalog_events (id, payload) VALUES
('e1', '{"id":"e1","name":"Horizonte Festival","category":"Música","venue":"Estadio Obras · Buenos Aires","date":"2026-11-21T21:00","price":45000,"rows":8,"columns":12,"medium":"Digital","accent":"lime"}'),
('e2', '{"id":"e2","name":"Una noche de jazz","category":"Música","venue":"Teatro Vorterix · Buenos Aires","date":"2026-10-16T20:30","price":28000,"rows":6,"columns":10,"medium":"Papel","accent":"peach"}'),
('e3', '{"id":"e3","name":"Ideas que conectan","category":"Conferencia","venue":"Centro de Convenciones · Córdoba","date":"2026-12-04T09:00","price":18000,"rows":8,"columns":10,"medium":"RFID","accent":"lavender"}');
