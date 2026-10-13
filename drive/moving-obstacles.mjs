// Small kinematic obstacles (toll arms) keep collider/body identity while moving.
// This is separate from static trimesh streaming, so a barrier never needs a
// whole-world collider rebuild at animation frequency.
export function createMovingObstacleSet(R,world,tags,toLocal,removeContact=()=>{}){
 const entries=new Map();
 const remove=(key,e)=>{tags.delete(e.collider.handle);removeContact(e.collider.handle);world.removeRigidBody(e.body);entries.delete(key);};
 return{sync(items){const seen=new Set();for(const item of items){seen.add(item.id);const shape=[item.halfExtents.x,item.halfExtents.y,item.halfExtents.z].join('|');let e=entries.get(item.id);if(e&&e.shape!==shape){remove(item.id,e);e=null;}const p=toLocal(item.position),q=item.rotation;if(!e){const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x,p.y,p.z).setRotation(q).setCcdEnabled(true)),collider=world.createCollider(R.ColliderDesc.cuboid(item.halfExtents.x,item.halfExtents.y,item.halfExtents.z).setCollisionGroups((8<<16)|3).setFriction(.22).setRestitution(.08),body);tags.set(collider.handle,'wall');e={body,collider,shape};entries.set(item.id,e);}e.body.setNextKinematicTranslation(p);e.body.setNextKinematicRotation(q);e.collider.setEnabled(item.enabled!==false);e.body.setEnabled(item.enabled!==false);}
 for(const[key,e]of [...entries])if(!seen.has(key))remove(key,e);},get size(){return entries.size;},get entries(){return entries;},dispose(){for(const[key,e]of [...entries])remove(key,e);}};
}
