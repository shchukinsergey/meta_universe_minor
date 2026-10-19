const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'museum-assets-test-'));
const cleanDir = dir => fs.rmSync(dir, { recursive: true, force: true });

test('serves the museum PNG as a reusable same-origin building asset', async t => {
  const dir = tempDir();
  const app = createApp({ dataDir: dir, secureCookies: false });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => { await app.close(); cleanDir(dir); });

  const response = await fetch(`http://127.0.0.1:${app.server.address().port}/art/museum_v1.png`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^image\/png\b/);
  const actual = Buffer.from(await response.arrayBuffer());
  const expected = fs.readFileSync(path.join(__dirname, '..', 'art', 'museum_v1.png'));
  assert.deepEqual(actual, expected);
});

test('rejects path traversal through the building-asset route', async t => {
  const dir = tempDir();
  const app = createApp({ dataDir: dir, secureCookies: false });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => { await app.close(); cleanDir(dir); });

  const response = await fetch(`http://127.0.0.1:${app.server.address().port}/art/%2e%2e%2fserver.js`);
  assert.equal(response.status, 404);
});

function readBuildingSpecs() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = 'const BUILDING_SPECS=';
  const markerAt = html.indexOf(marker);
  assert.ok(markerAt >= 0, 'missing BUILDING_SPECS registry');
  const start = html.indexOf('{', markerAt);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) {
      return JSON.parse(JSON.stringify(require('node:vm').runInNewContext(`(${html.slice(start, i + 1)})`)));
    }
  }
  assert.fail('unterminated BUILDING_SPECS registry');
}

test('every building has reusable placement, scale, anchor, collision and entrance metadata', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const specs = readBuildingSpecs();
  assert.deepEqual(Object.keys(specs).sort(), ['castle', 'gallery', 'observatory', 'shop', 'workshop']);
  for (const [id, spec] of Object.entries(specs)) {
    for (const key of ['sprite', 'position', 'scale', 'anchor', 'collision', 'entrance']) {
      assert.ok(Object.prototype.hasOwnProperty.call(spec, key), `${id} is missing ${key}`);
    }
    assert.ok(spec.sprite === null || /^\/art\/[a-z0-9_-]+\.png$/i.test(spec.sprite), `${id} has an invalid PNG path`);
    assert.ok(Number.isFinite(spec.position.u) && Number.isFinite(spec.position.v), `${id} position must use tile coordinates`);
    assert.ok(Number.isFinite(spec.scale) && spec.scale > 0, `${id} scale must be positive`);
    assert.ok(Number.isFinite(spec.anchor.x) && Number.isFinite(spec.anchor.y), `${id} anchor must use source pixels`);
    assert.ok(['minU', 'maxU', 'minV', 'maxV'].every(key => Number.isFinite(spec.collision[key])), `${id} collision bounds must use tile offsets`);
    assert.ok(Number.isFinite(spec.entrance.u) && Number.isFinite(spec.entrance.v), `${id} entrance must use tile offsets`);
  }
  assert.equal(specs.gallery.sprite, '/art/museum_v1.png');
  assert.equal(specs.gallery.scale, 2);
  assert.deepEqual(specs.gallery.anchor, { x: 96, y: 116 });
  assert.deepEqual(specs.gallery.position, { u: -12, v: 4 });
  assert.deepEqual(specs.gallery.collision, { minU: -3, maxU: 2, minV: -3, maxV: 2 });
  assert.deepEqual(specs.gallery.entrance, { u: 3, v: 1 });
  assert.ok(html.includes('class BuildingSpriteSystem'), 'missing shared PNG sprite renderer');
  assert.ok(html.includes("if(o.type==='building'){const spec=BUILDING_SPECS[o.id];if(spec?.sprite)this.buildingSprites.draw(c,o);else drawBuilding(c,o)}"), 'sprite buildings must bypass the procedural renderer');
  assert.ok(html.includes('function drawBuilding(c,o){if(BUILDING_SPECS[o.id]?.sprite)return;'), 'procedural fallback must never repaint a sprite building');
  assert.ok(/imageSmoothingEnabled\s*=\s*false/.test(html), 'pixel smoothing is not disabled');
  assert.ok(/drawImage\s*\(/.test(html), 'Canvas2D drawImage is not used');
});

test('every building has one entrance-anchored AERIS label with a non-overlapping footprint', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const specs = readBuildingSpecs();
  const expected = { gallery: 'МУЗЕЙ', shop: 'ШОУРУМ', workshop: 'ДЕПАРТАМЕНТ\nБЛАГОУСТРОЙСТВА', observatory: 'ОБСЕРВАТОРИЯ', castle: 'АРХИВ' };
  const boxes = [];
  for (const [id, spec] of Object.entries(specs)) {
    assert.equal(spec.label?.title, expected[id], `${id} label title`);
    assert.ok(spec.label.icon && Number.isFinite(spec.label.offset.dx) && Number.isFinite(spec.label.offset.dy), `${id} label icon/offset`);
    const entrance = { u: spec.position.u + spec.entrance.u + spec.label.offset.u, v: spec.position.v + spec.entrance.v + spec.label.offset.v };
    const x = 2200 + (entrance.u - entrance.v) * 32 + spec.label.offset.dx;
    const y = 1500 + (entrance.u + entrance.v) * 16 + spec.label.offset.dy;
    const lines = spec.label.title.split('\n');
    const width = Math.max(142, ...lines.map(line => line.length * 7.2)) + 34;
    const height = 16 + lines.length * 14 + (spec.label.locked ? 13 : 0);
    boxes.push({ id, left: x-width/2, right: x+width/2, top: y, bottom: y+height });
    if (['castle','observatory'].includes(id)) assert.equal(spec.label.locked, true, `${id} must be marked unavailable`);
  }
  for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++) {
    const a=boxes[i],b=boxes[j];
    assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top, `${a.id} label overlaps ${b.id}`);
  }
  assert.ok(html.includes('class BuildingLabelRenderer'), 'missing shared Canvas label component');
  assert.ok(html.includes('this.labelRenderer.draw(c,b,'), 'labels are not rendered in the foreground pass');
  assert.ok(html.includes("this.interaction.nearby?.type==='door'"), 'nearby state is not linked to InteractionSystem');
  assert.ok(html.includes('active=active&&!locked'), 'a nearby locked label must stay muted');
});
