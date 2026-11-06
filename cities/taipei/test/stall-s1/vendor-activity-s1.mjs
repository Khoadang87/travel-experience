// Vendor activity is driven by elapsed simulation time, never joystick magnitude.
// Renderer adapters must map these states to authored character animation clips.
export class VendorActivity {
  constructor(){this.time=0;this.phase=0;this.near=false;this.lastGreeting=-Infinity;this.greetingUntil=-Infinity;}
  update(dt,{distance=Infinity,visible=true}={}){
    if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid elapsed time');
    // Resume after a hidden tab without leaping through seconds of animation.
    const step=visible?Math.min(dt,0.1):0;
    this.time+=step;this.phase=(this.phase+step)%12;
    const approaching=Number.isFinite(distance)&&distance<2.8;
    if(approaching&&!this.near&&this.time-this.lastGreeting>=15){
      this.lastGreeting=this.time;this.greetingUntil=this.time+1.6;
    }
    this.near=approaching;
    const greeting=this.time<this.greetingUntil;
    return {activity:greeting?'acknowledge':this.phase<7?'prepare':'serve',
      activityTime:greeting?this.time-this.lastGreeting:this.phase<7?this.phase:this.phase-7,
      simulationTime:this.time,lookAtVisitor:approaching};
  }
}
