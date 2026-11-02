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
    this.source=document.createElement('canvas');this.source.width=2048;this.source.height=1024;
    this.sourceCtx=this.source.getContext('2d',{willReadFrequently:true});
    this.costs=[];this.lastLog=0;this.rays=null;this.lastPicture=null;
    this.nadir=nadir;this.mode='software-video-projection';this.last=0;
  }
  setPixelRatio() {} // Deliberately bounded CPU workload, not a full-HD claim.
  setSize(width,height) {
    const scale=Math.min(1,960/width,960/height);
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
    const decoded=video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
    const picture=[video,video.currentTime,video.videoWidth,video.videoHeight,decoded,q0.x,q0.y,q0.z,q0.w,camera.fov,camera.aspect,this.width,this.height];
    if(this.lastPicture && picture.every((value,index)=>value===this.lastPicture[index]))return;
    this.last=now;
    try {this.sourceCtx.drawImage(video,0,0,2048,1024);} catch{return;}
    let data;try {data=this.sourceCtx.getImageData(0,0,2048,1024).data;}catch{return;}
    const q=camera.quaternion, x=q.x,y=q.y,z=q.z,w=q.w;
    const m00=1-2*(y*y+z*z),m01=2*(x*y-z*w),m02=2*(x*z+y*w);
    const m10=2*(x*y+z*w),m11=1-2*(x*x+z*z),m12=2*(y*z-x*w);
    const m20=2*(x*z-y*w),m21=2*(y*z+x*w),m22=1-2*(x*x+y*y);
    const tan=Math.tan(camera.fov*Math.PI/360), out=this.pixels.data;
    const rayKey=[this.width,this.height,camera.fov,camera.aspect].join(':');
    if(this.rayKey!==rayKey) {
      this.rayKey=rayKey;this.rays=new Float32Array(this.width*this.height*3);
      for(let row=0;row<this.height;row++)for(let col=0;col<this.width;col++) {
        const rx=(2*(col+.5)/this.width-1)*tan*camera.aspect,ry=(1-2*(row+.5)/this.height)*tan;
        const inv=1/Math.hypot(rx,ry,1),i=(row*this.width+col)*3;
        this.rays[i]=rx*inv;this.rays[i+1]=ry*inv;this.rays[i+2]=-inv;
      }
    }
    const ground=[0,0,0];for(let i=0;i<2048;i+=32){const index=(800*2048+i)*4;for(let c=0;c<3;c++)ground[c]+=data[index+c]/64;}
    for(let pixel=0;pixel<this.width*this.height;pixel++) {
      const j=pixel*3,rx=this.rays[j],ry=this.rays[j+1],rz=this.rays[j+2];
      const dx=m00*rx+m01*ry+m02*rz,dy=m10*rx+m11*ry+m12*rz,dz=m20*rx+m21*ry+m22*rz;
      const u=((Math.atan2(dz,dx)/(2*Math.PI))%1+1)%1,v=.5-Math.asin(Math.max(-1,Math.min(1,dy)))/Math.PI;
      const fx=u*2048-.5,fy=Math.max(0,Math.min(1023,v*1024-.5));
      const left=Math.floor(fx),top=Math.floor(fy),a=fx-left,b=fy-top;
      const x0=(left+2048)%2048,x1=(x0+1)%2048,y1=Math.min(1023,top+1);
      const i00=(top*2048+x0)*4,i10=(top*2048+x1)*4,i01=(y1*2048+x0)*4,i11=(y1*2048+x1)*4,index=pixel*4;
      const radius=dy<0?45*Math.hypot(dx,dz)/(-dy):Infinity;
      const alpha=this.nadir?Math.max(0,Math.min(1,(36-radius)/(36*.38))):0;
      for(let c=0;c<3;c++) {
        const color=(data[i00+c]*(1-a)+data[i10+c]*a)*(1-b)+(data[i01+c]*(1-a)+data[i11+c]*a)*b;
        out[index+c]=color*(1-alpha)+ground[c]*alpha;
      }
      out[index+3]=255;
    }
    this.ctx.putImageData(this.pixels,0,0);this.lastPicture=picture;
    this.costs.push(performance.now()-now);if(this.costs.length>30)this.costs.shift();
    if(this.costs.length>=10 && performance.now()-this.lastLog>2000) {
      this.lastLog=performance.now();const sorted=[...this.costs].sort((a,b)=>a-b);
      console.info('Hoian software picture',JSON.stringify({version:'w64',width:this.width,height:this.height,
        sourceWidth:2048,renderSamples:this.costs.length,medianRenderMs:sorted[Math.floor(sorted.length/2)],
        maxRenderMs:sorted.at(-1)}));
    }
  }
}
