import{compactLocalCellResult}from'./local-road-loader.mjs?rev=world21d';
import{localCellCorridors,localAccessData}from'./local-road-catalogue.mjs?rev=world21d';
globalThis.onmessage=event=>{const{key,id,index,types}=event.data;try{const result=localCellCorridors(index,{getAccess:i=>localAccessData(i,types?.[String(i)])});globalThis.postMessage({key,id,result:compactLocalCellResult(result)});}catch(error){globalThis.postMessage({key,id,error:String(error?.message||error)});}};
