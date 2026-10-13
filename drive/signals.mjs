export const createSignals=()=>({side:0,armed:false,clock:0});
export function toggleSignal(s,side){s.side=s.side===side?0:side;s.armed=false;s.clock=0;}
export function resetSignals(s){s.side=0;s.armed=false;s.clock=0;}
export function stepSignals(s,steer,speed,dt){
 s.clock+=dt;
 if(s.side&&Math.abs(speed)>.8&&steer*s.side>.35)s.armed=true;
 if(s.armed&&Math.abs(steer)<.12){resetSignals(s);}
 return !!s.side&&s.clock%.8<.4;
}
