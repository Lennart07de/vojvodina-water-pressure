// Synthetic fixtures only; never used as public fallback data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addDays,belgradeDate,forecastWindow,parsePoint,scoreDistrict} from '../lib/pressure.ts';
import {ensembleHorizons,recentComparison,latestCommonEnd,outlookUsable,type NormalRegion,type OutlookResponse} from '../lib/outlook.ts';
const now=new Date('2026-09-16T12:00:00Z');
function ensemble(){
  const daily:Record<string,(string|number|null)[]>={time:Array.from({length:31},(_,i)=>addDays('2026-09-16',i))},daily_units:Record<string,string>={};
  for(let m=0;m<31;m++)for(const variable of ['precipitation_sum','temperature_2m_mean']){
    const key=variable+(m?`_member${String(m).padStart(2,'0')}`:'');daily_units[key]=variable==='precipitation_sum'?'mm':'°C';
    daily[key]=Array.from({length:31},(_,i)=>variable==='temperature_2m_mean'?20:m+(i===2?30-2*m:0));
  }
  return {latitude:45.5,longitude:20,timezone:'Europe/Belgrade',daily,daily_units};
}
test('timeline aggregates each complete member before computing percentiles and excludes today',()=>{
  const result=ensembleHorizons(ensemble(),now);
  assert.equal(result.length,30);assert.equal(result[0].end,'2026-09-17');assert.equal(result[29].end,'2026-10-16');
  assert.deepEqual(result[1].precipitation,{p10:30,median:30,p90:30,members:31});
  assert.equal(result[29].temperature?.median,20);
});
test('missing later member values suppress only affected horizons and variables',()=>{
  const raw=ensemble();raw.daily.precipitation_sum_member30[8]=null;
  const result=ensembleHorizons(raw,now);assert.ok(result[6].precipitation);assert.equal(result[7].precipitation,null);assert.ok(result[29].temperature);
  raw.daily_units.temperature_2m_mean_member01='°F';assert.equal(ensembleHorizons(raw,now)[0].temperature,null);
  raw.daily.time[2]=raw.daily.time[1];assert.equal(ensembleHorizons(raw,now)[0].precipitation,null);
});
test('recent rainfall compares identical calendar dates and grid, never replaces missing values',()=>{
  const end=addDays(belgradeDate(now),-5),dates=Array.from({length:30},(_,i)=>addDays(end,i-29));
  const region:NormalRegion={id:'test',name:'test',lat:45,lon:20,returned:[45,20],daily:Object.fromEntries(dates.map(d=>[d.slice(5),{mean:2,years:30}]))};
  const raw={latitude:45,longitude:20,timezone:'Europe/Belgrade',daily_units:{precipitation_sum:'mm',temperature_2m_mean:'°C'},daily:{time:dates,precipitation_sum:Array(30).fill(1),temperature_2m_mean:Array(30).fill(20)}};
  const value=recentComparison(raw,region,now);assert.equal(value.precipitation,30);assert.equal(value.normal,60);assert.equal(value.percentOfNormal,50);assert.equal(value.temperature,20);
  raw.daily.precipitation_sum[3]=null;assert.equal(recentComparison(raw,region,now).precipitation,null);
  raw.latitude=46;assert.equal(recentComparison(raw,region,now).temperature,null);
  for(const v of Object.values(region.daily))v.mean=0;assert.equal(recentComparison(raw,region,now).percentOfNormal,null);
});
test('outlook expires at Belgrade midnight and handles cross-year future dates',()=>{
  const value={retrievedAt:now.toISOString(),start:'2026-09-17'} as OutlookResponse;
  assert.equal(outlookUsable(value,now),true);assert.equal(outlookUsable(value,new Date('2026-09-16T22:00Z')),false);
  assert.equal(ensembleHorizons(null,new Date('2026-12-31T12:00Z'))[29].end,'2027-01-30');
});
test('publication lag selects one complete common period without filling missing rainfall',()=>{
  const dates=Array.from({length:37},(_,i)=>addDays('2026-08-06',i));
  const region:NormalRegion={id:'x',name:'X',lat:45,lon:20,returned:[45,20],daily:Object.fromEntries(dates.map(d=>[d.slice(5),{mean:2,years:30}]))};
  const raw={latitude:45,longitude:20,timezone:'Europe/Belgrade',daily_units:{precipitation_sum:'mm'},daily:{time:dates,precipitation_sum:[...Array(36).fill(1),null]}};
  assert.equal(latestCommonEnd([raw],[region],now),'2026-09-10');
  assert.equal(recentComparison(raw,region,now,'2026-09-10').precipitation,30);
  raw.daily.precipitation_sum[15]=null;assert.equal(recentComparison(raw,region,now,latestCommonEnd([raw],[region],now)).precipitation,null);
});
test('committed normals have all seven proxies and complete 1991–2020 calendar-day coverage',()=>{
  const data=JSON.parse(readFileSync(new URL('../data/climate-normals.json',import.meta.url),'utf8'));
  assert.equal(data.regions.length,7);
  for(const r of data.regions){assert.equal(Object.keys(r.daily).length,366);assert.match(r.rawSha256,/^[a-f0-9]{64}$/);for(const [key,v] of Object.entries(r.daily) as [string,{mean:number;years:number}][]){assert.equal(v.years,key==='02-29'?8:30);assert.ok(v.mean>=0&&Number.isFinite(v.mean));}}
});
test('temperature is shown independently without double-counting heat or suppressing valid pressure',()=>{
  const dates=forecastWindow(now).dates,sample={id:'x',district:'x',lat:45,lon:20,area:1};
  const raw={latitude:45,longitude:20,timezone:'Europe/Belgrade',daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm',temperature_2m_mean:'°C'},daily:{time:dates,precipitation_sum:Array(7).fill(1),et0_fao_evapotranspiration:Array(7).fill(3),temperature_2m_mean:Array(7).fill(25)}};
  const point=parsePoint(raw,sample,dates,now)!;const scored=scoreDistrict('x','X',[sample],new Map([['x',point]]),dates);assert.equal(scored.temperature,25);assert.equal(scored.deficit,14);
  raw.daily.temperature_2m_mean[0]=null;const missing=parsePoint(raw,sample,dates,now)!;const other=scoreDistrict('x','X',[sample],new Map([['x',missing]]),dates);assert.equal(other.temperature,null);assert.equal(other.score,scored.score);
});
