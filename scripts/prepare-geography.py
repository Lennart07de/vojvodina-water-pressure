"""Regenerate pinned district polygons and area-weighted 10 km samples.
Requires Python, shapely and pyproj. Run from repository root.
"""
import json, math, pathlib, urllib.request
from datetime import datetime, timezone
from shapely.geometry import shape, mapping, box
from shapely.ops import transform
from pyproj import Transformer

URL = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/SRB/ADM1/geoBoundaries-SRB-ADM1.geojson'
names = {'RS-01':'North Bačka','RS-02':'Central Banat','RS-03':'North Banat','RS-04':'South Banat','RS-05':'West Bačka','RS-06':'South Bačka','RS-07':'Srem'}
forward = Transformer.from_crs(4326,3035,always_xy=True).transform
inverse = Transformer.from_crs(3035,4326,always_xy=True).transform
raw = json.load(urllib.request.urlopen(URL))
features, districts, samples = [], [], []
for f in raw['features']:
    code = f['properties']['shapeISO']
    if code not in names: continue
    geom = shape(f['geometry'])
    assert geom.is_valid
    projected = transform(forward,geom)
    x0,y0,x1,y1 = projected.bounds
    label = projected.representative_point()
    simplified = projected.simplify(250,preserve_topology=True)
    rings = [list(r.exterior.coords) for r in (simplified.geoms if simplified.geom_type == 'MultiPolygon' else [simplified])]
    ids = []
    for x in range(math.floor(x0/10000)*10000,math.ceil(x1/10000)*10000,10000):
        for y in range(math.floor(y0/10000)*10000,math.ceil(y1/10000)*10000,10000):
            cell = projected.intersection(box(x,y,x+10000,y+10000))
            if cell.area <= 0: continue
            point = cell.representative_point()
            lon,lat = inverse(point.x,point.y)
            sid = f'{code}-{len(ids)}'
            samples.append(dict(id=sid,district=code,lat=round(lat,6),lon=round(lon,6),area=cell.area))
            ids.append(sid)
    districts.append(dict(id=code,name=names[code],area=projected.area,sampleIds=ids,label=[round(label.x),round(-label.y)],rings=[[[round(x),round(-y)] for x,y in r] for r in rings]))
    features.append({'type':'Feature','properties':{'id':code,'name':names[code]},'geometry':mapping(geom)})
assert len(districts)==7
for d in districts:
    assert abs(sum(s['area'] for s in samples if s['district']==d['id'])-d['area'])/d['area'] < 1e-8
pathlib.Path('data').mkdir(exist_ok=True)
pathlib.Path('public').mkdir(exist_ok=True)
pathlib.Path('data/districts.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')),encoding='utf-8')
pathlib.Path('data/samples.json').write_text(json.dumps(samples,separators=(',',':')),encoding='utf-8')
pathlib.Path('data/map.json').write_text(json.dumps(sorted(districts,key=lambda d:d['id']),separators=(',',':')),encoding='utf-8')
pathlib.Path('data/geography-source.json').write_text(json.dumps({'url':URL,'revision':'9469f09','boundaryYear':2017,'retrievedAt':datetime.now(timezone.utc).isoformat(),'licence':'ODbL-1.0','source':'OpenStreetMap / Wambacher via geoBoundaries','projection':'EPSG:3035','samplingGridMetres':10000,'displaySimplificationMetres':250},indent=2),encoding='utf-8')
print(f'Prepared {len(districts)} districts and {len(samples)} weighted samples.')
