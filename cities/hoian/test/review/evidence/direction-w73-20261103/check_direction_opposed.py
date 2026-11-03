from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib,subprocess
from scipy.ndimage import map_coordinates,gaussian_filter,maximum_filter
r=Path(__file__).parent;W,H=512,342
main=json.loads((r/'heading-main-source-commit.json').read_text());ret=json.loads((r.parent/'hoian-player-w73/heading-return-w73.json').read_text())
def table_yaw(tab,t):
 p=np.clip(t/tab['dt'],0,len(tab['h'])-1);a=int(p);b=min(a+1,len(tab['h'])-1);return np.pi/2-(tab['h'][a]*(1-(p-a))+tab['h'][b]*(p-a))
def frame(p,t):
 result=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True)
 if result.stderr.strip():raise RuntimeError(result.stderr.decode())
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',str(p)]))['streams'][0];return np.frombuffer(result.stdout,np.uint8).reshape(probe['height'],probe['width'],3)
def project(im,yaw):
 yy,xx=np.mgrid[:H,:W];tan=np.tan(np.deg2rad(75)/2);rx=(2*(xx+.5)/W-1)*tan*W/H;ry=(1-2*(yy+.5)/H)*tan;rz=-np.ones_like(rx);norm=np.sqrt(rx*rx+ry*ry+1);rx/=norm;ry/=norm;rz/=norm
 dx=np.cos(yaw)*rx+np.sin(yaw)*rz;dz=-np.sin(yaw)*rx+np.cos(yaw)*rz
 u=np.mod(np.arctan2(dz,dx)/(2*np.pi),1)*im.shape[1]-.5;v=(.5-np.arcsin(ry)/np.pi)*im.shape[0]-.5
 return np.stack([map_coordinates(im[:,:,c],[v,u],order=1,mode='wrap') for c in range(3)],axis=-1)
def patches(a,b):
 a=a.astype(float).mean(2);b=b.astype(float).mean(2);gy,gx=np.gradient(gaussian_filter(a,1));A=gaussian_filter(gx*gx,1.5);B=gaussian_filter(gx*gy,1.5);C=gaussian_filter(gy*gy,1.5);score=A*C-B*B-.04*(A+C)**2
 mask=np.zeros((H,W),bool);mask[60:200,40:190]=True;mask[60:200,322:472]=True
 peaks=(score==maximum_filter(score,size=11))&mask&(score>0);ys,xs=np.where(peaks);inds=np.argsort(score[ys,xs])[::-1][:100];tracks=[]
 for idx in inds:
  x,y=int(xs[idx]),int(ys[idx]);patch=a[y-4:y+5,x-4:x+5];patch=patch-patch.mean();norm=np.linalg.norm(patch)
  if norm<30:continue
  scores=[]
  for dy in range(-10,11):
   for dx in range(-10,11):
    cand=b[y+dy-4:y+dy+5,x+dx-4:x+dx+5];cand=cand-cand.mean();den=norm*np.linalg.norm(cand);scores.append((float(np.sum(patch*cand)/den) if den else -1,dx,dy))
  scores.sort(reverse=True);best=scores[0];alts=[s for s in scores if (s[1]-best[1])**2+(s[2]-best[2])**2>4];gap=best[0]-alts[0][0]
  if best[0]<.85 or gap<.025 or max(abs(best[1]),abs(best[2]))>=10:continue
  tracks.append({'xy':[x,y],'delta':[best[1],best[2]],'ncc':best[0],'nonlocal_peak_gap':gap})
 return tracks
sources=[('main-entry',Path('/workspace/scratch/a7d4ca2c1f7e/hoian-junction-review-20261103/recovered-main-1058-1102.mp4'),8.2,main,1066.2),('main-bridge',Path('/workspace/scratch/058760c451a1/hoian-network-w50/bridge-area-capture-w50.mp4'),0,main,1102),('return-entry',Path('/workspace/scratch/058760c451a1/hoian-player-w54/assets/henk-return-w54.mp4'),5,ret,5)]
report={'method':'Held180-degree-opposed view control; actual-pixel reprojection; upper side-facade Harris corners and9x9 NCC±10px search. Integer screen flow only, no camera pose/translation proof.','rendered_player_checked':False,'iphone_checked':False,'independent_approval':False,'runtime_changed':False,'cases':[]}
contact=Image.new('RGB',(1536,1116),'#151b18');d=ImageDraw.Draw(contact)
for row,(name,path,start,tab,tt) in enumerate(sources):
 name='opposed-'+name; yaw=table_yaw(tab,tt)+np.pi;pics=[]
 for col,dt in enumerate([0,.2,.4]):
  pic=project(frame(path,start+dt),yaw);pics.append(pic);Image.fromarray(pic).save(r/f'{name}-{dt:g}.jpg',quality=94);contact.paste(Image.fromarray(pic),(col*W,row*372+30));d.text((col*W+5,row*372+5),f'{name} local{start+dt:g}s; held initial heading',fill='white')
 case={'name':name,'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'local_start':start,'inherited_global_time_for_main_only':tt if name.startswith('main') else None,'view_yaw_radians':float(yaw),'view_center_panorama_u':float((.75-yaw/(2*np.pi))%1),'pairs':[]}
 for i in range(2):
  tracks=patches(pics[i],pics[i+1]);left=[t['delta'][0] for t in tracks if t['xy'][0]<W/2];right=[t['delta'][0] for t in tracks if t['xy'][0]>=W/2]
  case['pairs'].append({'local_seconds':[start+i*.2,start+(i+1)*.2],'accepted_tracks':len(tracks),'left_tracks':len(left),'right_tracks':len(right),'median_dx_left':float(np.median(left)) if left else None,'median_dx_right':float(np.median(right)) if right else None,'tracks':tracks})
 report['cases'].append(case)
contact.save(r/'heading-opposed-contact.jpg',quality=93);(r/'direction-flow-opposed.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps([{k:v for k,v in c.items() if k!='source_sha256'}|{'pairs':[{k:v for k,v in p.items() if k!='tracks'} for p in c['pairs']]} for c in report['cases']]))
