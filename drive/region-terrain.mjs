// One local rectangle governs grading, regeneration and vegetation exclusion.
export function regionPad(town){return{centerX:0,centerZ:0,halfX:60,halfZ:55,...town.pad};}
export function regionPadLocal(town,x,z){const p=regionPad(town),dx=x-town.x,dz=z-town.z,c=Math.cos(town.angle),s=Math.sin(town.angle);return{x:dx*c-dz*s-p.centerX,z:dx*s+dz*c-p.centerZ,pad:p};}
export function regionPadDistance(town,x,z){const q=regionPadLocal(town,x,z);return Math.max(Math.abs(q.x)-q.pad.halfX,Math.abs(q.z)-q.pad.halfZ);}
export function regionPadBounds(town,margin=35){const p=regionPad(town),c=Math.cos(town.angle),s=Math.sin(town.angle),points=[];for(const x of[p.centerX-p.halfX-margin,p.centerX+p.halfX+margin])for(const z of[p.centerZ-p.halfZ-margin,p.centerZ+p.halfZ+margin])points.push({x:town.x+c*x+s*z,z:town.z-s*x+c*z});return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};}
