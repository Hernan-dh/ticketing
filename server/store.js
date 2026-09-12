import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { seed } from './domain.js';
import { join } from 'node:path';
export async function createStore() {
 if(process.env.MYSQL_URL) {
  const {createPool}=await import('mysql2/promise'); const pool=createPool(process.env.MYSQL_URL);
  await pool.query('CREATE TABLE IF NOT EXISTS ticketing_state (id INT PRIMARY KEY, payload JSON NOT NULL)');
  await pool.query('INSERT IGNORE INTO ticketing_state VALUES (1, ?)',[JSON.stringify(seed())]);
  return {async transaction(fn) { const c=await pool.getConnection(); try {await c.beginTransaction(); const [rows]=await c.query('SELECT payload FROM ticketing_state WHERE id=1 FOR UPDATE');const s=typeof rows[0].payload==='string'?JSON.parse(rows[0].payload):rows[0].payload;const result=await fn(s);await c.query('UPDATE ticketing_state SET payload=? WHERE id=1',[JSON.stringify(s)]);await c.commit();return result;}catch(e){await c.rollback();throw e;}finally{c.release();} },close:()=>pool.end()};
 }
 const directory=process.env.DATA_DIR||'data';const file=join(directory,'state.json'),temp=join(directory,'state.tmp');
 await mkdir(directory,{recursive:true}); let state; try {state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state=seed();}
 let queue=Promise.resolve();
 return {transaction(fn) { const task=queue.then(async()=>{const next=structuredClone(state);const result=await fn(next);await writeFile(temp,JSON.stringify(next));await rename(temp,file);state=next;return result;});queue=task.catch(()=>{});return task;},close:async()=>{await queue;} };
}
