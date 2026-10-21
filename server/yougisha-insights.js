export const SOURCES=['direct','mugen','game16','itch','x','instagram','line','google','bing','yahoo','kuronuri','other'];
export const visitValid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
export const dayKey=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
const prepared=new WeakMap();
export async function ensureInsights(db){
 if(!prepared.has(db)){const ready=(async()=>{
  // Additive migration through the existing D1 binding. No account/API permission changes.
  for(const sql of [
   `CREATE TABLE IF NOT EXISTS insight_visits (id TEXT PRIMARY KEY,device TEXT NOT NULL,day TEXT NOT NULL,hour INTEGER NOT NULL,source TEXT NOT NULL,screen TEXT NOT NULL,browser TEXT NOT NULL,language TEXT NOT NULL,country TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,started INTEGER NOT NULL DEFAULT 0,cleared INTEGER NOT NULL DEFAULT 0,seconds INTEGER,shares INTEGER NOT NULL DEFAULT 0,progress INTEGER NOT NULL DEFAULT 1,hints INTEGER NOT NULL DEFAULT 0,mistakes INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 0)`,
   'CREATE INDEX IF NOT EXISTS insight_visit_day ON insight_visits(day,source)',
   'CREATE INDEX IF NOT EXISTS insight_visit_device ON insight_visits(device,day)',
   'CREATE TABLE IF NOT EXISTS insight_meta(key TEXT PRIMARY KEY,value INTEGER NOT NULL)'
  ])await db.prepare(sql).run();
 })();prepared.set(db,ready);ready.catch(()=>prepared.delete(db));}await prepared.get(db);
}
export function dimensions(request){
 const ua=request.headers.get('user-agent')||'',lang=(request.headers.get('accept-language')||'').split(',')[0].split('-')[0].toLowerCase();
 return {device:/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)?'tablet':/Mobile|iPhone|iPod/i.test(ua)?'mobile':ua?'desktop':'unknown',browser:/Edg\//.test(ua)?'edge':/Firefox\//.test(ua)?'firefox':/Chrome\//.test(ua)?'chrome':/Safari\//.test(ua)?'safari':'other',language:['ja','en','zh','ko'].includes(lang)?lang:'other',country:/^[A-Z]{2}$/.test(request.cf?.country||'')?request.cf.country:'unknown'};
}
export function validInsight(body){return body.version===2&&visitValid(body.visit)&&SOURCES.includes(body.source)&&['progress','hints','mistakes','active'].every(k=>Number.isSafeInteger(body[k])&&body[k]>=0)&&body.progress>=1&&body.progress<=20&&body.hints<=1000&&body.mistakes<=1000&&body.active<=21600;}
export async function recordInsight(db,request,body,device,visit,now=Date.now()){
 if(!validInsight(body))return;
 await ensureInsights(db);
 const dim=dimensions(request),day=dayKey(now),hour=new Date(now+9*3600000).getUTCHours();
 const started=['start','clear'].includes(body.type)?1:0,cleared=body.type==='clear'?1:0,shares=body.type==='share'?1:0;
 // Source/device dimensions are fixed at arrival; no raw referrer, UA, country city or IP is stored.
 await db.prepare(`INSERT INTO insight_visits(id,device,day,hour,source,screen,browser,language,country,created,updated,started,cleared,seconds,shares,progress,hints,mistakes,active)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
 updated=excluded.updated,started=MAX(insight_visits.started,excluded.started),cleared=MAX(insight_visits.cleared,excluded.cleared),
 seconds=COALESCE(insight_visits.seconds,excluded.seconds),shares=MIN(insight_visits.shares+excluded.shares,100),
 progress=MAX(insight_visits.progress,excluded.progress),hints=MAX(insight_visits.hints,excluded.hints),mistakes=MAX(insight_visits.mistakes,excluded.mistakes),
 active=MAX(insight_visits.active,MIN(?,MAX(0,(excluded.updated-insight_visits.created)/1000)))
 WHERE insight_visits.device=excluded.device`).bind(visit,device,day,hour,body.source,dim.device,dim.browser,dim.language,dim.country,now,now,started,cleared,cleared?body.seconds:null,shares,body.progress,body.hints,body.mistakes,0,body.active).run();
 await db.prepare("INSERT OR IGNORE INTO insight_meta(key,value) VALUES('first_event',?)").bind(now).run();
}
const agg=`COUNT(*) visits,COUNT(DISTINCT v.device) browsers,SUM(v.started) starts,SUM(v.cleared) clears,SUM(v.shares) shares,SUM(v.active) active_seconds,SUM(v.hints) hints,SUM(v.mistakes) mistakes,ROUND(AVG(CASE WHEN v.cleared=1 THEN v.seconds END)) average_seconds`;
export async function insightReport(db,period=7,now=Date.now()){
 await ensureInsights(db);
 const days=[7,14,30].includes(Number(period))?Number(period):7,through=dayKey(now),from=dayKey(now-(days-1)*86400000);
 const rows=async(sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
 const base=`FROM insight_visits v JOIN devices d ON d.id=v.device WHERE v.day>=? AND v.day<=?`;
 const [meta,total,daily,sources,screens,browsers,languages,countries,hours,progress,quota,legacyVisits]=await Promise.all([
  db.prepare("SELECT value FROM insight_meta WHERE key='first_event'").first(),
  db.prepare(`SELECT ${agg},COUNT(DISTINCT CASE WHEN d.first_day>=? THEN v.device END) first_observed,COUNT(DISTINCT CASE WHEN d.first_day<? THEN v.device END) previously_observed,COUNT(DISTINCT CASE WHEN v.day>d.first_day THEN v.device END) returned ${base}`).bind(from,from,from,through).first(),
  rows(`SELECT v.day,${agg},COUNT(DISTINCT CASE WHEN d.first_day=v.day THEN v.device END) new_browsers,COUNT(DISTINCT CASE WHEN d.first_day<v.day THEN v.device END) returning_browsers ${base} GROUP BY v.day ORDER BY v.day`,from,through),
  rows(`SELECT v.source,${agg},COUNT(DISTINCT CASE WHEN v.day>d.first_day THEN v.device END) returned ${base} GROUP BY v.source ORDER BY visits DESC`,from,through),
  ...['screen','browser','language','country'].map(k=>rows(`SELECT v.${k} label,${agg} ${base} GROUP BY v.${k} ORDER BY visits DESC LIMIT 40`,from,through)),
  rows(`SELECT v.hour,${agg} ${base} GROUP BY v.hour ORDER BY v.hour`,from,through),
  db.prepare(`SELECT SUM(v.started) started,SUM(CASE WHEN v.started=1 AND v.progress>=5 THEN 1 ELSE 0 END) reached5,SUM(CASE WHEN v.started=1 AND v.progress>=10 THEN 1 ELSE 0 END) reached10,SUM(CASE WHEN v.started=1 AND v.progress>=15 THEN 1 ELSE 0 END) reached15,SUM(v.cleared) cleared ${base}`).bind(from,through).first(),
  rows('SELECT day,writes FROM counters WHERE day>=? AND day<=? ORDER BY day',from,through),
  rows(`SELECT v.day,COUNT(*) browsers,SUM(CASE WHEN d.first_day=v.day THEN 1 ELSE 0 END) first_observed,SUM(CASE WHEN d.first_day<v.day THEN 1 ELSE 0 END) previously_observed FROM visits v JOIN devices d ON d.id=v.device WHERE v.day>=? AND v.day<=? GROUP BY v.day ORDER BY v.day`,from,through)
 ]);
 return {version:2,from,through,period:days,startedAt:meta?.value||null,total,daily,sources,screens,browsers,languages,countries,hours,progress,quota,requestLimit:5000,legacyVisits,coverage:'公式サイト版のみ。掲載先の独立HTML5版は含みません。新しい訪問分析は開始日以降。',fetchedAt:now};
}
