from pathlib import Path
import subprocess,json,hashlib
from PIL import Image,ImageDraw
r=Path(__file__).parent
sources={'bridge':Path('/workspace/scratch/058760c451a1/hoian-network-w50/bridge-area-capture-w50.mp4'),'return':Path('/workspace/scratch/058760c451a1/hoian-player-w54/assets/henk-return-w54.mp4')}
selection=[('bridge',0,1102),('bridge',2,1104),('bridge',4,1106),('return',5,None)]
report={'scope':'Source-picture analysis only; inherited main timeline labels, not rendered player approval','sources':{},'frames':[]}
contact=Image.new('RGB',(2560,1320),'#151918');d=ImageDraw.Draw(contact)
for k,p in sources.items():report['sources'][k]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
for i,(k,t,nominal) in enumerate(selection):
 p=r/f'{k}-local-{t:g}.png'
 result=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(sources[k]),'-frames:v','1','-y',str(p)],capture_output=True,text=True,check=True)
 if result.stderr.strip() or not p.exists():raise RuntimeError(result.stderr)
 im=Image.open(p).convert('RGB');jpg=p.with_suffix('.jpg');im.save(jpg,quality=94)
 report['frames'].append({'image':jpg.name,'local_requested_seconds':t,'inherited_nominal_main_seconds':nominal,'decoded_png_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'jpeg_sha256':hashlib.sha256(jpg.read_bytes()).hexdigest(),'jpeg_changes':'JPEG compression only; original full panorama dimensions retained'})
 im.thumbnail((1280,640));x=i%2*1280;y=i//2*660;contact.paste(im,(x,y+20));d.text((x+8,y+4),f'{k} local{t}s'+(f'; inherited nominal HLS{nominal}s' if nominal else ''),fill='white')
contact.save(r/'bridge-junction-contact.jpg',quality=93)
(r/'bridge-frames.json').write_text(json.dumps(report,indent=2)+'\n')
