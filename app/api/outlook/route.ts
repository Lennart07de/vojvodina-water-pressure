import normals from '../../../data/climate-normals.json';
import {addDays,belgradeDate} from '../../../lib/pressure';
import {ensembleHorizons,recentComparison,latestCommonEnd,readDaily,outlookUsable,type NormalRegion,type OutlookResponse} from '../../../lib/outlook';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const regions=normals.regions as NormalRegion[];
const headers={'Cache-Control':'no-store'};
let memory:{value:OutlookResponse;expires:number}|null=null;
let pending:Promise<OutlookResponse>|null=null;
async function read(url:URL):Promise<unknown[]>{
  try{const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(45000)});if(!response.ok)return [];const data=await response.json();return Array.isArray(data)&&data.length===regions.length?data:[];}catch{return [];}
}
async function build(now:Date):Promise<OutlookResponse>{
  const today=belgradeDate(now),end=addDays(today,-5);
  const common={latitude:regions.map(r=>r.lat).join(','),longitude:regions.map(r=>r.lon).join(','),daily:'precipitation_sum,temperature_2m_mean',timezone:'Europe/Belgrade',cell_selection:'nearest'};
  const ensemble=new URL('https://ensemble-api.open-meteo.com/v1/ensemble');
  ensemble.search=new URLSearchParams({...common,models:'gfs05',forecast_days:'31'}).toString();
  const archive=new URL('https://archive-api.open-meteo.com/v1/archive');
  archive.search=new URLSearchParams({...common,models:'era5',start_date:addDays(end,-36),end_date:end}).toString();
  const [forecast,history]=await Promise.all([read(ensemble),read(archive)]);
  const recentEnd=latestCommonEnd(history,regions,now);
  const results=regions.map((r,i)=>{
    const f=readDaily(forecast[i]),h=readDaily(history[i]);
    return {id:r.id,name:r.name,requested:[r.lat,r.lon],ensembleReturned:f?[f.latitude,f.longitude]:null,recentReturned:h?[h.latitude,h.longitude]:null,horizons:ensembleHorizons(forecast[i],now),recent:recentComparison(history[i],r,now,recentEnd)};
  });
  const complete=results.every(r=>r.recent.precipitation!==null&&r.recent.temperature!==null&&r.horizons.every(h=>h.precipitation&&h.temperature));
  return {retrievedAt:now.toISOString(),start:addDays(today,1),regions:results,warning:complete?null:'Some public data are unavailable. Missing values and incomplete ensemble periods are not estimated.'};
}
export async function GET(){
  const now=new Date();
  if(memory&&memory.expires>now.getTime()&&outlookUsable(memory.value,now))return Response.json(memory.value,{headers});
  if(!pending)pending=build(now).finally(()=>{pending=null;});
  try{const value=await pending;memory={value,expires:now.getTime()+(value.warning?300000:21600000)};return Response.json(value,{headers});}
  catch{return Response.json({error:'Outlook unavailable. No replacement values were generated.'},{status:503,headers});}
}
