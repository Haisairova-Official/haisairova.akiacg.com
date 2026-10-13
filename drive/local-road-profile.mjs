import{measureRoad,clamp,roadMetrics}from'./local-road-paths.mjs?rev=world21d';
// Game-design cross sections (metres), not claims of civil-engineering approval.
export const LOCAL_ROAD_TYPES=Object.freeze({municipal:Object.freeze({name:'市政公路',width:8.5,laneWidth:3.5,sidewalk:1.8,speed:50/3.6}),rural:Object.freeze({name:'乡村公路',width:8.5,laneWidth:3.5,sidewalk:0,speed:45/3.6}),elevated:Object.freeze({name:'高架公路',width:8.5,laneWidth:3.5,sidewalk:0,speed:50/3.6})});
export const quintic=t=>{t=clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
// Each vertical span has zero endpoint first/second derivatives. A conservative
// Lipschitz envelope bounds its analytic grade (quintic derivative <=1.875).
// Requirements lift adjacent knots together; no max-of-bumps slope seams.
export function solveLocalProfile(plan,{startY,endY,naturalHeight=()=>0,requirements=()=>-Infinity,maxGrade=.05,knotSpacing=240,endFlat=85}={}){
 const measured=measureRoad(plan.map(p=>({...p,y:0}))),length=measured.at(-1).s;if(length<endFlat*2+100)return{valid:false,reason:'corridor-too-short'};
 const count=Math.max(2,Math.ceil((length-2*endFlat)/knotSpacing)),stations=[0,...Array.from({length:count+1},(_,i)=>endFlat+(length-2*endFlat)*i/count),length],knots=stations.map(s=>({s,y:-Infinity,fixed:false}));
 for(const i of[0,1])Object.assign(knots[i],{y:startY,fixed:true});for(const i of[knots.length-2,knots.length-1])Object.assign(knots[i],{y:endY,fixed:true});
 const samples=measured.map(p=>({...p,required:requirements(p),natural:naturalHeight(p.x,p.z)}));
 const interval=s=>{let lo=1;while(lo<knots.length-1&&knots[lo].s<s)lo++;return lo;};
 for(let i=2;i<knots.length-2;i++){const near=samples.filter(p=>Math.abs(p.s-knots[i].s)<knotSpacing*.65);knots[i].y=Math.max(0,near.reduce((sum,p)=>sum+p.natural,0)/Math.max(1,near.length)-3);}
 // Set both endpoints of each constrained interval at least as high as its
 // lower envelope. This is conservative, but robust between mesh samples.
 for(const p of samples)if(Number.isFinite(p.required)){const j=interval(p.s);for(const i of[j-1,j]){const k=knots[i];if(k.fixed&&k.y+1e-5<p.required)return{valid:false,reason:'constraint-at-fixed-approach',s:p.s,required:p.required,available:k.y};if(!k.fixed)k.y=Math.max(k.y,p.required);}}
 const limit=maxGrade/1.875;for(let pass=0;pass<knots.length;pass++){let changed=false;for(const direction of[1,-1])for(let t=0;t<knots.length-1;t++){const i=direction>0?t:knots.length-1-t,j=i+direction,a=knots[i],b=knots[j],min=a.y-Math.abs(b.s-a.s)*limit;if(b.y<min-1e-8){if(b.fixed)return{valid:false,reason:'insufficient-vertical-approach',s:b.s,required:min,available:b.y};b.y=min;changed=true;}}if(!changed)break;}
 const points=measureRoad(samples.map(p=>{const j=interval(p.s),a=knots[j-1],b=knots[j],t=(p.s-a.s)/(b.s-a.s),y=a.y+(b.y-a.y)*quintic(t);return{...p,y,planS:p.s,verticalConstraint:Number.isFinite(p.required)?p.required:null};}));
 const metrics=roadMetrics(points);if(metrics.maxGrade>maxGrade+1e-5)return{valid:false,reason:'grade-validation',metrics};if(points.some(p=>Number.isFinite(p.verticalConstraint)&&p.y+1e-5<p.verticalConstraint))return{valid:false,reason:'clearance-validation'};
 return{valid:true,points,knots,metrics,maxGrade,profile:'c2-quintic-knots-v1'};
}
export function classifyLocalProfile(points,{naturalHeight=()=>0,riverDistance=()=>Infinity,nearRoad=()=>false,municipalLength=380}={}){
 const length=points.at(-1).s;return points.map(p=>{const fromEnd=Math.min(p.s,length-p.s),municipal=1-quintic((fromEnd-municipalLength)/80),bridge=riverDistance(p.x,p.z)<80||nearRoad(p)||p.y-naturalHeight(p.x,p.z)>3.1,roadType=bridge?'elevated':municipal>.5?'municipal':'rural',profile=LOCAL_ROAD_TYPES[roadType];return{...p,roadType,structure:bridge?'bridge':'ground',bridge:bridge?1:0,width:profile.width,sidewalk:bridge?0:1.8*municipal,speed:profile.speed};});
}
