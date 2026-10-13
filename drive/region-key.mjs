// Canonical, colon-free generated indices preserve existing town:<key>:<type>
// consumers. Existing eastbound A cells retain their numeric region identities.
export const REGION_WORLD_SEED=7127;
export function regionHash(text){let n=REGION_WORLD_SEED;for(const ch of String(text))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;}
export function canonicalFamily(family){if(['A','B','C','D'].includes(family))return family;const m=/^([HV])(-?[1-9]\d*)$/.exec(family||'');if(!m)return null;const index=Number(m[2]);return Number.isSafeInteger(index)&&index!==1?family:null;}
export function parseRegionKey(key){if(typeof key!=='string')return null;const m=/^([^~]+)~(0|[1-9]\d*|-[1-9]\d*)$/.exec(key);if(!m||!canonicalFamily(m[1]))return null;const cell=Number(m[2]);if(!Number.isSafeInteger(cell)||m[1]==='A'&&cell>=0)return null;return{family:m[1],cell,key};}
export function regionKeyFor(family,cell){if(!canonicalFamily(family)||!Number.isSafeInteger(cell))throw new TypeError('Invalid regional cell');if(family==='A'&&cell>=0){const index=5+cell*4;if(!Number.isSafeInteger(index))throw new RangeError('Regional index exceeds coordinate precision');return index;}return`${family}~${cell}`;}
export function regionCell(index){const parsed=parseRegionKey(index);if(parsed)return parsed;if(Number.isSafeInteger(index)&&index>=1)return{family:'A',cell:Math.floor((index-5)/4),key:index,legacy:true};return null;}
