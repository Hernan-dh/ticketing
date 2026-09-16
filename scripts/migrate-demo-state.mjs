import {createHash} from 'node:crypto';
import {createPool} from 'mysql2/promise';

if (!process.env.MYSQL_URL || process.env.CONFIRM_PRIVACY_MIGRATION !== 'ticketing-demo') {
  throw Error('Set MYSQL_URL and CONFIRM_PRIVACY_MIGRATION=ticketing-demo.');
}
const pool=createPool(process.env.MYSQL_URL),[rows]=await pool.query('SELECT payload FROM ticketing_state WHERE id=1');
const state=typeof rows[0]?.payload==='string'?JSON.parse(rows[0].payload):rows[0]?.payload;
if (!state) throw Error('ticketing_state is empty.');
const stableId=(namespace,value)=>{const hash=createHash('sha256').update(`${namespace}:${value}`).digest('hex');return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;};
const connection=await pool.getConnection();
try {
  await connection.beginTransaction();
  for (const [index,order] of state.orders.entries()) {
    const customerId=stableId('customer',order.id),paymentMethodId=stableId('method',order.id),paymentId=stableId('payment',order.id);
    await connection.query('INSERT IGNORE INTO customers (id,pseudonym) VALUES (?,?)',[customerId,`Demo customer ${String(index+1).padStart(3,'0')}`]);
    await connection.query('INSERT IGNORE INTO payment_methods (id,customer_id,provider,provider_reference,method_type) VALUES (?,?,?,?,?)',[paymentMethodId,customerId,'demo',`legacy_${order.id}`,order.payment?.includes('Transfer')?'bank_transfer':'card']);
    await connection.query('INSERT IGNORE INTO sales_orders (id,customer_id,event_id,channel,total_amount,payment_status,created_at) VALUES (?,?,?,?,?,?,?)',[order.id,customerId,order.eventId,order.channel,order.total,'demo_paid',order.createdAt]);
    await connection.query('INSERT IGNORE INTO order_payments (id,order_id,payment_method_id,provider_reference,amount,status,created_at) VALUES (?,?,?,?,?,?,?)',[paymentId,order.id,paymentMethodId,`legacy_${order.id}`,order.total,'demo_paid',order.createdAt]);
  }
  for (const ticket of state.tickets) await connection.query('INSERT IGNORE INTO issued_tickets (id,order_id,event_id,seat,token_hash,medium,issued_at,used_at) VALUES (?,?,?,?,?,?,?,?)',[ticket.id,ticket.orderId,ticket.eventId,ticket.seat,createHash('sha256').update(ticket.token).digest(),ticket.medium,ticket.issuedAt||new Date().toISOString(),ticket.usedAt]);
  await connection.commit();
  console.log(`Migrated ${state.orders.length} demo orders and ${state.tickets.length} tickets without contact data.`);
} catch (error) { await connection.rollback(); throw error; } finally { connection.release(); await pool.end(); }
