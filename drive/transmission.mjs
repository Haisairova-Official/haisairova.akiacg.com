import {ensureEVState,evDriveForce,refreshMotorTelemetry,motorRPM} from './ev-powertrain.mjs?rev=world21d';
import {fleetSpec} from './fleet-specs.mjs?rev=world21d';
import {gearboxSpec,effectivePowertrain} from './gearbox-specs.mjs?rev=world21d';
import {powertrainSpec} from './powertrain-specs.mjs?rev=world21d';
import {integrateEngine,wheelShaftRPM,resistance,clamp} from './engine.mjs?rev=world21d';
export const roadRPM=(speed,gear,vehicle='yaris',tuning='arcade',state={})=>{const p=powertrainSpec(vehicle,tuning);return p.type==='ev'?Math.max(...p.motors.map(m=>Math.abs(motorRPM(speed,m,p)))):wheelShaftRPM(speed,gear,effectivePowertrain(p,{...state,vehicle,gear}));};
export function ensureTransmission(s){const p=powertrainSpec(s.vehicle,s.tuning);if(p.type==='ev'){ensureEVState(s,p);return;}if(s.transmission==='ev'){s.transmission='at';s.gear=1;s.rpm=p.idle;s.engineRunning=true;}s.transmission??='at';s.gear??=1;s.rpm??=850;s.shiftCooldown??=0;s.clutch??=0;s.clutchSlip??=0;s.engineRunning??=true;s.stallEnabled??=false;s.stallTime??=0;s.roadGrade??=0;s.gear=Math.min(effectivePowertrain(powertrainSpec(s.vehicle,s.tuning),s).ratios.length,s.gear);}
export function shiftGear(s,direction){
 ensureTransmission(s);if(s.transmission==='ev')return {ok:false,reason:'EV 单速固定减速，无离散换挡；使用 D / N / R 选择器'};if(s.transmission!=='mt')return {ok:false,reason:s.transmission==='cvt'?'CVT 连续变速，不提供虚构挡位；W 前进 / S 刹停后倒车':'MT 模式才能手动换挡'};
 if(s.clutch<.65)return {ok:false,reason:'换挡保护：先按住 Ctrl / 离合'};
 const groundSpeed=Math.max(Math.abs(s.speed||0),Math.hypot(s.vx||0,s.vz||0),s.groundSpeed||0);
 const p=effectivePowertrain(powertrainSpec(s.vehicle,s.tuning),s),next=clamp(s.gear+Math.sign(direction),-1,p.ratios.length);
 if(next===s.gear)return {ok:false,reason:'已经是最高／最低挡'};
 if((next<0||s.gear<0)&&groundSpeed>1.4)return {ok:false,reason:'先停稳，再选择 N / R / 1'};
 if(next>0&&s.speed<-.5)return {ok:false,reason:'先停稳，再挂前进挡'};
 if(roadRPM(s.speed,next,s.vehicle,s.tuning,s)>p.redline)return {ok:false,reason:'转速保护：先减速再降挡'};
 s.gear=next;s.shiftCooldown=.18;return {ok:true,reason:next<0?'R / 倒挡':next===0?'N / 空挡':`MT / ${next} 挡`};
}
export function ignite(s){
 ensureTransmission(s);if(s.transmission==='ev')return {ok:false,reason:'电驱 READY，无点火、离合或发动机熄火'};if(s.engineRunning)return {ok:false,reason:'发动机已在运转'};
 if(Math.abs(s.speed)>1.4||(s.transmission==='mt'&&s.gear!==0&&s.clutch<.8))return {ok:false,reason:'点火保护：停稳后挂 N，或踩住离合'};
 s.engineRunning=true;s.rpm=powertrainSpec(s.vehicle,s.tuning).idle*1.15;s.stallTime=0;return {ok:true,reason:'发动机已重新启动'};
}
export function driveForce(s,input,dt,options={}){
 ensureTransmission(s);if(powertrainSpec(s.vehicle,s.tuning).type==='ev')return evDriveForce(s,input,dt,powertrainSpec(s.vehicle,s.tuning),options);let p=effectivePowertrain(powertrainSpec(s.vehicle,s.tuning),s);const both=input.forward&&input.reverse;
 s.shiftCooldown=Math.max(0,s.shiftCooldown-dt);let brake=!!input.brake||both,throttle=0;
 if(s.transmission==='at'||s.transmission==='cvt'){
  s.clutch=0;s.stallTime=0;
  const groundSpeed=Math.max(Math.abs(s.speed||0),Math.hypot(s.vx||0,s.vz||0),s.groundSpeed||0);
  if(input.reverse&&!both){if(s.speed>.2||(s.gear>=0&&groundSpeed>.2))brake=true;else{s.gear=-1;throttle=1;}}
  else if(input.forward&&!both){if(s.speed<-.2||(s.gear<0&&groundSpeed>.2))brake=true;else{if(s.gear<1)s.gear=1;throttle=1;}}
  if(s.transmission==='at'&&s.gear>0&&s.shiftCooldown<=0){const rpm=roadRPM(s.speed,s.gear,s.vehicle,s.tuning,s);if(rpm>(p.shiftUpRPM??5600)&&s.gear<p.ratios.length){s.gear++;s.shiftCooldown=.45;}else if(rpm<(p.shiftDownRPM??2050)&&s.gear>1&&roadRPM(s.speed,s.gear-1,s.vehicle,s.tuning,s)<(p.shiftUpRPM??5100)){s.gear--;s.shiftCooldown=.45;}}
 }else{
  const target=input.clutch?1:0;s.clutch+=(target-s.clutch)*Math.min(1,dt*(input.clutch?18:4));
  if(input.clutch&&s.clutch>.995)s.clutch=1;if(!input.clutch&&s.clutch<.005)s.clutch=0;
  brake ||= !!input.reverse;throttle=input.forward&&!brake?1:0;
 }
 if(brake)throttle=0;
 if(s.transmission==='cvt'){
  const g=gearboxSpec(s.vehicle,'cvt');s.cvtRatio??=g.max;
  const targetRPM=throttle?p.peakPowerRPM:Math.max(p.idle,1400+Math.abs(s.speed)*12);
  const ideal=targetRPM*Math.PI/30*p.tyreRadius/Math.max(.5,Math.abs(s.speed))/g.finalDrive/p.gameFinalDrive;
  const desired=clamp(ideal,g.min,g.max),delta=(desired-s.cvtRatio)*(1-Math.exp(-dt/g.response));
  s.cvtRatio=clamp(s.cvtRatio+clamp(delta,-g.rate*dt,g.rate*dt),g.min,g.max);s.cvtTargetRPM=targetRPM;s.gear=s.gear<0?-1:s.gear===0?0:1;
  p=effectivePowertrain(powertrainSpec(s.vehicle,s.tuning),s);
 }
 if(fleetSpec(s.vehicle)?.trailer)p={...p,mass:p.mass+fleetSpec(s.vehicle).trailer.mass};
 const shaftRPM=()=>wheelShaftRPM(s.speed,s.gear,p);
 const limit=s.gear<0?5:(options.maxSpeed??13),speed=Math.abs(s.speed);
 // A declared game speed governor feathers fuel. Wheel force remains integrated;
 // overspeed is resisted by a brake force, never by clipping the speed state.
 if(speed>limit-.8)throttle*=clamp((limit+.1-speed)/.9,0,1);
 let coupling=s.gear===0||s.clutch>=.95?0:1-s.clutch;if(options.drivenContact===false)coupling=0;
 const friendly=s.transmission!=='mt'||!s.stallEnabled;
 if(friendly&&s.engineRunning){const shaft=Math.abs(roadRPM(s.speed,s.gear,s.vehicle,s.tuning,s));coupling*=clamp((shaft+p.idle*.14)/(p.launchRPM??1100),.08,1);if(s.rpm<p.idle*.76)coupling*=clamp(s.rpm/(p.idle*.76),0,1);}
 if(friendly&&!throttle&&Math.abs(roadRPM(s.speed,s.gear,s.vehicle,s.tuning,s))<p.idle*1.2)coupling=0;
 if(s.shiftCooldown>0)coupling*=.25;
 s.clutchEngagement=coupling;s.throttle=throttle;
 s.brakePressure??=0;s.handbrakePressure??=0;
 s.brakePressure+=(Number(!!brake)-s.brakePressure)*(1-Math.exp(-dt/(brake?.055:.08)));
 s.handbrakePressure+=(Number(!!input.handbrake)-s.handbrakePressure)*(1-Math.exp(-dt/(input.handbrake?.045:.11)));
 const roadLoad=resistance(s.speed,p,options.rigidBody?0:s.roadGrade||0);
 const brakeForce=Math.sign(s.speed)*Math.min(p.mass*10.5*s.brakePressure,Math.abs(s.speed)*p.mass/dt);
 const wheelForce=integrateEngine(s,dt,p,{throttle,brakeForce,roadLoad,coupling});
 if(s.engineRunning&&s.transmission==='mt'&&s.stallEnabled&&s.gear!==0&&s.clutch<.2&&s.rpm<(p.stallRPM??500))s.stallTime+=dt;else s.stallTime=0;
 if(s.stallTime>.18){s.engineRunning=false;s.rpm=0;}
 const governorForce=Math.sign(s.speed)*Math.max(0,speed-limit)*p.mass*4;
 s.roadResistance=roadLoad;s.brakeForce=brakeForce;s.governorForce=governorForce;
 return {brake,throttle,wheelForce,brakeForce,roadLoad,governorForce,force:wheelForce-roadLoad-brakeForce-governorForce,mass:p.mass};
}
