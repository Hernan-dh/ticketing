import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
test('API: autorización, concurrencia, emisión, ingreso único y persistencia',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'ticketing-test-'));
 let child;let log='';
 async function start(){child=spawn(process.execPath,[resolve('server/index.js')],{cwd,env:{...process.env,PORT:'3197',HOST:'127.0.0.1',ADMIN_KEY:'test-operator',ALLOW_DEMO_PAYMENTS:'true',MYSQL_URL:'',REDIS_URL:'',GRAILS_URL:''},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(log);try{const r=await fetch('http://127.0.0.1:3197/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Servidor no inició: '+log);}
 async function stop(){if(child&&child.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
 async function request(path,method='GET',body,admin=false){const r=await fetch(`http://127.0.0.1:3197/api${path}`,{method,headers:{'Content-Type':'application/json',...(admin?{'x-admin-key':'test-operator'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 try{await start();assert.equal((await request('/admin')).status,401);assert.equal((await request('/scan','POST',{token:'fake',eventId:'e1'})).status,401);
 const competitors=await Promise.all([1,2].map(()=>request('/holds','POST',{eventId:'e1',seats:['A1'],channel:'Web'})));assert.deepEqual(competitors.map(r=>r.status).sort(),[201,409]);const hold=competitors.find(r=>r.status===201).data;
 assert.equal((await request('/holds','POST',{eventId:'e1',seats:['A2'],channel:'Boletería'})).status,401);
 assert.equal((await request('/checkout','POST',{holdId:hold.id,email:'bad'})).status,400);
 const order=(await request('/checkout','POST',{holdId:hold.id,email:'test@example.com'})).data;
 const retry=(await request('/checkout','POST',{holdId:hold.id,email:'test@example.com'})).data;assert.equal(order.id,retry.id);assert.equal(order.total,45000);
 const entry={eventId:'e1',token:order.tickets[0].token};const scans=await Promise.all([1,2].map(()=>request('/scan','POST',entry,true)));assert.deepEqual(scans.map(r=>r.status).sort(),[200,409]);
 await stop();await start();assert.equal((await request('/scan','POST',entry,true)).status,409);assert.deepEqual((await request('/events/e1/seats')).data.sold,['A1']);
 const dashboard=(await request('/admin','GET',undefined,true)).data;assert.equal(dashboard.orders.length,1);assert.equal(dashboard.checkedIn,1);
 assert.equal((await request('/brand','PUT',{name:'Mi productora',color:'#abcdef'},true)).status,200);assert.equal((await request('/events')).data.brand.name,'Mi productora');
 }finally{await stop();await rm(cwd,{recursive:true,force:true});}
});
