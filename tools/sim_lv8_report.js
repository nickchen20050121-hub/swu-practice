// Lv8 強度報告：Lv8 用牌組 X，對 Lv7 用牌組 Y，換座位各打一半，輸出一行 JSON
// 用法：node tools/sim_lv8_report.js X Y 局數 [A等級] [B等級]
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join(__dirname,'..');
global.window=global; global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const f of ['cards.js','engine.js','i18n.js','effects.js','pilots.js','effects2.js','gfx.js', 'effects3.js','programs.js','meta_decks.js','deck.js','ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const pres=SWU.Deck.presets();
const mk=(d,n)=>({name:n,leader:SWU.Deck.card(d.leader),base:SWU.Deck.card(d.base),cards:SWU.Deck.expand(d)});
const H=SWU.AI.heur;
const X=+process.argv[2], Y=+process.argv[3], games=+process.argv[4]||4, LA=+process.argv[5]||8, LB=+process.argv[6]||7;
const out={x:X,xName:pres[X].leader,y:Y,yName:pres[Y].leader,la:LA,lb:LB,games:[]};
(async()=>{
for(let i=0;i<games;i++){
  const aSeat=i%2; let dec=0,tt=0,tmax=0;
  const io=(lv,isA)=>{let force=null;return {
    chooseAction:async(g,p,a)=>{const t=Date.now(); const r=await H.levelAction(g,p,a,lv); if(isA){const d=Date.now()-t;dec++;tt+=d;tmax=Math.max(tmax,d);} force=r.force!=null&&r.act&&r.act.type==='attack'?{uid:r.act.uid,target:r.force}:null; return r.act;},
    choose:async(g,p,r)=>{ if(force&&r.kind==='target'&&r.ctx&&r.ctx.uid===force.uid&&r.options.some(o=>o.id===force.target)){const t=force.target;force=null;return [t];} return H.levelChoose(g,p,r,lv)},
    resolveManual:async()=>{}}};
  const decks=aSeat===0?[mk(pres[X],'A'),mk(pres[Y],'B')]:[mk(pres[Y],'B'),mk(pres[X],'A')];
  const g=new SWU.Game(decks,[io(aSeat===0?LA:LB,aSeat===0),io(aSeat===1?LA:LB,aSeat===1)]);
  const t0=Date.now(); await g.run();
  const A=g.G.players[aSeat], B=g.G.players[1-aSeat];
  const hp=(P)=>(P.base.card.h||30)-P.base.damage;
  out.games.push({aFirst:aSeat===0,win:g.G.winner==null?null:g.G.winner===aSeat,rounds:g.G.round,aHp:hp(A),bHp:hp(B),
    errs:g.G.log.filter(l=>l.k==='logEffectError').length,dec,avgMs:Math.round(tt/Math.max(1,dec)),maxMs:tmax,sec:Math.round((Date.now()-t0)/1000)});
}
console.log(JSON.stringify(out));
})();
