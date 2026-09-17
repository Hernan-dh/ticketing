import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { checkout, demoPaymentMethods, fail, reserve, scan, seed } from './domain.js';

const parseJson=value=>typeof value==='string'?JSON.parse(value):value;
const iso=value=>value instanceof Date?value.toISOString():value;

function localStore(state,save,close) {
 let queue=Promise.resolve();
 const transaction=fn=>{const task=queue.then(async()=>{const next=structuredClone(state.value);const result=await fn(next);await save(next);state.value=next;return result;});queue=task.catch(()=>{});return task;};
 return {transaction,reserve:body=>transaction(s=>reserve(s,body)),checkout:body=>transaction(s=>checkout(s,body)),scan:body=>transaction(s=>scan(s,body)),seats:eventId=>transaction(s=>({sold:s.tickets.filter(t=>t.eventId===eventId).map(t=>t.seat),held:s.holds.filter(h=>h.eventId===eventId&&h.expiresAt>Date.now()).flatMap(h=>h.seats)})),admin:()=>transaction(s=>({orders:s.orders,checkedIn:s.tickets.filter(t=>t.usedAt).length,tickets:s.tickets.length,integrations:s.integrations})),customers:()=>transaction(()=>[]),revealCustomer:()=>fail('Disponible únicamente con MySQL.',503),close:async()=>{await queue;await close();}};
}

function mysqlSecrets() {
 const contact=process.env.CONTACT_ENCRYPTION_KEY,token=process.env.TICKET_TOKEN_KEY;
 if(!contact||contact.length<32||!token||token.length<32) throw Error('CONTACT_ENCRYPTION_KEY and TICKET_TOKEN_KEY must each contain at least 32 characters when MySQL is enabled.');
 return {contact:createHash('sha256').update(contact).digest(),token};
}
function encryptContact(value,key) {const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]);}
function decryptContact(value,key) {const data=Buffer.from(value),decipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8');}
function ticketToken(id,key) {return createHmac('sha256',key).update(`ticket:${id}`).digest('base64url');}
function ticketHash(token) {return createHash('sha256').update(token).digest();}

async function createMysqlStore(pool) {
 const secrets=mysqlSecrets();
 await pool.query('CREATE TABLE IF NOT EXISTS ticketing_state (id INT PRIMARY KEY, payload JSON NOT NULL)');
 await pool.query('INSERT IGNORE INTO ticketing_state VALUES (1, ?)',[JSON.stringify(seed())]);
 const withState=async fn=>{const c=await pool.getConnection();try{await c.beginTransaction();const [rows]=await c.query('SELECT payload FROM ticketing_state WHERE id=1 FOR UPDATE');const state=parseJson(rows[0].payload),result=await fn(state,c);await c.query('UPDATE ticketing_state SET payload=? WHERE id=1',[JSON.stringify(state)]);await c.commit();return result;}catch(error){await c.rollback();throw error;}finally{c.release();}};
 const transaction=fn=>withState(state=>fn(state));
 return {
  transaction,
  reserve:body=>withState(async(state,c)=>{const [sold]=await c.query('SELECT event_id AS eventId,seat FROM issued_tickets WHERE event_id=?',[body.eventId]),working={...state,holds:state.holds,tickets:sold},result=reserve(working,body);state.holds=working.holds;return result;}),
  checkout:body=>withState(async(state,c)=>{
   const [prior]=await c.query("SELECT o.id,o.hold_id AS holdId,o.event_id AS eventId,o.channel,o.total_amount AS total,o.created_at AS createdAt,cc.ciphertext,op.id AS paymentId,op.provider_reference AS providerReference,pm.method_type AS methodType FROM sales_orders o JOIN customer_contacts cc ON cc.customer_id=o.customer_id AND cc.purpose='ticket_delivery' LEFT JOIN order_payments op ON op.order_id=o.id LEFT JOIN payment_methods pm ON pm.id=op.payment_method_id WHERE o.hold_id=?",[body.holdId]);
   if(prior.length){const order=prior[0],[tickets]=await c.query('SELECT id,event_id AS eventId,seat,medium,used_at AS usedAt FROM issued_tickets WHERE order_id=? ORDER BY seat',[order.id]),createdAt=iso(order.createdAt);return {id:order.id,holdId:order.holdId,eventId:order.eventId,channel:order.channel,total:order.total,email:decryptContact(order.ciphertext,secrets.contact),createdAt,payment:'DEMO',tickets:tickets.map(t=>({...t,usedAt:iso(t.usedAt),token:ticketToken(t.id,secrets.token)})),paymentIntent:{id:order.paymentId,provider:'demo',providerReference:order.providerReference,methodType:order.methodType,status:'demo_paid',amount:order.total,currency:'ARS',createdAt}};}
   const hold=state.holds.find(h=>h.id===body.holdId);if(!hold||hold.expiresAt<=Date.now())fail('La reserva venció. Volvé a elegir asientos.',409);
   const email=String(body.email||''),buyerName=String(body.buyerName||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail('Ingresá un correo válido.');if(buyerName.length<2||buyerName.length>120)fail('Ingresá un nombre válido.');
   const method=demoPaymentMethods[body.paymentMethod||'demo_card'];if(!method)fail('Método de pago de demostración inválido.');
   const event=state.events.find(e=>e.id===hold.eventId);if(!event)fail('Evento inexistente.',404);
   await c.query('INSERT INTO catalog_events (id,payload) VALUES (?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)',[event.id,JSON.stringify(event)]);
   const normalizedEmail=email.trim().toLowerCase(),subjectHash=createHmac('sha256',secrets.contact).update(normalizedEmail).digest(),orderId=randomUUID(),methodId=randomUUID(),paymentId=randomUUID(),createdAt=new Date(),createdAtIso=createdAt.toISOString(),providerReference=`demo_${randomBytes(16).toString('hex')}`,pseudonym=`Cliente ${subjectHash.toString('hex').slice(0,12)}`;
   const [matches]=await c.query('SELECT id FROM customers WHERE subject_hash=? FOR UPDATE',[subjectHash]);const customerId=matches[0]?.id||randomUUID();
   if(!matches.length){await c.query('INSERT INTO customers (id,subject_hash,pseudonym,last_activity_at) VALUES (?,?,?,?)',[customerId,subjectHash,pseudonym,createdAt]);await c.query('INSERT INTO customer_contacts (id,customer_id,purpose,ciphertext) VALUES (?,?,?,?)',[randomUUID(),customerId,'ticket_delivery',encryptContact(normalizedEmail,secrets.contact)]);}else await c.query('UPDATE customers SET last_activity_at=? WHERE id=?',[createdAt,customerId]);
   await c.query('INSERT INTO customer_profiles (customer_id,display_name_ciphertext) VALUES (?,?) ON DUPLICATE KEY UPDATE display_name_ciphertext=VALUES(display_name_ciphertext)',[customerId,encryptContact(buyerName,secrets.contact)]);
   await c.query('INSERT INTO payment_methods (id,customer_id,provider,provider_reference,method_type) VALUES (?,?,?,?,?)',[methodId,customerId,'demo',providerReference,method.type]);
   await c.query('INSERT INTO sales_orders (id,hold_id,customer_id,event_id,channel,total_amount,payment_status,created_at) VALUES (?,?,?,?,?,?,?,?)',[orderId,hold.id,customerId,event.id,hold.channel,hold.total,'demo_paid',createdAt]);
   await c.query('INSERT INTO order_payments (id,order_id,payment_method_id,provider_reference,amount,status,created_at) VALUES (?,?,?,?,?,?,?)',[paymentId,orderId,methodId,providerReference,hold.total,'demo_paid',createdAt]);
   const tickets=[];for(const seat of hold.seats){const id=randomUUID(),token=ticketToken(id,secrets.token);await c.query('INSERT INTO issued_tickets (id,order_id,event_id,seat,token_hash,medium,issued_at) VALUES (?,?,?,?,?,?,?)',[id,orderId,event.id,seat,ticketHash(token),event.medium,createdAt]);tickets.push({id,orderId,eventId:event.id,seat,token,medium:event.medium,usedAt:null});}
   state.holds=state.holds.filter(h=>h.id!==hold.id);
   return {id:orderId,holdId:hold.id,eventId:event.id,total:hold.total,channel:hold.channel,email,createdAt:createdAtIso,payment:`DEMO · ${method.label}`,tickets,paymentIntent:{id:paymentId,provider:'demo',providerReference,methodType:method.type,status:'demo_paid',amount:hold.total,currency:'ARS',createdAt:createdAtIso}};
  }),
  async scan(body) {if(typeof body.token!=='string'||typeof body.eventId!=='string')fail('Entrada inválida para este evento.',404);const usedAt=new Date(),hash=ticketHash(body.token),[result]=await pool.query('UPDATE issued_tickets SET used_at=? WHERE event_id=? AND token_hash=? AND used_at IS NULL',[usedAt,body.eventId,hash]);if(result.affectedRows){const [rows]=await pool.query('SELECT seat,medium FROM issued_tickets WHERE event_id=? AND token_hash=?',[body.eventId,hash]);return {...rows[0],usedAt:usedAt.toISOString()};}const [rows]=await pool.query('SELECT used_at FROM issued_tickets WHERE event_id=? AND token_hash=?',[body.eventId,hash]);if(rows.length)fail('Esta entrada ya fue utilizada.',409);fail('Entrada inválida para este evento.',404);},
  async seats(eventId) {const [[sold],state]=await Promise.all([pool.query('SELECT seat FROM issued_tickets WHERE event_id=? ORDER BY seat',[eventId]),transaction(s=>s)]);return {sold:sold.map(x=>x.seat),held:state.holds.filter(h=>h.eventId===eventId&&h.expiresAt>Date.now()).flatMap(h=>h.seats)};},
  async admin() {const [orders,ticketCounts,state]=await Promise.all([pool.query("SELECT o.id,c.pseudonym AS email,o.channel,o.total_amount AS total,pm.method_type AS paymentMethodType,CONCAT('DEMO · ',pm.method_type) AS payment,o.created_at AS createdAt FROM sales_orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN order_payments op ON op.order_id=o.id LEFT JOIN payment_methods pm ON pm.id=op.payment_method_id ORDER BY o.created_at DESC"),pool.query('SELECT COUNT(*) AS tickets,SUM(used_at IS NOT NULL) AS checkedIn FROM issued_tickets'),transaction(s=>s)]);return {orders:orders[0].map(o=>({...o,createdAt:iso(o.createdAt)})),tickets:Number(ticketCounts[0][0].tickets),checkedIn:Number(ticketCounts[0][0].checkedIn||0),integrations:state.integrations};},
  async customers() {const [rows]=await pool.query('SELECT c.id,c.pseudonym,c.status,c.created_at AS createdAt,EXISTS(SELECT 1 FROM customer_profiles p WHERE p.customer_id=c.id) AS hasProfile,(SELECT MAX(o.created_at) FROM sales_orders o WHERE o.customer_id=c.id) AS lastPurchase,(SELECT COUNT(*) FROM sales_orders o WHERE o.customer_id=c.id) AS orders,(SELECT COUNT(*) FROM issued_tickets t JOIN sales_orders o ON o.id=t.order_id WHERE o.customer_id=c.id) AS tickets,(SELECT COALESCE(SUM(o.total_amount),0) FROM sales_orders o WHERE o.customer_id=c.id) AS total FROM customers c ORDER BY lastPurchase DESC');return rows.map(row=>({...row,hasProfile:Boolean(row.hasProfile),orders:Number(row.orders),tickets:Number(row.tickets),total:Number(row.total),createdAt:iso(row.createdAt),lastPurchase:iso(row.lastPurchase)}));},
  async revealCustomer(id) {const c=await pool.getConnection();try{await c.beginTransaction();const [rows]=await c.query("SELECT c.id,c.pseudonym,p.display_name_ciphertext AS nameCiphertext,cc.ciphertext AS emailCiphertext FROM customers c JOIN customer_profiles p ON p.customer_id=c.id JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.purpose='ticket_delivery' WHERE c.id=?",[id]);if(!rows.length)fail('Cliente inexistente.',404);const row=rows[0];await c.query("INSERT INTO privacy_audit_log (actor_pseudonym,action,resource_type,resource_id,outcome) VALUES ('shared-operator','reveal_customer','customer',?,'success')",[id]);await c.commit();return {id:row.id,pseudonym:row.pseudonym,name:decryptContact(row.nameCiphertext,secrets.contact),email:decryptContact(row.emailCiphertext,secrets.contact)};}catch(error){await c.rollback();throw error;}finally{c.release();}},
  close:()=>pool.end()
 };
}

export async function createStore() {
 if(process.env.MYSQL_URL){const {createPool}=await import('mysql2/promise');return createMysqlStore(createPool(process.env.MYSQL_URL));}
 const directory=process.env.DATA_DIR||'data',file=join(directory,'state.json'),temp=join(directory,'state.tmp');await mkdir(directory,{recursive:true});let value;try{value=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;value=seed();}
 return localStore({value},async next=>{await writeFile(temp,JSON.stringify(next));await rename(temp,file);},async()=>{});
}
