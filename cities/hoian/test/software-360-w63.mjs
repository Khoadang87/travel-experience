// CPU sampling of actual equirectangular video. No generated scenery or depth.
export function panoramaUV(x,y,z) {
  const length=Math.hypot(x,y,z);
  return [((Math.atan2(z,x)/(2*Math.PI))%1+1)%1, .5-Math.asin(Math.max(-1,Math.min(1,y/length)))/Math.PI];
}
export class Software360Renderer {
  constructor({nadir=true}={}) {
    this.domElement=document.createElement('canvas');
    this.ctx=this.domElement.getContext('2d',{alpha:false});
    if(!this.ctx)throw Error('No picture renderer available');
    this.source=document.createElement('canvas');this.source.width=1024;this.source.height=512;
    this.sourceCtx=this.source.getContext('2d',{willReadFrequently:true});
    this.lastPicture=null;
    this.nadir=nadir;this.mode='software-video-projection';this.last=0;
  }
  setPixelRatio() {} // Deliberately bounded CPU workload, not a full-HD claim.
  setSize(width,height) {
    const scale=Math.min(1,640/width,640/height);
    this.width=this.domElement.width=Math.round(width*scale);
    this.height=this.domElement.height=Math.round(height*scale);
    this.domElement.style.width=width+'px';this.domElement.style.height=height+'px';
    this.pixels=this.ctx.createImageData(this.width,this.height);this.last=0;this.lastPicture=null;
  }
  setAnimationLoop(callback) {
    const frame=()=>{callback();this.frameId=requestAnimationFrame(frame);};
    this.frameId=requestAnimationFrame(frame);
  }
  render(scene,camera) {
    const now=performance.now();if(now-this.last<100)return;
    const video=scene.children.find(mesh=>mesh.material?.map?.isVideoTexture)?.material.map.image;
    if(!video||video.readyState<2||video.seeking)return;
    // Keep processing controls every animation tick, but reuse the already
    // projected picture while the decoded frame and view remain unchanged.
    // This avoids repeatedly sampling a paused frame and competing with input.
    const q0=camera.quaternion;
    const picture=[video,video.currentTime,q0.x,q0.y,q0.z,q0.w,camera.fov,camera.aspect,this.width,this.height];
    if(this.lastPicture && picture.every((value,index)=>value===this.lastPicture[index]))return;
    this.last=now;
    try {this.sourceCtx.drawImage(video,0,0,1024,512);} catch{return;}
    let data;try {data=this.sourceCtx.getImageData(0,0,1024,512).data;}catch{return;}
    const q=camera.quaternion, x=q.x,y=q.y,z=q.z,w=q.w;
    const m00=1-2*(y*y+z*z),m01=2*(x*y-z*w),m02=2*(x*z+y*w);
    const m10=2*(x*y+z*w),m11=1-2*(x*x+z*z),m12=2*(y*z-x*w);
    const m20=2*(x*z-y*w),m21=2*(y*z+x*w),m22=1-2*(x*x+y*y);
    const tan=Math.tan(camera.fov*Math.PI/360), out=this.pixels.data;
    const ground=[0,0,0];for(let i=0;i<1024;i+=16){const index=(400*1024+i)*4;for(let c=0;c<3;c++)ground[c]+=data[index+c]/64;}
    for(let row=0;row<this.height;row++) {
      const ry=(1-2*(row+.5)/this.height)*tan;
      for(let col=0;col<this.width;col++) {
        const rx=(2*(col+.5)/this.width-1)*tan*camera.aspect;
        const dx=m00*rx+m01*ry-m02,dy=m10*rx+m11*ry-m12,dz=m20*rx+m21*ry-m22;
        const uv=panoramaUV(dx,dy,dz), sx=Math.floor(uv[0]*1024)%1024,sy=Math.max(0,Math.min(511,Math.floor(uv[1]*512)));
        const source=(sy*1024+sx)*4,index=(row*this.width+col)*4;
        // Equivalent purpose to the existing soft nadir disc: camera masking.
        const radius=dy<0?45*Math.hypot(dx,dz)/(-dy):Infinity;
        const alpha=this.nadir?Math.max(0,Math.min(1,(36-radius)/(36*.38))):0;
        for(let c=0;c<3;c++)out[index+c]=data[source+c]*(1-alpha)+ground[c]*alpha;
        out[index+3]=255;
      }
    }
    this.ctx.putImageData(this.pixels,0,0);this.lastPicture=picture;
  }
}
