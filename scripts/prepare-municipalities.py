"""Pinned ADM2 polygons and independent, full-area municipal sampling.
Run from repository root with shapely==2.1.2 and pyproj==3.8.0.
Optional first argument: previously downloaded source GeoJSON.
"""
import json, math, pathlib, sys, urllib.request, hashlib
from datetime import datetime, timezone
from collections import Counter
from shapely.geometry import shape, mapping, box
from shapely.ops import transform, unary_union
from pyproj import Transformer

URL='https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SRB/ADM2/geoBoundaries-SRB-ADM2.geojson'
COUNTS={'RS-01':3,'RS-02':5,'RS-03':6,'RS-04':8,'RS-05':4,'RS-06':12,'RS-07':7}
OFFICIAL='https://www.stat.gov.rs/sr-Latn/oblasti/registar-prostornih-jedinica-i-gis/administrativno-teritorijalna-podela-i-nstj-nivoi-1-2-3/nstj-1-vojvodina'
accents={'Pancevo':'Pančevo','Kanjiza':'Kanjiža','Backa Topola':'Bačka Topola','Novi Knezevac':'Novi Kneževac','Pecinci':'Pećinci','Indjija':'Inđija','Sid':'Šid','Kovacica':'Kovačica','Plandiste':'Plandište','Vrsac':'Vršac','Coka':'Čoka','Mali Idjos':'Mali Iđoš','Novi Becej':'Novi Bečej','Secanj':'Sečanj','Zitiste':'Žitište','Odzaci':'Odžaci','Bac':'Bač','Becej':'Bečej','Backa Palanka':'Bačka Palanka','Backi Petrovac':'Bački Petrovac','Beocin':'Beočin','Zabalj':'Žabalj'}
forward=Transformer.from_crs(4326,3035,always_xy=True).transform
inverse=Transformer.from_crs(3035,4326,always_xy=True).transform
source=pathlib.Path(sys.argv[1]).read_bytes() if len(sys.argv)>1 else urllib.request.urlopen(URL).read()
raw=json.loads(source)
districts={f['properties']['id']:transform(forward,shape(f['geometry'])) for f in json.loads(pathlib.Path('data/districts.geojson').read_text(encoding='utf8'))['features']}
features,areas,samples=[],[],[]
projected_by_id={}
for f in raw['features']:
    geom=shape(f['geometry'])
    assert geom.is_valid
    projected=transform(forward,geom)
    ratios=sorted(((projected.intersection(d).area/projected.area,code) for code,d in districts.items()),reverse=True)
    ratio,district=ratios[0]
    if ratio<.5: continue
    assert ratio>.99, (f['properties'],ratio)
    mid=f['properties']['shapeID']
    raw_name=f['properties']['shapeName']
    name=raw_name.removesuffix(' Municipality').removesuffix(' City')
    name=accents.get(name,name)
    projected_by_id[mid]=projected
    label=projected.representative_point()
    simplified=projected.simplify(150,preserve_topology=True)
    polygons=list(simplified.geoms) if simplified.geom_type=='MultiPolygon' else [simplified]
    # Preserve holes with SVG even-odd fill.
    rings=[[[round(x),round(-y)] for x,y in ring.coords] for p in polygons for ring in [p.exterior,*p.interiors]]
    ids=[]
    x0,y0,x1,y1=projected.bounds
    for x in range(math.floor(x0/10000)*10000,math.ceil(x1/10000)*10000,10000):
        for y in range(math.floor(y0/10000)*10000,math.ceil(y1/10000)*10000,10000):
            part=projected.intersection(box(x,y,x+10000,y+10000))
            if part.area<=0: continue
            point=part.representative_point()
            assert projected.covers(point)
            lon,lat=inverse(point.x,point.y)
            sid=f'{mid}-{len(ids)}'
            samples.append(dict(id=sid,district=district,municipality=mid,lat=lat,lon=lon,area=part.area))
            ids.append(sid)
    assert abs(sum(s['area'] for s in samples if s['municipality']==mid)-projected.area)/projected.area<1e-8
    areas.append(dict(id=mid,name=name,sourceName=raw_name,district=district,area=projected.area,districtOverlap=ratio,sampleIds=ids,label=[round(label.x),round(-label.y)],rings=rings))
    features.append(dict(type='Feature',properties=dict(id=mid,name=name,district=district),geometry=mapping(geom)))
assert Counter(a['district'] for a in areas)==COUNTS
diagnostics={}
for code,d in districts.items():
    members=[projected_by_id[a['id']] for a in areas if a['district']==code]
    union=unary_union(members)
    overlap=(sum(m.area for m in members)-union.area)/union.area
    difference=union.symmetric_difference(d).area/d.area
    assert overlap<1e-6, (code,overlap)
    assert difference<.01, (code,difference)
    diagnostics[code]=dict(municipalities=len(members),boundaryDifferenceFraction=difference,overlapFraction=max(0,overlap))
def save(path,obj): pathlib.Path(path).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf8')
save('data/municipalities.geojson',dict(type='FeatureCollection',features=features))
save('data/municipalities.json',sorted(areas,key=lambda a:(a['district'],a['name'])))
save('data/municipality-samples.json',samples)
save('data/municipality-source.json',dict(url=URL,revision='9469f09',boundaryYear=2017,retrievedAt=datetime.now(timezone.utc).isoformat(),sha256=hashlib.sha256(source).hexdigest(),licence='ODbL-1.0',source='OpenStreetMap / Wambacher via geoBoundaries',officialCountSource=OFFICIAL,projection='EPSG:3035',samplingGridMetres=10000,displaySimplificationMetres=150,municipalityCount=len(areas),sampleCount=len(samples),districtChecks=diagnostics,note='2017 public boundaries, not a current official cadastral map. Parent districts assigned by >99% area overlap and checked against official counts. Full ADM2 polygons retained; slight ADM1/ADM2 boundary differences are not silently clipped.'))
print(json.dumps(dict(municipalities=len(areas),samples=len(samples),checks=diagnostics)))
