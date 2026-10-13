// Finite tyre contact constraints used only after a deliberate parked-mode request.
// Bodies remain dynamic. Each grounded wheel has its own tangent anchor and
// friction budget; saturation releases that anchor instead of pinning the car.
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),scale=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const normalize=a=>scale(a,1/(Math.hypot(a.x,a.y,a.z)||1));
const rotate=(q,v)=>{const t=scale(cross(q,v),2);return add(v,add(scale(t,q.w),cross(q,t)));};
function matrixVector(m,v){return{x:m[0]*v.x+m[1]*v.y+m[2]*v.z,y:m[1]*v.x+m[3]*v.y+m[4]*v.z,z:m[2]*v.x+m[4]*v.y+m[5]*v.z};}
export function solveParkingContacts(unit,dt,gravity={x:0,y:-9.81,z:0}){
 const {body,vehicle,wheels,prop}=unit,com=body.worldCom(),q=body.rotation(),inverse=body.effectiveWorldInvInertia().elements,massInv=body.invMass(),constraints=[];unit.parkingAnchors??=[];
 for(let i=0;i<wheels.length;i++){
  const load=Math.min(vehicle.wheelSuspensionForce(i)||0,vehicle.wheelMaxSuspensionForce(i)),brake=unit.parkingBrakeCaps?.[i]||0;
  if(!vehicle.wheelIsInContact(i)||load<=0||brake<=0){unit.parkingAnchors[i]=null;continue;}
  const point=vehicle.wheelContactPoint(i),normal=normalize(vehicle.wheelContactNormal(i)),forward0=rotate(q,{x:0,y:0,z:1}),forward=normalize(sub(forward0,scale(normal,dot(forward0,normal)))),side=normalize(cross(normal,forward)),r=sub(point,com),axes=[forward,side],lever=axes.map(a=>cross(r,a)),Ilever=lever.map(a=>matrixVector(inverse,a));
  const k00=massInv+dot(lever[0],Ilever[0]),k11=massInv+dot(lever[1],Ilever[1]),k01=dot(lever[0],Ilever[1]),det=k00*k11-k01*k01;
  const prior=unit.parkingAnchors[i],anchor=prior&&dot(prior.normal,normal)>.98?prior:{point:{...point},normal:{...normal}};unit.parkingAnchors[i]=anchor;
  const limit=prop.mu*.7*load*dt,longLimit=Math.min(brake,limit);constraints.push({i,point,normal,axes,k00,k11,k01,det,anchor,longLimit,limit,j:[0,0],sliding:false});
 }
 for(let iteration=0;iteration<10;iteration++)for(const c of constraints){
  const v=add(body.velocityAtPoint(c.point),scale(gravity,dt)),error=sub(c.point,c.anchor.point),target=c.axes.map(axis=>dot(v,axis)+.10*dot(error,axis)/dt),delta=[(-target[0]*c.k11+target[1]*c.k01)/c.det,(-target[1]*c.k00+target[0]*c.k01)/c.det];
  let j=[c.j[0]+delta[0],c.j[1]+delta[1]],ratio=Math.hypot(j[0]/Math.max(1e-9,c.longLimit),j[1]/Math.max(1e-9,c.limit));if(ratio>1){j=j.map(v=>v/ratio);c.sliding=true;}
  const impulse=add(scale(c.axes[0],j[0]-c.j[0]),scale(c.axes[1],j[1]-c.j[1]));body.applyImpulseAtPoint(impulse,c.point,true);c.j=j;
 }
 for(const c of constraints)if(c.sliding)c.anchor.point={...c.point};
 unit.parkingContactStats=constraints.map(c=>({wheel:c.i,forward:c.j[0],side:c.j[1],longLimit:c.longLimit,limit:c.limit,sliding:c.sliding}));return unit.parkingContactStats;
}
export function clearParkingContacts(unit){if(unit.parkingAnchors){unit.parkingAnchors=null;unit.parkingContactStats=[];}}
