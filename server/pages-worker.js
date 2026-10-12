import {handle} from './api.js';
// Optional integration, kept out of the static production deployment until authorized.
export default {async fetch(request,env){const pathname=new URL(request.url).pathname;if(pathname.startsWith('/yougisha/api/')||pathname==='/yougisha/stats')return handle(request,{DB:env.YOUGISHA_DB,METRICS_SALT:env.YOUGISHA_METRICS_SALT,STATS_KEY:env.YOUGISHA_STATS_KEY,METRICS_ENABLED:env.YOUGISHA_METRICS_ENABLED});if(pathname.startsWith('/api/'))return env.GAME.fetch(request);return env.ASSETS.fetch(request);}};
