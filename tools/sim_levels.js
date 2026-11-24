// 難度驗證：等級 A 對等級 B，換座位各打一半。用法：node tools/sim_levels.js A B 局數
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join(__dirname,'..');
global.window=global; global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const f of ['cards.js','engine.js','i18n.js','effects.js','gfx.js','programs.js','meta_decks.js','deck.js','ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const pres=SWU.Deck.presets();
const mk=(d,n)=>({name:n,leader:SWU.Deck.card(d.leader),base:SWU.Deck.card(d.base),cards:SWU.Deck.expand(d)});
const H=SWU.AI.heur;
const A=+process.argv[2], B=+process.argv[3], games=+process.argv[4]||16, off=+process.argv[5]||0;
let aW=0,bW=0,none=0;
(async()=>{
for(let i=0;i<games;i++){
  const aSeat=i%2;
  const io=(lv)=>{let force=null;return {
    chooseAction:async(g,p,a)=>{const r=await H.levelAction(g,p,a,lv); force=r.force!=null&&r.act&&r.act.type==='attack'?{uid:r.act.uid,target:r.force}:null; return r.act;},
    choose:async(g,p,r)=>{ if(force&&r.kind==='target'&&r.ctx&&r.ctx.uid===force.uid&&r.options.some(o=>o.id===force.target)){const t=force.target;force=null;return [t];} return H.levelChoose(g,p,r,lv)},
    resolveManual:async()=>{}}};
  const k=Math.floor(i/2)+off, d0=pres[k%pres.length], d1=pres[(k+1)%pres.length];
  const g=new SWU.Game([mk(d0,'X'),mk(d1,'Y')],[io(aSeat===0?A:B),io(aSeat===1?A:B)]);
  await g.run();
  if(g.G.winner==null) none++; else if(g.G.winner===aSeat) aW++; else bW++;
}
console.log('L'+A,aW,'L'+B,bW,'none',none);
})();
