from PIL import Image,ImageDraw
from pathlib import Path
import json,hashlib
r=Path(__file__).parent;specs=[('corner-details.jpg',340,[('main-river-local-19.png',(1800,230,2560,1000)),('other-river-local-0.png',(0,230,760,1000))]),('balcony-details.jpg',480,[('main-river-local-0.png',(240,260,1300,1000)),('other-river-local-11.png',(0,260,850,1000))])];meta=[]
for name,width,parts in specs:
 out=Image.new('RGB',(width*2,370),'#181d1b');d=ImageDraw.Draw(out)
 for i,(n,box) in enumerate(parts):
  im=Image.open(r/n).crop(box);im.thumbnail((width-10,330));out.paste(im,(i*width+5,30));d.text((i*width+5,6),n,fill='white');meta.append({'image':name,'source':n,'native_pixel_crop':box,'alterations':'Crop and proportional downscale only; no reconstruction'})
 out.save(r/name,quality=94)
(r/'crop-provenance.json').write_text(json.dumps(meta,indent=2)+'\n')
images=['riverside-contact.jpg','corner-details.jpg','balcony-details.jpg'];p=r/'source-review.json';j=json.loads(p.read_text());j['evidence_images']=[{'file':n,'bytes':(r/n).stat().st_size,'sha256':hashlib.sha256((r/n).read_bytes()).hexdigest(),'git_blob_sha1':hashlib.sha1(('blob '+str((r/n).stat().st_size)+'\0').encode()+(r/n).read_bytes()).hexdigest()} for n in images];p.write_text(json.dumps(j,indent=2)+'\n');print(json.dumps(j['evidence_images']))
