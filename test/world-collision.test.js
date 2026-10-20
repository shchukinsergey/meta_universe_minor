const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function registry(name){const start=html.indexOf('const '+name+'=');return html.slice(start,html.indexOf('\n});',start)+4)}
function fixture(loaded=true){
 const projection=html.slice(html.indexOf('const P='),html.indexOf('\n',html.indexOf('const P=')));
 const worldClass=html.slice(html.indexOf('class World{'),html.indexOf('class CollisionSystem{'));
 const collision=html.slice(html.indexOf('class CollisionSystem{'),html.indexOf('class LocalChat{'));
 const ctx=vm.createContext({game:{placement:{occupied:()=>false}},dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)});
 vm.runInContext([projection,registry('BUILDING_SPECS'),registry('CITY_TREE_SPRITES'),registry('CITY_FURNITURE_SPRITES'),worldClass,collision,'World.prototype.cacheGround=()=>null;globalThis.api={P,unproject,World,CollisionSystem,CITY_TREE_SPRITES,CITY_FURNITURE_SPRITES};'].join('\n'),ctx);
 const a=ctx.api,world=new a.World,c=new a.CollisionSystem(world);
 const images=new Map(loaded?[...Object.values(a.CITY_TREE_SPRITES),...Object.values(a.CITY_FURNITURE_SPRITES)].map(s=>[s.id,{naturalWidth:100}]):[]);
 c.refreshSpriteCollisions(images);
 return {a,c,world,entities:world.entities};
}
test('perimeter furniture, trees and flowerbeds block their visible ground bases',()=>{
 const {a,c,entities}=fixture();
 for(const o of entities.filter(o=>['bench','lamp','tree','planter','bollard','plaza-flowerbed'].includes(o.type))){
  assert.equal(c.canMove(o.x,o.y,'world'),false,`${o.type} at ${o.u},${o.v}`);
 }
 assert.equal(c.walkable(-2.3,6),false,'bench extends beyond its central blocked cell');
 const spawn=a.P(3,3);assert.equal(c.canMove(spawn.x,spawn.y,'world'),true);
 assert.equal(c.walkable(0,0),false,'fountain remains blocked');
});
test('old positions are released and relocated trees use their actual ground positions',()=>{
 const {a,c}=fixture();
 for(const [u,v] of [[-4,3],[3,-4],[-3,4],[-5,3]])assert.equal(c.walkable(u,v),true,`stale obstacle ${u},${v}`);
 for(const [u,v] of [[-5,4],[6,-5]]){const p=a.P(u,v);assert.equal(c.canMove(p.x,p.y,'world'),false)}
});
test('all entrances and user flower cells remain accessible without crossing furniture',()=>{
 const {a,c,world}=fixture();
 for(const door of world.interactions){
  const route=c.findPath({u:3,v:3},door,'world');assert.ok(route.length,door.id);
  for(let i=1;i<route.length;i++)assert.equal(c.edgeClear(route[i-1],route[i],'world'),true);
 }
 for(const [u,v] of [[-5,-3],[-4,-3],[-5,-2],[-4,-2],[4,3],[5,3],[4,4],[5,4]]){
  const p=a.P(u,v);assert.equal(c.canMove(p.x,p.y,'world'),true,`user flower cell ${u},${v}`);
 }
 assert.equal(c.edgeClear({u:-4,v:6},{u:-2,v:6},'world'),false,'direct line through bench is rejected');
});
test('failed PNG loads keep procedural obstacles at their new coordinates',()=>{
 const {c}=fixture(false);
 for(const [u,v] of [[-5,4],[6,-5],[-3,6],[-6,6],[2,-4]])assert.equal(c.walkable(u,v),false);
});
test('the reclaimed river is walkable while decoration validation keeps the server footprint',()=>{
 const {a,c,world}=fixture();
 assert.equal([...world.tiles.values()].some(t=>t.kind==='water'||t.kind==='bridge'),false);
 for(const [u,v] of [[-7,0],[7,0],[7,4],[-7,-6],[0,-18]]){
  const p=a.P(u,v);assert.equal(c.canMove(p.x,p.y,'world'),true,`river fill ${u},${v}`);
 }
 assert.equal(c.edgeClear({u:6,v:4},{u:8,v:4},'world'),true,'crossing is no longer limited to the old bridge');
 const {decorationPlacementValid}=require('../decoration-placement');
 const item={type:'graffiti',surface:'floor',size:'S',scale:1,rotation:0};
 assert.equal(decorationPlacementValid(item,{surfaceId:'city-floor',u:7,v:4},world),false);
 assert.equal(decorationPlacementValid(item,{surfaceId:'city-floor',u:7,v:2},world),true,'old bridge stays a valid graffiti surface');
});

test('updated ZARYA footprint blocks the new wings and releases the old lot while keeping its door reachable',()=>{
 const {a,c,world}=fixture();
 for(const [u,v] of [[16,-9],[16,-5],[12,-9],[13,-4]])assert.equal(c.walkable(u,v),false,`ZARYA base ${u},${v}`);
 assert.equal(c.walkable(9,-6),true,'old empty footprint is released');
 const door=world.interactions.find(d=>d.id==='shop');
 assert.equal(c.canMove(door.x,door.y,'world'),true);
 assert.ok(c.findPath({u:3,v:3},door).length,'door remains reachable');
});
