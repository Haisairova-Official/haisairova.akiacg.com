// Simplified sprung-load transfer, independent of the cosmetic bounce animation.
// CG heights and suspension response are estimates, not Toyota rollover test data.
import {vehicleSpec} from './vehicle-specs.mjs?rev=world21d';
export function stepRollover(s,lateralAcceleration,dt){
 const p=vehicleSpec(s.vehicle),track=(p.frontTrack+p.rearTrack)/2,h=s.vehicle==='chr'?.66:.54;
 s.loadTransfer??=0;s.loadRate??=0;s.liftTime??=0;s.rolloverAngle??=0;s.rolloverRate??=0;
 s.lateralAcceleration=lateralAcceleration;
 if(!s.rolled){
  const target=2*h*lateralAcceleration/(9.81*track),omega=5.2,damping=.18;
  s.loadRate+=((target-s.loadTransfer)*omega*omega-2*damping*omega*s.loadRate)*dt;
  s.loadTransfer+=s.loadRate*dt;s.roll=s.loadTransfer*.13;
  const lifting=Math.abs(s.loadTransfer)>1.06&&Math.abs(s.slip||0)>.45;
  s.liftTime=lifting?s.liftTime+dt:Math.max(0,s.liftTime-dt*2);
  if(s.liftTime>.10){s.rolled=true;s.rolloverSide=Math.sign(s.loadTransfer)||1;s.rolloverRate=s.rolloverSide*Math.max(.8,Math.abs(s.loadRate)*.3);}
 }
 if(s.rolled){
  const angle=Math.abs(s.rolloverAngle),side=s.rolloverSide||1;
  const rotationalAcceleration=9.81*h/(h*h+track*track/12)*Math.max(.15,Math.sin(Math.min(Math.PI-.15,angle+.2)));
  s.rolloverRate+=side*rotationalAcceleration*dt;s.rolloverAngle+=s.rolloverRate*dt;
  if(Math.abs(s.rolloverAngle)>=Math.PI){s.rolloverAngle=side*Math.PI;s.rolloverRate=0;}
 }
 return !!s.rolled;
}
export function resetRollover(s){Object.assign(s,{rolled:false,loadTransfer:0,loadRate:0,liftTime:0,rolloverAngle:0,rolloverRate:0,rolloverSide:0,lateralAcceleration:0});}
