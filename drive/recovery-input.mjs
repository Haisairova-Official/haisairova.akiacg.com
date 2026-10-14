// A short release recovers locally; only an uninterrupted two-second hold respawns.
export function createRecoveryHold(seconds=2){
 let source=null,elapsed=0,fired=false;
 return{
  begin(id){if(source!==null)return false;source=id;elapsed=0;fired=false;return true;},
  step(dt){if(source===null||fired)return null;elapsed+=Math.max(0,dt);if(elapsed+1e-9>=seconds){fired=true;return 'spawn';}return null;},
  release(id){if(source!==id)return null;const result=fired?null:'local';source=null;elapsed=0;fired=false;return result;},
  cancel(){source=null;elapsed=0;fired=false;},
  get source(){return source;},get active(){return source!==null&&!fired;},get remaining(){return Math.max(0,seconds-elapsed);}
 };
}
