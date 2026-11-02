from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json,hashlib
r=Path(__file__).parent
base='https://pub-ea3274d70651434b8581144229d8b102.r2.dev/hoian/hls13/main/j4/f2560/'
names=['init.mp4']+['s%03d.m4s'%i for i in range(50,75)]
def get(name):
 p=r/name
 if not p.exists():subprocess.run(['curl','--fail','--silent','--show-error','--max-time','30','--max-filesize','10000000','-o',str(p)+'.pending',base+name],check=True);Path(str(p)+'.pending').replace(p)
 return p
with ThreadPoolExecutor(max_workers=4) as pool:parts=list(pool.map(get,names))
output=r/'bridge-area-capture-w50.mp4'
with output.open('wb') as out:
 for p in parts:out.write(p.read_bytes())
with (r/'decode.log').open('w') as log:
 result=subprocess.run(['ffmpeg','-v','error','-i',str(output),'-map','0:v:0','-f','null','-'],stdout=log,stderr=log,timeout=180)
report={'source':base,'first_segment_start':1102,'last_segment_end':1202,'single_initialization_segment':True,'segments':names,'full_decode_exit':result.returncode,'artifact_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'geographic_branches_verified':False,'interactive_player_accepted':False}
(r/'capture-decode-review-w50.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:report[k] for k in ['full_decode_exit','first_segment_start','last_segment_end']}))
