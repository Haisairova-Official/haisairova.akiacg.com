// Fictional game passage only. No payments, accounts, real ETC credentials or
// claims about a road operator's charging rules.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const TOLL_TUNING=Object.freeze({approachSpeed:20/3.6,detectDistance:35,stopLine:-3,manualStopSpeed:.3,entryDwell:2,exitDwell:3,raiseSeconds:.7,lowerSeconds:1,clearance:5,abandonSeconds:2});
export function createTollLane({id,type='etc',direction='entry'}={}){
 const s={id,type,direction,phase:'closed',angle:0,owner:null,elapsed:0,absent:0,passages:0,lastPass:null};
 const owned=a=>a.id===s.owner,eligible=a=>a.direction>.5&&a.front<1&&a.front>=-60&&a.back<1;
 const obstructed=actors=>actors.some(a=>a.front>-.8&&a.back<TOLL_TUNING.clearance&&a.front>-2&&a.height>0);
 const release=()=>{s.owner=null;s.elapsed=0;s.absent=0;};
 function step(dt,actors=[]){dt=clamp(dt,0,.1);const events=[];if(!dt)return events;
  let actor=actors.find(owned);if(s.owner&&!actor){s.absent+=dt;if(s.absent>=TOLL_TUNING.abandonSeconds&&!obstructed(actors)){release();s.phase=s.angle>.001?'lowering':'closed';}}else s.absent=0;
  if(s.owner&&actor?.front< -55&&actor.speed<=.3&&!obstructed(actors)){release();actor=null;s.phase=s.angle>.001?'lowering':'closed';}
  if(s.phase==='closed'){
   const next=actors.filter(eligible).sort((a,b)=>b.front-a.front||String(a.id).localeCompare(String(b.id)))[0];if(next&&next.front>=-TOLL_TUNING.detectDistance){s.owner=next.id;s.phase='processing';s.elapsed=0;actor=next;}
  }
  if(s.phase==='processing'){
   if(actor?.front< -55&&actor.speed<0){release();s.phase='closed';}
   else if(actor){const stopped=Math.abs(actor.speed)<=TOLL_TUNING.manualStopSpeed&&actor.front<=TOLL_TUNING.stopLine+.8&&actor.front>=TOLL_TUNING.stopLine-6;
    if(s.type==='etc'||stopped)s.elapsed+=dt;else s.elapsed=0;
    const dwell=s.type==='etc'?.2:s.direction==='entry'?TOLL_TUNING.entryDwell:TOLL_TUNING.exitDwell;if(s.elapsed>=dwell){s.phase='raising';s.elapsed=0;}
   }
  }
  if(s.phase==='raising'){s.angle=Math.min(Math.PI/2,s.angle+Math.PI/2/TOLL_TUNING.raiseSeconds*dt);if(s.angle>=Math.PI/2-1e-9){s.phase='open';s.angle=Math.PI/2;}}
  if(s.phase==='open'){
   if(actor&&actor.back>TOLL_TUNING.clearance&&actor.direction>.5){s.passages++;s.lastPass={id:actor.id,direction:s.direction};events.push({type:'pass',lane:id,...s.lastPass});release();s.phase='clearing';}
   else if(!s.owner)s.phase='clearing';
  }
  if(s.phase==='clearing'){if(obstructed(actors))s.elapsed=0;else if((s.elapsed+=dt)>=.35){s.phase='lowering';s.elapsed=0;}}
  if(s.phase==='lowering'){
   if(obstructed(actors)){s.phase='raising';}
   else{s.angle=Math.max(0,s.angle-Math.PI/2/TOLL_TUNING.lowerSeconds*dt);if(s.angle<=1e-9){s.angle=0;s.phase='closed';release();}}
  }
  return events;
 }
 return{state:s,step,reset({preserveArm=false}={}){const angle=preserveArm?s.angle:0;Object.assign(s,{phase:angle>0?'clearing':'closed',angle,owner:null,elapsed:0,absent:0,lastPass:null});},speedLimit(actor){if(!eligible(actor)&&!owned(actor))return Infinity;const gap=Math.max(0,TOLL_TUNING.stopLine-actor.front),authorized=owned(actor)&&s.angle>1.45;return authorized?TOLL_TUNING.approachSpeed:Math.min(TOLL_TUNING.approachSpeed,Math.sqrt(2*3.5*gap));}};
}
