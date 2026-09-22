import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { createStore } from './store.js';
import { brandInput, eventInput, fail, demoPaymentMethods } from './domain.js';
const app=express(), store=await createStore();
const key=process.env.ADMIN_KEY || randomBytes(18).toString('hex');
if(!process.env.ADMIN_KEY) console.log(`Clave de operador temporal: ${key}`);
let redis; if(process.env.REDIS_URL) {redis=(await import('redis')).createClient({url:process.env.REDIS_URL});redis.on('error',e=>console.error('Redis:',e.message));await redis.connect();}
app.use(express.json({limit:'32kb'}));
app.use((req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');next();});
const admin=(req,res,next)=>{const supplied=Buffer.from(req.get('x-admin-key')||''),expected=Buffer.from(key);if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return res.status(401).json({error:'Ingresá la clave de operador.'});next();};
// Redis only limits request rate; MySQL transactions remain the inventory authority.
app.use('/api',async(req,res,next)=>{try{if(redis){const k=`rate:${req.ip}:${Math.floor(Date.now()/60000)}`;const n=await redis.incr(k);if(n===1)await redis.expire(k,70);if(n>300)return res.status(429).json({error:'Demasiadas solicitudes. Esperá un minuto.'});}next();}catch(e){next(e);}});
async function catalog(method='GET',body) {const r=await fetch(`${process.env.GRAILS_URL}/api/events`,{method,headers:{'Content-Type':'application/json','X-Service-Key':process.env.SERVICE_KEY||''},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});if(!r.ok)fail('No se pudo consultar el catálogo Grails.',502);return r.json();}
app.get('/api/health',(_q,r)=>r.json({status:'ok',storage:process.env.MYSQL_URL?'mysql':'local',redis:!!redis,payments:'demo'}));
app.get('/api/payment-methods',(_q,r)=>r.json({provider:'demo',methods:Object.entries(demoPaymentMethods).map(([id,method])=>({id,...method}))}));
app.get('/api/events',async(_q,r)=>{if(process.env.GRAILS_URL){const events=await catalog();await store.transaction(s=>{for(const e of events){const current=s.events.find(existing=>existing.id===e.id);if(current)Object.assign(current,e);else s.events.push({...e,brandId:s.brands[0].id});}});}r.json(await store.transaction(s=>({events:s.events,brands:s.brands})));});
app.post('/api/events',admin,async(q,r)=>{const draft=eventInput(q.body);await store.transaction(s=>{if(!s.brands.some(brand=>brand.id===draft.brandId))fail('Elegí una marca válida.');});const event=process.env.GRAILS_URL?await catalog('POST',draft):draft;await store.transaction(s=>s.events.push(event));r.status(201).json(event);});
app.get('/api/events/:id/seats',async(q,r)=>r.json(await store.seats(q.params.id)));
app.post('/api/holds',async(q,r)=>{if(q.body.channel!=='Web'){let accepted=false;admin(q,r,()=>{accepted=true;});if(!accepted)return;}r.status(201).json(await store.reserve(q.body));});
app.post('/api/checkout',async(q,r)=>{if(process.env.ALLOW_DEMO_PAYMENTS!=='true')fail('El gateway de pago todavía no está configurado.',503);r.json(await store.checkout(q.body));});
app.post('/api/scan',admin,async(q,r)=>r.json(await store.scan(q.body)));
app.get('/api/admin',admin,async(_q,r)=>r.json(await store.admin()));
app.get('/api/customers',admin,async(_q,r)=>r.json({customers:await store.customers()}));
app.post('/api/customers/:id/reveal',admin,async(q,r)=>r.json(await store.revealCustomer(q.params.id)));
app.post('/api/brands',admin,async(q,r)=>r.status(201).json(await store.transaction(s=>{const brand=brandInput(q.body);s.brands.push(brand);return brand;})));
app.put('/api/brands/:id',admin,async(q,r)=>r.json(await store.transaction(s=>{const index=s.brands.findIndex(brand=>brand.id===q.params.id);if(index<0)fail('Marca inexistente.',404);return s.brands[index]=brandInput(q.body,q.params.id);})));
app.put('/api/integrations',admin,async(q,r)=>{const {provider,type}=q.body;if(!['Pago','Correo','Entrega','Beneficios','Sitio de venta'].includes(type)||typeof provider!=='string'||!provider.trim()||provider.length>80)fail('Configuración inválida.');r.json(await store.transaction(s=>{const item={id:randomBytes(8).toString('hex'),provider:provider.trim(),type,status:'Pendiente de conexión'};s.integrations.push(item);return item;}));});
app.use(express.static(resolve('dist')));
app.get('/{*path}',(_q,r)=>r.sendFile(resolve('dist/index.html')));
app.use((e,_q,r,_n)=>{if(!e.status||e.status>=500)console.error(e);r.status(e.status||500).json({error:e.status&&e.status<500?e.message:'Servicio no disponible. Intentá nuevamente.'});});
const server=app.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log('Ticketing API http://localhost:3001'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await store.close();if(redis)await redis.quit();process.exit(0);}));
