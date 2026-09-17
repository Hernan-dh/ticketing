import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { createPool } from 'mysql2/promise';

if (!process.argv.includes('--append') || process.env.CONFIRM_DEMO_SEED !== 'ticketing-demo') {
  throw Error('Run with --append and CONFIRM_DEMO_SEED=ticketing-demo.');
}
if (!process.env.MYSQL_URL || !process.env.CONTACT_ENCRYPTION_KEY || !process.env.TICKET_TOKEN_KEY) {
  throw Error('MYSQL_URL, CONTACT_ENCRYPTION_KEY and TICKET_TOKEN_KEY are required.');
}

const events = [
  {id:'demo-cerati',name:'Siempre es hoy: homenaje a Cerati',category:'Música',venue:'Movistar Arena · Buenos Aires',date:'2026-10-10T21:00',price:52000,rows:10,columns:14,medium:'Digital',accent:'lime'},
  {id:'demo-spinetta',name:'Mañana es mejor: canciones de Spinetta',category:'Música',venue:'Teatro Gran Rex · Buenos Aires',date:'2026-10-24T20:30',price:44000,rows:8,columns:12,medium:'Papel',accent:'peach'},
  {id:'demo-sosa',name:'Gracias a la vida: tributo a Mercedes Sosa',category:'Música',venue:'Teatro Libertador · Córdoba',date:'2026-11-07T21:00',price:38000,rows:9,columns:12,medium:'Digital',accent:'lavender'},
  {id:'demo-charly',name:'Clics modernos: noche Charly García',category:'Música',venue:'Estadio Obras · Buenos Aires',date:'2026-11-21T22:00',price:61000,rows:12,columns:16,medium:'RFID',accent:'lime'},
  {id:'demo-gardel',name:'Volver: gala Carlos Gardel',category:'Música',venue:'Teatro Colón · Buenos Aires',date:'2026-12-05T20:00',price:75000,rows:7,columns:10,medium:'Papel',accent:'peach'},
  {id:'demo-paez',name:'El amor después del amor: especial Fito Páez',category:'Música',venue:'Anfiteatro Municipal · Rosario',date:'2026-12-19T21:30',price:47000,rows:10,columns:13,medium:'Digital',accent:'lavender'}
];
const sales = [
  ['demo-cerati','Web','card',['A1','A2'],true],['demo-cerati','Móvil','wallet',['B3'],true],
  ['demo-spinetta','Web','card',['A4','A5'],false],['demo-spinetta','Boletería','cash',['C1'],false],
  ['demo-sosa','Distribuidor','bank_transfer',['A1','A2','A3'],false],['demo-sosa','Web','card',['B4'],false],
  ['demo-charly','Móvil','wallet',['A1','A2'],false],['demo-charly','Boletería','cash',['C5','C6'],false],
  ['demo-charly','Web','card',['D1'],false],['demo-gardel','Distribuidor','bank_transfer',['A1','A2'],false],
  ['demo-gardel','Web','card',['B2'],false],['demo-paez','Web','card',['A1','A2','A3'],false],
  ['demo-paez','Móvil','wallet',['B1'],false],['demo-paez','Boletería','cash',['C2','C3'],false],
  ['demo-cerati','Web','card',['C1'],false],['demo-cerati','Móvil','wallet',['C2','C3'],false],
  ['demo-spinetta','Web','bank_transfer',['B1'],false],['demo-spinetta','Boletería','cash',['B2','B3'],false],
  ['demo-sosa','Web','card',['C1'],false],['demo-sosa','Distribuidor','bank_transfer',['C2','C3'],false],
  ['demo-charly','Móvil','wallet',['B1'],false],['demo-charly','Web','card',['B2','B3'],false],
  ['demo-gardel','Boletería','cash',['C1'],false],['demo-paez','Web','card',['D1','D2'],false]
];
const fictionalNames=['Valentina Robles','Mateo Ferrer','Camila Benítez','Julián Acosta','Sofía Pereyra','Tomás Quiroga','Martina Lagos','Bruno Méndez','Lara Villalba','Nicolás Soria','Emilia Funes','Franco Leiva','Renata Molina','Simón Cabrera','Abril Navarro','Benjamín Paz','Catalina Roldán','Dante Silva','Emma Torres','Felipe Varela','Guadalupe Arias','Joaquín Bustos','Malena Costa','Ramiro Duarte'];

const stableId=(namespace,value)=>{const hash=createHash('sha256').update(`${namespace}:${value}`).digest('hex');return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;};
const contactKey=createHash('sha256').update(process.env.CONTACT_ENCRYPTION_KEY).digest();
const encrypt=value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',contactKey,iv),body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]);};
const tokenFor=id=>createHmac('sha256',process.env.TICKET_TOKEN_KEY).update(`ticket:${id}`).digest('base64url');
const byId=new Map(events.map(event=>[event.id,event]));
const pool=createPool(process.env.MYSQL_URL),connection=await pool.getConnection();
try {
  await connection.beginTransaction();
  const [stateRows]=await connection.query('SELECT payload FROM ticketing_state WHERE id=1 FOR UPDATE');
  const state=typeof stateRows[0].payload==='string'?JSON.parse(stateRows[0].payload):stateRows[0].payload;
  for (const event of events) {
    await connection.query('INSERT INTO catalog_events (id,payload) VALUES (?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)',[event.id,JSON.stringify(event)]);
    const current=state.events.find(item=>item.id===event.id);if(current)Object.assign(current,event);else state.events.push(event);
  }
  for (const [index,[eventId,channel,methodType,seats,checkedIn]] of sales.entries()) {
    const number=String(index+1).padStart(3,'0'),email=`cliente-${number}@example.test`,event=byId.get(eventId);
    const customerId=stableId('showcase-customer',number),contactId=stableId('showcase-contact',number),methodId=stableId('showcase-method',number),orderId=stableId('showcase-order',number),paymentId=stableId('showcase-payment',number),holdId=stableId('showcase-hold',number),providerReference=`showcase_${number}`;
    const createdAt=new Date(Date.UTC(2026,8,index+1,15));
    const pseudonym=`Cliente ${createHmac('sha256',contactKey).update(email).digest('hex').slice(0,12)}`;
    const subjectHash=createHmac('sha256',contactKey).update(email).digest();
    await connection.query('INSERT INTO customers (id,subject_hash,pseudonym,last_activity_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE subject_hash=VALUES(subject_hash),pseudonym=VALUES(pseudonym),last_activity_at=VALUES(last_activity_at)',[customerId,subjectHash,pseudonym,createdAt]);
    await connection.query("INSERT IGNORE INTO customer_contacts (id,customer_id,purpose,ciphertext) VALUES (?,?,'ticket_delivery',?)",[contactId,customerId,encrypt(email)]);
    await connection.query('INSERT INTO customer_profiles (customer_id,display_name_ciphertext) VALUES (?,?) ON DUPLICATE KEY UPDATE display_name_ciphertext=VALUES(display_name_ciphertext)',[customerId,encrypt(fictionalNames[index])]);
    await connection.query("INSERT IGNORE INTO payment_methods (id,customer_id,provider,provider_reference,method_type) VALUES (?,?,'demo',?,?)",[methodId,customerId,providerReference,methodType]);
    await connection.query("INSERT IGNORE INTO sales_orders (id,hold_id,customer_id,event_id,channel,total_amount,payment_status,created_at) VALUES (?,?,?,?,?,?,'demo_paid',?)",[orderId,holdId,customerId,eventId,channel,seats.length*event.price,createdAt]);
    await connection.query("INSERT IGNORE INTO order_payments (id,order_id,payment_method_id,provider_reference,amount,status,created_at) VALUES (?,?,?,?,?,'demo_paid',?)",[paymentId,orderId,methodId,providerReference,seats.length*event.price,createdAt]);
    for (const seat of seats) {const ticketId=stableId('showcase-ticket',`${number}:${seat}`),token=tokenFor(ticketId);await connection.query('INSERT IGNORE INTO issued_tickets (id,order_id,event_id,seat,token_hash,medium,issued_at,used_at) VALUES (?,?,?,?,?,?,?,?)',[ticketId,orderId,eventId,seat,createHash('sha256').update(token).digest(),event.medium,createdAt,checkedIn?new Date(Date.UTC(2026,8,15,19,30)):null]);}
  }
  await connection.query('UPDATE ticketing_state SET payload=? WHERE id=1',[JSON.stringify(state)]);
  await connection.commit();
  console.log(`Showcase data ready: ${events.length} events and ${sales.length} idempotent demo sales.`);
} catch(error) {await connection.rollback();throw error;} finally {connection.release();await pool.end();}
