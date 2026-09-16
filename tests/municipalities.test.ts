import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scoreMunicipalities,type MunicipalSample} from '../lib/municipalities.ts';
import {forecastWindow,isUsable,type PointForecast} from '../lib/pressure.ts';

const dates=forecastWindow(new Date('2026-09-11T10:00:00Z')).dates;
const samples:MunicipalSample[]=[{id:'a1',district:'RS-01',municipality:'a',lat:45,lon:20,area:1},{id:'a2',district:'RS-01',municipality:'a',lat:45,lon:20.1,area:3},{id:'b1',district:'RS-01',municipality:'b',lat:45,lon:20.2,area:2}];
const areas=[{id:'a',name:'A',district:'RS-01',area:4},{id:'b',name:'B',district:'RS-01',area:2}];
const point=(id:string,rain:number,et0:number,lon:number):PointForecast=>({id,latitude:45,longitude:lon,soil:null,soilTime:null,days:dates.map(date=>({date,precipitation:rain,et0}))});
test('municipal scores use their own weighted samples, not district values',()=>{
  const points=new Map([['a1',point('a1',0,4,20)],['a2',point('a2',4,2,20.1)],['b1',point('b1',0,4,20.2)]]);
  const [a,b]=scoreMunicipalities(areas,samples,points,dates);
  assert.equal(a.deficit,7);assert.equal(a.grade,'Low');assert.equal(b.deficit,28);assert.equal(b.grade,'High');
  assert.equal(a.coveragePercent,100);assert.equal(a.distinctForecastLocations,2);
});
test('missing municipal sample suppresses only its municipality and reports area coverage',()=>{
  const points=new Map([['a1',point('a1',0,4,20)],['b1',point('b1',0,4,20)]]);
  const [a,b]=scoreMunicipalities(areas,samples,points,dates);
  assert.equal(a.status,'missing');assert.equal(a.score,null);assert.equal(a.coveragePercent,25);
  assert.equal(b.status,'available');assert.equal(a.sharedForecastLocations,1);assert.equal(b.sharedForecastLocations,1);
});
test('repeated returned coordinates are not counted as independent forecast locations',()=>{
  const points=new Map(samples.map(s=>[s.id,point(s.id,0,4,20)]));
  const [a]=scoreMunicipalities(areas,samples,points,dates);
  assert.equal(a.expectedSamples,2);assert.equal(a.distinctForecastLocations,1);assert.equal(a.sharedForecastLocations,1);
});
test('municipal forecast validity expires at local midnight',()=>{
  const response={retrievedAt:'2026-09-11T20:00:00Z',window:forecastWindow(new Date('2026-09-11T20:00:00Z'))};
  assert.equal(isUsable(response,new Date('2026-09-11T21:59:00Z')),true);
  assert.equal(isUsable(response,new Date('2026-09-11T22:00:00Z')),false);
});
test('45 pinned municipal polygons have conserved areas and verified district membership counts',()=>{
  const data=JSON.parse(readFileSync(new URL('../data/municipalities.json',import.meta.url),'utf8')) as {id:string;district:string;area:number;sampleIds:string[];districtOverlap:number}[];
  const samples=JSON.parse(readFileSync(new URL('../data/municipality-samples.json',import.meta.url),'utf8')) as MunicipalSample[];
  const expected:Record<string,number>={'RS-01':3,'RS-02':5,'RS-03':6,'RS-04':8,'RS-05':4,'RS-06':12,'RS-07':7};
  assert.equal(data.length,45);assert.equal(new Set(data.map(a=>a.id)).size,45);assert.equal(new Set(samples.map(s=>s.id)).size,samples.length);
  for(const [id,count] of Object.entries(expected))assert.equal(data.filter(a=>a.district===id).length,count);
  for(const a of data){
    const own=samples.filter(s=>s.municipality===a.id);
    assert.ok(a.districtOverlap>.99);assert.ok(own.length>0);assert.equal(own.length,a.sampleIds.length);
    assert.ok(own.every(s=>s.district===a.district&&s.area>0&&Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&a.sampleIds.includes(s.id)));
    assert.ok(Math.abs(own.reduce((n,s)=>n+s.area,0)-a.area)/a.area<1e-8);
  }
  assert.ok(samples.every(s=>data.some(a=>a.id===s.municipality)));
});
