import {scoreDistrict,type Sample,type PointForecast,type DistrictResult, type PressureResponse} from './pressure.ts';

export type MunicipalSample=Sample&{municipality:string};
export type MunicipalArea={id:string;name:string;district:string;area:number};
export type MunicipalResult=DistrictResult&{district:string;areaKm2:number;coveragePercent:number;distinctForecastLocations:number;sharedForecastLocations:number};
export type MunicipalResponse=Pick<PressureResponse,'method'|'window'|'retrievedAt'|'model'|'resolution'|'gridPoints'>&{district:string;municipalities:MunicipalResult[];warning:string|null};
const location=(p:PointForecast)=>`${p.latitude},${p.longitude}`;

export function scoreMunicipalities(areas:MunicipalArea[],samples:MunicipalSample[],points:Map<string,PointForecast>,dates:string[]):MunicipalResult[]{
  const owners=new Map<string,Set<string>>();
  for(const s of samples){const p=points.get(s.id);if(p){const key=location(p);const set=owners.get(key)??new Set<string>();set.add(s.municipality);owners.set(key,set);}}
  return areas.map(area=>{
    const own=samples.filter(s=>s.municipality===area.id);
    const result=scoreDistrict(area.id,area.name,own,points,dates);
    const locations=new Set(own.flatMap(s=>{const p=points.get(s.id);return p?[location(p)]:[];}));
    const total=own.reduce((n,s)=>n+s.area,0),valid=own.reduce((n,s)=>n+(points.has(s.id)?s.area:0),0);
    return {...result,district:area.district,areaKm2:area.area/1e6,coveragePercent:total?100*valid/total:0,distinctForecastLocations:locations.size,sharedForecastLocations:[...locations].filter(k=>(owners.get(k)?.size??0)>1).length,explanation:result.explanation.replace('across this district','across this municipality/city')+' Municipal boundaries do not increase forecast resolution. Local supply and crop needs must be checked before any restrictions.'};
  });
}
