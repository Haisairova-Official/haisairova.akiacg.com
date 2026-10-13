import{shiftGear}from'./transmission.mjs?rev=world21d';
export const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Direction assistance adapts W/S to the existing physical clutch and ratios.
// It never sets velocity, bypasses the clutch, starts the engine or turns a body.
export function createTankDirectionAssist(){let pending=0;return{reset(){pending=0;},step(s,raw){if(s.vehicle!=='bt7')return raw;const out={...raw,steer:Math.max(-1,Math.min(1,raw.touchSteer||0))},request=raw.forward===raw.reverse?0:raw.forward?(raw.gearThrottle&&s.gear<0?-1:1):-1,both=raw.forward&&raw.reverse;
 if(s.transmission!=='mt'){pending=0;if(request&&Math.sign(s.gear)!==request&&Math.max(Math.abs(s.speed),s.groundSpeed||0)>.2)return{...out,forward:false,reverse:false,brake:true};return out;}
 out.reverse=false;out.forward=false;if(both){pending=0;return{...out,brake:true};}if(!request){pending=0;return out;}
 if(request*s.speed<-.2){pending=request;return{...out,brake:true,clutch:true};}
 if(raw.clutch){pending=0;out.forward=s.gear===0||Math.sign(s.gear)===request||s.clutch>=.95;return out;}
 if(Math.sign(s.gear)===request){pending=0;out.forward=true;return out;}
 pending=request;out.brake=true;out.clutch=true;if(Math.max(Math.abs(s.speed),s.groundSpeed||0)>.2||s.clutch<.95||s.shiftCooldown>0)return out;
 const wanted=request<0?-1:1,result=shiftGear(s,Math.sign(wanted-s.gear));if(result.ok&&s.gear===wanted){pending=0;out.brake=!!raw.brake;out.clutch=false;out.forward=true;}return out;
 },get pending(){return pending;}};}
export function createTankView(){let yaw=0,pitch=.28;return{reset(heading=0){yaw=heading;pitch=.28;},centre(heading){yaw=heading;},move(dx,dy,sensitivity=.003){yaw=wrapAngle(yaw-Math.max(-500,Math.min(500,dx))*sensitivity);pitch=Math.max(.06,Math.min(1.12,pitch+Math.max(-500,Math.min(500,dy))*sensitivity*.75));},get yaw(){return yaw;},get pitch(){return pitch;}};}
export function approachTurretYaw(current,target,dt,maxRate=1.8){const d=wrapAngle(target-current);return wrapAngle(current+Math.max(-maxRate*dt,Math.min(maxRate*dt,d)));}
