// 測試間接傷害與自行分配傷害：node tools/sim_indirect.js 場數
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join(__dirname,'..');
global.window=global; global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const f of ['cards.js','engine.js','i18n.js','effects.js','gfx.js','programs.js','meta_decks.js','deck.js','ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const pres=SWU.Deck.presets();
const extra=['TIE Bomber','Torpedo Barrage','Planetary Bombardment','Emperor Palpatine | Master of the Dark Side','The Legacy Run | Doomed Debris','Guerilla Soldier','Kimoglia Heavy Fighter','Devastator | Hunting the Rebellion','Hold Them Off','First Order Stormtrooper'].map(k=>SWU.DB.list.find(c=>c.key===k)).filter(Boolean);
console.log('extra cards',extra.length);
const games=+process.argv[2]||10; let errs=0,ind=0,div=0,wins=[0,0];
(async()=>{
for(let i=0;i<games;i++){
  const mk=(d,n)=>{const cards=SWU.Deck.expand(d);for(let j=0;j<extra.length*2;j++) cards[j]=extra[j%extra.length];return {name:n,leader:SWU.Deck.card(d.leader),base:SWU.Deck.card(d.base),cards};};
  const io=()=>({chooseAction:async(g,p,a)=>SWU.AI.heur.chooseAction(g,p,a),choose:async(g,p,r)=>SWU.AI.heur.choose(g,p,r),resolveManual:async()=>{}});
  const g=new SWU.Game([mk(pres[0],'A'),mk(pres[1],'B')],[io(),io()]);
  const od=g.dealDivided.bind(g); g.dealDivided=async(...a)=>{div++;return od(...a);};
  await g.run();
  const e=g.G.log.filter(l=>l.k==='logEffectError'); errs+=e.length; if(e.length) console.log('ERR',e.slice(0,3).map(l=>l.a));
  ind+=g.G.log.filter(l=>l.k==='logIndirect').length;
  if(g.G.winner!=null) wins[g.G.winner]++;
}
console.log('wins',wins,'indirect events',ind,'divided events',div,'effect errors',errs);
})();
