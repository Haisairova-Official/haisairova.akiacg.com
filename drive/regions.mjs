import{REGION_WORLD_SEED,regionHash,parseRegionKey}from'./region-key.mjs?rev=world21d';
export{REGION_WORLD_SEED}from'./region-key.mjs?rev=world21d';
// Stable destination identity is separate from interchange shape and streamed slot.
// These are game layouts. Owl's exact exterior/floor plan is not claimed as canon.
export const CRABBAY_INDEX=17,CRABBAY_REGION_ID='region:crabbay';
export const REGION_LAYOUT_VERSION=4;
const hash=regionHash;
export const ORIGIN_REGION=Object.freeze({id:'region:archive-origin',index:null,kind:'archive',name:'秋月存档街区',layoutId:'archive-original',layoutVersion:1,seed:hash('archive-origin'),destinationId:'destination:archive',sourceStatus:'original-site'});
export function regionForIndex(index){
 if(index===null||index===undefined)return ORIGIN_REGION;
 const generated=parseRegionKey(index);if(!generated&&(!Number.isSafeInteger(index)||index<1))throw new TypeError('Invalid region index');
 const urban=index===21,crabbay=index===CRABBAY_INDEX,id=crabbay?CRABBAY_REGION_ID:generated?`region:generated:${index}`:`region:local:${index}`,seed=hash(id),baker=index===5,names=['松溪','青石','柳岸','南田','榆湾','禾原'];
 return Object.freeze({id,index,kind:crabbay?'crabbay':baker?'baker':urban?'urban-viaduct':'village',name:crabbay?'螃蟹湾':baker?'迷你贝克街':urban?'望江高架街区':`${names[seed%names.length]}村 · ${generated?100+seed%900:index}`,layoutId:crabbay?'crabbay-quay':baker?'baker-crescent':urban?'urban-viaduct':['village-long-block','village-stepped-blocks','village-farm-collector'][seed%3],layoutVersion:crabbay||urban?1:baker?2:REGION_LAYOUT_VERSION,seed,hostFamily:generated?.family||'A',cell:generated?.cell??null,destinationId:crabbay?'destination:crabbay':baker?'destination:mini-baker-street':urban?'destination:urban-viaduct':generated?`destination:generated:${index}`:`destination:local:${index}`,sourceStatus:crabbay?'original-coastal-environment-prototype':baker?'original-prototype-inspired-by-pub-and-office':'procedural-original'});
}
export function regionById(id){if(id===CRABBAY_REGION_ID)return regionForIndex(CRABBAY_INDEX);if(id===ORIGIN_REGION.id)return ORIGIN_REGION;const generated=/^region:generated:(.+)$/.exec(id||'');if(generated)return parseRegionKey(generated[1])?regionForIndex(generated[1]):null;const m=/^region:local:([1-9]\d{0,15})$/.exec(id||'');return m&&Number.isSafeInteger(Number(m[1]))?regionForIndex(Number(m[1])):null;}
export const regionGeometryKey=(region,pose)=>[region.layoutId,region.layoutVersion,region.seed,...['x','z','y','angle'].map(k=>Number(pose[k]||0).toFixed(5)),...(region.kind==='village'?[pose.localConnected?'connected':'collector-only']:[])].join(':');
export const regionPose=pose=>({...pose,regionId:regionForIndex(pose.index).id,layoutId:regionForIndex(pose.index).layoutId});
