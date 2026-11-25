// 比賽牌組互打：檢查效果錯誤、卡住、手動處理
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join(__dirname,'..');
global.window=global; global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const f of ['cards.js','engine.js','i18n.js','effects.js','effects2.js','gfx.js','programs.js','meta_decks.js','deck.js','ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const metas=SWU.Deck.presets().filter(d=>d.meta);
const mk=(d)=>({name:d.name.slice(2,14),leader:SWU.Deck.card(d.leader),base:SWU.Deck.card(d.base),cards:SWU.Deck.expand(d)});
const H=SWU.AI.heur; if(process.env.STYLE) SWU.AI.settings.style=process.env.STYLE;
const games=+process.argv[2]||9; const smart=process.argv[3]!=='old';
const stat={};let errs=0,manual=0,stuck=0;
(async()=>{
for(let i=0;i<games;i++){
  const a=metas[i%metas.length], b=metas[(i*4+3)%metas.length];
  const io=()=>{let force=null;return {
    chooseAction:async(g,p,acts)=>{ if(!smart) return H.chooseAction(g,p,acts); const r=await H.chooseActionSmart(g,p,acts); force=r.force!=null&&r.act&&r.act.type==='attack'?{uid:r.act.uid,target:r.force}:null; return r.act; },
    choose:async(g,p,r)=>{ if(force&&r.kind==='target'&&r.ctx&&r.ctx.uid===force.uid&&r.options.some(o=>o.id===force.target)){const t=force.target;force=null;return [t];} return H.choose(g,p,r)},
    resolveManual:async(g,p,info)=>{manual++;console.log('MANUAL',info.card.key,'|',info.text.slice(0,80))}}};
  const g=new SWU.Game([mk(a),mk(b)],[io(),io()]);
  await g.run();
  const e=g.G.log.filter(l=>l.k==='logEffectError'); errs+=e.length; if(e.length) console.log('ERR',a.name.slice(0,20),'vs',b.name.slice(0,20),e.slice(0,3).map(l=>l.a));
  if(g.G.winner==null){stuck++;console.log('no winner',a.name,b.name,g.G.round);}
  else{const w=g.G.winner===0?a:b;stat[w.name.slice(2,20)]=(stat[w.name.slice(2,20)]||0)+1;}
  console.log(i,a.name.slice(2,20),'vs',b.name.slice(2,20),'→',g.G.winner,'rounds',g.G.round);
}
console.log(stat,'errors',errs,'manual',manual,'stuck',stuck);
})();
