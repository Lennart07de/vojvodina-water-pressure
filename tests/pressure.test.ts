// Synthetic fixtures belong only in tests, never in the public interface.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {forecastWindow,classification,scoreDistrict,parsePoint,parseRiver,isUsable,type Sample,type PointForecast,type PressureResponse} from '../lib/pressure.ts';
const now=new Date('2026-09-10T12:00:00Z'),dates=forecastWindow(now).dates;
const s:Sample={id:'a',district:'RS-01',lat:46,lon:20,area:1};
const point=(id:string,et:number,p=0):PointForecast=>({id,latitude:46,longitude:20,soil:null,soilTime:null,days:dates.map((date,i)=>({date,et0:i===0?et:0,precipitation:i===0?p:0}))});
test('unrounded thresholds and score saturation',()=>{
  assert.equal(classification(9.99999),'Low');assert.equal(classification(10),'Medium');assert.equal(classification(19.99999),'Medium');assert.equal(classification(20),'High');
  const d=scoreDistrict('RS-01','Test',[s],new Map([['a',point('a',80)]]),dates);assert.equal(d.score,100);assert.equal(d.deficit,80);
});
test('wet locations are floored before unequal area weighting',()=>{
  const b={...s,id:'b',area:3};const d=scoreDistrict('RS-01','Test',[s,b],new Map([['a',point('a',0,40)],['b',point('b',40)]]),dates);
  assert.equal(d.deficit,30);assert.equal(d.precipitation,10);assert.equal(d.et0,30);
});
test('one missing sample suppresses the entire district without reweighting',()=>{
  const d=scoreDistrict('RS-01','Test',[s,{...s,id:'b'}],new Map([['a',point('a',20)]]),dates);
  assert.equal(d.status,'missing');assert.equal(d.grade,null);assert.equal(d.score,null);assert.equal(d.validSamples,1);
});
test('precipitation exceeding ET0 produces zero pressure',()=>assert.equal(scoreDistrict('RS-01','Test',[s],new Map([['a',point('a',5,20)]]),dates).deficit,0));
test('invalid units, nulls, incomplete and negative values reject a point',()=>{
  const raw=()=>({latitude:46,longitude:20,timezone:'Europe/Belgrade',daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm'},daily:{time:dates,precipitation_sum:Array(7).fill(1),et0_fao_evapotranspiration:Array(7).fill(3)}});
  assert.ok(parsePoint(raw(),s,dates,now));
  const a=raw();a.daily.precipitation_sum[0]=null;assert.equal(parsePoint(a,s,dates,now),null);
  const b=raw();b.daily.et0_fao_evapotranspiration[1]=-1;assert.equal(parsePoint(b,s,dates,now),null);
  const c=raw();c.daily_units.precipitation_sum='inch';assert.equal(parsePoint(c,s,dates,now),null);
  const d=raw();d.daily.time=dates.slice(1);assert.equal(parsePoint(d,s,dates,now),null);
});
test('local dates survive midnight, year-end and DST transitions',()=>{
  assert.equal(forecastWindow(new Date('2026-09-10T22:30:00Z')).start,'2026-09-12');
  for(const stamp of ['2026-03-28T12:00Z','2026-10-24T12:00Z','2026-12-31T12:00Z']){const w=forecastWindow(new Date(stamp));assert.equal(w.dates.length,7);assert.equal(new Set(w.dates).size,7);}
  assert.equal(forecastWindow(new Date('2026-12-31T12:00Z')).start,'2027-01-01');
});
test('cached result expires at date rollover or after 24 hours',()=>{
  const r={retrievedAt:now.toISOString(),window:forecastWindow(now)} as PressureResponse;
  assert.equal(isUsable(r,new Date('2026-09-10T20:00Z')),true);
  assert.equal(isUsable(r,new Date('2026-09-10T22:00Z')),false);
  assert.equal(isUsable(r,new Date('2026-09-11T13:00Z')),false);
});
test('discharge parser rejects water-level-only or changed tables and marks old dates',()=>{
  const html='<p>Datum: CETVRTAK, 10.09.2026.</p><table><tr><td>Vodostaj (cm)</td><td>Promena vodostaja (cm)</td><td>Proticaj vode (m³/s)</td><td>Temperatura vode</td></tr><tr><td>-64</td><td>-5</td><td>890</td><td>-</td></tr></table>';
  const r=parseRiver(html,now);assert.equal(r.value,890);assert.equal(r.status,'available');assert.equal(r.date,'2026-09-10');
  assert.equal(parseRiver(html.replace('</tr><tr>','</tr><tr><td colspan="4">&nbsp;</td></tr><tr>'),now).value,890);
  assert.equal(parseRiver(html.replace('890','-'),now).status,'missing');
  assert.equal(parseRiver(html.replace('Proticaj vode','Other'),now).status,'missing');
  assert.equal(parseRiver(html,new Date('2026-09-14T12:00Z')).status,'stale');
});
test('geography includes exactly seven districts with all positive sample areas',()=>{
  const map=JSON.parse(readFileSync(new URL('../data/map.json',import.meta.url),'utf8'));
  const samples:Sample[]=JSON.parse(readFileSync(new URL('../data/samples.json',import.meta.url),'utf8'));
  assert.deepEqual(map.map((d:{id:string})=>d.id),Array.from({length:7},(_,i)=>`RS-0${i+1}`));
  for(const d of map){const district=samples.filter(s=>s.district===d.id);assert.ok(district.length>1);assert.ok(district.every(s=>s.area>0));assert.ok(Math.abs(district.reduce((a,s)=>a+s.area,0)-d.area)<1);}
});
