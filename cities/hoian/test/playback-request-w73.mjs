// A released or replaced intent cannot fail or cancel a newer request.
export class PlaybackRequest {
  constructor() {this.pending=null;this.generation=0;this.sequence=0;}
  cancel() {this.generation++;this.pending=null;}
  request(video,{isSelected,shouldKeepPlaying,onFailure,onEvent=()=>{}}) {
    if(this.pending)return this.pending.done;
    const ticket={generation:this.generation,id:++this.sequence};this.pending=ticket;
    const current=()=>this.pending===ticket && ticket.generation===this.generation && isSelected();
    onEvent('play-request',{request:ticket.id});
    // Call play synchronously within the user input event, preserving Safari activation.
    let attempt;try{attempt=video.play();}catch(error){attempt=Promise.reject(error);}
    ticket.done=Promise.resolve(attempt).then(()=>{
      onEvent('play-resolved',{request:ticket.id,stale:!current()});
      if(isSelected() && !shouldKeepPlaying())video.pause();
    },error=>{
      const accepted=current();onEvent('play-rejected',{request:ticket.id,stale:!accepted,error:error.name});
      if(accepted)onFailure(error);
    }).finally(()=>{
      if(this.pending===ticket)this.pending=null;
    });
    return ticket.done;
  }
}
