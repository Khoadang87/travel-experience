from pathlib import Path
import cv2,numpy as np,json,hashlib
r=Path(__file__).parent;src=r.parent/'hoian-junction-review-20261103'
sift=cv2.SIFT_create(nfeatures=14000)
# Static architecture masks only; exclude foreground pedestrians and nadir.
regions={'main-local-8.2.png':[(.77,.18,.98,.56),(.29,.18,.48,.57)],'return-local-35.png':[(.28,.18,.48,.56),(.72,.16,.97,.57)],'bridge-local-0.png':[(.66,.13,.91,.57),(.16,.21,.34,.57)],'return-local-5.png':[(.13,.13,.35,.57),(.65,.20,.91,.57)]}
data={}
for name,boxes in regions.items():
 im=cv2.imread(str(src/name));h,w=im.shape[:2];mask=np.zeros((h,w),np.uint8)
 for x1,y1,x2,y2 in boxes:mask[int(y1*h):int(y2*h),int(x1*w):int(x2*w)]=255
 kp,desc=sift.detectAndCompute(cv2.cvtColor(im,cv2.COLOR_BGR2GRAY),mask);data[name]=(im,kp,desc)
report={'scope':'Masked static-architecture correspondences only; no runtime alignment or independent approval','source_frame_sha256':{n:hashlib.sha256((src/n).read_bytes()).hexdigest() for n in regions},'masks_normalized':regions,'pairs':[],'delivery_approved':False}
for a,b in [('main-local-8.2.png','return-local-35.png'),('bridge-local-0.png','return-local-5.png')]:
 ia,ka,da=data[a];ib,kb,db=data[b];raw=cv2.BFMatcher().knnMatch(da,db,k=2);good=[m for m,n in raw if m.distance<.7*n.distance]
 # Enforce bidirectional nearest match before geometric consistency.
 reverse={m.queryIdx:m.trainIdx for m,n in cv2.BFMatcher().knnMatch(db,da,k=2) if m.distance<.7*n.distance}
 good=[m for m in good if reverse.get(m.trainIdx)==m.queryIdx]
 ptsa=np.float32([ka[m.queryIdx].pt for m in good]);ptsb=np.float32([kb[m.trainIdx].pt for m in good])
 H,inliers=cv2.findHomography(ptsa,ptsb,cv2.RANSAC,4.0) if len(good)>=4 else (None,None)
 indices=np.where(inliers.ravel()>0)[0].tolist() if inliers is not None else []
 record={'a':a,'b':b,'ratio_threshold':.7,'mutual_matches':len(good),'homography_inliers':len(indices),'homography_scope':'planar image correspondence only; equirectangular distortion/parallax prevent interpreting as a camera rotation or physical join','matches':[{'a_xy':ptsa[i].tolist(),'b_xy':ptsb[i].tolist(),'homography_inlier':i in indices,'descriptor_distance':float(good[i].distance)} for i in range(len(good))]}
 report['pairs'].append(record)
 vis=cv2.drawMatches(ia,ka,ib,kb,good,None,matchesMask=[int(i in indices) for i in range(len(good))],flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS);scale=min(1,1920/vis.shape[1]);vis=cv2.resize(vis,None,fx=scale,fy=scale);name=a.replace('.png','')+'--'+b.replace('.png','')+'.jpg';cv2.imwrite(str(r/name),vis,[cv2.IMWRITE_JPEG_QUALITY,93]);record['comparison_image']=name
(r/'static-matches.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps([{k:v for k,v in p.items() if k!='matches'} for p in report['pairs']]))
