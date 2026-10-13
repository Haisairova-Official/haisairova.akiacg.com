import{annotate}from'./interchange-logic.mjs?rev=world21d';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
const line=(a,b,grade=null)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.5);return Array.from({length:n+1},(_,i)=>{const t=i/n;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,grade?grade(t):a[2]+(b[2]-a[2])*t];});};
// Smooth curvature ramps at both ends, rather than instant straight→circle steering.
const arc=(cx,cz,r,a,b,y)=>{const n=Math.ceil(Math.abs(b-a)*r/1.35),ramp=.15,integral=t=>2.5*t**4-3*t**5+t**6,turn=u=>{if(u<ramp)return ramp*integral(u/ramp);if(u<=1-ramp)return u-ramp/2;const t=(u-1+ramp)/ramp;return 1-1.5*ramp+ramp*(t-integral(t));},start=[cx+r*Math.cos(a),cz+r*Math.sin(a)],end=[cx+r*Math.cos(b),cz+r*Math.sin(b)],initial=a+Math.sign(b-a)*Math.PI/2,unit=[[0,0]];let x=0,z=0;for(let i=1;i<=n;i++){const h=initial+(b-a)*turn((i-.5)/n)/(1-ramp);x+=Math.cos(h)/n;z+=Math.sin(h)/n;unit.push([x,z]);}const scale=Math.hypot(end[0]-start[0],end[1]-start[1])/Math.hypot(x,z),points=unit.map(p=>[start[0]+p[0]*scale,start[1]+p[1]*scale,y]);points[0]=[...start,y];points[points.length-1]=[...end,y];return points;};
const measure=raw=>annotate(raw).map((p,i,list)=>{const a=list[Math.max(0,i-1)],b=list[Math.min(list.length-1,i+1)];return{...p,heading:Math.atan2(b.x-a.x,b.z-a.z),grade:(b.y-a.y)/Math.max(.001,Math.hypot(b.x-a.x,b.z-a.z))};});
// One connected urban corridor, with a real upper deck crossing the two
// ground streets. These game dimensions are not an engineering certification.
export function buildUrbanViaductLayout(region,profile){
 const sections=[
 ['ground-in',line([44,-19,0],[-340,-19,0]),'urban'],
 ['west-south-turn',arc(-340,-89,70,Math.PI/2,Math.PI,0),'urban'],
 ['west-south-street',line([-410,-89,0],[-410,-100,0]),'urban'],
 ['south-turn',arc(-340,-100,70,Math.PI,3*Math.PI/2,0),'urban'],
 ['ramp-up',line([-340,-170,0],[-60,-170,8],t=>8*smooth(t)),'urban-ramp'],
 ['upper-south-turn',arc(-60,-100,70,-Math.PI/2,0,8),'elevated'],
 ['upper-cross-street',line([10,-100,8],[10,151,8]),'elevated'],
 ['upper-north-turn',arc(-60,151,70,0,Math.PI/2,8),'elevated'],
 ['ramp-down',line([-60,221,8],[-340,221,0],t=>8*(1-smooth(t))),'urban-ramp'],
 ['north-turn',arc(-340,151,70,Math.PI/2,Math.PI,0),'urban'],
 ['west-north-street',line([-410,151,0],[-410,89,0]),'urban'],
 ['west-return-turn',arc(-340,89,70,Math.PI,3*Math.PI/2,0),'urban'],
 ['ground-out',line([-340,19,0],[44,19,0]),'urban']
 ];
 const raw=[],labels=[];for(const [id,points,type]of sections)for(const p of raw.length?points.slice(1):points){raw.push(p);labels.push({sectionId:id,roadType:type});}const centre=measure(raw),length=centre.at(-1).s;
 for(let i=0;i<centre.length;i++)Object.assign(centre[i],labels[i],{rightApron:1.8*smooth((centre[i].s-4)/25)*smooth((length-centre[i].s-4)/25)});
 const through=measure(centre.map(p=>{const offset=1.6*smooth((p.s-6)/18)*smooth((length-p.s-6)/18);return[p.x+Math.cos(p.heading)*offset,p.z-Math.sin(p.heading)*offset,p.y];}));for(let i=0;i<through.length;i++)Object.assign(through[i],labels[i]);
 const parking={id:'viaduct-parking',x:-170,z:-36,heading:Math.PI,landmarkId:'destination:urban-viaduct'},main={id:`${region.id}:street`,kind:'town',role:'through',roadType:'elevated',structure:'mixed',layer:0,...profile,points:centre},spur={id:`region:${region.index}:parking`,kind:'town',role:'parking',roadType:'urban',structure:'ground',layer:0,width:8,speed:10/3.6,sidewalk:0,points:measure(line([-170,-19-profile.width/2,0],[-170,-46,0]))};
 return{region,roads:[main,spur],through,ports:{in:{x:44,z:-19,y:0,heading:-Math.PI/2},out:{x:44,z:19,y:0,heading:Math.PI/2}},bounds:{minX:-440,maxX:45,minZ:-200,maxZ:251},groundBounds:{minX:-440,maxX:45,minZ:-200,maxZ:251},terrainPad:{centerX:-197.5,centerZ:25.5,halfX:242.5,halfZ:225.5,preserveRiver:true},parking:[parking],landmarks:[{id:'destination:urban-viaduct',name:region.name,kind:'place',x:-170,z:-45,description:'独立城市高架道路：沿上坡接入8米高架，越过两条地面街道，再沿下坡回到高速入口。原型选值，不代表真实工程认证。'}],spawn:{...through.reduce((best,p)=>p.s>8&&p.s<50&&Math.abs(p.x-20)<Math.abs(best.x-20)?p:best,through[0])},length:through.at(-1).s,sections:sections.map(([id,,roadType])=>({id,roadType})),viaduct:{height:8,cornerExtent:70,curvatureTransition:.15,rampLength:280,maximumGrade:.055,deckDepth:1.58}};
}
