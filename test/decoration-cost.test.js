const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../decoration-workshops.js'),'utf8');
function fixture(coins,createDecoration=async()=>{}){
 const game={backend:{user:{id:'user'},createDecoration},storage:{data:{coins},save(){}},ui:{toast(){},updateProfile(){}}};
 const method=source.slice(source.indexOf('  async save(type,params)'),source.indexOf('  menu(){'));
 const Workshop=vm.runInNewContext('class Workshop{'+method+'};Workshop',{game});
 return {game,workshop:new Workshop};
}
test('flowers and graffiti each cost ten coins, insufficient funds create nothing',async()=>{
 for(const type of ['flower','graffiti']){
  let calls=0;const f=fixture(15,async()=>{calls++});
  assert.equal(await f.workshop.save(type,{}),true);assert.equal(f.game.storage.data.coins,5);
  assert.equal(await f.workshop.save(type,{}),false);assert.equal(calls,1);assert.equal(f.game.storage.data.coins,5);
 }
});
test('failed creation refunds the cost and concurrent clicks cannot double-charge',async()=>{
 let reject;const f=fixture(20,()=>new Promise((_,r)=>{reject=r}));
 const pending=f.workshop.save('flower',{});assert.equal(f.game.storage.data.coins,10);
 assert.equal(await f.workshop.save('graffiti',{}),false);
 reject(Error('offline'));assert.equal(await pending,false);assert.equal(f.game.storage.data.coins,20);
});
