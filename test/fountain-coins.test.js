const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fixture(coins=2){
 let saves=0,updates=0;const messages=[];
 const game={storage:{data:{coins},save(){saves++}},ui:{toast:m=>messages.push(m),updateProfile(){updates++}},player:{x:2200,y:1560,facing:1,motion:'ground',path:[1]},scenes:{current:'world'}};
 const source=html.slice(html.indexOf('class FountainCoins{'),html.indexOf('class InteractionSystem{'));
 const Coins=vm.runInNewContext(source+';FountainCoins',{game,P:()=>({x:2200,y:1500}),dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)});
 return {game,effect:new Coins,messages,saves:()=>saves,updates:()=>updates};
}
test('a fountain toss deducts exactly one coin and blocks duplicate actions during flight',()=>{
 const f=fixture();assert.equal(f.effect.toss(0),true);assert.equal(f.game.storage.data.coins,1);assert.equal(f.saves(),1);assert.equal(f.updates(),1);
 assert.equal(f.game.player.path.length,0);assert.equal(f.effect.toss(100),false);assert.equal(f.game.storage.data.coins,1);
 assert.equal(f.effect.toss(1400),true);assert.equal(f.game.storage.data.coins,0);
 assert.equal(f.effect.toss(2800),false);assert.equal(f.game.storage.data.coins,0);assert.equal(f.messages[0],'Недостаточно монет');
});
test('a toss requires being on the ground near the world fountain and expired effects are released',()=>{
 const f=fixture();f.game.scenes.current='shop';assert.equal(f.effect.toss(0),false);
 f.game.scenes.current='world';f.game.player.motion='jump';assert.equal(f.effect.toss(0),false);
 f.game.player.motion='ground';f.game.player.x=2400;assert.equal(f.effect.toss(0),false);
 assert.equal(f.game.storage.data.coins,2);f.game.player.x=2200;assert.equal(f.effect.toss(0),true);
 f.effect.draw({},1400);assert.equal(f.effect.flight,null);
});
