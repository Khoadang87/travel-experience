from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,hashlib,json
r=Path(__file__).parent;src=r.parent/'hoian-junction-review-20261103';p=Path('/workspace/scratch/058760c451a1/hoian-player-w54/assets/henk-return-w54.mp4')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='e802da59e406706acd71e03a8319b104a67a147698f5da7eb0a1215a5ac47cda'
contact=Image.new('RGB',(1280,720),'#151918');d=ImageDraw.Draw(contact);frames=[]
for i,t in enumerate([0,2,4]):
 dest=r/f'return-leadin-{t}.png';result=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-y',str(dest)],capture_output=True,text=True,check=True)
 if result.stderr.strip():raise RuntimeError(result.stderr)
 im=Image.open(dest).convert('RGB');im.thumbnail((640,320));contact.paste(im,(i%2*640,i//2*360+20));d.text((i%2*640+4,i//2*360+4),f'Exact return local{t}s; currently outside offered route',fill='white');frames.append({'file':dest.name,'requested_local_seconds':t,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
im=Image.open(src/'bridge-local-0.png').convert('RGB');im.thumbnail((640,320));contact.paste(im,(640,380));d.text((644,364),'Main review local0s; inherited HLS1102',fill='white');contact.save(r/'return-leadin-contact.jpg',quality=94)
(r/'return-leadin.json').write_text(json.dumps({'return_media_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'frames':frames,'runtime_changed':False,'new_spatial_connection_verified':False},indent=2)+'\n')
print(json.dumps({'frames':len(frames),'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest()}))
