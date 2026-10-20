// AERIS.OS / Department of City Beautification — stage 1.
// Drafts are browser-local until server inventory is introduced in stage 3.
const DECORATION_OPTIONS = {
  flowerTypes: [['daisy','Ромашки'],['tulip','Тюльпаны'],['rose','Розы'],['sunflower','Подсолнухи'],['lavender','Лаванда']],
  flowerColors: [['white','Белый','#f6f4e9'],['yellow','Жёлтый','#f5cd60'],['pink','Розовый','#e7a0bd'],['red','Красный','#df6572'],['purple','Фиолетовый','#a483d2'],['blue','Голубой','#86bfe0']],
  flowerForms: [['single','Один цветок'],['group','Небольшая группа'],['round','Круглая клумба'],['rectangle','Прямоугольная клумба']],
  graffitiTypes: [['bugs','Баксбани'],['mognu','Я тебя могну'],['minor','Майнор супер'],['flower','Цветок'],['geometry','Геометрический рисунок'],['sixty-seven','67']],
  sizes: [['S','S'],['M','M'],['L','L']],
  surfaces: [['wall','Стена'],['floor','Пол']]
};
const decorationColor = id => DECORATION_OPTIONS.flowerColors.find(row=>row[0]===id)?.[2] || '#f6f4e9';

function drawFlowerPreview(c, item) {
  const w=c.canvas.width,h=c.canvas.height;
  c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
  c.fillStyle='#e8f3ff';c.fillRect(0,0,w,h);
  c.fillStyle='#8daea7';c.beginPath();c.moveTo(w/2,52);c.lineTo(w-25,106);c.lineTo(w/2,158);c.lineTo(25,106);c.fill();
  c.fillStyle='#5d8d68';c.beginPath();c.moveTo(w/2,66);c.lineTo(w-42,108);c.lineTo(w/2,145);c.lineTo(42,108);c.fill();
  c.save();c.translate(w/2,105);c.scale(1.7,1.7);c.translate(-w/2,-105);
  const offsets={single:[[0,0]],group:[[-45,13],[-19,-9],[13,17],[42,-5]],round:[[0,-21],[-45,0],[45,0],[-22,22],[22,22]],rectangle:[[-48,-13],[0,-13],[48,-13],[-48,18],[0,18],[48,18]]}[item.form]||[[0,0]];
  const px=(x,y,width,height,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),width,height)};
  for(const [dx,dy] of offsets){const x=w/2+dx,y=105+dy,petal=decorationColor(item.color);
    px(x-2,y-17,4,24,'#386d52');px(x-9,y-9,8,4,'#609b68');px(x+2,y-4,8,4,'#609b68');
    if(item.flower==='tulip'){px(x-7,y-30,14,12,petal);px(x-7,y-33,5,5,petal);px(x+2,y-33,5,5,petal)}
    else if(item.flower==='lavender'){for(let k=0;k<4;k++)px(x-5+(k%2)*3,y-36+k*5,8,5,petal)}
    else if(item.flower==='rose'){px(x-9,y-30,18,13,petal);px(x-5,y-27,10,5,'#f6d9e0');px(x-2,y-28,5,5,petal)}
    else {let r=item.flower==='sunflower'?12:9;for(const [ox,oy] of [[-r,0],[r,0],[0,-r],[0,r],[-8,-8],[8,-8],[-8,8],[8,8]])px(x+ox-4,y-29+oy-4,8,8,petal);px(x-6,y-35,12,12,item.flower==='sunflower'?'#765641':'#f1c75f')}
  }
  c.restore();
}
function drawGraffitiPreview(c,item){
  const w=c.canvas.width,h=c.canvas.height;c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
  c.fillStyle='#e9f3ff';c.fillRect(0,0,w,h);c.save();
  if(item.surface==='wall'){c.fillStyle='#a9b9c9';c.beginPath();c.moveTo(30,25);c.lineTo(287,49);c.lineTo(287,155);c.lineTo(30,130);c.fill();c.translate(45,41);c.transform(1,.09,0,1,0,0)}
  else{c.fillStyle='#a9b9c9';c.beginPath();c.moveTo(160,40);c.lineTo(305,104);c.lineTo(160,167);c.lineTo(15,104);c.fill();c.translate(76,86);c.transform(1,.38,-.4,.38,0,0)}
  const size={S:.7,M:1,L:1.3}[item.size]||1;c.scale(size,size);
  const primary=decorationColor(item.primary),secondary=decorationColor(item.secondary);
  c.fillStyle=primary;c.strokeStyle=secondary;c.lineWidth=3;
  if(item.template==='flower'||item.template==='geometry')c.translate(40/size,0);
  if(item.template==='flower'){for(const [x,y] of [[0,38],[26,38],[13,20],[13,55]])c.fillRect(x+45,y-7,22,20);c.fillStyle=secondary;c.fillRect(56,31,20,20)}
  else if(item.template==='geometry'){c.fillRect(30,30,78,42);c.fillStyle=secondary;c.fillRect(44,12,43,70);c.fillStyle=primary;c.fillRect(55,25,20,46)}
  else{const text={bugs:'БАКСБАНИ',mognu:'Я ТЕБЯ МОГНУ',minor:'МАЙНОР СУПЕР','sixty-seven':'67'}[item.template]||'';c.font='bold 28px monospace';c.lineJoin='round';c.textAlign='center';const center=113.5/size,baseline=(item.surface==='wall'?60:24)/size;c.strokeText(text,center,baseline,190/size);c.fillText(text,center,baseline,190/size)}
  c.restore();
}
function drawWorkshopStations(c,t){
  const f=P(-3,-3),g=P(3,-3);
  // Flower bench: seed trays, pots, tools and a few live flowers.
  diamond(c,f.x,f.y+8,119,56,'#294b48');rect(c,f.x-55,f.y-24,110,33,'#9b785d');
  poly(c,[[f.x-65,f.y-28],[f.x,f.y-57],[f.x+65,f.y-28],[f.x,f.y+1]],'#d5ad76');
  for(let i=0;i<3;i++){let x=f.x-39+i*38;rect(c,x-8,f.y-39,16,15,'#b97161');rect(c,x-6,f.y-40,12,5,'#514c3e');rect(c,x-2,f.y-62,4,22,'#54885f');rect(c,x-9,f.y-69,15,10,['#f0e9da','#db92a9','#edcb66'][i])}
  c.fillStyle='#e8f4ff';c.font='bold 10px monospace';c.textAlign='center';c.fillText('ЦВЕТЫ',f.x,f.y+30);
  // Graffiti board: fixed sample marks and a small row of spray cans.
  diamond(c,g.x,g.y+7,111,48,'#233b54');rect(c,g.x-51,g.y-97,102,77,'#24538b');rect(c,g.x-47,g.y-93,94,69,'#e1edfa');
  c.fillStyle='#285cb6';c.font='bold 17px monospace';c.textAlign='center';c.fillText('67',g.x,g.y-52);rect(c,g.x-45,g.y-43,22,11,'#d795b0');rect(c,g.x+22,g.y-43,22,11,'#86bbdf');
  for(let i=0;i<4;i++){rect(c,g.x-32+i*18,g.y-19,10,20,['#db92a9','#e5cc6c','#7199ca','#a286cb'][i]);rect(c,g.x-30+i*18,g.y-22,6,3,'#dce8ed')}
  c.fillStyle='#e8f4ff';c.font='bold 10px monospace';c.fillText('ГРАФФИТИ',g.x,g.y+29);
}
class DecorationWorkshops {
  constructor(){this.key='aeris-decoration-drafts-v1';this.drafts={};try{const raw=JSON.parse(localStorage.getItem(this.key)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))this.drafts=raw;
    let changed=false;for(const [owner,inventory] of Object.entries(this.drafts)){if(!inventory||typeof inventory!=='object')continue;
      if(inventory.graffiti){const old={...inventory.graffiti},placement=old.placement;
        if(placement?.wallId){old.placement=placement.wallId.startsWith('plaza-wall-')?undefined:{surfaceId:placement.wallId,x:.5,y:.5}}
        else if(placement){const id=floorSurfaceAt(placement.u,placement.v)?.id;old.placement=id?{surfaceId:id,u:placement.u,v:placement.v}:undefined}
        inventory.graffitiItems=[...(inventory.graffitiItems||[]),{...old,id:old.id||crypto.randomUUID(),owner,scale:1,rotation:0,layerOrder:old.placement?1:undefined}];delete inventory.graffiti;changed=true}
      if(!Array.isArray(inventory.graffitiItems))inventory.graffitiItems=[];
    }if(changed)localStorage.setItem(this.key,JSON.stringify(this.drafts))}catch{}}
  async migrateToServer(){const user=game.backend.user?.id,inventory=this.drafts[user];if(!inventory)return;
    const old=[inventory.flower,...(inventory.graffitiItems||[])].filter(Boolean).sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0)||(a.createdAt||0)-(b.createdAt||0));
    for(const item of old){try{
      const {type,flower,color,form,template,primary,secondary,size,surface}=item;
      const saved=await game.backend.createDecoration({type,flower,color,form,template,primary,secondary,size,surface,clientId:item.id});
      if(item.placement&&!saved.placement){const p=item.placement,placement=type==='flower'?{u:p.u,v:p.v}:surface==='wall'?{surfaceId:p.surfaceId||p.wallId,x:p.x,y:p.y}:{surfaceId:'city-floor',u:p.u,v:p.v};
        await game.backend.placeDecoration(saved.id,placement,item.scale||1,item.rotation||0)}
      if(type==='flower')delete inventory.flower;else inventory.graffitiItems=inventory.graffitiItems.filter(x=>x.id!==item.id);
      localStorage.setItem(this.key,JSON.stringify(this.drafts));
    }catch(e){game.ui.toast('Не удалось перенести старый объект: '+e.message)}}
  }
  async save(type,params){const user=game.backend.user?.id;if(!user){game.ui.toast('Войдите в игру, чтобы создать объект');return false}
    if(this.creating)return false;
    const cost=10,data=game.storage.data;
    if(!Number.isSafeInteger(data.coins)||data.coins<cost){game.ui.toast('Недостаточно монет: нужно 10');return false}
    this.creating=true;data.coins-=cost;game.storage.save();game.ui.updateProfile();
    try{await game.backend.createDecoration({type,...params});return true}
    catch(e){data.coins+=cost;game.storage.save();game.ui.updateProfile();game.ui.toast('Не удалось создать объект: '+e.message);return false}
    finally{this.creating=false}}

  menu(){game.ui.show('<div class="eyebrow">ДЕПАРТАМЕНТ БЛАГОУСТРОЙСТВА</div><h2>Выберите мастерскую</h2><p>Создайте композицию цветов или рисунок для города.</p><div class="decoration-menu"><button id="openFlowers">Цветочная мастерская</button><button id="openGraffiti">Граффити-мастерская</button><button id="openDecorations">Мои объекты</button></div>');$('#openFlowers').onclick=()=>this.open('flower');$('#openGraffiti').onclick=()=>this.open('graffiti');$('#openDecorations').onclick=()=>this.inventory()}
  open(type){const flower=type==='flower',options=DECORATION_OPTIONS;
    game.ui.show('<div class="eyebrow">ДЕПАРТАМЕНТ БЛАГОУСТРОЙСТВА / '+(flower?'ЦВЕТЫ':'ГРАФФИТИ')+'</div><h2>'+(flower?'Цветочная мастерская':'Граффити-мастерская')+'</h2><canvas class="decoration-preview" id="decorationPreview" width="320" height="180" aria-label="Предпросмотр композиции"></canvas><div class="decoration-controls" id="decorationControls"></div><p class="decoration-note" id="decorationNote">Объекты сохраняются на сервере и видны другим игрокам после размещения.</p><button class="primary wide" id="createDecoration">'+(flower?'Создать композицию · 10 монет':'Создать граффити · 10 монет')+'</button><button class="wide" id="viewDecorations">Мои объекты</button>');
    const controls=$('#decorationControls');const addSelect=(id,title,items)=>{const label=document.createElement('label');label.textContent=title;label.htmlFor=id;const select=document.createElement('select');select.id=id;for(const [value,name] of items){const opt=document.createElement('option');opt.value=value;opt.textContent=name;select.append(opt)}const group=document.createElement('div');group.append(label,select);controls.append(group);return select};
    if(flower){addSelect('decFlower','Тип цветов',options.flowerTypes);addSelect('decColor','Цвет',options.flowerColors.map(row=>row.slice(0,2)));addSelect('decForm','Форма посадки',options.flowerForms)}
    else{addSelect('decTemplate','Шаблон',options.graffitiTypes);addSelect('decPrimary','Основной цвет',options.flowerColors.map(row=>row.slice(0,2)));addSelect('decSecondary','Дополнительный цвет',options.flowerColors.map(row=>row.slice(0,2)));addSelect('decSize','Размер',options.sizes);addSelect('decSurface','Поверхность',options.surfaces);$('#decSecondary').value='blue'}
    const data=()=>flower?{flower:$('#decFlower').value,color:$('#decColor').value,form:$('#decForm').value}:{template:$('#decTemplate').value,primary:$('#decPrimary').value,secondary:$('#decSecondary').value,size:$('#decSize').value,surface:$('#decSurface').value};
    const redraw=()=>{if(flower){const blue=controls.querySelector('#decColor option[value=blue]');blue.disabled=!['lavender','rose'].includes($('#decFlower').value);if(blue.disabled&&$('#decColor').value==='blue')$('#decColor').value='white';drawFlowerPreview($('#decorationPreview').getContext('2d'),data())}else drawGraffitiPreview($('#decorationPreview').getContext('2d'),data())};
    controls.addEventListener('change',redraw);redraw();$('#createDecoration').onclick=async()=>{const button=$('#createDecoration');button.disabled=true;try{if(!await this.save(type,data()))return;$('#decorationNote').textContent='Объект сохранён на сервере. Откройте «Мои объекты», чтобы разместить его.';game.ui.toast('Объект создан')}finally{button.disabled=false}};$('#viewDecorations').onclick=()=>this.inventory(type);
  }
  inventory(tab='flower'){
    if(game.placement?.active)game.placement.cancel();
    game.ui.show('<div class="eyebrow">AERIS.OS / БЛАГОУСТРОЙСТВО</div><h2>Мои объекты</h2><p class="decoration-note">Черновики видите только вы. Размещённые объекты видны всем игрокам.</p><div class="row"><button id="invFlowers">Цветы</button><button id="invGraffiti">Граффити</button></div><div id="inventoryContents"></div>');
    $('#invFlowers').onclick=()=>this.inventory('flower');$('#invGraffiti').onclick=()=>this.inventory('graffiti');
    $('#invFlowers').classList.toggle('selected',tab==='flower');$('#invGraffiti').classList.toggle('selected',tab==='graffiti');
    const user=game.backend.user?.id,items=[...game.backend.decorations.values()].filter(x=>x.ownerId===user&&x.type===tab).sort((a,b)=>b.createdAt-a.createdAt),container=$('#inventoryContents');
    if(!items.length){const empty=document.createElement('p');empty.textContent='Пока пусто. Создайте объект в Департаменте благоустройства.';container.append(empty);return}
    for(const item of items){const card=document.createElement('article');card.className='decoration-card';
      const thumbnail=document.createElement('canvas');thumbnail.width=128;thumbnail.height=96;thumbnail.className='decoration-thumbnail';thumbnail.getContext('2d').drawImage(game.placement.sprite(item),0,0);
      const body=document.createElement('div'),title=document.createElement('strong');
      title.textContent=tab==='flower'?DECORATION_OPTIONS.flowerTypes.find(x=>x[0]===item.flower)?.[1]||'Цветы':DECORATION_OPTIONS.graffitiTypes.find(x=>x[0]===item.template)?.[1]||'Граффити';
      const detail=document.createElement('p');detail.textContent=tab==='flower'?(DECORATION_OPTIONS.flowerForms.find(x=>x[0]===item.form)?.[1]||'Композиция'):[item.size,item.surface==='wall'?'Стена':'Пол'].join(' · ');
      const state=document.createElement('p');state.textContent=item.placement?'Размещено в городе':'В инвентаре';
      const actions=document.createElement('div');actions.className='row';const place=document.createElement('button');place.className='primary';place.textContent='Разместить';place.disabled=!!item.placement;place.onclick=()=>game.placement.start(item.id);
      const remove=document.createElement('button');remove.textContent='Удалить из инвентаря';remove.onclick=async()=>{if(!window.confirm('Удалить объект? Если он размещён, он также исчезнет с карты.'))return;
        remove.disabled=true;try{await game.backend.removeDecoration(item.id);this.inventory(tab)}catch(e){remove.disabled=false;game.ui.toast('Не удалось удалить объект: '+e.message)}};
      actions.append(place,remove);body.append(title,detail,state,actions);card.append(thumbnail,body);container.append(card)}
  }

}
if(typeof module!=='undefined'&&module.exports)module.exports={drawFlowerPreview,drawGraffitiPreview};
