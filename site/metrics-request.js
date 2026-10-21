const API_ORIGIN='https://kuronuri-hyakka-7tn.pages.dev';
export function metricsBase(href){const u=new URL(href);return ['https://file.game16.net','https://html-classic.itch.zone'].includes(u.origin)?API_ORIGIN+'/yougisha/api/embed/':'./api/';}
export async function requestMetrics(path,body,{href=globalThis.location.href,fetcher=globalThis.fetch}={}){
 if(!/^(event|summary\?date=\d{4}-\d{2}-\d{2})$/.test(path))throw Error('Invalid metric route');
 const r=await fetcher(metricsBase(href)+path,{method:body?'POST':'GET',mode:'cors',credentials:'omit',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('集計未接続');return r.json();
}
