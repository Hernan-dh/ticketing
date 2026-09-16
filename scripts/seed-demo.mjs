import { randomBytes, randomUUID } from 'node:crypto';
import { createPool } from 'mysql2/promise';

const confirmation = 'ticketing-demo';
if (!process.argv.includes('--reset') || process.env.CONFIRM_DEMO_RESET !== confirmation) {
  console.error('Refusing to replace data. Run with --reset and CONFIRM_DEMO_RESET=ticketing-demo.');
  process.exit(1);
}
if (!process.env.MYSQL_URL) {
  console.error('MYSQL_URL is required. Run this inside the app container.');
  process.exit(1);
}

const events = [
  { id: 'demo-cerati', name: 'Siempre es hoy: homenaje a Cerati', category: 'Música', venue: 'Movistar Arena · Buenos Aires', date: '2026-10-10T21:00', price: 52000, rows: 10, columns: 14, medium: 'Digital', accent: 'lime' },
  { id: 'demo-spinetta', name: 'Mañana es mejor: canciones de Spinetta', category: 'Música', venue: 'Teatro Gran Rex · Buenos Aires', date: '2026-10-24T20:30', price: 44000, rows: 8, columns: 12, medium: 'Papel', accent: 'peach' },
  { id: 'demo-sosa', name: 'Gracias a la vida: tributo a Mercedes Sosa', category: 'Música', venue: 'Teatro Libertador · Córdoba', date: '2026-11-07T21:00', price: 38000, rows: 9, columns: 12, medium: 'Digital', accent: 'lavender' },
  { id: 'demo-charly', name: 'Clics modernos: noche Charly García', category: 'Música', venue: 'Estadio Obras · Buenos Aires', date: '2026-11-21T22:00', price: 61000, rows: 12, columns: 16, medium: 'RFID', accent: 'lime' },
  { id: 'demo-gardel', name: 'Volver: gala Carlos Gardel', category: 'Música', venue: 'Teatro Colón · Buenos Aires', date: '2026-12-05T20:00', price: 75000, rows: 7, columns: 10, medium: 'Papel', accent: 'peach' },
  { id: 'demo-paez', name: 'El amor después del amor: especial Fito Páez', category: 'Música', venue: 'Anfiteatro Municipal · Rosario', date: '2026-12-19T21:30', price: 47000, rows: 10, columns: 13, medium: 'Digital', accent: 'lavender' }
];

const sales = [
  ['demo-cerati', 'Marina Solís', 'cliente-001@example.test', 'Web', 'DEMO · Tarjeta tokenizada', ['A1', 'A2'], true],
  ['demo-cerati', 'Tomás Vega', 'cliente-002@example.test', 'Móvil', 'DEMO · Billetera digital', ['B3'], true],
  ['demo-spinetta', 'Lara Montes', 'cliente-003@example.test', 'Web', 'DEMO · Tarjeta tokenizada', ['A4', 'A5'], false],
  ['demo-spinetta', 'Bruno Ríos', 'cliente-004@example.test', 'Boletería', 'DEMO · Efectivo', ['C1'], false],
  ['demo-sosa', 'Elena Paz', 'cliente-005@example.test', 'Distribuidor', 'DEMO · Transferencia', ['A1', 'A2', 'A3'], false],
  ['demo-sosa', 'Nicolás Rey', 'cliente-006@example.test', 'Web', 'DEMO · Tarjeta tokenizada', ['B4'], false],
  ['demo-charly', 'Mora Vidal', 'cliente-007@example.test', 'Móvil', 'DEMO · Billetera digital', ['A1', 'A2'], false],
  ['demo-charly', 'Ivo Campos', 'cliente-008@example.test', 'Boletería', 'DEMO · Efectivo', ['C5', 'C6'], false],
  ['demo-charly', 'Clara Luna', 'cliente-009@example.test', 'Web', 'DEMO · Tarjeta tokenizada', ['D1'], false],
  ['demo-gardel', 'Renata Flores', 'cliente-010@example.test', 'Distribuidor', 'DEMO · Transferencia', ['A1', 'A2'], false],
  ['demo-gardel', 'Gael Serrano', 'cliente-011@example.test', 'Web', 'DEMO · Tarjeta tokenizada', ['B2'], false],
  ['demo-paez', 'Aitana Mar', 'cliente-012@example.test', 'Web', 'DEMO · Tarjeta tokenizada', ['A1', 'A2', 'A3'], false],
  ['demo-paez', 'León Arroyo', 'cliente-013@example.test', 'Móvil', 'DEMO · Billetera digital', ['B1'], false],
  ['demo-paez', 'Noa Rivera', 'cliente-014@example.test', 'Boletería', 'DEMO · Efectivo', ['C2', 'C3'], false]
];

const byId = new Map(events.map(event => [event.id, event]));
const orders = [];
const tickets = [];
for (const [eventId, buyerName, email, channel, payment, seats, checkedIn] of sales) {
  const event = byId.get(eventId);
  const id = randomUUID();
  const createdAt = new Date(`2026-09-${String(1 + orders.length).padStart(2, '0')}T15:00:00Z`).toISOString();
  orders.push({ id, holdId: `demo-hold-${orders.length + 1}`, eventId, total: seats.length * event.price, channel, email, buyerName, createdAt, payment });
  for (const seat of seats) tickets.push({ id: randomUUID(), token: randomBytes(32).toString('base64url'), seat, eventId, orderId: id, medium: event.medium, usedAt: checkedIn ? '2026-09-15T19:30:00.000Z' : null });
}

const state = {
  brand: { name: 'Ticketing Demo', color: '#d7fa76' },
  events,
  holds: [],
  orders,
  tickets,
  integrations: [
    { id: 'demo-payment', provider: 'Mercado Pago (simulado)', type: 'Pago', status: 'Entorno de demostración' },
    { id: 'demo-email', provider: 'Resend (simulado)', type: 'Correo', status: 'Pendiente de conexión' },
    { id: 'demo-delivery', provider: 'WhatsApp (simulado)', type: 'Entrega', status: 'Pendiente de conexión' }
  ]
};

const pool = createPool(process.env.MYSQL_URL);
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  await connection.query('CREATE TABLE IF NOT EXISTS ticketing_state (id INT PRIMARY KEY, payload JSON NOT NULL)');
  await connection.query('DELETE FROM catalog_events');
  for (const event of events) await connection.query('INSERT INTO catalog_events (id, payload) VALUES (?, ?)', [event.id, JSON.stringify(event)]);
  await connection.query('INSERT INTO ticketing_state (id, payload) VALUES (1, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)', [JSON.stringify(state)]);
  await connection.commit();
  console.log(`Demo loaded: ${events.length} events, ${orders.length} orders, ${tickets.length} tickets.`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
