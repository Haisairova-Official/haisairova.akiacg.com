import {FLEET_GEOMETRY} from './fleet-specs.mjs?rev=world21d';
// Toyota UK specifications. Front wheel steering is derived, not a published measurement.
// XP10: https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/Gen1-Yaris-archive-press-pack.pdf
// C-HR: https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/C-HR-gen1-Nov-2016.pdf
export const VEHICLE_SPECS={
 ...Object.fromEntries(Object.entries(FLEET_GEOMETRY).map(([k,v])=>[k,{...v}])),
 yaris:{name:'1999 UK Yaris 1.0 GLS 3dr',length:3.615,width:1.660,height:1.500,wheelbase:2.370,frontTrack:1.440,rearTrack:1.420,outerTyreRadius:4.9},
 chr:{name:'2017 UK C-HR 1.2T FWD',length:4.360,width:1.795,height:1.565,wheelbase:2.640,frontTrack:1.550,rearTrack:1.550,outerTyreRadius:5.2}
};
for(const p of Object.values(VEHICLE_SPECS)){p.rearAxleRadius=Math.sqrt(p.outerTyreRadius**2-p.wheelbase**2)-p.frontTrack/2;p.maxSteer=Math.atan(p.wheelbase/p.rearAxleRadius);Object.freeze(p);}
export const vehicleSpec=kind=>VEHICLE_SPECS[kind]||VEHICLE_SPECS.yaris;
export function steeringGeometry(kind,speed,rack){const p=vehicleSpec(kind),v=Math.abs(speed),grip=7.2;const limit=Math.min(p.maxSteer,Math.atan(grip*p.wheelbase/Math.max(.01,v*v)));const angle=rack*limit;return {angle,yaw:speed*Math.tan(angle)/p.wheelbase,grip};}
