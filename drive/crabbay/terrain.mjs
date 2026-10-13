// Bounded harbour inlet: shared by terrain carving, water, quay and vegetation.
// Metres relative to the unique Crabbay district. This is an original game scene.
export const CRABBAY_BASIN=Object.freeze({minX:-110,maxX:-64,minZ:-45,maxZ:45,level:-1.8,bed:-4.3,padding:20,blend:16});
export function basinLocal(pose,x,z){const dx=x-pose.x,dz=z-pose.z,c=Math.cos(pose.angle),s=Math.sin(pose.angle);return{x:dx*c-dz*s,z:dx*s+dz*c};}
export function basinTerrainHeight(pose,x,z,current){const w=pose.pad?.water;if(!w)return current;const p=basinLocal(pose,x,z),outside=Math.max(w.minX-p.x,p.x-w.maxX,w.minZ-p.z,p.z-w.maxZ,0),t=Math.max(0,Math.min(1,(outside-w.padding)/w.blend));return Math.min(current,(pose.y+w.bed)*(1-t)+current*t);}
export function basinVegetationAllowed(pose,x,z){const w=pose.pad?.water;if(!w)return true;const p=basinLocal(pose,x,z);return p.x<w.minX-4||p.x>w.maxX+4||p.z<w.minZ-4||p.z>w.maxZ+4;}
