import {initial,visible,enumerate,narrow,forced,judge,clueHint} from './logic.js';
let p,known,models;
self.onmessage=({data:{id,type,puzzle,moves,person,value}})=>{try{let extra={};if(type==='init'){p=puzzle;known=initial(p);models=enumerate(known,visible(p,known));for(const move of moves||[]){if(!judge(models,known,move.id,move.value).ok)break;known[move.id]=move.value;models=narrow(models,visible(p,known));}}
if(type==='judge'){extra=judge(models,known,person,value);if(extra.ok){known[person]=value;models=narrow(models,visible(p,known));}}
if(type==='hint')extra=clueHint(p,known,models)||{};
self.postMessage({id,ok:true,known,remaining:models.length,forced:forced(models,known),...extra});}catch(e){self.postMessage({id,ok:false,error:e.message});}};
