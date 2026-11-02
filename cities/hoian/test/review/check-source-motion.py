"""Internal two-view camera-motion investigation from actual captured panoramas.
Not browser QA, geolocation proof, real-device acceptance or captured return travel.
"""
import cv2,hashlib,json,math
import numpy as np
from pathlib import Path

ROOT=Path(__file__).parent
W,H=768,512
F=H/(2*math.tan(math.radians(70)/2))
K=np.array([[F,0,W/2],[0,F,H/2],[0,0,1]],dtype=float)

def project(pano,u):
 y,x=np.mgrid[0:H,0:W].astype(np.float32)
 vx=(x-W/2)/F;vy=-(y-H/2)/F;vz=np.ones_like(x)
 a=2*np.pi*u;xx=vz*np.cos(a)-vx*np.sin(a);zz=vz*np.sin(a)+vx*np.cos(a)
 mx=((np.arctan2(zz,xx)/(2*np.pi))%1*pano.shape[1]).astype(np.float32)
 my=((.5-np.arcsin(vy/np.sqrt(vx*vx+vy*vy+1))/np.pi)*pano.shape[0]).astype(np.float32)
 return cv2.remap(pano,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_WRAP)

def estimate(a,b,mask):
 sift=cv2.SIFT_create(nfeatures=3500)
 ka,da=sift.detectAndCompute(a,mask);kb,db=sift.detectAndCompute(b,mask)
 if da is None or db is None:return {'usable':False,'reason':'No feature descriptors'}
 pairs=cv2.BFMatcher().knnMatch(da,db,k=2)
 good=[m for pair in pairs if len(pair)==2 for m,n in [pair] if m.distance<.72*n.distance]
 if len(good)<12:return {'usable':False,'matches':len(good)}
 pa=np.float32([ka[m.queryIdx].pt for m in good]);pb=np.float32([kb[m.trainIdx].pt for m in good])
 E,inliers=cv2.findEssentialMat(pa,pb,K,method=cv2.RANSAC,prob=.999,threshold=1)
 if E is None:return {'usable':False,'matches':len(good),'reason':'No essential matrix'}
 n,R,t,posemask=cv2.recoverPose(E[:3],pa,pb,K,mask=inliers.copy())
 rotation=math.degrees(math.acos(float(np.clip((np.trace(R)-1)/2,-1,1))))
 displacement=float(np.median(np.linalg.norm(pb-pa,axis=1)))
 usable=bool(n>=25 and n/len(good)>.35 and displacement>1 and rotation<15)
 return {'usable':usable,'matches':len(good),'essential_inliers':int(inliers.sum()),'cheirality_inliers':n,'median_pixel_displacement':round(displacement,3),'rotation_degrees':round(rotation,3),'translation_camera2_from_camera1':t.ravel().tolist(),'interpretation':'t_z positive suggests camera moved away from this view; negative suggests toward. Direction is relative, no metric scale.'}

def frame(cap,seconds):
 cap.set(cv2.CAP_PROP_POS_FRAMES,round(seconds*cap.get(cv2.CAP_PROP_FPS)))
 ok,p=cap.read()
 if not ok:raise ValueError('Requested source frame did not decode')
 return p

if __name__=='__main__':
 source=ROOT/'probe-1104.mp4';cap=cv2.VideoCapture(str(source))
 origin=next(item['segment_start'] for item in json.loads((ROOT/'phone-location-candidates-1100.json').read_text()) if item['position']==1104)
 frames={t:frame(cap,t) for t in [.2,1.2,2.2]};cap.release()
 mask=np.zeros((H,W),dtype=np.uint8)
 # Upper facade strips exclude most street-level pedestrians; trees and signs
 # can still move. Robust geometry and repeated temporal pairs are mandatory.
 mask[100:305,:300]=255;mask[100:305,468:]=255
 views={'estimated_forward':.5,'phone_street_candidate':.05};results=[];tiles=[]
 for label,u in views.items():
  projected={t:project(p,u) for t,p in frames.items()}
  for a,b in [(.2,1.2),(1.2,2.2),(.2,2.2)]:results.append({'view':label,'u':u,'forward_timeline':[origin+a,origin+b],**estimate(projected[a],projected[b],mask)})
  row=[]
  for t in [.2,2.2]:
   p=projected[t].copy();cv2.putText(p,label+' t='+str(origin+t),(12,30),cv2.FONT_HERSHEY_SIMPLEX,.6,(0,0,255),2);row.append(p)
  tiles.append(np.hstack(row))
 cv2.imwrite(str(ROOT/'source-motion-contact.jpg'),np.vstack(tiles))
 report={'actual_segment_start':origin,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'method':'calibrated perspective reprojection, masked SIFT, essential-matrix RANSAC and cheirality','results':results,'independent_advisor_approved':False,'iphone_accepted':False,'limits':['Moving people and foliage can contaminate motion estimates','No camera translation magnitude or geographic route continuity is established','Exact phone timestamp and view yaw are not recovered','This provides no newly captured backward or sideways route']}
 (ROOT/'source-motion-review-v2.json').write_text(json.dumps(report,indent=2));print(json.dumps(results,indent=2))
