import {batchStaticVisuals} from './mesh-batching.js?rev=world21d';
import{TRAFFIC_TYPES}from'./traffic-fleet.mjs?rev=world21d';
export function createTrafficModel(T,type,color,{box,material,wheelGeo}){
 const p=TRAFFIC_TYPES[type],node=new T.Group(),visual=new T.Group(),sprung=new T.Group(),lamps=new Map();node.add(visual);visual.add(sprung);
 function wheel(parent,x,z,r=.34,dual=false){const m=new T.Mesh(wheelGeo,material(0x203039));m.rotation.z=Math.PI/2;m.scale.set(r/.28,dual?1.7:1,r/.28);m.position.set(x,r,z);parent.add(m);}
 if(type==='semi'){
  box(sprung,1.9,.32,6.7,0x293945,0,.93,0);box(sprung,2.45,2.22,2.48,color,0,2.27,1.9);box(sprung,2.19,.86,.04,0x284553,0,2.66,3.158);box(sprung,1.55,.70,.05,0x354653,0,1.65,3.17);
  for(const side of[-1,1]){box(sprung,.02,.72,1.18,0x284553,side*1.23,2.63,2.17);for(const z of[2.1,-1.2,-2.55])wheel(visual,side*.99,z,.5,z<0);}
 }else if(type==='van'){
  box(sprung,2.10,1.60,1.65,color,0,1.19,2.36);box(sprung,2.15,2.35,4.7,0xd0d9d7,0,1.92,-.82);box(sprung,1.85,.53,.04,0x294553,0,1.60,3.21);for(const side of[-1,1])for(const z of[2,-1.8])wheel(visual,side*.96,z,.43,z<0);
 }else{
  box(sprung,p.width,.65,p.length,color,0,.69,0);const cabin=type==='mpv'?3.35:type==='suv'?2.85:2.3,h=p.height-.99;
  box(sprung,p.width*.88,h,cabin,color,0,1.0+h/2,-.22);box(sprung,p.width*.81,h*.70,.045,0x294553,0,1.0+h*.55,cabin/2-.19);box(sprung,p.width*.81,h*.70,.045,0x294553,0,1.0+h*.55,-cabin/2-.25);
  for(const side of[-1,1]){box(sprung,.026,h*.65,cabin*.91,0x294553,side*p.width*.448,1.0+h*.55,-.22);for(const z of[-p.wheelbase/2,p.wheelbase/2])wheel(visual,side*p.width*.45,z,type==='sedan'?.31:.37);}
 }
 for(const side of[-1,1]){box(sprung,.36,.17,.04,0xe6e3ca,side*p.width*.32,type==='semi'?1.13:.76,p.length/2+.02);box(sprung,.4,.18,.04,0xae5557,side*p.width*.32,.78,-p.length/2-.02);const m=new T.MeshStandardMaterial({color:0xb97c32,emissive:0xffa526,emissiveIntensity:0});lamps.set(side,m);for(const z of[-p.length/2-.04,p.length/2+.04]){const lamp=new T.Mesh(new T.BoxGeometry(.18,.14,.04),m);lamp.position.set(side*p.width*.4,.82,z);sprung.add(lamp);}}
 const result={node,visual,sprung,lamps};
 if(p.trailer){const t=p.trailer,trailerNode=new T.Group(),trailerVisual=new T.Group();trailerNode.add(trailerVisual);box(trailerVisual,t.width,.22,t.length,0x536b77,0,1.44,0);box(trailerVisual,t.width,2.04,t.length-.08,0xc9d4d2,0,2.58,0);for(const side of[-1,1]){for(const z of[-3.1,-4.4,-5.7])wheel(trailerVisual,side*.98,z,.5,true);for(let z=-6.1;z<6.3;z+=.65)box(trailerVisual,.035,1.95,.035,0xaebfc0,side*1.26,2.6,z);box(trailerVisual,.3,.17,.04,0xb45757,side*.95,1.26,-6.53);}Object.assign(result,{trailerNode,trailerVisual});}
 batchStaticVisuals(T,sprung);batchStaticVisuals(T,visual,{recursive:false});if(result.trailerVisual)batchStaticVisuals(T,result.trailerVisual);
 return result;
}
