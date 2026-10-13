// Deterministic traffic decisions. All distances are metres; speeds are m/s.
export const laneCenters=d=>d>0?[13,19,25]:[-14,-8,-2];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smoothLane=t=>{t=clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
export function initTraffic(t){t.preferredSpeed=Math.min(t.maxSpeed??Infinity,15+(t.id*7%19));t.velocity=t.preferredSpeed;t.lane=t.z;t.change=null;t.laneCooldown=2+(t.id%5);t.signal=0;t.changes=0;t.generation=(t.generation||0)+1;}
export function clearOfJunction(x,distance=0,direction=1){
 const lo=Math.min(x,x+distance*direction),hi=Math.max(x,x+distance*direction);
 for(let i=Math.max(1,Math.floor((lo-40)/720));i<=Math.ceil((hi-40)/720)+1;i++){const e=40+i*720;if(hi>e-235&&lo<e+355)return false;}return true;
}
export function occupiesLane(o,z){return Math.abs(o.z-z)<Math.max(2.25,(o.width||1.65)/1.25+.6)||!!o.change&&(!o.change.returning&&Math.abs(o.change.to-z)<.1||Math.abs(o.change.from-z)<.1);}
const occupies=occupiesLane;
function actors(t,traffic,player){return traffic.filter(o=>o!==t&&o.direction===t.direction).concat(player&&(player.roadY||0)<1&&(t.lanes||laneCenters(t.direction)).some(z=>Math.abs(player.z-z)<3.2)?[{...player,velocity:Math.max(0,(player.vx??player.speed)*t.direction),isPlayer:true}]:[]);}
export function laneSafe(t,to,traffic,player){
 if(!(t.lanes||laneCenters(t.direction)).includes(to))return false;
 for(const o of actors(t,traffic,player)){
  if(!occupies(o,to))continue;const gap=(o.x-t.x)*t.direction,ov=o.observedVelocity??o.velocity??o.speed??0;
  const extra=gap>=0?(t.frontExtent??1.825)+(o.rearExtent??1.825)-3.65:(o.frontExtent??1.825)+(t.rearExtent??1.825)-3.65,free=Math.abs(gap)-extra;
  if(gap>=0){if(free<10+t.velocity*.85||((t.velocity-ov)>.1&&free/(t.velocity-ov)<4)||free<Math.max(0,t.velocity*t.velocity/(2*(t.braking||9))-ov*ov/(2*(o.braking||9)))+8)return false;}
  else if(free<10+ov*.95||((ov-t.velocity)>.1&&free/(ov-t.velocity)<4.5))return false;
 }
 return true;
}
function leader(t,z,traffic,player){let best={gap:Infinity,velocity:t.preferredSpeed};for(const o of actors(t,traffic,player)){const raw=(o.x-t.x)*t.direction,gap=raw-((t.frontExtent??1.825)+(o.rearExtent??1.825)-3.65);if(raw>0&&occupies(o,z)&&gap<best.gap)best={gap,velocity:o.observedVelocity??o.velocity??o.speed??0};}return best;}
export function stepTraffic(traffic,player,dt){
 for(const t of traffic){
  if(t.reservation)continue;
  t.laneCooldown=Math.max(0,t.laneCooldown-dt);
  const ahead=leader(t,t.z,traffic,player);
  if(!t.change&&t.laneCooldown===0&&ahead.gap<18+t.preferredSpeed*2.3&&ahead.velocity<t.preferredSpeed-1.5){
   const choices=(t.lanes||laneCenters(t.direction)).filter(z=>Math.abs(z-t.lane)===6).sort((a,b)=>leader(t,b,traffic,player).gap-leader(t,a,traffic,player).gap);
   for(const to of choices)if((Math.max(to,t.lane)<(t.lanes?.at(-1)??25)||t.direction<0||clearOfJunction(t.x,(t.preferredSpeed+2)*4.4,t.direction))&&laneSafe(t,to,traffic,player)&&leader(t,to,traffic,player).gap>ahead.gap+12){t.change={from:t.lane,to,time:0};t.signal=Math.sign(t.lane-to)*t.direction;break;}
  }
  if(t.change){
   const c=t.change,duration=t.changeDuration??3.2;
   if(c.returning){
    // The target lane was never entered. Release its reservation immediately,
    // then retrace the same smooth lateral curve without a position jump.
    c.time=Math.max(1,c.time-dt);t.z=c.from+(c.to-c.from)*smoothLane((c.time-1)/duration);
    if(c.time===1){t.lane=c.from;t.change=null;t.signal=0;t.laneCooldown=4+t.id%3;}
   } else {
    c.time+=dt;
    if(c.time<1&&!laneSafe(t,c.to,traffic,player)){t.change=null;t.signal=0;t.laneCooldown=3;}
    else if(c.time>=1){
     const next=c.from+(c.to-c.from)*smoothLane((c.time-1)/duration);
     // Recheck front/rear gap and TTC before entering the target lane. Keeping
     // its reservation while waiting would make a polite rear NPC brake too,
     // creating a deadlock. Withdraw instead and let that vehicle pass first.
     const unsafeApproach=Math.abs(t.z-c.to)>2.3&&!laneSafe(t,c.to,traffic,player);
     if(unsafeApproach){c.time-=dt;c.returning=true;t.signal=0;}
     else if(actors(t,traffic,player).some(o=>Math.abs(o.x-t.x)<8+Math.max((t.frontExtent??1.825)+(o.rearExtent??1.825),(o.frontExtent??1.825)+(t.rearExtent??1.825))-3.65&&Math.abs(o.z-next)<2.3)){c.time-=dt;t.velocity=Math.max(0,t.velocity-10*dt);}
     else {t.z=next;if(c.time>=1+duration){t.lane=c.to;t.change=null;t.signal=0;t.laneCooldown=7+t.id%4;t.changes++;}}
    }
   }
  }
  const fronts=[leader(t,t.z,traffic,player)];if(t.change&&!t.change.returning)fronts.push(leader(t,t.change.to,traffic,player));
  let target=t.preferredSpeed,hard=Infinity;
  for(const f of fronts){hard=Math.min(hard,f.gap-7);target=Math.min(target,Math.max(0,f.velocity+(f.gap-(10+t.velocity*1.1))*.7));}
  t.velocity+=clamp(target-t.velocity,-(t.braking||9)*dt,2.4*dt);
  const dx=Math.min(t.velocity*dt,Math.max(0,hard));if(dx<t.velocity*dt)t.velocity=dx/dt;
  t.x+=dx*t.direction;t.speed=t.velocity;
 }
}
