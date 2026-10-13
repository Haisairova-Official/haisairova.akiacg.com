export const createChallenge=()=>({active:false,finished:false,startX:0,furthest:0,elapsed:0,penalty:0,score:0,combo:0,safeTime:99,lastPass:99,result:0});
export function startChallenge(c,x){Object.assign(c,{active:true,finished:false,startX:x,furthest:x,elapsed:0,penalty:0,result:0});}
export function stepChallenge(c,x,dt){
 c.safeTime+=dt;c.lastPass+=dt;if(c.lastPass>7)c.combo=0;
 if(c.active){c.elapsed+=dt;c.furthest=Math.max(c.furthest,x);if(c.furthest-c.startX>=1000){c.active=false;c.finished=true;c.result=c.elapsed+c.penalty;}}
}
export function challengeContact(c){c.combo=0;c.safeTime=0;if(c.active)c.penalty+=3;}
export function safePass(c,base=100){if(c.safeTime<3)return false;c.combo++;c.lastPass=0;c.score+=Math.max(0,Math.min(200,base))*Math.min(c.combo,5);return true;}
