import areas from '../../../data/municipalities.json';
import rawSamples from '../../../data/municipality-samples.json';
import {fetchForecastPoints} from '../../../lib/forecast';
import {forecastWindow,isUsable,METHOD} from '../../../lib/pressure';
import {scoreMunicipalities,type MunicipalSample,type MunicipalResponse} from '../../../lib/municipalities';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const samples=rawSamples as MunicipalSample[];
const allowed=new Set(areas.map(a=>a.district));
const memory=new Map<string,{result:MunicipalResponse;expires:number}>();
const pending=new Map<string,Promise<MunicipalResponse>>();
const headers={'Cache-Control':'no-store'};

export async function GET(request:Request){
  const district=new URL(request.url).searchParams.get('district')??'';
  if(!allowed.has(district))return Response.json({error:'Choose one of the seven Vojvodina districts (RS-01 to RS-07).'}, {status:400,headers});
  const now=new Date(),cached=memory.get(district);
  if(cached&&cached.expires>now.getTime()&&isUsable(cached.result,now))return Response.json(cached.result,{headers});
  if(!pending.has(district)){
    const task=(async()=>{
      const own=samples.filter(s=>s.district===district);
      const {points,failed}=await fetchForecastPoints(own,now);
      const result:MunicipalResponse={district,method:METHOD,window:forecastWindow(now),retrievedAt:now.toISOString(),model:'ECMWF IFS HRES via Open-Meteo',resolution:'Approx. 9 km forecast grid; independent 10 km municipality-area sampling',municipalities:scoreMunicipalities(areas.filter(a=>a.district===district),own,points,forecastWindow(now).dates),warning:failed?'Some forecast requests failed. Affected municipalities are unscored.':null,gridPoints:own.map(s=>({id:s.id,requested:[s.lat,s.lon],returned:points.has(s.id)?[points.get(s.id)!.latitude,points.get(s.id)!.longitude]:null}))};
      memory.set(district,{result,expires:now.getTime()+(result.municipalities.every(m=>m.status==='available')?21600000:300000)});
      return result;
    })().finally(()=>pending.delete(district));
    pending.set(district,task);
  }
  try{return Response.json(await pending.get(district),{headers});}
  catch{return Response.json({error:'Municipal forecasts unavailable. No municipal scores can be calculated.'},{status:503,headers});}
}
