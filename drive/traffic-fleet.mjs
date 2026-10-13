// Representative traffic classes, not named production configurations.
export const TRAFFIC_TYPES={
 sedan:{width:1.76,length:4.45,height:1.46,mass:1350,wheelbase:2.65,maxSpeed:33,braking:8.5},
 suv:{width:1.91,length:4.75,height:1.75,mass:1850,wheelbase:2.80,maxSpeed:31,braking:8},
 mpv:{width:1.92,length:5.05,height:1.86,mass:2200,wheelbase:3.0,maxSpeed:29,braking:7.5},
 van:{width:2.15,length:6.4,height:3.1,mass:4800,wheelbase:3.8,maxSpeed:27,braking:6.5},
 semi:{width:2.5,length:6.85,height:3.5,mass:7875,wheelbase:3.975,maxSpeed:25,braking:5.8,trailer:{width:2.5,length:13,height:3.6,mass:14000,hitchZ:4.75,tractorHitchZ:-1.4,axleZ:-4.4}}
};
const order=['sedan','suv','sedan','mpv','sedan','van','suv','semi','mpv','sedan','van','suv'];
export function initTrafficClass(t){t.type??=order[t.id%order.length];const p=TRAFFIC_TYPES[t.type]||TRAFFIC_TYPES.sedan;Object.assign(t,p,{frontExtent:p.length/2,rearExtent:p.trailer?12.65:p.length/2});return t;}
export function trafficBodies(t,{physical=true}={}){
 const p=physical&&t.physical?t.physical:t,body={x:p.x,z:p.z,y:p.y??t.y,heading:p.heading,width:t.width??1.65,length:t.length??3.65,height:t.height??1.5},parts=[body];
 if(t.trailer){const q=physical&&t.physical?.trailer?t.physical.trailer:t.trailerPose;if(q)parts.push({...q,width:t.trailer.width,length:t.trailer.length,height:t.trailer.height});}
 return parts;
}
export function updateTrailerPose(t,reset=false){if(!t.trailer)return;const a=t.trailer,hx=t.x+Math.sin(t.heading)*a.tractorHitchZ,hz=t.z+Math.cos(t.heading)*a.tractorHitchZ;
 let heading=reset||!t.trailerPose?t.heading:t.trailerPose.heading;
 if(!reset&&t.lastHitch){const dx=hx-t.lastHitch.x,dz=hz-t.lastHitch.z;heading+=(dx*Math.cos(heading)-dz*Math.sin(heading))/(a.hitchZ-a.axleZ);}
 t.trailerPose={x:hx-Math.sin(heading)*a.hitchZ,z:hz-Math.cos(heading)*a.hitchZ,y:t.y-a.hitchZ*Math.cos(heading-t.heading)*(t.grade||0)+a.tractorHitchZ*(t.grade||0),grade:t.grade||0,heading};t.lastHitch={x:hx,z:hz};
}
