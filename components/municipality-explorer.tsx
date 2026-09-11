'use client';
import {useEffect,useRef,useState} from 'react';
import areas from '../data/municipalities.json';
import source from '../data/municipality-source.json';
import {isUsable,WEATHER_SOURCE} from '../lib/pressure';
import type {MunicipalResponse} from '../lib/municipalities';

const colors:Record<string,string>={Low:'#b9cbb4',Medium:'#e8c579',High:'#ce795d',Missing:'#d8dcd5'};
const fmt=(v:number|null|undefined,digits=1)=>v==null?'—':v.toFixed(digits);
const dateTime=(s:string)=>new Date(s).toLocaleString('en-GB',{timeZone:'Europe/Belgrade',dateStyle:'medium',timeStyle:'short'});
const linkProps={target:'_blank',rel:'noreferrer'};

export default function MunicipalityExplorer({districtId,districtName}:{districtId:string;districtName:string}){
  const [open,setOpen]=useState(false);
  return <section className='municipality-explorer' aria-label='Optional municipality drill-down'>
    <div className='municipality-heading'><div><span className='eyebrow'>OPTIONAL SECOND LEVEL</span><h2>{districtName} <span>/ municipalities & cities</span></h2><p>More detailed monitoring areas, not more accurate weather predictions.</p></div><button className='municipality-open' onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls='municipal-outlook'>{open?'Close municipality view':`Explore municipalities in ${districtName}`}</button></div>
    {open&&<MunicipalOutlook districtId={districtId} districtName={districtName}/>}
  </section>;
}

function MunicipalOutlook({districtId,districtName}:{districtId:string;districtName:string}){
  const local=areas.filter(a=>a.district===districtId);
  const [selected,setSelected]=useState(local[0].id),[data,setData]=useState<MunicipalResponse|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true),[now,setNow]=useState<Date|null>(null),[attempt,setAttempt]=useState(0),[labels,setLabels]=useState(true),[zoom,setZoom]=useState(1);
  const first=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setInterval(()=>setNow(new Date()),60000);
    first.current?.focus({preventScroll:true});
    void (async()=>{
      try{
        const response=await fetch(`/api/municipalities?district=${encodeURIComponent(districtId)}`,{signal:controller.signal});
        if(!response.ok)throw new Error('Municipality forecasts are unavailable. Please retry.');
        const value:MunicipalResponse=await response.json();
        if(value.district!==districtId||!isUsable(value))throw new Error('Municipality forecast has expired. Please retry.');
        if(!controller.signal.aborted){setData(value);setNow(new Date());}
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Municipality forecasts unavailable.');}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>{controller.abort();clearInterval(timer);};
  },[districtId,attempt]);
  const usable=data&&now&&isUsable(data,now)?data:null;
  const result=usable?.municipalities.find(m=>m.id===selected),area=local.find(a=>a.id===selected)!;
  const coordinates=local.flatMap(a=>a.rings.flat()),xs=coordinates.map(p=>p[0]),ys=coordinates.map(p=>p[1]);
  const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=5000;
  const rows=[...local].sort((a,b)=>a.name.localeCompare(b.name));
  return <div id='municipal-outlook'>
    <h3 ref={first} tabIndex={-1}>Municipal monitoring outlook · {districtName}</h3>
    <p className='municipality-warning'>Approximately 9 km weather model. Neighbouring municipalities can share forecast locations; small differences are not evidence of different water availability. Check local water supply, irrigation, crop needs and allocations before any restrictions.</p>
    <div className='municipality-status'><span>{usable?`Forecast valid: ${usable.window.start} to ${usable.window.end} · Retrieved: ${dateTime(usable.retrievedAt)} (Europe/Belgrade)`:'No current municipal forecast loaded.'}</span><button disabled={loading} onClick={()=>{setLoading(true);setError(null);setAttempt(a=>a+1);}}>{loading?'Loading municipal forecasts…':'Refresh municipal data'}</button></div>
    {(error||data&&!usable||usable?.warning)&&<p role='status' className='notice'>{error||(data&&!usable?'The municipal outlook expired. Refresh to get current data.':usable?.warning)}{error&&usable?' Showing the previous, unexpired municipal forecast.':''}</p>}
    <div className='municipality-grid'>
      <div className='municipality-map'><div className='municipality-controls'><button onClick={()=>setLabels(v=>!v)} aria-pressed={labels}>Municipality labels</button><button onClick={()=>setZoom(z=>Math.min(2,z+.25))} disabled={zoom===2} aria-label='Zoom municipality map in'>+</button><button onClick={()=>setZoom(1)} disabled={zoom===1}>Reset municipality map</button></div>
        <svg viewBox={`${x-pad} ${y-pad} ${w+2*pad} ${h+2*pad}`} role='group' aria-label={`Municipalities in ${districtName}`}>
          <g transform={`translate(${x+w/2} ${y+h/2}) scale(${zoom}) translate(${-x-w/2} ${-y-h/2})`}>
          {local.map(a=>{const r=usable?.municipalities.find(m=>m.id===a.id);return <path key={a.id} d={a.rings.map(ring=>'M'+ring.map(p=>p.join(',')).join('L')+'Z').join('')} fillRule='evenodd' fill={colors[r?.grade??'Missing']} stroke={selected===a.id?'#244936':'#faf9f2'} strokeWidth={selected===a.id?700:300} role='button' tabIndex={0} aria-pressed={selected===a.id} aria-label={`${a.name}: ${r?.grade??'no data'} municipal pressure`} onClick={()=>setSelected(a.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(a.id);}}}><title>{a.name}</title></path>;})}
          {labels&&local.map(a=><text className='municipality-map-label' key={a.id} x={a.label[0]} y={a.label[1]} textAnchor='middle' fontSize={Math.max(w,h)/48}>{a.name}</text>)}
          </g>
        </svg>
        <div className='legend'>{['Low','Medium','High','Missing'].map(k=><span key={k}><i style={{background:colors[k]}}/>{k==='Missing'?'No data':k}</span>)}</div>
        <label className='municipality-select'>Select municipality / city<select value={selected} onChange={e=>setSelected(e.target.value)}>{rows.map(a=><option key={a.id} value={a.id}>{a.name} — {usable?.municipalities.find(m=>m.id===a.id)?.grade??'No data'}</option>)}</select></label>
      </div>
      <article className='municipality-detail' aria-live='polite'><span className='eyebrow'>MUNICIPALITY / CITY DETAIL</span><h3>{area.name}</h3><span className={`badge ${(result?.grade??'missing').toLowerCase()}`}>{result?.grade?`${result.grade} weather pressure`:loading?'Loading':'No data'}</span>
        <dl><div><dt>Weather pressure score</dt><dd>{fmt(result?.score,0)} / 100</dd></div><div><dt>Seven-day precipitation</dt><dd>{fmt(result?.precipitation)} mm</dd></div><div><dt>Seven-day reference ET₀</dt><dd>{fmt(result?.et0)} mm</dd></div><div><dt>Area-weighted deficit</dt><dd>{fmt(result?.deficit)} mm</dd></div></dl>
        <p>{usable?`${usable.window.start}–${usable.window.end}. Retrieved ${dateTime(usable.retrievedAt)} (Europe/Belgrade); retrieval is not model issue time.`:'Dates and values are unavailable until a current forecast is retrieved.'} <a href={WEATHER_SOURCE} {...linkProps}>Open-Meteo / ECMWF</a></p>
        <h4>Why this classification?</h4><p>{result?.explanation??'Every municipal sample needs all seven days of precipitation and ET₀. Missing values never become zero, and district scores are never copied here.'}</p>
        <h4>Recommended next step</h4><p>{result?.grade?`${result.action} — for local authority review only.`:'Check missing data before assigning a priority.'} This is a monitoring indicator, not a municipal restriction order.</p>
        <h4>Coverage & resolution</h4><p>{result?`${result.validSamples} / ${result.expectedSamples} sampling locations complete; ${fmt(result.coveragePercent)}% of sampled polygon area covered. ${result.distinctForecastLocations} distinct returned forecast locations; ${result.sharedForecastLocations} also serve another municipality in this district.`:`0 / ${area.sampleIds.length} sampling locations loaded.`}</p><p>{fmt(area.area/1e6)} km² polygon area · 10 km area-weighted sampling · approximately 9 km forecast model. Returned coordinates identify model-location overlap, not independent observations or confidence.</p>
        {result&&result.distinctForecastLocations<=2&&<p className='municipality-warning'>Only {result.distinctForecastLocations} distinct forecast locations are available here. Local variation cannot be resolved reliably by this indicator.</p>}
        <h4>Soil moisture · not scored</h4><p>{fmt(result?.soil,3)} m³/m³ at 7–28 cm. {result?.soilTime?`Valid ${result.soilTime.replace('T',' ')} Europe/Belgrade.`:'Soil-moisture data unavailable.'} Modelled state, not groundwater or an observation. <a href={WEATHER_SOURCE} {...linkProps}>Source</a></p>
        {result?.status==='available'&&<details><summary>Seven daily forecasts</summary><table className='municipality-daily'><thead><tr><th>Date</th><th>Precipitation (mm)</th><th>ET₀ (mm)</th></tr></thead><tbody>{result.days.map(d=><tr key={d.date}><td>{d.date}</td><td>{fmt(d.precipitation)}</td><td>{fmt(d.et0)}</td></tr>)}</tbody></table></details>}
      </article>
    </div>
    <details className='municipality-method'><summary>Municipal method, boundary provenance & limitations</summary><p>Each municipality is sampled independently within its full polygon: deficit = max(0, seven-day ET₀ − precipitation) at each sample, followed by area weighting. Score = min(100, 100 × deficit / 30). Low &lt;10 mm; Medium 10–&lt;20 mm; High ≥20 mm. These unvalidated thresholds are inherited from the district prototype, not calibrated municipal standards. Soil moisture, EDO and river discharge have zero weight.</p><p>45 municipalities/cities in seven districts. Boundaries represent 2017, from OpenStreetMap/Wambacher via geoBoundaries (ODbL); they are not a current official cadastral map. Parent assignment and counts were validated. Minor differences between the two boundary datasets remain; independently sampled municipal results need not exactly reproduce district results. No irrigated-land weighting or additional weather resolution is claimed.</p><p><a href={source.url} {...linkProps}>Pinned municipal boundaries</a> · <a href={source.officialCountSource} {...linkProps}>Statistical Office district counts</a> · <a href='https://www.openstreetmap.org/copyright' {...linkProps}>ODbL licence</a> · <a href={`/api/municipalities?district=${districtId}`} {...linkProps}>Municipal data & requested/returned coordinates</a></p><p>Boundary revision {source.revision}, retrieved {source.retrievedAt.slice(0,10)}. Municipal forecasts load only when this view is opened. Per-instance caching can reuse complete data for six hours or failures for five minutes; cold starts can fetch more often. Scores expire at the next Belgrade date or after 24 hours. The district overview and regional context remain separate.</p></details>
  </div>;
}
