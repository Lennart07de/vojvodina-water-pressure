import {addDays,belgradeDate} from './pressure.ts';

export const ENSEMBLE_SOURCE='https://open-meteo.com/en/docs/ensemble-api';
export const HISTORY_SOURCE='https://open-meteo.com/en/docs/historical-weather-api';
export type Spread={p10:number;median:number;p90:number;members:number};
export type Horizon={days:number;end:string;precipitation:Spread|null;temperature:Spread|null};
export type NormalRegion={id:string;name:string;lat:number;lon:number;returned:number[];daily:Record<string,{mean:number;years:number}>};
export type RecentComparison={start:string;end:string;precipitation:number|null;normal:number|null;percentOfNormal:number|null;temperature:number|null;reason:string|null};
export type OutlookRegion={id:string;name:string;requested:number[];ensembleReturned:number[]|null;recentReturned:number[]|null;horizons:Horizon[];recent:RecentComparison};
export type OutlookResponse={retrievedAt:string;start:string;regions:OutlookRegion[];warning:string|null};
type Raw={latitude:number;longitude:number;timezone:string;daily:Record<string,unknown[]>;daily_units:Record<string,string>};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function readDaily(value:unknown):Raw|null{
  if(!value||typeof value!=='object')return null;
  const v=value as Raw;
  if(!finite(v.latitude)||!finite(v.longitude)||v.timezone!=='Europe/Belgrade'||!v.daily||!v.daily_units||!Array.isArray(v.daily.time)||v.daily.time.some(d=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))||new Set(v.daily.time).size!==v.daily.time.length)return null;
  return v;
}
function series(raw:Raw|null,key:string,dates:string[],unit:string):number[]|null{
  if(!raw||raw.daily_units[key]!==unit||!Array.isArray(raw.daily[key]))return null;
  const values=dates.map(date=>raw.daily[key][raw.daily.time.indexOf(date)]);
  if(!values.every(finite)||unit==='mm'&&values.some(v=>v<0))return null;
  return values;
}
export function spread(values:number[]):Spread|null{
  if(values.length!==31||!values.every(finite))return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return {p10:sorted[3],median:sorted[15],p90:sorted[27],members:31};
}
export function ensembleHorizons(value:unknown,now:Date):Horizon[]{
  const raw=readDaily(value),today=belgradeDate(now);
  return Array.from({length:30},(_,index)=>{
    const days=index+1,dates=Array.from({length:days},(_,i)=>addDays(today,i+1));
    function aggregate(variable:string,unit:string,mean:boolean){
      const values=Array.from({length:31},(_,member)=>series(raw,variable+(member?`_member${String(member).padStart(2,'0')}`:''),dates,unit));
      if(values.some(v=>v===null))return null;
      return spread(values.map(v=>v!.reduce((a,b)=>a+b,0)/(mean?days:1)));
    }
    return {days,end:dates.at(-1)!,precipitation:aggregate('precipitation_sum','mm',false),temperature:aggregate('temperature_2m_mean','°C',true)};
  });
}
export function recentComparison(value:unknown,region:NormalRegion,now:Date,end=addDays(belgradeDate(now),-5)):RecentComparison{
  const start=addDays(end,-29),dates=Array.from({length:30},(_,i)=>addDays(start,i));
  const raw=readDaily(value);
  // A matching ERA5 grid location is essential for a like-for-like baseline comparison.
  const sameGrid=raw&&Math.abs(raw.latitude-region.returned[0])<0.0001&&Math.abs(raw.longitude-region.returned[1])<0.0001;
  const p=sameGrid?series(raw,'precipitation_sum',dates,'mm'):null,t=sameGrid?series(raw,'temperature_2m_mean',dates,'°C'):null;
  const normals=dates.map(d=>region.daily[d.slice(5)]);
  const normal=normals.every(v=>v&&finite(v.mean)&&v.mean>=0)?normals.reduce((sum,v)=>sum+v.mean,0):null;
  const precipitation=p?p.reduce((a,b)=>a+b,0):null;
  return {start,end,precipitation,normal,percentOfNormal:precipitation!==null&&normal!==null&&normal>0?100*precipitation/normal:null,temperature:t?t.reduce((a,b)=>a+b,0)/30:null,reason:p?null:'Recent ERA5 rainfall is incomplete or its grid does not match the baseline. Comparison unavailable.'};
}
export function latestCommonEnd(values:unknown[],regions:NormalRegion[],now:Date):string{
  const latest=addDays(belgradeDate(now),-5);
  for(let lag=0;lag<=7;lag++){
    const end=addDays(latest,-lag);
    if(regions.length&&regions.every((region,i)=>recentComparison(values[i],region,now,end).precipitation!==null))return end;
  }
  return latest; // No complete common window: show missing values, never backfill rain.
}
export function outlookUsable(value:OutlookResponse,now=new Date()){
  const age=now.getTime()-Date.parse(value.retrievedAt);
  return age>=0&&age<86400000&&value.start===addDays(belgradeDate(now),1);
}
