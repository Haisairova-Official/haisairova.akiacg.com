import {fleetSpec} from './fleet-specs.mjs?rev=world21d';
export function wheelLayout(kind,p,{trailer=false,driveMode='tracks'}={}){
 const f=fleetSpec(kind),frontShare=f?.physical.drive==='rwd'?0:f?.physical.drive==='awd'?(f.physical.driveFrontShare??.5):1,axles=trailer?f.trailer.axles:f?.physical.axles;
 if(!axles)return[true,false].flatMap(front=>[-1,1].map(side=>({side,x:side*(front?p.frontTrack:p.rearTrack)/2,z:(front?.5:-.5)*p.wheelbase,front,steer:front?1:0,drive:(front?frontShare:1-frontShare)/2,parking:front?0:.5,referenceLoad:p.mass*9.81/4})));
 const count=axles.length*2;
 return axles.flatMap((a,j)=>[-1,1].map(side=>{
  let referenceLoad=p.mass*9.81/count;
  if(kind==='dayun'){
   const t=f.trailer,pin=t.mass*4.4/(4.75+4.4),front=(f.engine.mass*(p.cgForward+1.875)+pin*(-1.4+1.875))/3.975;
   referenceLoad=(trailer?(t.mass-pin)/6:j===0?front/2:(f.engine.mass+pin-front)/4)*9.81;
  }
  const tank=kind==='bt7',wheeled=driveMode==='wheels';
  return{side,x:side*a.track/2,z:a.z,front:j===0,steer:trailer?0:tank?(wheeled&&j===0?1:0):a.steer||0,drive:trailer?0:tank?(wheeled?(j===axles.length-1?.5:0):1/count):(a.drive||0)/2,parking:trailer?1/count:tank?1/count:(a.parking||0)/2,referenceLoad};
 }));
}
