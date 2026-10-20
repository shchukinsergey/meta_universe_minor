// Server-authoritative decoration placement; only sprite and surface caches live in the browser.
const DECORATION_ZONES={
  flowers:[[-5,-3],[-4,-3],[-5,-2],[-4,-2],[4,3],[5,3],[4,4],[5,4]],
  walls:[{id:'observatory-facade',buildingId:'observatory',orientation:'front'},{id:'castle-facade',buildingId:'castle',orientation:'front'}]
};
const decorationCell=(cells,u,v)=>cells.some(([a,b])=>a===u&&b===v);
const FLOOR_SURFACE_ID='city-floor';
const floorSurfaceAt=(u,v)=>Number.isFinite(u)&&Number.isFinite(v)?{id:FLOOR_SURFACE_ID}:undefined;
const graffitiScale=item=>({S:.55,M:.75,L:.95}[item.size]||.75)*(item.scale||1);
const graffitiAngle=item=>(item.rotation||0)*Math.PI/180;
function graffitiFootprint(item,target){const span=graffitiScale(item),co=Math.cos(graffitiAngle(item)),si=Math.sin(graffitiAngle(item)),points=[];
  for(const x of [-1,1])for(const y of [-1,1])points.push({u:target.u+(x*co-y*si)*span,v:target.v+(x*si+y*co)*span});return points}

function decorationPlacementValid(item,target,world,placed=[],actors=[],doors=[]){
  if(!item||!target)return false;
  if(item.type==='graffiti'&&item.surface==='wall'){
    if(!DECORATION_ZONES.walls.some(w=>w.id===target.wallId)||!Number.isFinite(target.x)||!Number.isFinite(target.y))return false;
    const a=graffitiAngle(item),extent=.48*graffitiScale(item)*(Math.abs(Math.cos(a))+Math.abs(Math.sin(a)))/2;
    return target.x-extent>=-1e-7&&target.x+extent<=1+1e-7&&target.y-extent>=-1e-7&&target.y+extent<=1+1e-7;
  }
  if(item.type==='graffiti'&&item.surface==='floor'){
    const {u,v}=target;if(!Number.isFinite(u)||!Number.isFinite(v))return false;
    const tile=world.tile(Math.round(u),Math.round(v));
    return (!target.surfaceId||target.surfaceId===FLOOR_SURFACE_ID)&&!!tile&&tile.decorationAllowed!==false&&['paving','bridge'].includes(tile.kind);
  }
  if(item.type!=='flower')return false;
  const {u,v}=target;if(!Number.isInteger(u)||!Number.isInteger(v)||!decorationCell(DECORATION_ZONES.flowers,u,v))return false;
  const tile=world.tile(u,v);if(!tile||tile.blocked||tile.kind!=='paving'||doors.some(d=>Math.hypot(d.u-u,d.v-v)<2))return false;
  if(placed.some(o=>o.type==='flower'&&o.placement?.u===u&&o.placement?.v===v))return false;
  return !actors.some(a=>Math.hypot(a.x-(2200+(u-v)*32),a.y-(1500+(u+v)*16))<38);
}
function decorationFacade(wall){
  const spec=BUILDING_SPECS[wall.buildingId];if(!spec||spec.sprite)return null;
  const {u,v}=spec.position,D=P(u-3.5,v+2.5),C=P(u+2.5,v+2.5);
  const h=wall.buildingId==='castle'?174:126;
  const at=t=>({x:D.x+(C.x-D.x)*t,y:D.y+(C.y-D.y)*t-h+15});
  const a=at(.2),b=at(.8),height=h-30;
  return {a,b,height,center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2+height/2}}
}
function outlineDecorationFacade(c,region,color){
  c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.moveTo(region.a.x,region.a.y);c.lineTo(region.b.x,region.b.y);
  c.lineTo(region.b.x,region.b.y+region.height);c.lineTo(region.a.x,region.a.y+region.height);c.closePath();c.stroke()
}
function facadePoint(r,p){const x=(p.x-r.a.x)/(r.b.x-r.a.x);return {x,y:(p.y-r.a.y-(r.b.y-r.a.y)*x)/r.height}}

function drawFloorGraffiti(c,item,sprite){const p=P(item.placement.u,item.placement.v),span=graffitiScale(item),a=graffitiAngle(item),co=Math.cos(a),si=Math.sin(a);
  c.save();c.transform(64*span*(co-si)/128,32*span*(co+si)/128,-64*span*(si+co)/96,32*span*(co-si)/96,p.x,p.y);
  c.drawImage(sprite,-64,-48);c.restore()}
function drawWallGraffiti(c,item,sprite){const span=.48*graffitiScale(item),a=graffitiAngle(item),co=Math.cos(a),si=Math.sin(a);
  c.save();c.transform(256*span*co/128,192*span*si/128,-256*span*si/96,192*span*co/96,item.placement.x*256,item.placement.y*192);
  c.drawImage(sprite,-64,-48);c.restore()}
class DecorationPlacement {
  constructor(workshops){this.workshops=workshops;this.active=null;this.cursor=null;this.cache=new Map;this.surfaceCache=new Map;this.floorChunks=null;this.scale=1;this.rotation=0}
  items(){return [...(game.backend?.decorations?.values()||[])].filter(x=>x.ownerId===game.backend.user?.id)}
  placed(){return [...(game.backend?.decorations?.values()||[])].filter(x=>x.placement)}
  layers(id){return this.placed().filter(x=>x.type==='graffiti'&&(id===FLOOR_SURFACE_ID?x.surface==='floor':x.placement.surfaceId===id)).sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0)||String(a.id).localeCompare(String(b.id)))}
  invalidate(){this.surfaceCache.clear();this.floorChunks=null}
  occupied(u,v){return this.placed().some(x=>x.type==='flower'&&x.placement?.u===Math.round(u)&&x.placement?.v===Math.round(v))}
  activeItem(){return this.items().find(x=>x.id===this.active)}
  valid(target){return decorationPlacementValid({...this.activeItem(),scale:this.scale,rotation:this.rotation},target,game.world,this.placed(),[game.player,...game.backend.players.values()],game.world.interactions)}
  hint(){const hint=$('#placementHint');if(!this.active){hint.classList.add('hidden');return}hint.classList.remove('hidden');
    if(this.activeItem()?.type==='flower'){hint.textContent='ЦВЕТЫ · выберите зелёную клетку · клик — посадить · Esc — отмена';return}
    hint.innerHTML='ГРАФФИТИ · мышь — положение · колесо — размер · Q / R — поворот · Esc — отмена<br><span id="graffitiScale"></span>';this.updateScaleLabel()}
  updateScaleLabel(){const label=$('#graffitiScale');if(label)label.textContent=`Размер ${Math.round(this.scale*100)}% · ${this.rotation}°`}
  adjustScale(delta){if(this.activeItem()?.type!=='graffiti')return;this.scale=Math.round(Math.max(.65,Math.min(1.35,this.scale+delta*.1))*100)/100;if(this.lastPointer)this.move(this.lastPointer);this.updateScaleLabel()}
  rotate(delta){if(this.activeItem()?.type!=='graffiti')return;this.rotation=(this.rotation+delta*45+360)%360;if(this.lastPointer)this.move(this.lastPointer);this.updateScaleLabel()}
  start(id){const item=this.items().find(x=>x.id===id);if(!item||item.placement){game.ui.toast('Объект недоступен для размещения');return}
    if(game.scenes.current!=='world')game.scenes.exit();else game.ui.close();if(item.type==='flower')game.routeTo('plaza');
    this.active=item.id;this.scale=1;this.rotation=0;this.cursor=null;this.lastPointer=null;this.hint();$('#world').focus()}
  cancel(){if(!this.active)return;this.active=null;this.cursor=null;this.lastPointer=null;this.hint();game.ui.toast('Размещение отменено — объект остался в инвентаре')}
  point(e){const r=game.canvas.getBoundingClientRect();return {x:e.clientX-r.left+game.camera.x,y:e.clientY-r.top+game.camera.y}}
  move(e){if(!this.active||game.scenes.current!=='world'||!e)return;this.lastPointer={clientX:e.clientX,clientY:e.clientY};const raw=this.point(e),item=this.activeItem();
    if(item?.surface==='wall'){const wall=DECORATION_ZONES.walls.find(w=>{const r=decorationFacade(w),p=r&&facadePoint(r,raw);return p&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1});
      if(wall){const region=decorationFacade(wall),p=facadePoint(region,raw),a=graffitiAngle({...item,scale:this.scale,rotation:this.rotation}),half=.48*graffitiScale({...item,scale:this.scale})*(Math.abs(Math.cos(a))+Math.abs(Math.sin(a)))/2;
        this.cursor={wallId:wall.id,surfaceId:wall.id,x:Math.max(half,Math.min(1-half,p.x)),y:Math.max(half,Math.min(1-half,p.y))}}
      else this.cursor={...unproject(raw.x,raw.y)}}
    else if(item?.type==='graffiti'){const p=unproject(raw.x,raw.y);this.cursor={...p,surfaceId:FLOOR_SURFACE_ID}}
    else{const p=unproject(raw.x,raw.y);this.cursor={u:Math.round(p.u),v:Math.round(p.v)}}
    this.cursor.valid=this.valid(this.cursor)}
  async confirm(e){if(!this.active||this.pending)return false;this.move(e);if(!this.cursor?.valid){game.ui.toast('Здесь размещать нельзя');return true}
    const user=game.backend.user?.id,item=this.activeItem();if(!user||!item)return true;
    const {u,v,wallId,x,y,surfaceId}=this.cursor,placement=wallId?{surfaceId:wallId,x,y}:item.type==='graffiti'?{surfaceId,u,v}:{u,v};
    this.pending=true;
    try{await game.backend.placeDecoration(item.id,placement,this.scale,this.rotation);this.active=null;this.cursor=null;this.lastPointer=null;this.hint();game.ui.toast('Объект размещён');return true}
    catch(err){game.ui.toast('Не удалось разместить: '+err.message);return true}
    finally{this.pending=false}}
  sprite(item){const key=JSON.stringify([item.type,item.flower,item.color,item.form,item.template,item.primary,item.secondary]);if(this.cache.has(key))return this.cache.get(key);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=96;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    if(item.type==='flower'){
      const positions={single:[[0,0]],group:[[-16,6],[0,-5],[16,6]],round:[[0,-13],[-20,1],[20,1],[-10,13],[10,13]],rectangle:[[-20,-8],[0,-8],[20,-8],[-20,10],[0,10],[20,10]]}[item.form]||[[0,0]];
      for(const [dx,dy] of positions){const x=64+dx,y=72+dy;c.fillStyle='#35734f';c.fillRect(x-2,y-25,4,24);c.fillStyle=decorationColor(item.color);
        if(item.flower==='lavender'){for(let j=0;j<4;j++)c.fillRect(x-4,y-34+j*4,8,4)}
        else if(item.flower==='tulip'){c.fillRect(x-7,y-34,14,13);c.fillRect(x-7,y-38,5,6);c.fillRect(x+2,y-38,5,6)}
        else if(item.flower==='rose'){c.fillRect(x-8,y-36,16,16);c.fillStyle='#f8dfe9';c.fillRect(x-3,y-31,6,5)}
        else {for(const [a,b] of [[-9,0],[9,0],[0,-9],[0,9]])c.fillRect(x+a-4,y-32+b-4,8,8);c.fillStyle=item.flower==='sunflower'?'#765641':'#f4d46f';c.fillRect(x-5,y-37,10,10)}
      }
    }else{
      c.fillStyle=decorationColor(item.primary);c.strokeStyle=decorationColor(item.secondary);c.lineWidth=3;c.textAlign='center';c.lineJoin='round';
      if(item.template==='flower'){for(const [x,y]of [[64,17],[30,44],[98,44],[64,73],[40,22],[88,22],[40,66],[88,66]]){c.beginPath();c.ellipse(x,y,13,10,0,0,Math.PI*2);c.fill()}c.fillStyle=decorationColor(item.secondary);c.beginPath();c.arc(64,45,15,0,Math.PI*2);c.fill()}
      else if(item.template==='geometry'){c.lineWidth=8;c.strokeRect(17,13,94,70);c.strokeStyle=decorationColor(item.primary);c.beginPath();c.moveTo(24,72);c.lineTo(104,22);c.moveTo(24,22);c.lineTo(104,72);c.stroke();c.fillStyle=decorationColor(item.secondary);c.beginPath();c.arc(64,48,11,0,Math.PI*2);c.fill()}
      else{const text={bugs:'БАКСБАНИ',mognu:'Я ТЕБЯ МОГНУ',minor:'МАЙНОР СУПЕР','sixty-seven':'67'}[item.template]||'';c.font='bold 55px monospace';c.lineWidth=5;c.strokeText(text,64,66,116);c.fillText(text,64,66,116)}
    }
    if(this.cache.size>=256)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,canvas);return canvas
  }
  worldSprites(){return this.placed().filter(o=>o.type==='flower').map(item=>({type:'decoration',item,...P(item.placement.u,item.placement.v)}))}
  drawPlaced(c,item){const p=P(item.placement.u,item.placement.v);c.save();c.drawImage(this.sprite(item),p.x-64,p.y-76);c.restore()}
  drawFloor(c){if(!this.floorChunks){this.floorChunks=new Map;
      for(const item of this.layers(FLOOR_SURFACE_ID)){
        const corners=graffitiFootprint(item,item.placement).map(p=>P(p.u,p.v));
        const left=Math.floor((Math.min(...corners.map(p=>p.x))-2)/256),right=Math.floor((Math.max(...corners.map(p=>p.x))+2)/256);
        const top=Math.floor((Math.min(...corners.map(p=>p.y))-2)/256),bottom=Math.floor((Math.max(...corners.map(p=>p.y))+2)/256);
        for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++){
          const key=x+','+y;let chunk=this.floorChunks.get(key);
          if(!chunk){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.translate(-x*256,-y*256);chunk={canvas,ctx,x:x*256,y:y*256};this.floorChunks.set(key,chunk)}
          drawFloorGraffiti(chunk.ctx,item,this.sprite(item));
        }
      }
    }
    for(const chunk of this.floorChunks.values()){
      if(chunk.x+256<game.camera.x||chunk.x>game.camera.x+game.view.width||chunk.y+256<game.camera.y||chunk.y>game.camera.y+game.view.height)continue;
      c.drawImage(chunk.canvas,chunk.x,chunk.y)
    }}
  drawFacade(c,building){const wall=DECORATION_ZONES.walls.find(w=>w.buildingId===building.id);if(!wall)return;
    const region=decorationFacade(wall);if(!region)return;
    // A clear wall panel replaces windows only inside the two designated drawing areas.
    c.save();c.beginPath();c.moveTo(region.a.x,region.a.y);c.lineTo(region.b.x,region.b.y);
    c.lineTo(region.b.x,region.b.y+region.height);c.lineTo(region.a.x,region.a.y+region.height);c.closePath();
    c.fillStyle=building.id==='castle'?'#6e7b94':'#cccfca';c.fill();c.restore();
    const layers=this.layers(wall.id);if(!layers.length)return;
    let canvas=this.surfaceCache.get(wall.id);if(!canvas){canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      for(const item of layers)drawWallGraffiti(ctx,item,this.sprite(item));this.surfaceCache.set(wall.id,canvas)}
    const r=decorationFacade(wall);c.save();c.transform((r.b.x-r.a.x)/256,(r.b.y-r.a.y)/256,0,r.height/192,r.a.x,r.a.y);c.drawImage(canvas,0,0);c.restore()}
  drawZones(c){if(!this.active||game.scenes.current!=='world')return;const item=this.activeItem();if(!item)return;c.save();c.lineWidth=2;
    if(item.type==='flower')for(const [u,v] of DECORATION_ZONES.flowers){const p=P(u,v);c.strokeStyle='#75ea98';c.beginPath();c.moveTo(p.x,p.y-12);c.lineTo(p.x+25,p.y);c.lineTo(p.x,p.y+12);c.lineTo(p.x-25,p.y);c.closePath();c.stroke()}
    else if(item.surface==='floor'){} // Entire walkable city floor is available; no placement outlines.
    else for(const wall of DECORATION_ZONES.walls){const r=decorationFacade(wall);if(r)outlineDecorationFacade(c,r,'#8cecff')}c.restore()}
  drawCursor(c,phase='raised'){if(!this.active||!this.cursor||game.scenes.current!=='world')return;const item=this.activeItem();if(!item||((item.surface==='floor')!==(phase==='floor')))return;c.save();c.strokeStyle=this.cursor.valid?'#6cf499':'#ff6d84';
    if(item.type==='flower'){const p=P(this.cursor.u,this.cursor.v);c.beginPath();c.moveTo(p.x,p.y-16);c.lineTo(p.x+30,p.y);c.lineTo(p.x,p.y+16);c.lineTo(p.x-30,p.y);c.closePath();c.stroke();if(this.cursor.valid){c.globalAlpha=.55;this.drawPlaced(c,{...item,placement:this.cursor})}}
    else if(item.surface==='wall'){const wall=DECORATION_ZONES.walls.find(w=>w.id===this.cursor.wallId);if(wall){const r=decorationFacade(wall);outlineDecorationFacade(c,r,c.strokeStyle);c.save();c.transform((r.b.x-r.a.x)/256,(r.b.y-r.a.y)/256,0,r.height/192,r.a.x,r.a.y);c.globalAlpha=this.cursor.valid?.7:.35;
      drawWallGraffiti(c,{...item,scale:this.scale,rotation:this.rotation,placement:this.cursor},this.sprite(item));c.restore()}}
    else{c.globalAlpha=this.cursor.valid?.7:.35;drawFloorGraffiti(c,{...item,scale:this.scale,rotation:this.rotation,placement:this.cursor},this.sprite(item))}c.restore()}
}
if(typeof module!=='undefined'&&module.exports)module.exports={DECORATION_ZONES,decorationPlacementValid,graffitiFootprint,floorSurfaceAt,DecorationPlacement};
