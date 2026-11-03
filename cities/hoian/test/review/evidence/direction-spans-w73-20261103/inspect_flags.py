from pathlib import Path
import ast,json,numpy as np
from PIL import Image,ImageDraw
r=Path(__file__).parent;prior=r.parent/'hoian-direction-review-20261103';tree=ast.parse((prior/'check_direction.py').read_text());nodes=[]
for n in tree.body:
 if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='sources' for t in n.targets):break
 nodes.append(n)
ns={'__file__':str(prior/'check_direction.py')};exec(compile(ast.Module(body=nodes,type_ignores=[]),'defs','exec'),ns)
j=json.loads((r/'span-flow-report.json').read_text());flag=[c for c in j['cases'] if c['triage']=='needs_picture_review'];out=Image.new('RGB',(1536,4*372),'#151b18');draw=ImageDraw.Draw(out);bridge=Path('/workspace/scratch/058760c451a1/hoian-network-w50/bridge-area-capture-w50.mp4')
for row,c in enumerate(flag):
 t=c['local_requested_seconds'][0];yaw=c['initial_yaw'];h2=ns['table_yaw'](ns['main'],c['inherited_main_global_time']+.2);c['table_heading_change_over_pair_degrees']=float(np.degrees(np.arctan2(np.sin(h2-yaw),np.cos(h2-yaw))))
 for col,(dt,offset) in enumerate([(0,0),(.2,0),(0,np.pi)]):
  pic=ns['project'](ns['frame'](bridge,t+dt),yaw+offset);out.paste(Image.fromarray(pic),(col*512,row*372+30));draw.text((col*512+5,row*372+5),c['name']+f' local{t+dt:g}s'+(' opposed' if offset else ' estimated-front'),fill='white')
out.save(r/'flagged-spans-contact.jpg',quality=93);(r/'span-flow-report.json').write_text(json.dumps(j,indent=2)+'\n');print(json.dumps([{'name':c['name'],'heading_change':c['table_heading_change_over_pair_degrees']} for c in flag]))
