from pathlib import Path
from PIL import Image,ImageDraw
import ast,json,numpy as np,hashlib
r=Path(__file__).parent;prior=r.parent/'hoian-direction-review-20261103'
tree=ast.parse((prior/'check_direction.py').read_text());nodes=[]
for node in tree.body:
 if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='sources' for t in node.targets):break
 nodes.append(node)
ns={'__file__':str(prior/'check_direction.py')};exec(compile(ast.Module(body=nodes,type_ignores=[]),'check_direction.py','exec'),ns)
main=ns['main'];ret=ns['ret'];frame=ns['frame'];project=ns['project'];patches=ns['patches'];table_yaw=ns['table_yaw']
early=Path('/workspace/scratch/a7d4ca2c1f7e/hoian-junction-review-20261103/recovered-main-1058-1102.mp4');bridge=Path('/workspace/scratch/058760c451a1/hoian-network-w50/bridge-area-capture-w50.mp4');returnclip=Path('/workspace/scratch/058760c451a1/hoian-player-w54/assets/henk-return-w54.mp4')
cases=[(f'main-{t}',early if t<1102 else bridge,t-1058 if t<1102 else t-1102,main,t) for t in [1070,1080,1090,1110,1120,1130,1140,1150,1160,1170,1180,1190]]+[(f'return-{t}',returnclip,t,ret,t) for t in [10,15,20,25,30]]
report={'scope':'Sparse offline heading-sign triage at new captured intervals, not full-route or player/device acceptance','candidate':'w73','runtime_changed':False,'sources':{},'cases':[],'delivery_approved':False,'iphone_checked':False}
for p in [early,bridge,returnclip]:report['sources'][p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
sheets=[]
for start in range(0,len(cases),6):sheets.append(Image.new('RGB',(1024,6*372),'#151b18'))
for i,(name,path,t,tab,tabletime) in enumerate(cases):
 raw=[frame(path,t),frame(path,t+.2)];yaw=table_yaw(tab,tabletime);case={'name':name,'source':path.name,'local_requested_seconds':[t,t+.2],'inherited_main_global_time':tabletime if name.startswith('main') else None,'initial_yaw':float(yaw),'views':[]}
 for side,offset in enumerate([0,np.pi]):
  pics=[project(im,yaw+offset) for im in raw];tracks=patches(*pics);left=[p['delta'][0] for p in tracks if p['xy'][0]<256];right=[p['delta'][0] for p in tracks if p['xy'][0]>=256];ml=float(np.median(left)) if left else None;mr=float(np.median(right)) if right else None;delta=mr-ml if ml is not None and mr is not None else None
  case['views'].append({'offset_radians':float(offset),'left_count':len(left),'right_count':len(right),'median_dx_left':ml,'median_dx_right':mr,'right_minus_left':delta,'tracks':tracks});sheet=sheets[i//6];sheet.paste(Image.fromarray(pics[0]),(side*512,(i%6)*372+30));ImageDraw.Draw(sheet).text((side*512+5,(i%6)*372+5),name+(' estimated-forward' if side==0 else '180deg-opposed'),fill='white')
 a,b=case['views'];sufficient=min(a['left_count'],a['right_count'],b['left_count'],b['right_count'])>=8
 case['triage']='direction_sign_consistent_sample' if sufficient and a['right_minus_left']>=1 and b['right_minus_left']<=-1 else 'needs_picture_review'
 report['cases'].append(case);print(json.dumps({'case':name,'triage':case['triage'],'delta':[a['right_minus_left'],b['right_minus_left']],'counts':[[v['left_count'],v['right_count']] for v in case['views']]}),flush=True)
for i,im in enumerate(sheets):im.save(r/f'span-contact-{i+1}.jpg',quality=92)
report['criteria']='At least8 retained NCC tracks in each side of each view; median right-minus-left >=1px forward and <=-1px opposed. Heuristic triage only; failure means inspect, not proven heading defect.'
(r/'span-flow-report.json').write_text(json.dumps(report,indent=2)+'\n')
summary={'total_new_short_spans':len(cases),'consistent_sample_count':sum(c['triage']=='direction_sign_consistent_sample' for c in report['cases']),'needs_picture_review':[c['name'] for c in report['cases'] if c['triage']!='direction_sign_consistent_sample'],'no_full_route_pass':True,'runtime_changed':False};(r/'span-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
