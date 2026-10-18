const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../server');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'meta-universe-test-'));
const cleanDir = dir => fs.rmSync(dir, { recursive: true, force: true });
const generatedTestPassword = () => crypto.randomBytes(32).toString('hex');

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
  r = await req('/api/register', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'Test_User',password:generatedTestPassword()})});
  assert.equal(r.status, 201); const cookie = r.headers.get('set-cookie').split(';')[0];
  r = await req('/api/me',{headers:{cookie}}); const me = await r.json(); assert.equal(me.user.username,'Test_User'); assert.equal('passwordHash' in me.user,false);
  r = await req('/api/profile',{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({profile:{face:'(•‿•)',color:'#abcdef',equipped:'scarf',owned:['scarf'],favorites:[],reactions:[]}})}); assert.equal(r.status,200);
  r = await req('/api/works',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({title:'A work',bg:'#fff',shape:'circle',symbol:'★',color:'#123456'})}); assert.equal(r.status,201);
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`, {headers:{cookie,origin:base}});
  await once(ws,'open'); const msg = () => new Promise((resolve,reject)=>{ ws.addEventListener('message',e=>resolve(JSON.parse(e.data)),{once:true}); ws.addEventListener('error',reject,{once:true}); });
  const init = await msg(); assert.equal(init.type,'init'); assert.equal(init.players[0].username,'Test_User');
  const chatPromise = msg(); ws.send(JSON.stringify({type:'chat',text:'hello'})); const chat=await chatPromise; assert.equal(chat.type,'chat'); assert.equal(chat.message.text,'hello');
  ws.close(); await once(ws,'close');
  r=await req('/api/logout',{method:'POST',headers:{cookie}}); assert.equal(r.status,200);
  r=await req('/api/me',{headers:{cookie}}); assert.deepEqual(await r.json(),{user:null});
});

test('rejects invalid usernames and unauthenticated APIs', async (t) => {
 const dir=tempDir(); const app=createApp({dataDir:dir,secureCookies:false}); app.server.listen(0,'127.0.0.1'); await once(app.server,'listening'); t.after(async()=>{await app.close();cleanDir(dir)});
 const b=`http://127.0.0.1:${app.server.address().port}`;
 let r=await fetch(b+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'x!',password:generatedTestPassword()})}); assert.equal(r.status,400);
 r=await fetch(b+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'Valid_Name',password:'x'.repeat(5000)})}); assert.equal(r.status,400);
 r=await fetch(b+'/api/profile'); assert.equal(r.status,401);
});

test('accepts HTTPS origin when Amvera terminates TLS before the Node app', async (t) => {
  const dir = tempDir();
  const app = createApp({ dataDir: dir, secureCookies: false, amvera: true });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => { await app.close(); cleanDir(dir); });
  const host = `127.0.0.1:${app.server.address().port}`;
  const response = await fetch(`http://${host}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'Proxy_User', password: generatedTestPassword() }),
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
