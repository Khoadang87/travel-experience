"""Internal image matching only; never phone acceptance or route coverage proof."""
from pathlib import Path
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor
import cv2,json,re,subprocess,sys

root=Path(__file__).parent
base='https://pub-ea3274d70651434b8581144229d8b102.r2.dev/hoian/hls13/f2560/index.m3u8'
rows=[];t=0;init=None;duration=0
for line in Path('/tmp/hoian-forward-playlist.m3u8').read_text().splitlines():
 if line.startswith('#EXT-X-MAP:'):init=re.search('URI="([^"]+)"',line)[1]
 elif line.startswith('#EXTINF:'):duration=float(line.split(':')[1].split(',')[0])
 elif line and not line.startswith('#'):
  rows.append({'t':t,'end':t+duration,'init':init,'file':line});t+=duration
phone=cv2.imread(str(root/'phone-first.jpg'))[310:665,:]
sift=cv2.SIFT_create(nfeatures=1800);kp,ds=sift.detectAndCompute(phone,None)
def inspect(pos):
 row=next(r for r in rows if r['t']<=pos<r['end']);name='probe-'+str(pos);paths=[]
 for i,item in enumerate([row['init'],row['file']]):
  p=root/(name+'-'+str(i)+'.bin')
  if not p.exists():subprocess.run(['curl','--fail','--silent','--show-error','--max-time','25','-o',str(p),urljoin(base,item)],check=True)
  paths.append(p)
 video=root/(name+'.mp4')
 with video.open('wb') as out:
  for p in paths:out.write(p.read_bytes())
 cap=cv2.VideoCapture(str(video));ok,frame=cap.read();cap.release()
 if not ok:return {'position':pos,'decoded':False}
 cv2.imwrite(str(root/(name+'.jpg')),frame)
 k,d=sift.detectAndCompute(frame,None)
 pairs=cv2.BFMatcher().knnMatch(ds,d,k=2)
 matches=[m for m,n in pairs if m.distance<.7*n.distance]
 return {'position':pos,'segment_start':row['t'],'decoded':True,'feature_matches':len(matches),'matched_panorama_u':[round(k[m.trainIdx].pt[0]/frame.shape[1],4) for m in matches], 'geographic_match_verified':False}
positions=list(map(int,sys.argv[1:])) or [503,530,900,1061,1110,1200]
with ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(inspect,positions))
(root/('phone-location-candidates-'+str(positions[0])+'.json')).write_text(json.dumps(results,indent=2))
print([{k:r[k] for k in ['position','decoded','feature_matches'] if k in r} for r in results])
