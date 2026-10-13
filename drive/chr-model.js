// Original photo-guided China-market 2020 C-HR visual approximation.
// Geometry is authored offline; the labelled 2017 UK 1.2T powertrain remains independent.
export const CHR_DIMENSIONS={length:4.405,width:1.795,height:1.565,wheelbase:2.64,wheelRadius:.345};
let model,pending,attempt=0;
export const isCHRReady=()=>!!model;
export function prepareCHR(yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0))){
 if(model)return Promise.resolve();if(pending)return pending;
 pending=(async()=>{const {metadata,payload}=await (attempt?import(`./chr-model-data.mjs?rev=world21d&retry=${attempt}`):import('./chr-model-data.mjs?rev=world21d')),text=atob(payload),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);const geometry=[];
  for(const g of metadata.geometry){const packed=new Int16Array(bytes.buffer,g.vertex[0],g.vertex[1]),count=packed.length/6,positions=new Float32Array(count*3),normals=new Float32Array(count*3);for(let i=0;i<count;i++)for(let j=0;j<3;j++){positions[i*3+j]=packed[i*6+j]/10000;normals[i*3+j]=packed[i*6+j+3]/32767;}const I=g.indexBytes===2?Uint16Array:Uint32Array;geometry.push({...g,positions,normals,index:new I(bytes.buffer,g.index[0],g.index[1])});await yieldFrame();}
  model={...metadata,geometry};
 })().catch(error=>{pending=null;attempt++;throw error;});return pending;
}
export function createCHR(T){
 if(!model)throw new Error('C-HR asset is not prepared');const car=new T.Group(),body=new T.Group(),wheels=[],roots=[body];car.add(body);Object.assign(car.userData,{body,wheels,rollAngle:0,kind:'chr',visualConfiguration:'中国市场 2020 C-HR 外观近似',groundHull:model.groundHull.map(p=>[...p])});
 for(const w of model.wheels){const pivot=new T.Group(),spin=new T.Group();pivot.position.fromArray(w.position);pivot.add(spin);car.add(pivot);wheels.push({pivot,spin,front:w.front});roots.push(spin);}
 const materials=model.materials.map((m,index)=>{const material=new T.MeshStandardMaterial(m);if(index===0)material.userData.paintRole='body';return material;});for(const g of model.geometry){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(g.positions,3));geometry.setAttribute('normal',new T.BufferAttribute(g.normals,3));geometry.setIndex(new T.BufferAttribute(g.index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,materials[g.material]);mesh.castShadow=mesh.receiveShadow=true;roots[g.bone].add(mesh);}return car;
}
