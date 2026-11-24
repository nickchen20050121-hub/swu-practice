// 回上一步（重播）一致性測試：同種子＋同輸入重播，狀態必須完全相同
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join(__dirname,'..');
global.window=global; global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const f of ['cards.js','engine.js','i18n.js','effects.js','gfx.js','programs.js','meta_decks.js','deck.js','ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const pres=SWU.Deck.presets();
const mk=(d,n)=>({name:n,leader:SWU.Deck.card(d.leader),base:SWU.Deck.card(d.base),cards:SWU.Deck.expand(d)});
const st=(g)=>JSON.stringify(g.G,(k,v)=>typeof v==='function'?undefined:k==='log'?v.length:v);
const games=+process.argv[2]||10; let bad=0,checks=0;
(async()=>{
for(let i=0;i<games;i++){
  const snaps={};
  const mkio=(human,g0)=>({isHuman:human,chooseAction:async(g,p,a)=>{if(human&&g.checkpoints.length&&!g.replaying)snaps[g.rec.length]=st(g);return SWU.AI.heur.chooseAction(g,p,a)},choose:async(g,p,r)=>SWU.AI.heur.choose(g,p,r),resolveManual:async()=>{}});
  const decks=[mk(pres[i%pres.length],'A'),mk(pres[(i+1)%pres.length],'B')];
  const g=new SWU.Game(decks,[mkio(true),mkio(false)]);
  await g.run();
  const cps=g.checkpoints.filter(c=>snaps[c]);
  for(const cp of [cps[Math.floor(cps.length/3)],cps[Math.floor(cps.length*2/3)],cps[cps.length-1]].filter(x=>x!=null)){
    checks++;
    let got=null;
    const io2=(human)=>({isHuman:human,chooseAction:async(g2)=>{got=got||st(g2);throw new Error('stop')},choose:async()=>{got=got||'CHOOSE';throw new Error('stop')},resolveManual:async()=>{}});
    const g2=new SWU.Game(g.decks,[io2(true),io2(false)],{seed:g.seed,uid0:g.uid0,replay:g.rec.slice(0,cp)});
    const orig=console.error;console.error=()=>{};await g2.run();console.error=orig;
    if(got!==snaps[cp]){bad++;console.log('MISMATCH game',i,'cp',cp,'of',g.rec.length, got==='CHOOSE'?'(stopped at choose)':'');}
  }
}
console.log('replay checks',checks,'mismatches',bad);
})();
