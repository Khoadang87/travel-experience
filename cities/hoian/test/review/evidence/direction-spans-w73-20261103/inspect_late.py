from pathlib import Path
from PIL import Image,ImageDraw
import ast,json,numpy as np
r=Path(__file__).parent;prior=r.parent/'hoian-direction-review-20261103';tree=ast.parse((prior/'check_direction.py').read_text());nodes=[]
for n in tree.body:
 if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='sources' for t in n.targets):break
 nodes.append(n)
ns={'__file__':str(prior/'check_direction.py')};exec(compile(ast.Module(body=nodes,type_ignores=[]),'defs','exec'),ns);p=Path('/workspace/scratch/058760c451a1/hoian-network-w50/bridge-area-capture-w50.mp4');out=Image.new('RGB',(1536,744),'#151b18');d=ImageDraw.Draw(out);samples=[]
for i,t in enumerate([86,88,90,92,94,96]):
 gt=1102+t;yaw=ns['table_yaw'](ns['main'],gt);pic=ns['project'](ns['frame'](p,t),yaw);out.paste(Image.fromarray(pic),(i%3*512,i//3*372+30));d.text((i%3*512+5,i//3*372+5),f'Local{t}s; inherited main{gt}; table-facing view',fill='white');samples.append({'local_seconds':t,'inherited_main_seconds':gt,'view_yaw':float(yaw)})
out.save(r/'late-heading-contact.jpg',quality=93);(r/'late-heading-samples.json').write_text(json.dumps({'samples':samples,'scope':'Offline source-pixel table-heading views; not exact player or independent motion proof'},indent=2)+'\n')
