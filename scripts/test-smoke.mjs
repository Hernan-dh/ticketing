const base=(process.env.SMOKE_BASE_URL||'').replace(/\/$/,'');
if(!/^https?:\/\/.+/.test(base)) throw Error('Set SMOKE_BASE_URL, for example https://ticketing.example.test.');
for(const path of ['/api/health','/api/events']) {const response=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error(`${path} returned ${response.status}`);await response.json();}
console.log(`Smoke test passed for ${base}.`);
