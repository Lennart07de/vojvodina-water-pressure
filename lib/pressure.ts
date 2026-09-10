export const METHOD = 'weather-deficit-v1';
export const WEATHER_SOURCE = 'https://open-meteo.com/en/docs/ecmwf-api';
export const EDO_SOURCE = 'https://drought.emergency.copernicus.eu/data/wms-service';
export const RIVER_SOURCE = 'https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42035';
export type Sample = {id:string;district:string;lat:number;lon:number;area:number};
export type Grade = 'Low'|'Medium'|'High';
export type Daily = {date:string;precipitation:number;et0:number};
export type PointForecast = {id:string;latitude:number;longitude:number;days:Daily[];soil:number|null;soilTime:string|null};
export type DistrictResult = {id:string;name:string;status:'available'|'missing';grade:Grade|null;score:number|null;deficit:number|null;precipitation:number|null;et0:number|null;days:Daily[];soil:number|null;soilTime:string|null;expectedSamples:number;validSamples:number;reason:string|null;action:string;explanation:string;};
export type River = {status:'available'|'missing'|'stale';value:number|null;date:string|null;retrievedAt:string;source:string;message:string};
export type Edo = {status:'context'|'missing'|'stale';latestDate:string|null;retrievedAt:string;source:string;message:string};
export type PressureResponse = {method:string;window:{start:string;end:string;dates:string[]};retrievedAt:string;model:string;resolution:string;districts:DistrictResult[];edo:Edo;river:River;warning:string|null;gridPoints:{id:string;requested:[number,number];returned:[number,number]|null}[]};

export function belgradeDate(now:Date):string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Belgrade',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function addDays(date:string,n:number):string {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10);
}
export function forecastWindow(now=new Date()) {
  const today = belgradeDate(now);
  const dates = Array.from({length:7},(_,i)=>addDays(today,i+1));
  return {start:dates[0],end:dates[6],dates};
}
export function classification(deficit:number):Grade { return deficit < 10 ? 'Low' : deficit < 20 ? 'Medium' : 'High'; }
export function actionFor(grade:Grade) {return grade==='High'?'Prioritise water-saving measures':grade==='Medium'?'Prepare restrictions':'Monitor';}
export function isUsable(response:PressureResponse,now=new Date()):boolean {
  const age=now.getTime()-Date.parse(response.retrievedAt);
  return age>=0 && age<86400000 && response.window.start===forecastWindow(now).start;
}

// Validate whole point series; one missing day must never become zero rainfall.
export function parsePoint(raw:unknown,sample:Sample,dates:string[],now=new Date()):PointForecast|null {
  if(!raw || typeof raw!=='object') return null;
  const r=raw as Record<string,any>;
  if(!Number.isFinite(r.latitude)||!Number.isFinite(r.longitude)||r.timezone!=='Europe/Belgrade') return null;
  if(r.daily_units?.precipitation_sum!=='mm'||r.daily_units?.et0_fao_evapotranspiration!=='mm') return null;
  if(!Array.isArray(r.daily?.time)||new Set(r.daily.time).size!==r.daily.time.length) return null;
  const days:Daily[]=[];
  for(const date of dates){
    const i=r.daily.time.indexOf(date);
    const p=r.daily.precipitation_sum?.[i], e=r.daily.et0_fao_evapotranspiration?.[i];
    if(i<0||!Number.isFinite(p)||!Number.isFinite(e)||p<0||e<0) return null;
    days.push({date,precipitation:p,et0:e});
  }
  let soil:number|null=null,soilTime:string|null=null;
  // Use today's 00:00 model state, never a future moisture value as a current observation.
  const target=belgradeDate(now)+'T00:00';
  const i=r.hourly?.time?.indexOf(target)??-1;
  const sm=r.hourly?.soil_moisture_7_to_28cm?.[i];
  if(r.hourly_units?.soil_moisture_7_to_28cm==='m³/m³' && i>=0 && Number.isFinite(sm) && sm>=0 && sm<=1){soil=sm;soilTime=target;}
  return {id:sample.id,latitude:r.latitude,longitude:r.longitude,days,soil,soilTime};
}

export function scoreDistrict(id:string,name:string,samples:Sample[],points:Map<string,PointForecast>,dates:string[]):DistrictResult {
  const available=samples.filter(s=>points.has(s.id));
  const missing:DistrictResult={id,name,status:'missing',grade:null,score:null,deficit:null,precipitation:null,et0:null,days:[],soil:null,soilTime:null,expectedSamples:samples.length,validSamples:available.length,reason:'Insufficient forecast data — pressure not calculated.',action:'Check missing data',explanation:'A complete seven-day rainfall and ET₀ forecast is required at every sampling location.'};
  if(!samples.length || available.length!==samples.length) return missing;
  const area=samples.reduce((a,s)=>a+s.area,0);
  if(!Number.isFinite(area)||area<=0||samples.some(s=>!Number.isFinite(s.area)||s.area<=0)) return missing;
  let deficit=0;
  const days=dates.map(date=>({date,precipitation:0,et0:0}));
  let soil=0,soilComplete=true,soilTime:string|null=null;
  for(const s of samples){
    const p=points.get(s.id)!; const weight=s.area/area;
    if(p.days.length!==7 || p.days.some((d,i)=>d.date!==dates[i]||!Number.isFinite(d.precipitation)||!Number.isFinite(d.et0)||d.precipitation<0||d.et0<0)) return missing;
    deficit+=weight*Math.max(0,p.days.reduce((a,d)=>a+d.et0-d.precipitation,0));
    p.days.forEach((d,i)=>{days[i].precipitation+=weight*d.precipitation;days[i].et0+=weight*d.et0;});
    if(p.soil===null || (soilTime!==null && soilTime!==p.soilTime)) soilComplete=false;
    else {soil+=weight*p.soil;soilTime=p.soilTime;}
  }
  const precipitation=days.reduce((a,d)=>a+d.precipitation,0),et0=days.reduce((a,d)=>a+d.et0,0);
  const grade=classification(deficit),score=Math.min(100,100*deficit/30);
  const explanation=`Forecast precipitation averages ${precipitation.toFixed(1)} mm and reference evapotranspiration ${et0.toFixed(1)} mm across this district. The area-weighted deficit is ${deficit.toFixed(1)} mm, placing it in the ${grade.toLowerCase()} pressure band (${grade==='Low'?'below 10 mm':grade==='Medium'?'10 to below 20 mm':'20 mm or more'}). This indicates weather-driven pressure, not confirmed water scarcity.`;
  return {...missing,status:'available',grade,score,deficit,precipitation,et0,days,soil:soilComplete?soil:null,soilTime:soilComplete?soilTime:null,reason:null,action:actionFor(grade),explanation};
}

export function parseRiver(html:string,now=new Date()):River {
  const base:River={status:'missing',value:null,date:null,retrievedAt:now.toISOString(),source:RIVER_SOURCE,message:'Novi Sad discharge unavailable. No river value is used in the district score.'};
  // Match the reporting date, then a row below the labelled daily measurement header.
  const date=html.match(/Datum\s*:\s*(?:<[^>]*>|\s|&nbsp;|[A-Za-zČĆŠĐŽčćšđž,])*?(\d{2})\.(\d{2})\.(\d{4})\./i);
  if(!date) return base;
  const iso=`${date[3]}-${date[2]}-${date[1]}`;
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
  const text=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
  const h=rows.findIndex(row=>/Proticaj vode/i.test(text(row))&&/Temperatura vode/i.test(text(row)));
  if(h<0)return base;
  // The official report has one empty colspan spacer between header and values.
  let row=rows[h+1]??'';
  if(/colspan=["']4["']/i.test(row)&&text(row)==='')row=rows[h+2]??'';
  const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>text(m[1]));
  if(cells.length!==4 || !/^\d+(?:[.,]\d+)?$/.test(cells[2]))return base;
  const value=Number(cells[2].replace(',','.'));
  const age=(Date.parse(belgradeDate(now)+'T12:00:00Z')-Date.parse(iso+'T12:00:00Z'))/86400000;
  if(!Number.isFinite(value)||value<0||!Number.isFinite(age)||age<0)return base;
  // Publication time is absent: expire conservatively on the second local day.
  return {...base,status:age>=2?'stale':'available',date:iso,value,message:age>=2?'This report is at least two calendar dates old; treat it as historical context.':'Official daily reported discharge. One station describes the Danube here, not water available to each district.'};
}
