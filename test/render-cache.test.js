const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function canvasDocument(){
 const stats={canvases:0,gradients:0,resizes:0};
 const document={createElement(){stats.canvases++;return {width:0,height:0,getContext:()=>({translate(){},scale(){},createRadialGradient(){stats.gradients++;return {addColorStop(){}}},fillRect(){},drawImage(){stats.resizes++}})}}};
 return {document,stats};
}
test('all benches have identical pixel dimensions in both diagonal orientations',()=>{
 const start=html.indexOf('const CITY_FURNITURE_SPRITES=');
 const code=html.slice(start,html.indexOf('\n});',start)+4);
 const specs=vm.runInNewContext(code+';CITY_FURNITURE_SPRITES');
 const benches=Object.entries(specs).filter(([key])=>key.startsWith('bench:'));
 assert.equal(benches.length,5);
 for(const [,spec] of benches){
  const png=fs.readFileSync(path.join(__dirname,'..',spec.src));
  assert.equal(Math.round(png.readUInt32BE(16)*spec.scale),87);
  assert.equal(Math.round(png.readUInt32BE(20)*spec.scale),68);
 }
});
test('sprite resizing happens once per asset and scale, failed loads retain the fallback',()=>{
 const {document,stats}=canvasDocument();
 const code=html.slice(html.indexOf('class BuildingSpriteSystem{'),html.indexOf('function drawBuilding('));
 const System=vm.runInNewContext(code+';BuildingSpriteSystem',{document});
 const sprites=new System({});sprites.images.set('tree',{naturalWidth:300,naturalHeight:600});
 const first=sprites.scaled('tree',1/3);
 for(let i=0;i<120;i++)assert.equal(sprites.scaled('tree',1/3),first);
 assert.equal(first.width,100);assert.equal(first.height,200);
 assert.equal(stats.resizes,1);assert.equal(stats.canvases,1);
 assert.equal(sprites.scaled('missing',1),null);
});
test('ground-light gradients are cached and offscreen lights are skipped',()=>{
 const {document,stats}=canvasDocument();
 const start=html.indexOf('drawLighting(c,t){');
 const code=html.slice(start,html.indexOf('\ninterior(c,t){',start));
 const renderer=vm.runInNewContext('({'+code+'})',{document});
 renderer.world={entities:[{type:'lamp',x:100,y:100},{type:'lamp',x:200,y:100},{type:'lamp',x:10000,y:10000}]};
 renderer.camera={x:0,y:0};renderer.view={width:1000,height:800};
 let draws=0;
 for(let i=0;i<120;i++)renderer.drawLighting({drawImage(){draws++}},i*16);
 assert.equal(stats.gradients,1);assert.equal(stats.canvases,1);assert.equal(draws,240);
});
test('avatar filters render once on a small surface per pose, appearance and direction',()=>{
 let canvases=0,avatarDraws=0;
 const document={createElement(){canvases++;return {width:0,height:0,getContext:()=>({translate(){},save(){},restore(){}})}}};
 const start=html.indexOf('function playerAvatarSprite('),end=html.indexOf('function artwork(',start);
 const sprite=vm.runInNewContext(html.slice(start,end)+';playerAvatarSprite',{document,drawAvatar(){avatarDraws++}});
 const first=sprite('#e7b875',null,1,0);
 for(let i=0;i<120;i++)assert.equal(sprite('#e7b875',null,1,0),first);
 assert.equal(first.width,96);assert.equal(first.height,112);
 assert.equal(canvases,1);assert.equal(avatarDraws,5);
 assert.notEqual(sprite('#e7b875',null,-1,0),first);
 assert.notEqual(sprite('#e7b875','hat',1,0),first);
 assert.notEqual(sprite('#e7b875',null,1,2),first);
 for(let i=0;i<80;i++)sprite('color-'+i,null,1,0);
 assert.ok(sprite.cache.size<=64,'cache stays bounded when appearance changes');
});
