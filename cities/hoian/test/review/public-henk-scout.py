"""Inspect short public-source frames; no login, new account or paid access.
Signed public playback URLs stay in memory/private source HTML, never reports.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,os,re,json,sys,cv2

r=Path(__file__).parent
page=r/'henk-deovr-page.html'
s=page.read_text()
assert 'isPremium:!1' in s and 'visibility:"public"' in s
url=re.search(r'name:"h265",videoSources:.*?height:1080.*?url:"([^"]+)"',s)[1]
times=list(map(int,sys.argv[1:])) or [0,90,300,420,700,900,1050,1450]
assert len(times)<=30 and all(0<=t<1768 for t in times)
def get(t):
 output=r/f'henk-scout-{t}.jpg'
 if output.exists():return {'t':t,'ok':True,'cached':True}
 cmd=['ffmpeg','-v','error','-tls_verify','1','-ca_file',os.environ.get('SSL_CERT_FILE','/etc/ssl/certs/ca-certificates.crt')]
 proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
 if proxy:cmd+=['-http_proxy',proxy]
 cmd+=['-ss',str(t),'-i',url,'-frames:v','1','-y',str(output)]
 # Provider errors can include the public signed URL; retain privately only.
 with (r/f'henk-scout-{t}.log').open('w') as log:
  try:p=subprocess.run(cmd,stdout=log,stderr=log,timeout=40)
  except subprocess.TimeoutExpired:return {'t':t,'ok':False,'reason':'timeout'}
 return {'t':t,'ok':p.returncode==0 and output.exists()}
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(get,times))
(r/('henk-scout-batch-'+str(times[0])+'.json')).write_text(json.dumps(results,indent=2))
rows=[]
for item in results:
 if item['ok']:
  f=cv2.imread(str(r/f"henk-scout-{item['t']}.jpg"));f=cv2.resize(f,(720,360));cv2.putText(f,str(item['t']),(15,35),cv2.FONT_HERSHEY_SIMPLEX,1,(0,0,255),2);rows.append(f)
if rows:cv2.imwrite(str(r/('henk-scout-batch-'+str(times[0])+'.jpg')),cv2.vconcat(rows))
print(json.dumps(results))
