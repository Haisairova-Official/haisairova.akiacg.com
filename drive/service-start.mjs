import {SERVICE_AREAS} from './road-network.mjs?rev=world21d';
// Whitelisted NEW SESSION start. Never read the query again during simulation.
export const readServiceStart=(pathname,search)=>/\/drive\/highway\/?$/.test(pathname)&&new URLSearchParams(search).get('start')==='jiangwan';
export function jiangwanStartPose(){const path=SERVICE_AREAS[0],p=path.centre,lane=17,along=-37;return{path,pose:{x:p.x-Math.cos(p.heading)*lane+Math.sin(p.heading)*along,z:p.z+Math.sin(p.heading)*lane+Math.cos(p.heading)*along,roadY:p.y,heading:p.heading,speed:0,vx:0,vz:0}};}
