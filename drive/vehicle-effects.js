import {vehicleSpec} from './vehicle-specs.mjs?rev=world21d';
// Lamps are attached to the sprung body; wheel geometry is never scaled by the suspension.
export function addTurnLights(T,car){
 if(car.userData.turnLights)return; // Original EV lenses already follow their curved shell.
 const kind=car.userData.kind,yaris=kind==='yaris',spec=kind==='trailer'?{length:13,width:2.5,height:3.6}:vehicleSpec(kind),length=spec.length/2+.035,width=spec.width*.41,y=Math.min(1.2,spec.height*.5);
 const sides=new Map();
 for(const side of [-1,1]){
  const material=new T.MeshStandardMaterial({color:0x925c20,emissive:0xffa51f,emissiveIntensity:0,roughness:.35});
  for(const z of [-length,length]){const lamp=new T.Mesh(new T.BoxGeometry(.18,.10,.035),material);lamp.position.set(side*width,y,z);car.userData.body.add(lamp);}
  const marker=new T.Mesh(new T.BoxGeometry(.026,.065,.12),material);marker.position.set(side*(spec.width/2+.03),Math.min(1.5,spec.height*.7),spec.length*.2);car.userData.body.add(marker);sides.set(side,material);
 }
 car.userData.turnLights=sides;
}
export function applyTurnLights(car,side,on){for(const [key,material] of car.userData.turnLights||[]){const lit=side===key&&on;material.emissiveIntensity=lit?2.5:0;material.color.setHex(lit?0xffba42:0x925c20);}}
