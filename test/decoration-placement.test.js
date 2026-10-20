const test=require('node:test');
const assert=require('node:assert/strict');
const {drawFlowerPreview,drawGraffitiPreview}=require('../decoration-workshops');
const {DECORATION_ZONES,decorationPlacementValid,DecorationPlacement}=require('../decoration-placement');

function canvasStub(){
  const calls=[];
  const c={canvas:{width:320,height:180},fillStyle:null,textAlign:null,calls,
    fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isFinite),'draw with finite dimensions');calls.push({type:'rect',x,y,w,h,color:this.fillStyle})},
    clearRect(){},beginPath(){},moveTo(){},lineTo(){},fill(){},save(){},restore(){},translate(){},transform(){},scale(){},
    strokeText(text,x){calls.push({type:'text',text,x,align:this.textAlign})},fillText(){}
  };return c;
}
test('flower preview draws actual stems and petals after the soil',()=>{
  for(const flower of ['daisy','tulip','rose','sunflower','lavender']){
    const c=canvasStub();drawFlowerPreview(c,{flower,color:'pink',form:'round'});
    assert.ok(c.calls.some(x=>x.color==='#386d52'),'stem: '+flower);
    assert.ok(c.calls.some(x=>x.color==='#e7a0bd'),'petals: '+flower);
  }
});
test('graffiti lettering uses centered text alignment',()=>{
  const c=canvasStub();drawGraffitiPreview(c,{template:'sixty-seven',primary:'white',secondary:'blue',size:'L',surface:'wall'});
  assert.equal(c.calls.find(x=>x.type==='text').align,'center');
});
test('placement is limited to explicit free cells, no doors, avatars or occupied slots',()=>{
  const world={tile:(u,v)=>({kind:'paving',blocked:false})};
  const item={type:'flower'};const target={u:DECORATION_ZONES.flowers[0][0],v:DECORATION_ZONES.flowers[0][1]};
  assert.equal(decorationPlacementValid(item,target,world,[],[],[]),true);
  assert.equal(decorationPlacementValid(item,{u:0,v:0},world,[],[],[]),false);
  assert.equal(decorationPlacementValid(item,target,{tile:()=>({kind:'paving',blocked:true})},[],[],[]),false);
  assert.equal(decorationPlacementValid(item,target,world,[{type:'flower',placement:{...target}}],[],[]),false);
  assert.equal(decorationPlacementValid(item,target,world,[],[{x:2200+(target.u-target.v)*32,y:1500+(target.u+target.v)*16}],[]),false);
  assert.equal(decorationPlacementValid(item,target,world,[],[],[{...target}]),false);
});
test('graffiti may be placed anywhere on city paving or a bridge, under objects and other paint',()=>{
  const world={tile:()=>({kind:'paving',blocked:true})};
  const floor={type:'graffiti',surface:'floor',size:'M',scale:1};
  assert.deepEqual(DECORATION_ZONES.walls.map(x=>x.buildingId).sort(),['castle','observatory']);
  assert.ok(DECORATION_ZONES.walls.every(x=>!('u' in x)&&!('v' in x)),'no freestanding walls');
  assert.equal('floorSurfaces' in DECORATION_ZONES,false);
  const target={u:15.2,v:-10.7,surfaceId:'city-floor'};
  assert.equal(decorationPlacementValid(floor,target,world,[{type:'graffiti',placement:target}],[],[]),true);
  assert.equal(decorationPlacementValid(floor,target,{tile:()=>({kind:'bridge',blocked:false})},[],[],[]),true);
  assert.equal(decorationPlacementValid(floor,target,{tile:()=>({kind:'water',blocked:false})},[],[],[]),false);
  assert.equal(decorationPlacementValid(floor,target,{tile:()=>undefined},[],[],[]),false);
  assert.equal(decorationPlacementValid(floor,{wallId:DECORATION_ZONES.walls[0].id},world,[],[],[]),false);
});
test('wall local coordinates permit layers but reject artwork crossing facade edges',()=>{
  const wall={type:'graffiti',surface:'wall',size:'L',scale:1};
  const id=DECORATION_ZONES.walls[0].id;
  const target={wallId:id,x:.5,y:.5};
  assert.equal(decorationPlacementValid(wall,target,null,[{type:'graffiti',placement:target}],[],[]),true);
  assert.equal(decorationPlacementValid(wall,{...target,x:.1},null,[],[],[]),false);
  assert.equal(decorationPlacementValid({...wall,rotation:45},{...target,x:.2},null,[],[],[]),false);
  assert.equal(decorationPlacementValid(wall,{...target,wallId:'building-facade'},null,[],[],[]),false);
});
test('server snapshot renders placed objects from all owners in server layer order, drafts remain private',()=>{
  const previous=global.game;
  try{
    global.game={backend:{user:{id:'alice'},decorations:new Map([
      ['later',{id:'later',ownerId:'bob',type:'graffiti',surface:'floor',placement:{surfaceId:'city-floor',u:3,v:4},layerOrder:9}],
      ['private',{id:'private',ownerId:'bob',type:'graffiti',surface:'floor',placement:null}],
      ['earlier',{id:'earlier',ownerId:'alice',type:'graffiti',surface:'floor',placement:{surfaceId:'city-floor',u:3,v:4},layerOrder:2}],
      ['flower',{id:'flower',ownerId:'bob',type:'flower',placement:{u:2,v:3}}]
    ])}};
    const placement=new DecorationPlacement(null);
    assert.deepEqual(placement.items().map(x=>x.id),['earlier']);
    assert.deepEqual(placement.layers('city-floor').map(x=>x.id),['earlier','later']);
    assert.equal(placement.occupied(2,3),true);
  }finally{global.game=previous}
});

test('wall graffiti is limited to observatory and archive, leaving active buildings untouched',()=>{
 assert.deepEqual(DECORATION_ZONES.walls.map(w=>w.buildingId),['observatory','castle']);
 const item={type:'graffiti',surface:'wall',size:'M',scale:1,rotation:0};
 for(const wallId of ['observatory-facade','castle-facade'])assert.equal(decorationPlacementValid(item,{wallId,x:.5,y:.5}),true);
 for(const wallId of ['shop-facade','workshop-facade'])assert.equal(decorationPlacementValid(item,{wallId,x:.5,y:.5}),false);
});
