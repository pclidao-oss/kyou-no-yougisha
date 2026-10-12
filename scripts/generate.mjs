import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {SIZE,bit,popcount,maskOf,neighbors,between,agrees,encodeAnswer,verify,weekday,today} from '../site/logic.js';
const names=['あおい','いつき','うた','えいた','おとは','かえで','きよ','くるみ','けい','こはる','さな','しおり','すず','せい','そうた','たまき','ちひろ','つばさ','てる','とわ'];
const jobs=['八百屋','駅員','郵便屋','漫画家','保育士','花屋','大工'];
const towns=[['ひだまり商店街','共同売店の売上金が消えた。町の証言をつないで、関わった住人を探そう。'],['しおかぜ港町','祭りの飾りが持ち去られた。出港前に、この町の謎を解き明かそう。'],['こもれび学園','文化祭の看板が隠された。放課後の証言が捜査の鍵になる。'],['ゆけむり温泉街','旅館組合の記念品がなくなった。湯の町に残る証言を集めよう。'],['つきみ団地','集会所の備品が持ち去られた。住人たちの証言から全員の立場を確かめよう。']];
export const TARGETS=[0,3,4,6,8,12,16];
function rng(seed){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function candidates(answer,residents){const c=[],name=i=>residents[i].name;
 const count=(ids,subject)=>c.push({type:'count',mask:maskOf(ids),count:popcount(answer&maskOf(ids)),text:`${subject}のうち、犯人はちょうど${popcount(answer&maskOf(ids))}人だ。`});
 for(let i=0;i<SIZE;i++){count(neighbors(i),`${name(i)}の隣にいる人`);const row=Math.floor(i/4),col=i%4;for(const [dir,j,ok] of [['上',i-4,row>0],['下',i+4,row<4],['左',i-1,col>0],['右',i+1,col<3]])if(ok)c.push({type:'count',mask:1<<j,count:bit(answer,j),text:`${name(i)}のすぐ${dir}にいる人は、${bit(answer,j)?'犯人':'無実'}だ。`});}
 for(let row=0;row<5;row++)count(Array.from({length:4},(_,col)=>row*4+col),`${row+1}行目にいる人`);
 for(let col=0;col<4;col++)count(Array.from({length:5},(_,row)=>row*4+col),`${col+1}列目にいる人`);
 for(const job of jobs)count(residents.filter(x=>x.job===job).map(x=>x.id),job);
 count([0,3,16,19],'四隅にいる人');count(Array.from({length:20},(_,i)=>i).filter(i=>i<4||i>=16||i%4===0||i%4===3),'外周にいる人');
 for(let a=0;a<20;a++)for(let b=a+1;b<20;b++){if(bit(answer,a)===bit(answer,b))c.push({type:'equal',a,b,text:`${name(a)}と${name(b)}は同じ立場だ（両方犯人、または両方無実）。`});if(a%4===b%4||Math.floor(a/4)===Math.floor(b/4)){const ids=between(a,b);if(ids.length&&ids.every(i=>!bit(answer,i)))c.push({type:'count',mask:maskOf(ids),count:0,text:`${name(a)}と${name(b)}の間にいる人は、全員無実だ。`});}}
 const rowCounts=Array.from({length:5},(_,i)=>popcount((answer>>>(i*4))&15)),max=Math.max(...rowCounts);if(rowCounts.filter(n=>n===max).length===1){const row=rowCounts.indexOf(max);c.push({type:'maxrow',row,text:`犯人がいちばん多いのは${row+1}行目だ（ほかの行より多い）。`});}
 c.push({type:'parity',value:popcount(answer)%2,text:`犯人の合計は${popcount(answer)%2?'奇数':'偶数'}人だ。`});return c;
}
export function generate(date,attempt=0){if(attempt>100)throw Error('生成試行上限');const r=rng('yougisha-v1:'+date+':'+attempt),order=shuffle(Array.from({length:20},(_,i)=>i),r),criminals=6+Math.floor(r()*5),answer=maskOf(order.slice(0,criminals));
 const jobOrder=shuffle(jobs,r),residents=names.map((name,id)=>({id,name,job:jobOrder[id%7]})),seed=shuffle(order,r)[0],known=new Set([seed]);let holder=seed,clues=[];
 const add=(bundle)=>{for(const c of bundle)clues.push({...c,holder,id:'c'+clues.length});};
 const w=weekday(date),hardSizes=[[ ],[3],[4],[3,3],[4,4],[4,4,4],[4,4,4,4]][w];
 for(const size of hardSizes){let unknown=order.filter(i=>!known.has(i)),ones=unknown.filter(i=>bit(answer,i)),zeros=unknown.filter(i=>!bit(answer,i));let ids;
 if(size===4){if(ones.length<2||zeros.length<2)return generate(date,attempt+1);ids=shuffle([...ones.slice(0,2),...zeros.slice(0,2)],r);add(ids.map(skip=>{const scope=ids.filter(i=>i!==skip),mask=maskOf(scope),count=popcount(answer&mask);return {type:'count',mask,count,text:`${scope.map(i=>names[i]).join('・')}の3人のうち、犯人はちょうど${count}人だ。`};}));}
 else {const majority=zeros.length>=2&&ones.length?0:1,a=(majority?ones:zeros).slice(0,2),b=(majority?zeros:ones)[0];if(a.length<2||b===undefined)return generate(date,attempt+1);ids=shuffle([...a,b],r);add([{type:'equal',a:a[0],b:a[1],text:`${names[a[0]]}と${names[a[1]]}は同じ立場だ（両方犯人、または両方無実）。`},{type:'count',mask:maskOf(ids),count:popcount(answer&maskOf(ids)),text:`${ids.map(i=>names[i]).join('・')}の3人のうち、犯人はちょうど${popcount(answer&maskOf(ids))}人だ。`}]);}
 for(const i of ids)known.add(i);holder=ids[ids.length-1];}
 const pool=shuffle(candidates(answer,residents),r);
 while(known.size<20){const target=order.find(i=>!known.has(i));const eligible=pool.filter(c=>{if(c.type==='count')return bit(c.mask,target)&&Array.from({length:20},(_,i)=>i).filter(i=>bit(c.mask,i)&&!known.has(i)).length===1;if(c.type==='equal')return (c.a===target&&known.has(c.b))||(c.b===target&&known.has(c.a));return false;});const chosen=eligible.find(c=>c.type==='count'&&popcount(c.mask)>1)||eligible[0];if(!chosen)throw Error('手がかり不足');add([chosen]);known.add(target);holder=target;}
 // Add truthful parity/row/corner evidence to already completed witnesses; it cannot create a stall.
 const bonus=pool.filter(c=>c.type==='parity'||c.type==='maxrow'||(c.type==='count'&&/四隅|外周/.test(c.text))).slice(0,2);add(bonus);
 const [town,story]=towns[Math.floor(r()*towns.length)];const p={version:1,date,issue:Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse('2026-10-13T00:00:00Z'))/86400000)+1,town,story,residents,seed:{id:seed,value:bit(answer,seed)},clues,sealed:encodeAnswer(answer,date),difficulty:{weekday:w,target:TARGETS[w]}};
 const metrics=verify(p);if(metrics.combinationResidents!==TARGETS[w])throw Error('難易度の計測値が目標外');p.difficulty.metrics={combinationResidents:metrics.combinationResidents,singleFrontiers:metrics.singleFrontiers,rounds:metrics.rounds,clueCount:metrics.clueCount};return p;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const start=process.argv[2]||today(),days=Number(process.argv[3]||31);fs.mkdirSync('site/puzzles',{recursive:true});for(let n=0;n<days;n++){const date=new Date(Date.parse(start+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),file=`site/puzzles/${date}.json`;if(!fs.existsSync(file)){fs.writeFileSync(file,JSON.stringify(generate(date)));console.log('Generated '+date);}}const dates=fs.readdirSync('site/puzzles').filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map(n=>n.slice(0,10)).sort();fs.writeFileSync('site/puzzles/index.json',JSON.stringify({launch:'2026-10-13',dates}));}
