from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,json,hashlib
r=Path(__file__).parent;source=Path('/workspace/scratch/058760c451a1/hoian-multiclip')
report={'scope':'Actual retained source coverage analysis; not a player test','sources':{},'frames':[],'runtime_changed':False,'delivery_approved':False}
contact=Image.new('RGB',(1920,720),'#171c1a');d=ImageDraw.Draw(contact)
for row,(name,times) in enumerate([('main-river.mp4',[0,9,19]),('other-river.mp4',[0,11,23])]):
 p=source/name;probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=start_time,duration,size:stream=width,height,codec_name,r_frame_rate','-of','json',str(p)]));dec=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],capture_output=True,text=True,check=True)
 if dec.stderr.strip():raise RuntimeError(dec.stderr)
 report['sources'][name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'probe':probe,'full_decode_exit':dec.returncode,'full_decode_stderr':dec.stderr}
 for col,t in enumerate(times):
  out=r/(p.stem+f'-local-{t}.png');res=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-y',str(out)],capture_output=True,text=True,check=True)
  if res.stderr.strip() or not out.exists():raise RuntimeError(res.stderr)
  im=Image.open(out).convert('RGB');im.thumbnail((640,320));contact.paste(im,(col*640,row*360+30));d.text((col*640+6,row*360+6),name+f' local{t}s',fill='white');report['frames'].append({'source':name,'requested_local_seconds':t,'file':out.name,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()})
contact.save(r/'riverside-contact.jpg',quality=93);report['contact_sha256']=hashlib.sha256((r/'riverside-contact.jpg').read_bytes()).hexdigest();(r/'source-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['sources']))
