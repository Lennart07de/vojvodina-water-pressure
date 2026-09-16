import {forecastWindow,parsePoint,type Sample,type PointForecast} from './pressure';

// Fixed server-side coordinates only. Reused at both administrative levels.
export async function fetchForecastPoints(samples:Sample[],now:Date){
  const window=forecastWindow(now),points=new Map<string,PointForecast>();
  const batches:Sample[][]=[];
  for(let i=0;i<samples.length;i+=40)batches.push(samples.slice(i,i+40));
  let next=0,failed=0;
  await Promise.all(Array.from({length:3},async()=>{
    while(next<batches.length){
      const batch=batches[next++];
      const url=new URL('https://api.open-meteo.com/v1/ecmwf');
      url.search=new URLSearchParams({latitude:batch.map(s=>s.lat).join(','),longitude:batch.map(s=>s.lon).join(','),models:'ecmwf_ifs',daily:'precipitation_sum,et0_fao_evapotranspiration,temperature_2m_mean',hourly:'soil_moisture_7_to_28cm',forecast_days:'8',timezone:'Europe/Belgrade',cell_selection:'nearest'}).toString();
      try{
        const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
        if(!r.ok){failed++;continue;}
        const json=await r.json();const values=Array.isArray(json)?json:[json];
        if(values.length!==batch.length){failed++;continue;}
        batch.forEach((s,i)=>{const p=parsePoint(values[i],s,window.dates,now);if(p)points.set(s.id,p);});
      }catch{failed++;}
    }
  }));
  return {points,failed};
}
