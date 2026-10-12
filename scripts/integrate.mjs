import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(process.argv[2]||''),source=path.resolve('site'),output=path.join(root,'site','yougisha');if(!process.argv[2]||!fs.existsSync(path.join(root,'site','_worker.js')))throw Error('対象のPagesソースを指定してください');if(fs.existsSync(output))throw Error('既存のyougishaがあるため停止します');
const worker=fs.readFileSync(path.join(root,'site','_worker.js'),'utf8'),routes=fs.readFileSync(path.join(root,'site','_routes.json'),'utf8');if(JSON.parse(routes).include.some(p=>p==='/*'||p.startsWith('/yougisha')))throw Error('静的配信が保証できないルート設定');
fs.cpSync(source,output,{recursive:true});const home=path.join(root,'site','index.html'),old=fs.readFileSync(home,'utf8');if(!old.includes('<footer>'))throw Error('フッターを確認できません');fs.writeFileSync(home,old.replace('<footer>','<footer><a href="/yougisha/">今日の容疑者を遊ぶ</a>'));
const headers=path.join(root,'site','_headers');fs.appendFileSync(headers,"\n/yougisha/*\n  ! Content-Security-Policy\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n/yougisha/puzzles/index.json\n  Cache-Control: no-cache\n");
if(fs.readFileSync(path.join(root,'site','_worker.js'),'utf8')!==worker||fs.readFileSync(path.join(root,'site','_routes.json'),'utf8')!==routes)throw Error('既存判定ルートが変更されました');
console.log('Added /yougisha/ static files and one reciprocal footer link. Existing Worker/routes unchanged.');
