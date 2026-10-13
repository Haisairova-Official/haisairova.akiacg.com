// Cache the actual neutral model's x/y support hull once. Rollover grounding
// uses geometry rather than a fixed lift shared by differently sized cars.
export function captureGroundHull(T,car){
 car.updateMatrixWorld(true);const inverse=car.matrixWorld.clone().invert(),v=new T.Vector3(),points=[];
 car.traverse(part=>{const positions=part.geometry?.attributes.position;if(!positions)return;const matrix=inverse.clone().multiply(part.matrixWorld);for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(matrix);points.push([v.x,v.y]);}});
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const half=items=>{const h=[];for(const p of items){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};
 return [...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)];
}
export function rolloverGroundY(hull,angle,roadY=0){
 const sin=Math.sin(angle),cos=Math.cos(angle),lowest=Math.min(...hull.map(([x,y])=>x*sin+y*cos));
 return roadY+.23-lowest;
}
