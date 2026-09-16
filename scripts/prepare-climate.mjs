import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Reproducible point proxies, not district-area averages. No provider values are invented.
const samples=JSON.parse(await fs.readFile(new URL('../data/samples.json',import.meta.url),'utf8'));
const map=JSON.parse(await fs.readFile(new URL('../data/map.json',import.meta.url),'utf8'));
const regions=map.map(d=>{
  const own=samples.filter(s=>s.district===d.id),area=own.reduce((a,s)=>a+s.area,0);
  const lat=own.reduce((a,s)=>a+s.lat*s.area/area,0),lon=own.reduce((a,s)=>a+s.lon*s.area/area,0);
  const point=[...own].sort((a,b)=>((a.lat-lat)**2+((a.lon-lon)*Math.cos(lat*Math.PI/180))**2)-((b.lat-lat)**2+((b.lon-lon)*Math.cos(lat*Math.PI/180))**2))[0];
  return {id:d.id,name:d.name,lat:point.lat,lon:point.lon,sampleId:point.id};
});
const results=[];
for(const region of regions){
  const url=new URL('https://archive-api.open-meteo.com/v1/archive');
  url.search=new URLSearchParams({latitude:String(region.lat),longitude:String(region.lon),start_date:'1991-01-01',end_date:'2020-12-31',daily:'precipitation_sum',models:'era5',timezone:'Europe/Belgrade',cell_selection:'nearest'}).toString();
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`${region.id}: HTTP ${response.status}`);
  const text=await response.text(),data=JSON.parse(text);
  if(data.daily_units?.precipitation_sum!=='mm'||data.timezone!=='Europe/Belgrade'||data.daily?.time?.length!==10958)throw new Error('Unexpected baseline schema');
  const daily={};
  for(let i=0;i<data.daily.time.length;i++){
    const date=data.daily.time[i],value=data.daily.precipitation_sum[i];
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error(`Missing baseline ${date}`);
    const key=date.slice(5);daily[key]??={sum:0,count:0};daily[key].sum+=value;daily[key].count++;
  }
  for(const [key,v] of Object.entries(daily))if(v.count!==(key==='02-29'?8:30))throw new Error(`Incomplete baseline ${key}`);
  results.push({...region,returned:[data.latitude,data.longitude],daily:Object.fromEntries(Object.entries(daily).map(([key,v])=>[key,{mean:v.sum/v.count,years:v.count}])),request:url.toString(),rawSha256:createHash('sha256').update(text).digest('hex')});
  console.log(`${region.name}: 30 complete years, 366 calendar-day normals`);
}
await fs.writeFile(new URL('../data/climate-normals.json',import.meta.url),JSON.stringify({retrievedAt:new Date().toISOString(),baseline:'1991–2020',model:'ERA5',source:'https://open-meteo.com/en/docs/historical-weather-api',resolution:'0.25° (~25 km)',method:'One existing interior sample nearest the area-weighted district sample centroid. Calendar-day mean precipitation across 1991–2020; Feb 29 uses eight years. Point proxies, not district averages or official station normals.',regions:results}));
