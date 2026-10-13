import {clamp,resistance,RAD_TO_RPM} from './engine.mjs?rev=world21d';
// Rigid fixed reduction. Rotor inertia is not publicly available and is omitted,
// rather than borrowing combustion/idle/clutch equations. Chassis mass, tyre
// contact, suspension and rigid inertia remain integrated by the existing solver.
export const motorRPM=(speed,motor,p)=>speed/p.tyreRadius*motor.reductionRatio*RAD_TO_RPM;
export function motorEnvelope(motor,rpm){
 const omega=Math.abs(rpm)/RAD_TO_RPM,base=Math.min(motor.peakTorque,motor.peakPowerKW*1000/Math.max(1e-9,omega));
 const x=clamp((motor.maxRPM-Math.abs(rpm))/(motor.maxRPM*.04),0,1),cut=x*x*(3-2*x);
 return base*cut;
}
export function refreshMotorTelemetry(s,p){s.motorRPMByAxle=Object.fromEntries(p.motors.map(m=>[m.axle,motorRPM(s.speed||0,m,p)]));s.motorRPM=Math.max(0,...Object.values(s.motorRPMByAxle).map(Math.abs));s.rpm=s.motorRPM;s.shaftRPM=s.motorRPM;s.clutchSlip=0;}
export function ensureEVState(s,p){
 if(s.transmission!=='ev'){s.transmission='ev';s.gear=1;s.evReady=true;s.rpm=0;s.brakePressure=0;s.handbrakePressure=0;}
 s.gear=[-1,0,1].includes(s.gear)?s.gear:1;s.evReady??=true;s.engineRunning=true;s.stallEnabled=false;s.stallTime=0;s.clutch=0;s.clutchSlip=0;s.clutchEngagement=0;s.clutchTorque=0;s.shiftCooldown=0;s.engineTorque=0;s.enginePower=0;s.engineBaseTorque=0;s.cvtRatio=0;s.cvtTargetRPM=0;s.roadGrade??=0;refreshMotorTelemetry(s,p);
}
export function selectEVRange(s,range){
 if(s.transmission!=='ev'||![-1,0,1].includes(range))return{ok:false,reason:'仅电驱单速车型使用 D / N / R'};
 if(range===s.gear)return{ok:true,reason:range<0?'R · 倒车':range?'D · 前进':'N · 自由滑行'};
 // Never clear physical velocity to make this check pass. The lateral ground
 // speed also matters when the car is sliding or has just been hit.
 if(range!==0&&(Math.max(Math.abs(s.speed||0),s.groundSpeed||0)>.2||s.throttle>.01))return{ok:false,reason:'方向保护：完全停稳并松开油门后选择 D / R'};
 s.gear=range;s.throttle=0;s.motorTorque=0;s.motorPowerKW=0;s.wheelForce=0;s.regenForce=0;s.regenPowerKW=0;
 return{ok:true,reason:range<0?'R · 倒车':range?'D · 前进':'N · 自由滑行，无驱动与回收'};
}
export function evDriveForce(s,input,dt,p,options={}){
 ensureEVState(s,p);dt=Math.max(1e-5,dt);const v=s.speed||0,speed=Math.abs(v),ground=Math.max(speed,s.groundSpeed||0),both=!!(input.forward&&input.reverse);
 let brake=!!input.brake||both||!!input.parking,throttle=0;
 if(!brake&&s.gear!==0&&s.evReady){
  const requested=input.reverse?-1:input.forward?1:0;
  if(requested){if(requested!==s.gear&&ground>.2||v*requested<-.2||Math.abs(v)<=.2&&ground>.2)brake=true;else{s.gear=requested;throttle=1;}}
 }else if(s.gear===0&&input.reverse)brake=true;
 s.brakePressure??=0;s.handbrakePressure??=0;s.brakePressure+=(Number(brake)-s.brakePressure)*(1-Math.exp(-dt/(brake?.055:.08)));s.handbrakePressure+=(Number(!!input.handbrake)-s.handbrakePressure)*(1-Math.exp(-dt/(input.handbrake?.045:.11)));
 const limit=s.gear<0?5:Math.min(options.maxSpeed??13,p.speedLimiterKmh===undefined?Infinity:p.speedLimiterKmh/3.6);
 if(speed>limit-.8)throttle*=clamp((limit+.1-speed)/.9,0,1);if(brake||!s.evReady)throttle=0;s.throttle=throttle;
 const axleForces={front:0,rear:0};let torque=0,power=0;
 for(const m of p.motors){const rpm=motorRPM(v,m,p),t=motorEnvelope(m,rpm)*throttle;axleForces[m.axle]+=t*m.reductionRatio*p.efficiency/p.tyreRadius*Math.sign(s.gear);torque+=t;power+=t*Math.abs(rpm)/RAD_TO_RPM/1000;}
 const wheelForce=axleForces.front+axleForces.rear,sign=Math.sign(v),governor=s.gear!==0&&s.evReady?Math.max(0,speed-limit)*p.mass*4:0;
 const lift=s.gear!==0&&s.evReady&&!throttle&&!brake&&!input.handbrake&&!input.parking?p.mass*p.regen.liftOffDecel:0;
 const totalBrake=Math.min(Math.max(p.mass*10.5*s.brakePressure,lift,governor),p.mass*10.5,speed*p.mass/dt),fade=clamp(speed/p.regen.fadeSpeed,0,1);
 // A driven axle cannot motor positively and regenerate at once. Residual
 // hydraulic pressure after pedal release remains mechanical when accelerating.
 const regenRequest=s.gear!==0&&s.evReady&&!input.parking&&throttle===0?Math.min(totalBrake,p.mass*p.regen.serviceMaxDecel*fade,p.regen.maxWheelPowerKW*1000/Math.max(1,speed)):0;
 const regenAxleForces={front:0,rear:0},regenWheelForces=[0,0,0,0],totalRatedPower=p.motors.reduce((a,m)=>a+m.peakPowerKW,0);
 let regen=0;
 for(const m of p.motors){const ids=m.axle==='front'?[0,1]:[2,3],perWheel=regenRequest*m.peakPowerKW/totalRatedPower/2;
  for(const i of ids)if(options.drivenContact!==false&&s.wheelContacts?.[i]){regenWheelForces[i]-=sign*perWheel;regenAxleForces[m.axle]-=sign*perWheel;regen+=perWheel;}
 }
 const brakeForce=sign*(totalBrake-regen),roadLoad=resistance(v,p,options.rigidBody?0:s.roadGrade||0);
 Object.assign(s,{motorTorque:torque,motorPowerKW:power,wheelForce,regenForce:regen,regenPowerKW:regen*speed/1000,brakeForce,roadResistance:roadLoad,governorForce:0});
 return{brake,throttle,wheelForce,axleForces,regenAxleForces,regenWheelForces,brakeForce,roadLoad,governorForce:0,force:wheelForce-roadLoad-sign*totalBrake,mass:p.mass};
}
