import {refreshMotorTelemetry} from './ev-powertrain.mjs?rev=world21d';
import {powertrainSpec} from './powertrain-specs.mjs?rev=world21d';
import {driveForce,ensureTransmission,roadRPM} from './transmission.mjs?rev=world21d';
import {steeringGeometry,vehicleSpec} from './vehicle-specs.mjs?rev=world21d';
import {createRigidContext,contextFor,releaseRigid,stopRigid,rightRigid} from './rigid-vehicle.mjs?rev=world21d';
export const SPAWN={x:-14,z:19,heading:Math.PI/2};
export const createCarState=()=>({...SPAWN,speed:0,steer:0,distance:0,fuelLevel:.72,roadY:0,roadGrade:0,vehicle:'yaris',tuning:'arcade',wheelAngle:0,rolled:false,loadTransfer:0,rolloverAngle:0,collisions:0,vx:0,vy:0,vz:0,slip:0,acceleration:0,pitch:0,roll:0,transmission:'at',gear:1,rpm:900,shiftCooldown:0,clutch:0,clutchSlip:0,engineRunning:true,stallEnabled:false,stallTime:0,brakePressure:0,handbrakePressure:0});
export function stopCar(s){stopRigid(s);Object.assign(s,{speed:0,steer:0,vx:0,vy:0,vz:0,slip:0,acceleration:0,yawRate:0,brakePressure:0,handbrakePressure:0});}
// R is a local recovery only. It does not change the road, heading or journey.
export function resetCar(s){delete s.modeChangePose;stopCar(s);Object.assign(s,{chassisY:(s.roadY||0)+.32,rolled:false,loadTransfer:0,rolloverAngle:0,pitch:0,roll:0,angularVelocity:{x:0,y:0,z:0},quaternion:{x:0,y:Math.sin(s.heading/2),z:0,w:Math.cos(s.heading/2)}});rightRigid(s);}
export function respawnCar(s,pose=SPAWN){const config={fuelLevel:Number.isFinite(s.fuelLevel)?s.fuelLevel:.72,vehicle:s.vehicle,tuning:s.tuning,transmission:s.transmission,stallEnabled:s.stallEnabled,engineRunning:s.engineRunning,driveMode:s.driveMode};releaseRigid(s);for(const k of Object.keys(s))delete s[k];Object.assign(s,createCarState(),config,pose,{gear:config.transmission==='mt'?0:1,rpm:config.engineRunning?900:0});ensureTransmission(s);}
export function collides(x,z,boxes,radius=1.25){if(Math.abs(x)>42-radius||Math.abs(z)>37-radius)return true;return boxes.some(b=>{const nx=Math.max(b.x-b.w/2,Math.min(x,b.x+b.w/2)),nz=Math.max(b.z-b.d/2,Math.min(z,b.z+b.d/2));return(x-nx)**2+(z-nz)**2<radius**2;});}
export function stepCar(s,input,dt,boxes=[],options={}){
 ensureTransmission(s);let c=contextFor(s);if(c&&(c.kind!==s.vehicle||c.tuning!==s.tuning||c.driveMode!==s.driveMode)){releaseRigid(s);c=null;}c??=createRigidContext(s,options,boxes);
 if(c.lastPublic&&Math.hypot(s.x-c.lastPublic.x,s.z-c.lastPublic.z)>.005)c.reposition(s);
 if(options.spatialStreaming!==undefined)c.spatialStreaming=!!options.spatialStreaming;c.sceneActors=options.traffic||c.sceneActors;
 c.syncScene(options.scene,options.physicsKey,options.mode||'city');c.syncTraffic(options.traffic,dt);
 const old={x:s.x,z:s.z,speed:s.speed},target=(input.left?1:0)-(input.right?1:0)||Math.max(-1,Math.min(1,input.steer||0));
 const rate=target===0?11:input.left||input.right?4.5:7;s.steer+=(target-s.steer)*(1-Math.exp(-dt*rate));
 const base=steeringGeometry(s.vehicle,s.groundSpeed??s.speed,1).angle,slipAngle=Math.atan2(Math.abs(s.slip||0),Math.max(2,Math.abs(s.speed))),counter=s.speed>3&&slipAngle>.025&&s.steer*(s.yawRate||0)<0;
 const authority=Math.min(vehicleSpec(s.vehicle).maxSteer,base+(counter?slipAngle*1.05:0));s.steerAuthority??=base;s.steerAuthority+=(authority-s.steerAuthority)*(1-Math.exp(-dt*12));
 const desiredAngle=s.steer*s.steerAuthority;s.wheelAngle+=Math.max(-2.5*dt,Math.min(2.5*dt,desiredAngle-s.wheelAngle));
 const drivenContact=!s.wheelContacts||c.units[0].wheels.some((w,i)=>w.drive>0&&s.wheelContacts[i]);
 const drive=driveForce(s,input,dt,{...options,rigidBody:true,drivenContact});drive.parking=!!input.parking;c.integrate(s,drive,dt);
 s.distance+=Math.hypot(s.x-old.x,s.z-old.z);s.shaftRPM=roadRPM(s.speed,s.gear,s.vehicle,s.tuning,s);s.clutchSlip=s.rpm-s.shaftRPM;if(powertrainSpec(s.vehicle,s.tuning).type==='ev')refreshMotorTelemetry(s,powertrainSpec(s.vehicle,s.tuning));
 s.physicsEngine='Rapier 0.19.3';s.physicsMass=c.systemMass;s.cgHeight=c.prop.cgHeight;s.inertia=c.prop.inertia;
}

export function switchDriveMode(s){
 if(s.vehicle!=='bt7')return {ok:false,reason:'仅BT-7可切换行走机构'};
 if(Math.abs(s.groundSpeed??s.speed)>.5||s.throttle>.01||s.rolled||s.upY<.9||s.wheelContacts&&!s.wheelContacts.some(Boolean))return {ok:false,reason:'停稳、松开油门并保持接地后，切换履带／轮式'};
 const pose=s.quaternion?{quaternion:{...s.quaternion},chassisY:s.chassisY}:null;stopCar(s);releaseRigid(s);if(pose)s.modeChangePose=pose;s.driveMode=s.driveMode==='wheels'?'tracks':'wheels';return {ok:true,reason:s.driveMode==='wheels'?'轮式：前轮转向、后轮驱动，履带收起（游戏简化换装）':'履带：内侧离合切断及制动转向，无原地反转履带'};
}
