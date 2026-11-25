const fs=require('fs'),vm=require('vm'),path=require('path');const dir=path.join(__dirname,'..');
global.window=global; global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const f of ['cards.js','engine.js','i18n.js','effects.js','effects2.js','deck.js','ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards(); SWU.lang='en';
const pres=SWU.Deck.presets();
const mk=(d,n)=>({name:n,leader:SWU.Deck.card(d.leader),base:SWU.Deck.card(d.base),cards:SWU.Deck.expand(d)});
const io=()=>({chooseAction:async(g,p,a)=>SWU.AI.heur.chooseAction(g,p,a),choose:async(g,p,r)=>SWU.AI.heur.choose(g,p,r),resolveManual:async(g,p,i)=>{}});
const g=new SWU.Game([mk(pres[0],'A'),mk(pres[1],'B')],[io(),io()]);
g.run().then(()=>{console.log(g.G.log.map(l=>SWU.fmtLog(l,'en')).join('\n'))});
