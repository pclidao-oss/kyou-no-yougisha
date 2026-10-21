const known=['mugen','game16','itch','x','instagram','line','google','bing','yahoo','kuronuri'];
export function sourceFor(href,referrer){
 let page;try{page=new URL(href);}catch{return 'direct';}
 const hint=(page.searchParams.get('utm_source')||'').toLowerCase();const alias={ig:'instagram',twitter:'x','itch.io':'itch',kuronuri_hyakka:'kuronuri'};
 if(hint)return known.includes(alias[hint]||hint)?alias[hint]||hint:'other';
 if(!referrer)return 'direct';let u;try{u=new URL(referrer);}catch{return 'other';}
 const h=u.hostname.toLowerCase(),is=d=>h===d||h.endsWith('.'+d);
 for(const [host,label]of [['freegame-mugen.jp','mugen'],['game16.net','game16'],['itch.io','itch'],['x.com','x'],['twitter.com','x'],['t.co','x'],['instagram.com','instagram'],['l.instagram.com','instagram'],['line.me','line'],['bing.com','bing'],['yahoo.co.jp','yahoo']])if(is(host))return label;
 if(is('google.com')||is('google.co.jp'))return 'google';
 if(u.origin===page.origin)return u.pathname.startsWith('/yougisha')?'direct':'kuronuri';return 'other';
}
export function activeDelta(previous,now,lastInput,visible,focused){return visible&&focused?Math.max(0,Math.min(now-previous,5000,lastInput+60000-previous)):0;}
export function createVisitorTracker({device,send,win=globalThis.window,doc=globalThis.document,nav=globalThis.navigator}){
 const enabled=nav?.globalPrivacyControl!==true&&!!win&&!!doc,visit=globalThis.crypto.randomUUID();
 const source=enabled?sourceFor(win.location.href,doc.referrer):'direct';let seen=false,activeMs=0,previous=Date.now(),lastInput=Date.now(),progress=1,hints=0,mistakes=0,pulses=0,stage=0,chain=Promise.resolve();
 const payload=(type,date,seconds)=>({version:2,type,date,device,visit,source,progress,hints,mistakes,active:Math.min(21600,Math.floor(activeMs/1000)),...(type==='clear'?{seconds:Math.max(1,Math.floor(seconds))}:{})});
 function event(type,date,seconds){if(!enabled)return Promise.resolve(null);if(type==='visit'){if(seen)return Promise.resolve(null);seen=true;}const body=payload(type,date,seconds);chain=chain.catch(()=>null).then(()=>send(body)).catch(()=>null);return chain;}
 let currentDate=null;
 if(enabled){
  const touch=()=>{lastInput=Date.now();};for(const type of ['pointerdown','keydown','scroll','touchstart'])doc.addEventListener(type,touch,{passive:true});
  win.setInterval(()=>{const now=Date.now();activeMs+=activeDelta(previous,now,lastInput,!doc.hidden,doc.hasFocus());previous=now;},5000);
  win.setInterval(()=>{if(seen&&currentDate&&!doc.hidden&&doc.hasFocus()&&Date.now()-lastInput<=60000&&pulses<8){pulses++;event('pulse',currentDate);}},60000);
 }
 return {event(type,date,seconds){currentDate=date;return event(type,date,seconds);},progress(n,date){progress=Math.max(1,Math.min(20,n));const next=[5,10,15].filter(x=>progress>=x).length;if(next>stage){stage=next;event('progress',date);}return progress;},hint(){hints++;},mistake(){mistakes++;},enabled};
}
