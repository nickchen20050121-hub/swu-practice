const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join(__dirname,'..');
global.window=global; global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const f of ['cards.js','engine.js','i18n.js','effects.js','pilots.js','effects2.js','gfx.js', 'effects3.js','programs.js','meta_decks.js','deck.js','ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const pres=SWU.Deck.presets();
for(const d of pres){const v=SWU.Deck.validate(d); console.log(d.name,SWU.Deck.count(d),v, SWU.Deck.analyze(d).unimplemented);}
const games=+process.argv[2]||5; let wins=[0,0],rounds=0,errs=0,manual=0;
(async()=>{
for(let i=0;i<games;i++){
  const mk=(d,n)=>({name:n,leader:SWU.Deck.card(d.leader),base:SWU.Deck.card(d.base),cards:SWU.Deck.expand(d)});
  const io=()=>({chooseAction:async(g,p,a)=>SWU.AI.heur.chooseAction(g,p,a),choose:async(g,p,r)=>SWU.AI.heur.choose(g,p,r),resolveManual:async(g,p,info)=>{manual++;console.log('MANUAL',info.card.key,'|',info.text)}});
  const d2 = i%2? pres[1] : SWU.Deck.autoBuild("Darth Vader | Don't Fail Me Again",'Bioweapons Lab | Naboo');
  const g=new SWU.Game([mk(pres[0],'A'),mk(d2.leader?d2:pres[1],'B')],[io(),io()]);
  await g.run();
  const e=g.G.log.filter(l=>l.k==='logEffectError'); errs+=e.length; if(e.length) console.log('ERR',e.slice(0,3).map(l=>l.a));
  if(g.G.winner!=null) wins[g.G.winner]++; else console.log('no winner, round',g.G.round, g.G.log.slice(-5).map(l=>SWU.fmtLog(l,'en')));
  rounds+=g.G.round;
}
console.log('wins',wins,'avg rounds',(rounds/games).toFixed(1),'effect errors',errs,'manual',manual);
})();
