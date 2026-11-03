from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
r=Path(__file__).parent;s=r.parent/'hoian-junction-review-20261103'
# Provisional manual correspondence estimates, requiring independent verification.
frames=[{'file':'main-local-8.2.png','points':[[2063,359],[2373,455]],'crop':[1800,280,2559,800]}, {'file':'return-local-35.png','points':[[703,325],[893,406]],'crop':[500,220,1040,740]}]
def ray(p,size):
 x,y=p;w,h=size;lon=(x/w-.5)*2*np.pi;lat=(.5-y/h)*np.pi;return np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
def sep(a,b,size):return float(np.degrees(np.arccos(np.clip(ray(a,size)@ray(b,size),-1,1))))
o=Image.new('RGB',(1200,960),'#171b1a');d=ImageDraw.Draw(o)
for i,f in enumerate(frames):
 p=s/f['file'];im=Image.open(p).convert('RGB');f['image_size']=list(im.size);f['source_frame_sha256']=hashlib.sha256(p.read_bytes()).hexdigest();f['manual_point_uncertainty_px']=12
 a,b=f['points'];f['provisional_angular_separation_degrees']=sep(a,b,im.size)
 # Conservative explicit corner perturbations of each provisional point box.
 vals=[sep([a[0]+dx,a[1]+dy],[b[0]+ex,b[1]+ey],im.size) for dx in [-12,12] for dy in [-12,12] for ex in [-12,12] for ey in [-12,12]]
 f['uncertainty_box_corner_angle_range']=[min(vals),max(vals)]
 draw=ImageDraw.Draw(im)
 for j,(x,y) in enumerate(f['points']):draw.ellipse((x-12,y-12,x+12,y+12),outline='#ff4040',width=3);draw.text((x+16,y),str(j+1),fill='#ff4040')
 crop=im.crop(f['crop']);crop.thumbnail((1160,420));o.paste(crop,(20,i*480+45));d.text((20,i*480+8),f['file']+'; provisional manually selected gate column tips 1/2; verify before use',fill='white')
o.save(r/'gate-correspondence-hypotheses.jpg',quality=94)
report={'scope':'Provisional manual pixel correspondence, NOT calibrated camera geometry or independent review','frames':frames,'interpretation':'Nominal ray separations differ, but uncertainty-box ranges overlap. Cannot reject a pure rotation conclusively from these manual points. No heading/position correction is justified. Gate correspondence identities and positions require independent review.','automated_attempt':{'algorithm':'masked SIFT mutual matching plus planar homography','executed_successfully':False,'failure':'ModuleNotFoundError: cv2 in both available Python runtimes; no installation attempted','matches_computed':None},'timeline_mapping':{'status':'still inherited nominal','external_manifest_attempt':'Public HLS URL not accessible through search-service open; no route/TLS/network override attempted','current_global_mapping_reverified':False},'runtime_changed':False,'delivery_approved':False,'phone_testing_ready':False,'image_sha256':hashlib.sha256((r/'gate-correspondence-hypotheses.jpg').read_bytes()).hexdigest()}
(r/'gate-correspondence-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'frames':[{'file':f['file'],'angle':f['provisional_angular_separation_degrees'],'uncertainty_range':f['uncertainty_box_corner_angle_range']} for f in frames],'interpretation':report['interpretation']}))
