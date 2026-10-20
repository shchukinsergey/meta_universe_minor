const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fixture(){
 let canvases=0;
 const context={scale(){},translate(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},fill(){},fillRect(){},drawImage(){}};
 const document={createElement(){canvases++;return {width:0,height:0,getContext:()=>context}}};
 const projection=html.slice(html.indexOf('const P='),html.indexOf('\n',html.indexOf('const P=')));
 const primitives=html.slice(html.indexOf('function poly('),html.indexOf('class Backend{'));
 const paving=html.slice(html.indexOf('function plazaContains('),html.indexOf('function drawPlazaShadow('));
 const at=html.indexOf('const CITY_GROUND_ASSETS=');const registry=html.slice(at,html.indexOf('\n});',at)+4);
 const {Paving,assets}=vm.runInNewContext([projection,primitives,registry,paving,'({Paving:CityPaving,assets:CITY_GROUND_ASSETS})'].join('\n'),{document});
 const tiles=new Map;
 for(let u=-21;u<=21;u++)for(let v=-22;v<=22;v++)tiles.set(u+','+v,{u,v,kind:'paving',blocked:false});
 const world={tiles,key:(u,v)=>u+','+v,interactions:[{u:-9,v:5},{u:14,v:-4},{u:13,v:13},{u:-8,v:-8},{u:6,v:-12}],entities:[{type:'fountain',x:2200,y:1500}]};
 return {Paving,world,assets,canvases:()=>canvases};
}
test('paving separates the public plaza, streets, forecourts and quiet terraces without altering the map',()=>{
 const {Paving,world}=fixture(),before=JSON.stringify({tiles:[...world.tiles],entities:world.entities,doors:world.interactions});
 const p=new Paving(world);
 assert.equal(p.material(0,0),'plaza');
 assert.equal(p.material(-3,6),'plaza','seating terrace belongs to the public space');
 for(const [u,v] of [[-6,4],[12,2],[14,-2],[14,10],[-6,-6],[6,-10]])assert.equal(p.material(u,v),'plaza','light paths connect the plaza to each building');
 assert.equal(p.material(-19,3),'quiet');assert.equal(p.material(15,-1),'plaza','ZARYA terrace meets the light approach');
 for(const d of world.interactions)assert.equal(p.material(d.u,d.v),'plaza','clear forecourt at every entrance');
 assert.equal(JSON.stringify({tiles:[...world.tiles],entities:world.entities,doors:world.interactions}),before);
});
test('flat fallback tiles are reused without generating textures',()=>{
 const {Paving,world,canvases}=fixture(),p=new Paving(world);
 for(const material of ['plaza','street','quiet'])for(const variant of [false,true]){
  const tile=p.stamp(material,variant);assert.equal(tile.width,64);assert.equal(tile.height,32);
  assert.equal(p.stamp(material,variant),tile);
 }
 assert.equal(canvases(),2);
});

test('only the four supplied PNGs cover the map, with sparse variants and no overlays',()=>{
 const {Paving,world,assets,canvases}=fixture(),images=new Map;
 assert.deepEqual(Object.keys(assets).sort(),['city_main','city_variant','plaza_main','plaza_variant']);
 for(const spec of Object.values(assets)){
  const png=fs.readFileSync(path.join(__dirname,'..',spec.src));
  assert.equal(png.readUInt32BE(16),64);assert.equal(png.readUInt32BE(20),32);assert.equal(png[25],6);
  images.set(spec.id,{naturalWidth:64,naturalHeight:32});
 }
 const p=new Paving(world,images);let draws=0,variants=0;
 const output={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},drawImage(image,x,y,w,h){
  draws++;assert.equal(w,64);assert.equal(h,32);
  if(image===images.get(assets.city_variant.id)||image===images.get(assets.plaza_variant.id))variants++;
 }};
 for(const t of world.tiles.values())p.drawTile(output,t);
 assert.equal(draws,world.tiles.size,'one PNG per tile, no decorative overlays');
 assert.ok(variants/draws>.04&&variants/draws<.08,'variants remain rare');
 assert.equal(canvases(),0,'loaded PNGs require no extra tile canvases');
 assert.equal(output.imageSmoothingEnabled,false);
 assert.equal(p.stamp('quiet',false),images.get(assets.city_main.id));
 assert.equal(p.stamp('street',false),images.get(assets.city_main.id));
});
