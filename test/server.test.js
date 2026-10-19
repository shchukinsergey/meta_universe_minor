const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../server');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'meta-universe-test-'));
const cleanDir = dir => fs.rmSync(dir, { recursive: true, force: true });

test('real HTTP auth/profile/work APIs and authenticated WebSocket room', async (t) => {
  const dir = tempDir();
  const app = createApp({ dataDir: dir, secureCookies: false });
  const server = app.server;
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await app.close(); cleanDir(dir); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (path, opts = {}) => fetch(base + path, opts);
  let r = await req('/health'); assert.equal(r.status, 200); assert.equal((await r.json()).ok, true);
  r = await req('/api/guest', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'Test_User'})});
  assert.equal(r.status, 201); const cookie = r.headers.get('set-cookie').split(';')[0];
  r = await req('/api/me',{headers:{cookie}}); const me = await r.json(); assert.equal(me.user.username,'Test_User'); assert.equal(me.user.guest,true); assert.equal('passwordHash' in me.user,false);
  r = await req('/api/profile',{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({profile:{face:'(•‿•)',color:'#abcdef',equipped:'scarf',owned:['scarf'],favorites:[],reactions:[]}})}); assert.equal(r.status,200);
  r = await req('/api/works',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({title:'A work',bg:'#fff',shape:'circle',symbol:'★',color:'#123456'})}); assert.equal(r.status,201);
  r = await req('/api/works',{headers:{cookie}}); const works=await r.json(); assert.equal(works.works.length,1); assert.equal(works.works[0].username,'Test_User'); assert.equal(works.works[0].title,'A work'); assert.ok('createdAt' in works.works[0]);
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`, {headers:{cookie,origin:base}});
  await once(ws,'open'); const msg = () => new Promise((resolve,reject)=>{ ws.addEventListener('message',e=>resolve(JSON.parse(e.data)),{once:true}); ws.addEventListener('error',reject,{once:true}); });
  const init = await msg(); assert.equal(init.type,'init'); assert.equal(init.players[0].username,'Test_User'); assert.equal(init.players[0].color,'#abcdef'); assert.equal(init.players[0].equipped,'scarf');
  const appearancePromise=msg(); ws.send(JSON.stringify({type:'profile',color:'#fedcba',equipped:'hat',username:'forged'})); const appearanceUpdate=await appearancePromise; assert.equal(appearanceUpdate.type,'players'); assert.deepEqual(Object.fromEntries(['color','equipped','username'].map(k=>[k,appearanceUpdate.players[0][k]])),{color:'#fedcba',equipped:'hat',username:'Test_User'});
  const invalidPromise=msg(); ws.send(JSON.stringify({type:'profile',color:'red',equipped:'admin'})); const stillSame=await Promise.race([invalidPromise,new Promise(resolve=>setTimeout(()=>resolve(null),100))]); assert.equal(stillSame,null);
  const chatPromise = msg(); ws.send(JSON.stringify({type:'chat',text:'hello'})); const chat=await chatPromise; assert.equal(chat.type,'chat'); assert.equal(chat.message.text,'hello');
  const clearedPromise=msg(); r=await req('/api/chat',{method:'DELETE',headers:{cookie}}); assert.equal(r.status,200); assert.deepEqual(await r.json(),{ok:true});
  const cleared=await clearedPromise; assert.deepEqual(cleared,{type:'chat_clear'});
  r=await req('/api/chat',{headers:{cookie}}); assert.deepEqual((await r.json()).messages,[]);
  ws.close(); await once(ws,'close');
  r=await req('/api/logout',{method:'POST',headers:{cookie}}); assert.equal(r.status,200);
  r=await req('/api/me',{headers:{cookie}}); assert.deepEqual(await r.json(),{user:null});
});

test('rejects invalid usernames and unauthenticated APIs', async (t) => {
 const dir=tempDir(); const app=createApp({dataDir:dir,secureCookies:false}); app.server.listen(0,'127.0.0.1'); await once(app.server,'listening'); t.after(async()=>{await app.close();cleanDir(dir)});
 const b=`http://127.0.0.1:${app.server.address().port}`;
 let r=await fetch(b+'/api/guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'  '})}); assert.equal(r.status,400);
 r=await fetch(b+'/api/guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'x'.repeat(21)})}); assert.equal(r.status,400);
 assert.equal((await fetch(b+'/api/register',{method:'POST'})).status,404);
 r=await fetch(b+'/api/profile'); assert.equal(r.status,401);
 assert.equal((await fetch(b+'/api/chat',{method:'DELETE'})).status,401);
});

test('accepts HTTPS origin when Amvera terminates TLS before the Node app', async (t) => {
  const dir = tempDir();
  const app = createApp({ dataDir: dir, secureCookies: false, amvera: true });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => { await app.close(); cleanDir(dir); });
  const host = `127.0.0.1:${app.server.address().port}`;
  const response = await fetch(`http://${host}/api/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Proxy_User' }),
    });
  assert.equal(response.status, 201);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const ws = new WebSocket(`ws://${host}/ws`, {
    headers: { cookie, origin: `https://${host}` },
  });
  const opened = once(ws, 'open');
  const initMessage = new Promise((resolve, reject) => {
    ws.addEventListener('message', event => resolve(JSON.parse(event.data)), { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  await opened;
  assert.equal((await initMessage).type, 'init');
  ws.close();
  await once(ws, 'close');
});

test('nickname-only guest session reconnects on reload without registration', async (t) => {
  const dir = tempDir();
  const app = createApp({ dataDir: dir, secureCookies: false });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => { await app.close(); cleanDir(dir); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  let r = await fetch(base + '/api/guest', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({username:'Лис'}) });
  assert.equal(r.status, 201);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  r = await fetch(base + '/api/me', {headers:{cookie}});
  const data = await r.json();
  assert.equal(data.user.username, 'Лис');
  assert.equal(data.user.guest, true);
    r = await fetch(base + '/api/guest', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({username:'Лис'}) });
    const second = await r.json();
    assert.equal(second.user.username, 'Лис');
    assert.notEqual(second.user.id, data.user.id);
    assert.equal((await fetch(base + '/api/register', {method:'POST'})).status, 404);
    assert.equal((await fetch(base + '/api/login', {method:'POST'})).status, 404);
});
