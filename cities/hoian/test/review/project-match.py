import cv2,numpy as np,json,math,sys
from pathlib import Path
r=Path(__file__).parent
phone=cv2.imread(str(r/'phone-first.jpg'))[310:665,:]
sift=cv2.SIFT_create(nfeatures=1500);kp,dp=sift.detectAndCompute(phone,None)
w,h=512,824;y,x=np.mgrid[0:h,0:w].astype(np.float32);f=h/(2*np.tan(np.radians(75)/2));vx=(x-w/2)/f;vy=-(y-h/2)/f;vz=np.ones_like(x);norm=np.sqrt(vx*vx+vy*vy+vz*vz)
best=[]
for position in (list(map(int,sys.argv[1:])) or [1096,1110,1136]):
 pano=cv2.imread(str(r/('probe-'+str(position)+'.jpg')))
 for u in np.arange(.025,.201,.025):
  a=2*np.pi*u
  for pitch in [-.1,0,.1,.2]:
   yy=vy*np.cos(pitch)+vz*np.sin(pitch);zz=vz*np.cos(pitch)-vy*np.sin(pitch)
   xx=zz*np.cos(a)-vx*np.sin(a);zz2=zz*np.sin(a)+vx*np.cos(a)
   mx=((np.arctan2(zz2,xx)/(2*np.pi))%1*pano.shape[1]).astype(np.float32);my=((.5-np.arcsin(yy/norm)/np.pi)*pano.shape[0]).astype(np.float32)
   view=cv2.remap(pano,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_WRAP)
   k,d=sift.detectAndCompute(view[146:501,:],None);pairs=cv2.BFMatcher().knnMatch(dp,d,k=2);matches=[m for m,n in pairs if m.distance<.7*n.distance]
   inliers=0
   if len(matches)>=4:
    _,mask=cv2.findHomography(np.float32([kp[m.queryIdx].pt for m in matches]),np.float32([k[m.trainIdx].pt for m in matches]),cv2.RANSAC,3.5)
    inliers=int(mask.sum()) if mask is not None else 0
   result={'position':position,'u':round(float(u),3),'pitch':pitch,'matches':len(matches),'homography_inliers':inliers,'source':'pixel reprojection, not browser or phone acceptance'}
   best.append(result)
   if len(matches)>=4:cv2.imwrite(str(r/('projection-'+str(position)+'-'+str(round(float(u),3))+'-'+str(pitch)+'.jpg')),view)
best.sort(key=lambda q:(q['homography_inliers'],q['matches']),reverse=True);(r/'projection-matches.json').write_text(json.dumps(best[:12],indent=2));print(best[:5])
