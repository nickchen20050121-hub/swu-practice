// 由奈強度測試：預想版（smart）對舊的規則型（old），換座位各打一半
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join(__dirname,'..');
global.window=global; global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const f of ['cards.js','engine.js','i18n.js','effects.js','effects2.js','gfx.js','programs.js','meta_decks.js','deck.js','ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const pres=SWU.Deck.presets();
const mk=(d,n)=>({name:n,leader:SWU.Deck.card(d.leader),base:SWU.Deck.card(d.base),cards:SWU.Deck.expand(d)});
const H=SWU.AI.heur;
const games=+process.argv[2]||10; let smartW=0,oldW=0,draw=0,tmax=0,ttot=0,dec=0,errs=0;
(async()=>{
for(let i=0;i<games;i++){
  const smartSeat=i%2;
  const io=(smart)=>{let force=null;return {
    chooseAction:async(g,p,a)=>{ const vsSmart=process.argv[4]==='deep'; if(!smart&&!vsSmart) return H.chooseAction(g,p,a); if(!smart){const r=await H.chooseActionSmart(g,p,a,{deep:false}); force=r.force!=null&&r.act&&r.act.type==='attack'?{uid:r.act.uid,target:r.force}:null; return r.act;} const t=Date.now(); const r=await H.chooseActionSmart(g,p,a,JSON.parse(process.env.OPT||'{"deep":true}')); const dt=Date.now()-t; tmax=Math.max(tmax,dt); ttot+=dt; dec++; force=r.force!=null&&r.act&&r.act.type==='attack'?{uid:r.act.uid,target:r.force}:null; return r.act; },
    choose:async(g,p,r)=>{ if(force&&r.kind==='target'&&r.ctx&&r.ctx.uid===force.uid&&r.options.some(o=>o.id===force.target)){const t=force.target;force=null;return [t];} return H.choose(g,p,r)},
    resolveManual:async()=>{}}};
  const d0=pres[i%pres.length], d1=pres[(i+(process.argv[3]==='cross'?1:0))%pres.length];
  const g=new SWU.Game([mk(d0,'A'),mk(d1,'B')],[io(smartSeat===0),io(smartSeat===1)]);
  await g.run();
  errs+=g.G.log.filter(l=>l.k==='logEffectError').length;
  if(g.G.winner==null) draw++; else if(g.G.winner===smartSeat) smartW++; else oldW++;
}
console.log('smart',smartW,'old',oldW,'none',draw,'| decisions',dec,'avg ms',(ttot/Math.max(1,dec)).toFixed(0),'max ms',tmax,'| effect errors',errs);
})();
