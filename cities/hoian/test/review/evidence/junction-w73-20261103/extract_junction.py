from pathlib import Path
import subprocess,json,hashlib
from PIL import Image,ImageDraw
root=Path(__file__).parent
sources={'main':root/'recovered-main-1058-1102.mp4','return':Path('/workspace/scratch/058760c451a1/hoian-player-w54/assets/henk-return-w54.mp4')}
selection=[('main',8.2,1066.2),('main',11,1069),('main',14,1072),('return',31,None),('return',33,None),('return',35,None)]
report={'sources':{},'frames':[],'spatial_alignment_verified':False,'delivery_approved':False}
for k,p in sources.items():report['sources'][k]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'media':json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=width,height,r_frame_rate,start_time','-of','json',str(p)])),'nominal_timeline_origin_inherited':1058 if k=='main' else 0,'timeline_mapping_reverified':False if k=='main' else True}
contact=Image.new('RGB',(1920,720),(24,28,27));draw=ImageDraw.Draw(contact)
for i,(kind,t,nominal) in enumerate(selection):
 name=f'{kind}-local-{t:g}.png';p=root/name
 result=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(sources[kind]),'-frames:v','1','-y',str(p)],capture_output=True,text=True,check=True)
 if result.stderr.strip() or not p.exists():raise RuntimeError('Decode extraction error: '+result.stderr)
 img=Image.open(p).convert('RGB');img.thumbnail((640,320));x=i%3*640;y=i//3*360;contact.paste(img,(x,y+30));label=f'{kind} local {t:g}s'+(f' / inherited nominal main {nominal:g}s' if nominal else '')
 draw.text((x+8,y+8),label,fill='white');report['frames'].append({'file':name,'local_time_requested':t,'main_timeline_nominal':nominal,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':Image.open(p).width,'height':Image.open(p).height})
contact.save(root/'assembly-junction-contact.jpg',quality=93)
(root/'frames.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'sources':{k:v['sha256'] for k,v in report['sources'].items()},'frames':len(report['frames'])}))
