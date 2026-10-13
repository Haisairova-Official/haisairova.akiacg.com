// Stable choices are keyed by integer world cell and seed, never a display name.
// Suitability is separate: a requested form can fail without retaining its label.
export const MIXED_JUNCTION_SHARE=.60;
export const JUNCTION_LAYOUT_SALT=0x918;
const mod=(n,m)=>((n%m)+m)%m;
export function junctionRandom(i,k,seed=7127){let n=(Math.imul(i|0,374761393)^Math.imul(k|0,668265263)^(seed^JUNCTION_LAYOUT_SALT))>>>0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
export const junctionProfileKey=(i,maxLanes)=>mod(i,12)+':'+maxLanes;
export function selectJunctionLayout(j,profiles,seed=7127){const random=junctionRandom(j.i,j.k,seed),requested=random<MIXED_JUNCTION_SHARE?'mixed':'cloverleaf',phase=mod(j.i,12),maxLanes=j.maxLanes,profileKey=junctionProfileKey(j.i,maxLanes),profile=profiles[profileKey];
 const selection={requested,type:'cloverleaf',random,phase,maxLanes,profileKey,reason:requested==='cloverleaf'?'seed-cloverleaf':!profile?'profile-unavailable':!profile.feasible?(profile.reason||'profile-infeasible'):null};
 if(requested==='mixed'&&profile?.feasible)selection.type='mixed';return selection;
}
