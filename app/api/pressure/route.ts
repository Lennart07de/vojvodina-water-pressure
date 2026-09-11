import map from '../../../data/map.json';
import sampleData from '../../../data/samples.json';
import {forecastWindow,parsePoint,scoreDistrict,parseRiver,isUsable,METHOD,EDO_SOURCE,RIVER_SOURCE,type Sample,type PressureResponse,type PointForecast,type Edo,type River} from '../../../lib/pressure';

// Forecasts are fetched at request time, never during the Next.js build.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Nine batches, three at a time, with 25-second upstream timeouts.
export const maxDuration = 120;

const samples=sampleData as Sample[];
let memory:{result:PressureResponse;expires:number}|null=null;
let pending:Promise<PressureResponse>|null=null;
async function readEdo(now:Date):Promise<Edo>{
  const base:Edo={status:'missing',latestDate:null,retrievedAt:now.toISOString(),source:EDO_SOURCE,message:'Current EDO soil-moisture anomaly could not be verified. Not included in the score.'};
  try{
    const r=await fetch('https://drought.emergency.copernicus.eu/api/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1',{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!r.ok)return base;
    const xml=await r.text();
    const layer=xml.match(/<Name>smian<\/Name>([\s\S]*?)<\/Layer>/)?.[1];
    const end=layer?.match(/<Extent[^>]*name="time"[^>]*>[^<]*\/(\d{4}-\d{2}-\d{2})\//)?.[1];
    if(!end)return base;
    const stale=now.getTime()-Date.parse(end)>21*86400000;
    return {...base,latestDate:end,status:stale?'stale':'context',message:stale?'The advertised EDO soil-moisture layer is too old for this outlook. No anomaly value is used.':'A recent EDO layer is advertised, but numeric district coverage has not been validated. Not included in the score.'};
  }catch{return base;}
}
async function readRiver(now:Date):Promise<River>{
  const empty=parseRiver('',now);
  try{const r=await fetch(RIVER_SOURCE,{cache:'no-store',signal:AbortSignal.timeout(12000)});return r.ok?parseRiver(await r.text(),now):empty;}catch{return empty;}
}
async function build(now:Date):Promise<PressureResponse>{
  const window=forecastWindow(now),points=new Map<string,PointForecast>();
  const context=Promise.all([readEdo(now),readRiver(now)]);
  const batches:Sample[][]=[];
  for(let i=0;i<samples.length;i+=40)batches.push(samples.slice(i,i+40));
  let next=0,failed=0;
  await Promise.all(Array.from({length:3},async()=>{
    while(next<batches.length){
      const batch=batches[next++];
      const url=new URL('https://api.open-meteo.com/v1/ecmwf');
      url.search=new URLSearchParams({latitude:batch.map(s=>s.lat).join(','),longitude:batch.map(s=>s.lon).join(','),models:'ecmwf_ifs',daily:'precipitation_sum,et0_fao_evapotranspiration',hourly:'soil_moisture_7_to_28cm',forecast_days:'8',timezone:'Europe/Belgrade',cell_selection:'nearest'}).toString();
      try{
        const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
        if(!r.ok){failed++;continue;}
        const json=await r.json();const values=Array.isArray(json)?json:[json];
        if(values.length!==batch.length){failed++;continue;}
        batch.forEach((s,i)=>{const p=parsePoint(values[i],s,window.dates,now);if(p)points.set(s.id,p);});
      }catch{failed++;}
    }
  }));
  const [edo,river]=await context;
  return {method:METHOD,window,retrievedAt:now.toISOString(),model:'ECMWF IFS HRES via Open-Meteo',resolution:'Approx. 9 km forecast grid; 10 km area-weighted sampling',districts:map.map(d=>scoreDistrict(d.id,d.name,samples.filter(s=>s.district===d.id),points,window.dates)),edo,river,warning:failed?'Some forecast requests failed. Affected districts are unscored.':null,gridPoints:samples.map(s=>({id:s.id,requested:[s.lat,s.lon],returned:points.has(s.id)?[points.get(s.id)!.latitude,points.get(s.id)!.longitude]:null}))};
}
export async function GET(){
  const now=new Date();
  if(memory&&memory.expires>now.getTime()&&isUsable(memory.result,now))return Response.json(memory.result,{headers:{'Cache-Control':'no-store'}});
  if(!pending)pending=build(now).finally(()=>{pending=null;});
  try{
    const result=await pending,ttl=result.districts.every(d=>d.status==='available')?21600:300;
    memory={result,expires:now.getTime()+ttl*1000};
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch{
    if(memory&&isUsable(memory.result,now))return Response.json({...memory.result,warning:'Refresh failed. Showing the previous, unexpired forecast.'},{headers:{'Cache-Control':'no-store'}});
    return Response.json({error:'Forecast service unavailable. No pressure scores can be calculated.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
