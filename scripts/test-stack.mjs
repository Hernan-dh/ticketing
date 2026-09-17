import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const port=Number(process.env.TEST_PORT||3311),project=`ticketing-test-${Date.now()}-${randomBytes(3).toString('hex')}`;
const environment={...process.env,ADMIN_KEY:'stack-test-operator-key',SERVICE_KEY:'stack-test-service-key',DB_PASSWORD:'stack-test-db-password',MYSQL_ROOT_PASSWORD:'stack-test-root-password',CONTACT_ENCRYPTION_KEY:'stack-test-contact-key-0123456789',TICKET_TOKEN_KEY:'stack-test-ticket-key-01234567890',ALLOW_DEMO_PAYMENTS:'true',APP_PORT:String(port)};
const composeArgs=['compose','-p',project,'-f','compose.yaml','-f','compose.test.yaml'];
const run=(args,{capture=false}={})=>new Promise((resolve,reject)=>{const child=spawn('docker',[...composeArgs,...args],{cwd:process.cwd(),env:environment,stdio:capture?['ignore','pipe','pipe']:'inherit'});let output='';if(capture){child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);}child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(Error(`docker compose ${args.join(' ')} exited with ${code}\n${output}`)));});
const waitFor=async(fn,label)=>{let error;console.log(`[integration] Waiting for ${label}...`);for(let attempt=0;attempt<120;attempt++){try{const result=await fn();console.log(`[integration] ${label} is ready.`);return result;}catch(cause){error=cause;if((attempt+1)%10===0)console.log(`[integration] Still waiting for ${label} (${attempt+1}s)...`);await new Promise(resolve=>setTimeout(resolve,1000));}}throw Error(`Timed out waiting for ${label}: ${error?.message||'unknown error'}`);};
const request=async(path,{method='GET',body,admin=false}={})=>{const response=await fetch(`http://127.0.0.1:${port}/api${path}`,{method,headers:{'content-type':'application/json',...(admin?{'x-admin-key':environment.ADMIN_KEY}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||`${method} ${path} failed`),{status:response.status});return data;};
const expect=(condition,message)=>{if(!condition)throw Error(message);};
const keep=process.argv.includes('--keep');
try {
  console.log(`[integration] Starting isolated stack ${project} on port ${port}...`);
  await run(['up','-d','--build']);
  try {await waitFor(async()=>{const health=await request('/health');expect(health.storage==='mysql','stack did not use MySQL');expect(health.redis===true,'stack did not use Redis');return health;},'application health');}
  catch (error) {const logs=await run(['logs','--no-color','app','mysql','catalog'],{capture:true}).catch(logError=>`Could not collect container logs: ${logError.message}`);throw Error(`${error.message}\n\nContainer logs:\n${logs}`);}
  const catalog=await waitFor(async()=>{const data=await request('/events');expect(data.events.some(event=>event.id==='e1'),'catalog event e1 unavailable');return data;},'Grails catalog');
  expect(catalog.events.length>0,'catalog is empty');
  console.log('[integration] Checking hold, checkout, sales, and customer profile...');
  const hold=await request('/holds',{method:'POST',body:{eventId:'e1',seats:['A1'],channel:'Web'}});
  const order=await request('/checkout',{method:'POST',body:{holdId:hold.id,buyerName:'Persona de Prueba',email:'stack-test@example.test',paymentMethod:'demo_card'}});
  expect(order.tickets.length===1,'checkout did not issue one ticket');
  const dashboard=await request('/admin',{admin:true});expect(dashboard.orders.some(item=>item.id===order.id),'order is absent from sales dashboard');
  const customers=await request('/customers',{admin:true});const customer=customers.customers.find(item=>item.pseudonym.startsWith('Cliente '));expect(customer,'pseudonymous customer is absent');
  const profile=await request(`/customers/${customer.id}/reveal`,{method:'POST',admin:true});expect(profile.name==='Persona de Prueba'&&profile.email==='stack-test@example.test','encrypted customer profile did not round-trip');
  console.log('[integration] Checking atomic duplicate-admission protection...');
  const scans=await Promise.allSettled([request('/scan',{method:'POST',admin:true,body:{eventId:'e1',token:order.tickets[0].token}}),request('/scan',{method:'POST',admin:true,body:{eventId:'e1',token:order.tickets[0].token}})]);
  const statuses=scans.map(result=>result.status==='fulfilled'?200:result.reason.status).sort();expect(statuses[0]===200&&statuses[1]===409,`expected scan statuses 200/409, got ${statuses.join('/')}`);
  console.log(`Integration stack passed on project ${project}.`);
} finally {
  if(keep) console.log(`Keeping ${project} for diagnosis on port ${port}.`);else {console.log('[integration] Removing isolated containers and volumes...');await run(['down','--volumes','--remove-orphans'],{capture:true}).catch(error=>console.error(`Cleanup failed: ${error.message}`));}
}
