// Each open/selection owns one request generation. Stale completion is discarded.
export function createShowroomState(){
 let opened=false,generation=0,current=null,loading=false,error='';const applied=new Map(),drafts=new Map();
 return {
  get opened(){return opened;},get current(){return current;},get loading(){return loading;},get error(){return error;},
  open(){opened=true;drafts.clear();return ++generation;},
  close(){opened=false;loading=false;error='';current=null;drafts.clear();++generation;},
  request(kind){loading=true;error='';return {generation:++generation,kind};},
  valid(token){return opened&&token.generation===generation;},
  complete(token){if(!this.valid(token))return false;current=token.kind;loading=false;error='';return true;},
  fail(token,message){if(!this.valid(token))return false;loading=false;error=String(message);return true;},
  draft(kind,color){if(color!==null&&!/^#[\da-f]{6}$/i.test(color))throw new TypeError('Expected #RRGGBB or null');drafts.set(kind,color);},
  color(kind){return drafts.has(kind)?drafts.get(kind):applied.get(kind)??null;},
  applied(kind){return applied.get(kind)??null;},
  apply(kind){const value=this.color(kind);applied.set(kind,value);return value;}
 };
}
