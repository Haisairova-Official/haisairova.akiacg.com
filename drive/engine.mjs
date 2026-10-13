// Lumped crankshaft + clutch model. The published full-load torque curve is brake torque;
// gross combustion therefore includes the friction it must overcome at full throttle.
export const RPM_TO_RAD=Math.PI/30,RAD_TO_RPM=30/Math.PI;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function curveTorque(curve,rpm){if(rpm<=curve[0][0])return curve[0][1];for(let i=1;i<curve.length;i++)if(rpm<=curve[i][0]){const a=curve[i-1],b=curve[i];return a[1]+(b[1]-a[1])*(rpm-a[0])/(b[0]-a[0]);}return curve.at(-1)[1];}
export function wheelShaftRPM(speed,gear,p){const ratio=gear===0?0:Math.abs(p.ratioOverride??(gear<0?p.reverse:p.ratios[gear-1]))*p.finalDrive*p.gameFinalDrive;return speed*Math.sign(gear)/p.tyreRadius*ratio*RAD_TO_RPM;}
export function resistance(speed,p,grade=0){const sign=Math.sign(speed),rolling=Math.abs(speed)>.02?p.mass*9.81*p.rollingResistance*sign:0;return rolling+.5*1.225*p.dragArea*speed*Math.abs(speed)+p.mass*9.81*Math.sin(Math.atan(grade));}
export function integrateEngine(s,dt,p,{throttle,brakeForce=0,roadLoad=0,coupling=0}){
 const ratio=s.gear===0?0:(p.ratioOverride??(s.gear<0?-p.reverse:p.ratios[s.gear-1]))*p.finalDrive*p.gameFinalDrive;
 const omega=Math.max(0,s.rpm)*RPM_TO_RAD,friction=(p.frictionBase??8)+s.rpm*(p.frictionRPM??.002)+(1-throttle)*s.rpm*(p.coastFrictionRPM??.003);
 const rawTorque=Math.min(curveTorque(p.torqueCurve,s.rpm),p.peakPowerKW*1000/Math.max(1,omega));
 const fuel=s.engineRunning&&s.rpm<p.redline?throttle:0;
 const idle=s.engineRunning?clamp((p.idle-s.rpm)*(p.idleGain??.22)+friction,0,p.idleMax??38):0;
 const combustion=s.engineRunning?Math.max(idle,fuel*(rawTorque*p.gameTorqueMultiplier+friction)):0;
 const net=combustion-friction;
 const omegaFree=Math.max(0,omega+net/p.engineInertia*dt);
 let clutchTorque=0,transfer=p.efficiency;
 if(ratio&&coupling>0){
  // The reflected vehicle inertia and external wheel load participate in the same
  // constraint solve. Locking cannot magically set RPM or create wheel energy.
  const externalAcceleration=(-roadLoad-brakeForce)/p.mass;
  const shaftFree=(s.speed+externalAcceleration*dt)*ratio/p.tyreRadius;
  transfer=omegaFree>=shaftFree?p.efficiency:1/p.efficiency;
  const inverseReflected=ratio*ratio*transfer/(p.mass*p.tyreRadius*p.tyreRadius);
  const required=(omegaFree-shaftFree)/(dt*(1/p.engineInertia+inverseReflected));
  const capacity=Math.min(p.clutchCapacity*coupling,p.mass*9*p.tyreRadius/(Math.abs(ratio)*transfer));
  clutchTorque=clamp(required,-capacity,capacity);
 }
 const finalOmega=Math.max(0,omegaFree-clutchTorque/p.engineInertia*dt);
 s.rpm=finalOmega*RAD_TO_RPM;
 s.shaftRPM=wheelShaftRPM(s.speed,s.gear,p);s.clutchSlip=s.rpm-s.shaftRPM;
 s.engineTorque=net;s.engineBaseTorque=rawTorque;s.clutchTorque=clutchTorque;
 s.wheelForce=clutchTorque*ratio*transfer/p.tyreRadius;
 s.enginePower=net*finalOmega/1000;
 return s.wheelForce;
}
