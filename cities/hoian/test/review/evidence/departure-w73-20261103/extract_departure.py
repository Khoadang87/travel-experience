"""Reproduce source-picture selection; never inserts media into the player."""
from pathlib import Path
import subprocess,hashlib
from PIL import Image,ImageDraw
r=Path(__file__).parent;p=Path('/workspace/scratch/058760c451a1/hoian-source-review/henk-bridge-departure-562.mp4')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='6c59480a6fc1843457314fbe1977eef0bc8549e33502e82fb0f3853dba2fee5a'
res=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],capture_output=True,text=True,check=True)
if res.stderr.strip():raise RuntimeError(res.stderr)
o=Image.new('RGB',(1920,360),'#151b18');d=ImageDraw.Draw(o)
for i,t in enumerate([0,7,14]):
 dest=r/f'departure-local-{t}.png';a=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-y',str(dest)],capture_output=True,text=True,check=True)
 if a.stderr.strip():raise RuntimeError(a.stderr)
 im=Image.open(dest).convert('RGB');im.thumbnail((640,320));o.paste(im,(i*640,30));d.text((i*640+5,7),f'Existing Henk departure local{t}s',fill='white')
o.save(r/'departure-contact.jpg',quality=94)
