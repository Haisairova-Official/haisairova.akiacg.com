// Paint is explicitly tagged by the factory before cloning or mesh batching.
// Never infer paint from colour, roughness or a scene-wide material search.
export function paintMaterials(root){
 const result=new Set();root?.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.userData?.paintRole)result.add(material);});
 return [...result];
}
export function setVehiclePaint(root,hex=null){
 if(hex!==null&&!/^#[\da-f]{6}$/i.test(hex))throw new TypeError('Expected #RRGGBB or null');
 const materials=paintMaterials(root);
 for(const material of materials){material.userData.originalPaint??=material.color.getHex();material.color.set(hex??material.userData.originalPaint);}
 return materials.length;
}
// Preview and uncommitted factory instances own these resources. Never call
// this on a committed player, cached vehicle or NPC.
export function disposePreview(root,{additionalRoots=[]}={}){
 const geometries=new Set(),materials=new Set(),instances=new Set();for(const part of [root,...additionalRoots])part?.traverse(object=>{if(object.isInstancedMesh)instances.add(object);if(object.geometry)geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);});
 for(const part of [root,...additionalRoots])part?.removeFromParent();for(const item of instances)item.dispose();for(const item of geometries)item.dispose();for(const item of materials)item.dispose();
}
