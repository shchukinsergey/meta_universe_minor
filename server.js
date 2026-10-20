'use strict';
const http=require('node:http'), path=require('node:path'), fs=require('node:fs'), crypto=require('node:crypto');
const Database=require('better-sqlite3'); const {WebSocketServer,WebSocket}=require('ws');
const FACES=['(^_^)','(•‿•)','(owo)','(>_<)','(♡_♡)','(-_-)','(x_x)','(★_★)'];
const ITEMS=['scarf','hat','halo','cape','bag','glasses','flower']; const SCENES=['world','gallery','shop','workshop'];
const DECORATION_ENUMS={flower:['daisy','tulip','rose','sunflower','lavender'],color:['white','yellow','pink','red','purple','blue'],form:['single','group','round','rectangle'],template:['bugs','mognu','minor','flower','geometry','sixty-seven'],primary:['white','yellow','pink','red','purple','blue'],secondary:['white','yellow','pink','red','purple','blue'],size:['S','M','L'],surface:['wall','floor']};
const FLOWER_CELLS=new Set(['-5,-3','-4,-3','-5,-2','-4,-2','4,3','5,3','4,4','5,4']);
const CITY_ISLANDS=[[0,0],[-12,4],[11,-5],[10,12],[-11,-9],[3,-13]];
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function cityTile(u,v){
 if(!finite(u)||!finite(v))return false;
 u=Math.round(u);v=Math.round(v);
 if(u< -21||u>21||v< -22||v>22)return false;
 const corridor=Math.abs(v-4)<=2&&u>=-10&&u<=3||Math.abs(v-2)<=2&&u>=0&&u<=15||Math.abs(v-6)<=2&&u>=0&&u<=15||Math.abs(u-13)<=2&&v>=0&&v<=15||Math.abs(u+7)<=2&&v>=-10&&v<=5||Math.abs(u-1)<=2&&v>=-14&&v<=0;
 if(!CITY_ISLANDS.some(([a,b])=>Math.abs(u-a)<=6&&Math.abs(v-b)<=6)&&!corridor)return false;
 const water=u===-7||u===7||(v===-18&&u>=-7&&u<=7);
 const bridge=u===-7&&(Math.abs(v-4)<=1||Math.abs(v+10)<=1)||u===7&&(v===2||v===6);
 return !water||bridge;
}
function validDecoration(b){if(!plain(b)||!['flower','graffiti'].includes(b.type))return false;
 const keys=b.type==='flower'?['flower','color','form']:['template','primary','secondary','size','surface'];
 return keys.every(k=>DECORATION_ENUMS[k].includes(b[k]))&&(b.type!=='flower'||b.color!=='blue'||['lavender','rose'].includes(b.flower));}
function validPlacement(d,b){if(!plain(b)||!plain(b.placement)||!finite(b.scale)||b.scale<.65||b.scale>1.35||!Number.isInteger(b.rotation)||b.rotation<0||b.rotation>359)return false;
 const p=b.placement;
 if(d.type==='flower')return (p.surfaceId===undefined||p.surfaceId==='city-floor')&&Object.keys(p).every(k=>['surfaceId','u','v'].includes(k))&&FLOWER_CELLS.has(`${p.u},${p.v}`)&&Number.isInteger(p.u)&&Number.isInteger(p.v);
 if(d.surface==='floor')return p.surfaceId==='city-floor'&&Object.keys(p).every(k=>['surfaceId','u','v'].includes(k))&&cityTile(p.u,p.v);
 if(!['observatory-facade','castle-facade'].includes(p.surfaceId)||!Object.keys(p).every(k=>['surfaceId','x','y'].includes(k))||!finite(p.x)||!finite(p.y))return false;
 const rad=b.rotation*Math.PI/180,extent=.48*({S:.55,M:.75,L:.95}[d.size])*b.scale*(Math.abs(Math.cos(rad))+Math.abs(Math.sin(rad)))/2;
 return p.x-extent>=-1e-7&&p.x+extent<=1+1e-7&&p.y-extent>=-1e-7&&p.y+extent<=1+1e-7;
}
const json=(res,status,data,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(data));};
function createApp(opts={}){
 const dataDir=opts.dataDir||process.env.DATA_DIR||path.join(__dirname,'data'); fs.mkdirSync(dataDir,{recursive:true});
 const db=new Database(path.join(dataDir,'game.sqlite')); db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL,normalized TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL,profile TEXT NOT NULL DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS works(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),title TEXT,bg TEXT,shape TEXT,symbol TEXT,color TEXT,created_at INTEGER);
 CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),text TEXT,created_at INTEGER);
 CREATE TABLE IF NOT EXISTS decorations(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,type TEXT NOT NULL,payload TEXT NOT NULL,placement TEXT,scale REAL,rotation INTEGER,layer_order INTEGER,created_at INTEGER NOT NULL,client_id TEXT);`);
 if(!db.pragma('table_info(decorations)').some(col=>col.name==='client_id'))db.exec('ALTER TABLE decorations ADD COLUMN client_id TEXT');
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS decorations_owner_client_id ON decorations(owner_id,client_id) WHERE client_id IS NOT NULL');
 db.exec('CREATE TABLE IF NOT EXISTS decoration_layer_sequence (value INTEGER PRIMARY KEY AUTOINCREMENT)');
 const prior=db.prepare('SELECT MAX(layer_order) AS n FROM decorations').get().n||0,seq=db.prepare('SELECT MAX(value) AS n FROM decoration_layer_sequence').get().n||0;
 if(prior>seq)db.prepare('INSERT INTO decoration_layer_sequence(value) VALUES(?)').run(prior);
 const decorationDTO=r=>{const payload=JSON.parse(r.payload);return {id:r.id,ownerId:r.owner_id,type:r.type,flower:payload.flower??null,color:payload.color??null,form:payload.form??null,template:payload.template??null,primary:payload.primary??null,secondary:payload.secondary??null,size:payload.size??null,surface:payload.surface??null,placement:r.placement?JSON.parse(r.placement):null,scale:r.scale,rotation:r.rotation,layerOrder:r.layer_order,createdAt:r.created_at}};
 const decorationList=owner=>db.prepare('SELECT * FROM decorations WHERE placement IS NOT NULL OR owner_id=? ORDER BY created_at,id').all(owner).map(decorationDTO);
 const decorationRow=db.prepare('SELECT * FROM decorations WHERE id=?');
 const placeDecoration=db.transaction((id,owner,b)=>{
  const row=decorationRow.get(id);if(!row)return {status:404};if(row.owner_id!==owner)return {status:403};if(row.placement)return {status:400};
  const d=decorationDTO(row);if(!validPlacement(d,b))return {status:400};
  if(d.type==='flower'&&db.prepare("SELECT 1 FROM decorations WHERE type='flower' AND placement IS NOT NULL AND json_extract(placement,'$.u')=? AND json_extract(placement,'$.v')=? LIMIT 1").get(b.placement.u,b.placement.v))return {status:400};
  const layerOrder=d.type==='graffiti'?Number(db.prepare('INSERT INTO decoration_layer_sequence DEFAULT VALUES').run().lastInsertRowid):null;
  db.prepare('UPDATE decorations SET placement=?,scale=?,rotation=?,layer_order=? WHERE id=?').run(JSON.stringify(b.placement),b.scale,b.rotation,layerOrder,id);
  return {status:200,decoration:decorationDTO(decorationRow.get(id))};
 });
 const cookieSecure=opts.secureCookies??(process.env.NODE_ENV==='production'); const amveraProxy=opts.amvera??(process.env.AMVERA==='1'); const presence=new Map(), loginLimits=new Map(); let server;
 const statements={user:db.prepare('SELECT * FROM users WHERE normalized=?'),session:db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?'),prune:db.prepare('DELETE FROM sessions WHERE expires<=?')};
 const parseCookie=req=>{const m=(req.headers.cookie||'').match(/(?:^|;\s*)session=([^;]+)/);return m?decodeURIComponent(m[1]):'';};
 const getUser=req=>{const token=parseCookie(req);return token?statements.session.get(crypto.createHash('sha256').update(token).digest('hex'),Date.now()):null;};
 const sessionCookie=(token,maxAge=604800)=>`session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cookieSecure?'; Secure':''}`;
 const issueSession=(res,id)=>{const token=crypto.randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),id,Date.now()+604800000);res.setHeader('Set-Cookie',sessionCookie(token));};
 const body=async req=>{let data='',n=0;for await(const chunk of req){n+=chunk.length;if(n>32768)throw Object.assign(Error('Body too large'),{status:413});data+=chunk;}try{return JSON.parse(data||'{}')}catch{throw Object.assign(Error('Invalid JSON'),{status:400})}};
 const authenticated=(req,res)=>{const u=getUser(req);if(!u)json(res,401,{error:'Authentication required'});return u;};
 const profileValid=p=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).every(k=>['face','color','equipped','owned','favorites','reactions'].includes(k))&&(!('face'in p)||FACES.includes(p.face))&&(!('color'in p)||(typeof p.color==='string'&&/^#[\da-fA-F]{6}$/.test(p.color)))&&['owned','favorites','reactions'].every(k=>!(k in p)||(Array.isArray(p[k])&&p[k].length<=30&&p[k].every(x=>typeof x==='string'&&x.length<=80)))&&(!('equipped'in p)||p.equipped===null||typeof p.equipped==='string'&&ITEMS.includes(p.equipped))&&(!p.owned||p.owned.every(x=>ITEMS.includes(x)));
 async function handler(req,res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'");
 try{const url=new URL(req.url,'http://localhost'), p=url.pathname;
 if(req.method==='GET'&&p==='/health')return json(res,200,{ok:true});
 if(req.method==='GET'&&p.startsWith('/art/')){const name=p.slice('/art/'.length);if(!/^[a-z0-9][a-z0-9_-]{0,63}\.png$/i.test(name))return json(res,404,{error:'Not found'});const file=path.join(__dirname,'art',name);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'Not found'});res.writeHead(200,{'content-type':'image/png','cache-control':'public, max-age=3600'});return fs.createReadStream(file).pipe(res);}
 if(req.method==='GET'&&p==='/'){const file=path.join(__dirname,'index.html');if(fs.existsSync(file)){res.writeHead(200,{'content-type':'text/html; charset=utf-8','Cache-Control':'no-store'});return fs.createReadStream(file).pipe(res);}return json(res,404,{error:'Not found'});}
 if(req.method==='GET'&&(p==='/museum-exhibits.js'||p==='/decoration-workshops.js'||p==='/decoration-placement.js'||/^\/assets\/museum\/museum-(born-digital|generative-art|historical-dress)\.png$/.test(p))){const file=path.join(__dirname,p.slice(1));if(!fs.existsSync(file))return json(res,404,{error:'Not found'});res.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript; charset=utf-8':'image/png','Cache-Control':p.endsWith('.js')?'no-store':'public, max-age=3600'});return fs.createReadStream(file).pipe(res);}
 if(req.method==='POST'&&p==='/api/guest'){const ip=req.socket.remoteAddress||'unknown',now=Date.now();if(!loginLimits.has(ip)&&loginLimits.size>=10000)loginLimits.delete(loginLimits.keys().next().value);const record=loginLimits.get(ip)||{count:0,start:now};if(now-record.start>60000){record.count=0;record.start=now;}if(++record.count>20){loginLimits.set(ip,record);return json(res,429,{error:'Too many attempts'});}loginLimits.set(ip,record);const b=await body(req),username=typeof b.username==='string'?b.username.trim():'';if(!username||Array.from(username).length>20||Array.from(username).some(ch=>ch.charCodeAt(0)<32||ch.charCodeAt(0)===127))return json(res,400,{error:'Введите имя (до 20 символов)'});const id=crypto.randomUUID(),salt=crypto.randomBytes(16),hash=crypto.randomBytes(64);db.prepare('INSERT INTO users(id,username,normalized,salt,hash,profile) VALUES(?,?,?,?,?,?)').run(id,username,'guest_'+id,salt.toString('hex'),hash.toString('hex'),'{}');issueSession(res,id);return json(res,201,{user:{id,username,profile:{},guest:true}});}
 if(req.method==='POST'&&p==='/api/logout'){const token=parseCookie(req);if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));return json(res,200,{ok:true},{'Set-Cookie':sessionCookie('',0)});}
 if(req.method==='GET'&&p==='/api/me'){const u=getUser(req),guest=!!u?.normalized.startsWith('guest_');return json(res,200,{user:guest?{id:u.id,username:u.username,profile:{},guest:true}:null});}
 if(p==='/api/profile'&&['GET','PUT'].includes(req.method)){const u=authenticated(req,res);if(!u)return;if(req.method==='GET')return json(res,200,{profile:JSON.parse(u.profile)});const b=await body(req);if(!profileValid(b.profile))return json(res,400,{error:'Invalid profile'});db.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(b.profile),u.id);return json(res,200,{profile:b.profile});}
 if(req.method==='GET'&&p==='/api/works'){const u=authenticated(req,res);if(!u)return;return json(res,200,{works:db.prepare('SELECT w.id,w.title,w.bg,w.shape,w.symbol,w.color,w.created_at AS createdAt,u.username FROM works w JOIN users u ON u.id=w.user_id WHERE w.user_id=? ORDER BY w.created_at DESC LIMIT 100').all(u.id)});}
 if(req.method==='POST'&&p==='/api/works'){const u=authenticated(req,res);if(!u)return;const b=await body(req);if(typeof b.title!=='string'||!b.title.trim()||b.title.length>80||['bg','shape','symbol','color'].some(k=>typeof b[k]!=='string'||!b[k]||b[k].length>80))return json(res,400,{error:'Invalid work'});const w={id:crypto.randomUUID(),...Object.fromEntries(['title','bg','shape','symbol','color'].map(k=>[k,b[k].trim()])),createdAt:Date.now()};db.prepare('INSERT INTO works VALUES(?,?,?,?,?,?,?,?)').run(w.id,u.id,w.title,w.bg,w.shape,w.symbol,w.color,w.createdAt);return json(res,201,{work:w});}
 if(p==='/api/decorations'&&['GET','POST'].includes(req.method)){
  const u=authenticated(req,res);if(!u)return;
  if(req.method==='GET')return json(res,200,{decorations:decorationList(u.id)});
  const b=await body(req);if(!validDecoration(b)||('clientId'in b&&!(typeof b.clientId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.clientId))))return json(res,400,{error:'Invalid decoration'});
  const fields=b.type==='flower'?['flower','color','form']:['template','primary','secondary','size','surface'];
  const payload=Object.fromEntries(fields.map(k=>[k,b[k]]));
  if(b.clientId){const existing=db.prepare('SELECT * FROM decorations WHERE owner_id=? AND client_id=?').get(u.id,b.clientId);if(existing)return json(res,200,{decoration:decorationDTO(existing)});}
  const id=crypto.randomUUID();db.prepare('INSERT INTO decorations(id,owner_id,type,payload,created_at,client_id) VALUES(?,?,?,?,?,?)').run(id,u.id,b.type,JSON.stringify(payload),Date.now(),b.clientId??null);
  const decoration=decorationDTO(decorationRow.get(id));sendToOwner(u.id,{type:'decoration_upsert',decoration});return json(res,201,{decoration});
 }
 const decorationRoute=p.match(/^\/api\/decorations\/([^/]+)(\/place)?$/);
 if(decorationRoute&&((req.method==='POST'&&decorationRoute[2])||(req.method==='DELETE'&&!decorationRoute[2]))){
  const u=authenticated(req,res);if(!u)return;const id=decorationRoute[1];
  if(req.method==='POST'){const b=await body(req),result=placeDecoration(id,u.id,b);if(result.status!==200)return json(res,result.status,{error:result.status===403?'Forbidden':result.status===404?'Not found':'Invalid placement'});broadcast({type:'decoration_upsert',decoration:result.decoration});return json(res,200,{decoration:result.decoration});}
  const row=decorationRow.get(id);if(!row)return json(res,404,{error:'Not found'});if(row.owner_id!==u.id)return json(res,403,{error:'Forbidden'});
  db.prepare('DELETE FROM decorations WHERE id=?').run(id);if(row.placement)broadcast({type:'decoration_remove',id});else sendToOwner(u.id,{type:'decoration_remove',id});return json(res,200,{ok:true});
 }
 if(req.method==='GET'&&p==='/api/chat'){const u=authenticated(req,res);if(!u)return;return json(res,200,{messages:db.prepare('SELECT m.id,u.username,json_extract(u.profile,'+'\'$.face\''+') AS face,m.text,m.created_at AS createdAt FROM messages m JOIN users u ON u.id=m.user_id ORDER BY m.created_at DESC LIMIT 50').all()});}
 if(req.method==='DELETE'&&p==='/api/chat'){const u=authenticated(req,res);if(!u)return;db.prepare('DELETE FROM messages').run();broadcast({type:'chat_clear'});return json(res,200,{ok:true});}
 return json(res,404,{error:'Not found'});
 }catch(e){return json(res,e.status||500,{error:e.status?e.message:'Internal server error'});}}
 server=http.createServer(handler);const wss=new WebSocketServer({noServer:true,maxPayload:4096,clientTracking:true});
 server.on('upgrade',(req,socket,head)=>{try{const u=new URL(req.url,'http://localhost'),origin=new URL(req.headers.origin||'');const expectedProtocol=amveraProxy?'https:':(req.socket.encrypted?'https:':'http:');if(u.pathname!='/ws'||origin.host!==req.headers.host||origin.protocol!==expectedProtocol)throw Error();const user=getUser(req);if(!user)throw Error();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,user));}catch{socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();}});
 const appearance=u=>{let profile={};try{profile=JSON.parse(u.profile||'{}')}catch{}return {face:profile.face||FACES[0],color:/^#[0-9a-fA-F]{6}$/.test(profile.color||'')?profile.color:null,equipped:ITEMS.includes(profile.equipped)?profile.equipped:null};};
 const playerList=()=>Array.from(presence.values()).map(x=>({id:x.user.id,username:x.user.username,...appearance(x.user),x:x.x,y:x.y,scene:x.scene,emote:x.emote}));const broadcast=o=>{const s=JSON.stringify(o);for(const c of wss.clients)if(c.readyState===WebSocket.OPEN)c.send(s);};const sendToOwner=(id,o)=>{const s=JSON.stringify(o);for(const c of wss.clients)if(c.readyState===WebSocket.OPEN&&c.ownerId===id)c.send(s);};
 wss.on('connection',(ws,user)=>{ws.ownerId=user.id;const p={user,x:0,y:0,scene:'world',lastMove:0,lastEmote:0,chat:[]};presence.set(user.id,p);ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);ws.send(JSON.stringify({type:'init',selfId:user.id,players:playerList(),messages:db.prepare('SELECT m.id,u.username,COALESCE(json_extract(u.profile,'+'\'$.face\''+'),?) AS face,m.text,m.created_at AS createdAt FROM messages m JOIN users u ON u.id=m.user_id ORDER BY m.created_at DESC LIMIT 50').all(FACES[0]).reverse(),decorations:decorationList(user.id)}));broadcast({type:'players',players:playerList()});ws.on('message',raw=>{try{const m=JSON.parse(raw.toString());if(m.type==='profile'){if(!Object.hasOwn(m,'color')||typeof m.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(m.color)||!Object.hasOwn(m,'equipped')||!(m.equipped===null||typeof m.equipped==='string'&&ITEMS.includes(m.equipped)))return;const current=JSON.parse(p.user.profile||'{}');current.color=m.color;current.equipped=m.equipped;p.user={...p.user,profile:JSON.stringify(current)};db.prepare('UPDATE users SET profile=? WHERE id=?').run(p.user.profile,user.id);broadcast({type:'players',players:playerList()});}else if(m.type==='move'){if(Date.now()-p.lastMove<100)return;p.lastMove=Date.now();if(!Number.isFinite(m.x)||!Number.isFinite(m.y)||Math.abs(m.x)>100000||Math.abs(m.y)>100000||!SCENES.includes(m.scene))return;p.x=m.x;p.y=m.y;p.scene=m.scene;broadcast({type:'players',players:playerList()});}else if(m.type==='chat'){const text=typeof m.text==='string'?Array.from(m.text.trim()).slice(0,30).join(''):'';p.chat=p.chat.filter(t=>Date.now()-t<5000);if(!text||p.chat.length>=4)return;p.chat.push(Date.now());const id=crypto.randomUUID(),createdAt=Date.now(),face=JSON.parse(user.profile).face||FACES[0];db.prepare('INSERT INTO messages VALUES(?,?,?,?)').run(id,user.id,text,createdAt);db.prepare('DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY created_at DESC LIMIT 50)').run();broadcast({type:'chat',message:{id,username:user.username,face,text,createdAt}});}else if(m.type==='emote'&&Number.isInteger(m.id)&&m.id>=1&&m.id<=8&&Date.now()-p.lastEmote>=250){p.lastEmote=Date.now();broadcast({type:'emote',id:m.id,username:user.username,face:JSON.parse(user.profile).face||FACES[0]});}}catch{}});ws.on('close',()=>{if(presence.get(user.id)===p)presence.delete(user.id);broadcast({type:'players',players:playerList()});});});
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},30000);heartbeat.unref();
 return {server,db,close:()=>new Promise(resolve=>{clearInterval(heartbeat);wss.close();server.close(()=>{db.close();resolve();});})};
}
if(require.main===module){const app=createApp();app.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Listening on ${app.server.address().port}`));}
module.exports={createApp};
