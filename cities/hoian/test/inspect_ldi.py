"""Offline inspection of captured LDI3 pixels; not browser/device acceptance.
Projection/depth equations adapted from Lifecast MIT-licensed Ldi3Mesh.js
and LifecastVideoPlayerShaders11.js, commit 3cecce98ab34747afe7695166944724075638dba.
Copyright 2021-2024 Lifecast Incorporated. See upstream MIT LICENSE.
"""
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).parent
def decode(t):
    data=subprocess.check_output(['ffmpeg','-v','error','-ss',str(t),'-i',str(ROOT/'facepaint-sample.mp4'),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-threads','1','-'])
    return np.frombuffer(data,np.uint8).reshape(1920,1920,3)

def render(frame, position=(0,0,0), width=640, height=480):
    n=640
    u,v=np.meshgrid((np.arange(n)+.5)/n,1-(np.arange(n)+.5)/n)
    a,b=2*(u-.5),2*(v-.5)
    radius=np.sqrt(a*a+b*b)
    r=radius/1.15
    phi=(.5*r+.5*r**3)*np.pi/2
    theta=np.arctan2(b,a)
    rays=np.stack([np.cos(theta)*np.sin(phi),np.sin(theta)*np.sin(phi),-np.cos(phi)],-1)
    points=[]; colors=[]
    for row in range(3):
        depth=frame[row*n:(row+1)*n,n:2*n,0]/255.
        scale=np.clip(.3/np.maximum(depth,.0001),.01,50)
        xyz=rays*scale[:,:,None]-np.array(position)
        mask=(radius<1)&(frame[row*n:(row+1)*n,2*n:3*n,0]>250)&(xyz[:,:,2]<-.01)
        points.append(xyz[mask]); colors.append(frame[row*n:(row+1)*n,:n][mask])
    xyz=np.concatenate(points); rgb=np.concatenate(colors)
    f=height/(2*np.tan(np.deg2rad(70)/2))
    x=np.rint(width/2+f*xyz[:,0]/-xyz[:,2]).astype(int)
    y=np.rint(height/2-f*xyz[:,1]/-xyz[:,2]).astype(int)
    mask=(x>=0)&(x<width)&(y>=0)&(y<height)
    x,y,z,rgb=x[mask],y[mask],-xyz[mask,2],rgb[mask]
    # Far-to-near point raster, no hole filling/inpainting/invented pixels.
    order=np.argsort(-z,kind='stable'); out=np.zeros((height,width,3),np.uint8)
    out[y[order],x[order]]=rgb[order]
    return Image.fromarray(out)

if __name__=='__main__':
    tiles=[]
    for t in [0,2,4]:
        im=render(decode(t));im.save(ROOT/f'ldi-view-{t}.png');tiles.append(im)
    contact=Image.new('RGB',(1920,480))
    for i,im in enumerate(tiles):contact.paste(im,(640*i,0))
    contact.save(ROOT/'ldi-view-contact.png')
