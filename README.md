# Meta Universe Minor backend

Node.js 22+ single-process backend. Run `npm install`, then `npm start`; set `PORT` to select the listening port. SQLite persists in `DATA_DIR` (defaults to `./data`; use `/data` on Amvera). Keep `/data` mounted as persistent storage. Do not run multiple app instances: WebSocket presence and broadcasts are process-local, and this service is designed for one process.

## Amvera deployment

`amvera.yml` selects Node.js 22, starts `npm start` on port 3000, and mounts persistent storage at `/data`. In the Amvera project settings, set `DATA_DIR=/data` and `NODE_ENV=production`; no application secrets are required. Keep one running instance so all players share the same WebSocket room and SQLite database. The server recognizes Amvera's TLS-terminating proxy for same-origin HTTPS WebSocket requests.

## HTTP contract

- `GET /health` → `{ "ok": true }`; `GET /` serves `index.html` when present.
- `POST /api/guest` accepts `{username}` (1–20 characters) and creates a guest identity. There is no password registration or recovery; a lost session cannot recover its private drafts. Authentication uses an opaque HttpOnly, SameSite=Lax cookie with a seven-day server-side session. `Secure` is enabled when `NODE_ENV=production` (TLS should terminate at the trusted platform proxy).
- `GET /api/me` → `{user:null}` or `{user:{id,username,profile,guest:true}}`.
- `POST /api/logout` revokes the session. `GET/PUT /api/profile`; PUT accepts `{profile}` with only `face`, `color`, `equipped`, `owned`, `favorites`, and `reactions`. Coins and identity are not client-writable.
- `GET /api/works` → `{works:[...]}`; `POST /api/works` accepts `{title,bg,shape,symbol,color}`.
- `GET /api/decorations` returns the caller's drafts and all placed objects. `POST /api/decorations` creates a private flower or preset graffiti draft; an optional UUID `clientId` makes browser-draft migration idempotent per owner. `POST /api/decorations/:id/place` accepts `{placement,scale,rotation}`; floor graffiti uses fractional `u,v` on city paving or bridges, flowers use the designated integer cells, and wall graffiti uses normalized `x,y` on `shop-facade` or `workshop-facade`. `DELETE /api/decorations/:id` removes an owned object. The server validates placements and assigns graffiti layer order.
- `GET /api/chat` → `{messages:[latest 50]}`.

JSON bodies are limited to 32 KiB. Guest creation is throttled per remote IP. Errors use `{error}` and suitable HTTP status codes.

## WebSocket contract

Connect to `/ws` using the authenticated session cookie and a same-host `Origin`. The server sends `{type:"init",selfId,players,messages,decorations}`; decoration snapshots contain the caller's drafts and all placed objects. Draft creation emits `decoration_upsert` only to the owner; placements emit `decoration_upsert` to all, and deletions emit `decoration_remove` to viewers. Player records contain `id,username,face,x,y,scene,emote`, and messages contain `id,username,face,text,createdAt`.

Send `{type:"move",x,y,scene}` (finite coordinates within ±100000; scene is `world`, `gallery`, `shop`, or `workshop`; at most 10/s). Server broadcasts `{type:"players",players}`. Send `{type:"chat",text}` (up to 30 Unicode codepoints; 4 messages per 5 seconds); server stores at most 50 messages and broadcasts `{type:"chat",message:{id,username,face,text,createdAt}}`. Send `{type:"emote",id}` (integer 1–8); server broadcasts `{type:"emote",id,username,face}`. Identity and face always come from the authenticated account. Presence is removed on disconnect. WebSocket payload size is capped and ping/pong checks dead peers.

Run `npm test` for built-in `node:test` integration coverage using real HTTP, SQLite, and WebSocket connections.
