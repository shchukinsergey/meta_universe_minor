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
  let page = await req('/'); assert.equal(page.headers.get('cache-control'),'no-store');
  assert.match(await page.text(),/decoration-workshops\.js\?v=/);
  for(const script of ['/decoration-workshops.js','/decoration-placement.js']){
    const asset=await req(script);assert.equal(asset.status,200);assert.equal(asset.headers.get('cache-control'),'no-store');
  }
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

const DecorationWebSocket = require('ws');
const decorationFixture = async t => {
 const dir=tempDir(),sockets=[]; let app=createApp({dataDir:dir,secureCookies:false});
 const start=async()=>{app.server.listen(0,'127.0.0.1');await once(app.server,'listening');return `http://127.0.0.1:${app.server.address().port}`};
 let base=await start(); t.after(async()=>{for(const ws of sockets)ws.terminate();await app.close();cleanDir(dir)});
 const call=async(cookie,route,method='GET',data)=>{const r=await fetch(base+route,{method,headers:{...(cookie?{cookie}:{}),'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,data:await r.json()}};
 const guest=async name=>{const r=await fetch(base+'/api/guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:name})});return {cookie:r.headers.get('set-cookie').split(';')[0],id:(await r.json()).user.id}};
 return {call,guest,restart:async()=>{await app.close();app=createApp({dataDir:dir,secureCookies:false});base=await start()},connect:async cookie=>{const ws=new DecorationWebSocket(base.replace('http','ws')+'/ws',{headers:{cookie,origin:base}}),events=[];ws.on('message',raw=>events.push(JSON.parse(raw.toString())));await once(ws,'open');sockets.push(ws);return events}};
};

test('decoration drafts remain private and idempotent migration persists on restart',async t=>{
 const f=await decorationFixture(t),a=await f.guest('Alpha'),b=await f.guest('Beta');
 assert.equal((await f.call(null,'/api/decorations')).status,401);
 const clientId='4d3352f6-b2fa-4e1e-92df-0a6f9e96f781',flower={type:'flower',flower:'rose',color:'pink',form:'round',clientId};
 const created=await f.call(a.cookie,'/api/decorations','POST',{...flower,ownerId:b.id,id:'forged',layerOrder:999});
 assert.equal(created.status,201);const d=created.data.decoration;assert.equal(d.ownerId,a.id);assert.notEqual(d.id,'forged');assert.equal(d.placement,null);
 assert.deepEqual((await f.call(b.cookie,'/api/decorations')).data.decorations,[]);
 assert.equal((await f.call(a.cookie,'/api/decorations','POST',{...flower,clientId:'not-a-uuid'})).status,400);
 assert.equal((await f.call(a.cookie,'/api/decorations','POST',{...flower,flower:'unknown'})).status,400);
 assert.equal((await f.call(a.cookie,'/api/decorations','POST',flower)).data.decoration.id,d.id);
 assert.equal((await f.call(b.cookie,`/api/decorations/${d.id}/place`,'POST',{placement:{surfaceId:'city-floor',u:4,v:3},scale:1,rotation:0})).status,403);
 const placed=await f.call(a.cookie,`/api/decorations/${d.id}/place`,'POST',{placement:{surfaceId:'city-floor',u:4,v:3},scale:1,rotation:0});
 assert.equal(placed.status,200);assert.deepEqual(placed.data.decoration.placement,{surfaceId:'city-floor',u:4,v:3});
 assert.equal((await f.call(b.cookie,'/api/decorations')).data.decorations.length,1);
 const another=(await f.call(b.cookie,'/api/decorations','POST',{type:'flower',flower:'daisy',color:'white',form:'single'})).data.decoration;
 assert.equal((await f.call(b.cookie,`/api/decorations/${another.id}/place`,'POST',{placement:{surfaceId:'city-floor',u:4,v:3},scale:1,rotation:0})).status,400);
 const fresh=(await f.call(b.cookie,'/api/decorations','POST',{type:'flower',flower:'daisy',color:'white',form:'single'})).data.decoration;
 assert.equal((await f.call(b.cookie,`/api/decorations/${fresh.id}/place`,'POST',{placement:{u:5,v:3},scale:1,rotation:0})).status,200);
 await f.restart();assert.equal((await f.call(a.cookie,'/api/decorations','POST',flower)).data.decoration.placement.u,4);
 assert.equal((await f.call(b.cookie,'/api/decorations')).data.decorations.length,3);
 assert.equal((await f.call(b.cookie,`/api/decorations/${d.id}`,'DELETE')).status,403);
 assert.equal((await f.call(a.cookie,`/api/decorations/${d.id}`,'DELETE')).status,200);
 assert.equal((await f.call(b.cookie,'/api/decorations')).data.decorations.length,2);
});

test('decoration placement validates geometry and synchronizes concurrent graffiti layers',async t=>{
 const f=await decorationFixture(t),a=await f.guest('Alpha'),b=await f.guest('Beta'),x=await f.connect(a.cookie),y=await f.connect(b.cookie);
 const graffiti={type:'graffiti',template:'geometry',primary:'red',secondary:'blue',size:'M',surface:'floor'};
 assert.equal((await f.call(a.cookie,'/api/decorations','POST',{...graffiti,size:'XL'})).status,400);
 const one=await f.call(a.cookie,'/api/decorations','POST',graffiti),two=await f.call(b.cookie,'/api/decorations','POST',graffiti);
 assert.equal(one.status,201);assert.equal(two.status,201);const id1=one.data.decoration.id,id2=two.data.decoration.id;
 assert.equal(y.some(e=>e.type==='decoration_upsert'&&e.decoration.id===id1),false);
 const place=(cookie,id,placement,scale=1,rotation=0)=>f.call(cookie,`/api/decorations/${id}/place`,'POST',{placement,scale,rotation});
 for(const p of [{surfaceId:'city-floor',u:-7,v:0},{surfaceId:'city-floor',u:99,v:99},{surfaceId:'bad',u:0,v:0}])assert.equal((await place(a.cookie,id1,p)).status,400);
 assert.equal((await place(a.cookie,id1,{surfaceId:'city-floor',u:0,v:0},null)).status,400);
 const fractional=(await f.call(a.cookie,'/api/decorations','POST',graffiti)).data.decoration;
 const fractionalPlacement=await place(a.cookie,fractional.id,{surfaceId:'city-floor',u:0.25,v:0.35});
 assert.equal(fractionalPlacement.status,200);assert.deepEqual(fractionalPlacement.data.decoration.placement,{surfaceId:'city-floor',u:0.25,v:0.35});
 const results=await Promise.all([place(a.cookie,id1,{surfaceId:'city-floor',u:-7,v:4}),place(b.cookie,id2,{surfaceId:'city-floor',u:0,v:0})]);
 assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(new Set(results.map(r=>r.data.decoration.layerOrder)).size,2);
 await new Promise(resolve=>setTimeout(resolve,30));for(const events of [x,y]){assert.equal(events.find(e=>e.type==='init').decorations.length,0);for(const id of [id1,id2])assert.ok(events.some(e=>e.type==='decoration_upsert'&&e.decoration.id===id))}
 assert.equal((await place(a.cookie,id1,{surfaceId:'city-floor',u:4,v:4})).status,400);
 const snapshot=await f.connect(a.cookie);await new Promise(resolve=>setTimeout(resolve,15));
 assert.ok(snapshot.find(e=>e.type==='init').decorations.some(d=>d.id===id2&&d.layerOrder===results[1].data.decoration.layerOrder));
 const wall=(await f.call(a.cookie,'/api/decorations','POST',{...graffiti,surface:'wall'})).data.decoration.id;
 assert.equal((await place(a.cookie,wall,{surfaceId:'shop-facade',x:0,y:.5})).status,400);
 assert.equal((await place(a.cookie,wall,{surfaceId:'shop-facade',x:.5,y:.5},1.35,45)).status,200);
 assert.equal((await f.call(a.cookie,`/api/decorations/${id1}`,'DELETE')).status,200);
 await new Promise(resolve=>setTimeout(resolve,20));assert.ok(y.some(e=>e.type==='decoration_remove'&&e.id===id1));
 assert.equal((await f.call(b.cookie,`/api/decorations/${id2}`,'DELETE')).status,200);
 assert.equal((await f.call(a.cookie,`/api/decorations/${wall}`,'DELETE')).status,200);
 const newer=(await f.call(a.cookie,'/api/decorations','POST',graffiti)).data.decoration.id;
 const next=await place(a.cookie,newer,{surfaceId:'city-floor',u:2,v:2});
 assert.equal(next.status,200);assert.ok(next.data.decoration.layerOrder>Math.max(...results.map(r=>r.data.decoration.layerOrder)));
});


test('existing decoration schema migrates nullable client id without losing rows',async t=>{
 const Database=require('better-sqlite3'),dir=tempDir(),file=path.join(dir,'game.sqlite');
 const old=new Database(file);old.exec("CREATE TABLE decorations(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,type TEXT NOT NULL,payload TEXT NOT NULL,placement TEXT,scale REAL,rotation INTEGER,layer_order INTEGER,created_at INTEGER NOT NULL)");old.close();
 const app=createApp({dataDir:dir,secureCookies:false});t.after(async()=>{await app.close();cleanDir(dir)});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 assert.ok(app.db.pragma('table_info(decorations)').some(c=>c.name==='client_id'));
 const base=`http://127.0.0.1:${app.server.address().port}`,r=await fetch(base+'/api/guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'Legacy'})});
 const cookie=r.headers.get('set-cookie').split(';')[0];
 const created=await fetch(base+'/api/decorations',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({type:'flower',flower:'rose',color:'blue',form:'single',clientId:'4d3352f6-b2fa-4e1e-92df-0a6f9e96f781'})});
 assert.equal(created.status,201);
});
