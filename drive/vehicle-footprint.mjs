import {vehicleSpec} from './vehicle-specs.mjs?rev=world21d';
import {fleetSpec} from './fleet-specs.mjs?rev=world21d';
export function vehicleBodies(s,kind=s.vehicle){
 const p=vehicleSpec(kind),f=fleetSpec(kind),out=[{x:s.x,z:s.z,y:s.chassisY??(s.roadY||0)+.22,heading:s.heading,width:p.width,length:p.length,height:p.height}];
 if(f?.trailer){const t=f.trailer,heading=s.trailer?.heading??s.heading,fh=s.heading,h=t.hitch,wx=s.x+Math.sin(fh)*h.tractor.z,wz=s.z+Math.cos(fh)*h.tractor.z;
 out.push({x:s.trailer?.x??wx-Math.sin(heading)*h.trailer.z,z:s.trailer?.z??wz-Math.cos(heading)*h.trailer.z,y:s.trailer?.y??out[0].y,heading,width:t.width,length:t.length,height:t.height});}
 return out;
}
