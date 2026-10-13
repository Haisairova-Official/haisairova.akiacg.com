import {powertrainSpec} from './powertrain-specs.mjs?rev=world21d';
import {gearboxSpec,transmissionModes} from './gearbox-specs.mjs?rev=world21d';
import {ensureTransmission} from './transmission.mjs?rev=world21d';
import {selectEVRange} from './ev-powertrain.mjs?rev=world21d';
export function transmissionChoices(kind){return powertrainSpec(kind).type==='ev'?[{value:'ev:1',label:'D · 单速原厂'},{value:'ev:0',label:'N · 单速原厂'},{value:'ev:-1',label:'R · 单速原厂'}]:transmissionModes(kind).map(value=>({value,label:gearboxSpec(kind,value).label}));}
export function syncTransmissionChoices(select,s,doc=globalThis.document){
 const list=transmissionChoices(s.vehicle),identity=list.map(o=>o.value+':'+o.label).join('|');
 if(select.dataset.choices!==identity){select.replaceChildren(...list.map(v=>{const o=doc.createElement('option');o.value=v.value;o.textContent=v.label;return o;}));select.dataset.choices=identity;}
 const ev=powertrainSpec(s.vehicle).type==='ev';select.value=ev?'ev:'+s.gear:s.transmission;select.setAttribute('aria-label',ev?'电驱方向：D前进、N滑行、R倒车':'变速模式');select.title=ev?'原厂单速固定减速；MT / AT / CVT 与离合不适用。D/R须停稳松油门。':'';
}
export function configureVehiclePowertrain(s,kind){
 const p=powertrainSpec(kind,s.tuning),previous=s.transmission;s.vehicle=kind;
 Object.assign(s,{motorRPM:0,motorRPMByAxle:{},motorTorque:0,motorPowerKW:0,regenForce:0,regenPowerKW:0,wheelForce:0,engineTorque:0,enginePower:0,clutchTorque:0,clutchSlip:0,clutchEngagement:0,clutch:0,stallTime:0,shiftCooldown:0,throttle:0,brakePressure:0,handbrakePressure:0});
 if(p.type==='ev'){s.transmission='ev';s.gear=1;s.tuning='stock';s.rpm=0;s.evReady=true;s.engineRunning=true;s.stallEnabled=false;}
 else{s.transmission=transmissionModes(kind).includes(previous)?previous:'at';s.gear=s.transmission==='mt'?0:1;s.engineRunning=true;s.rpm=p.idle;s.cvtRatio=gearboxSpec(kind,'cvt')?.max||0;delete s.evReady;}
 ensureTransmission(s);
}
// Used only for EV D/N/R. No position, speed, rigid-body or input mutation is
// hidden in the choice; the caller releases held controls after validation.
export function chooseElectricRange(s,value){if(!/^ev:(-1|0|1)$/.test(value))return{ok:false,reason:'此车使用原厂单速固定减速；MT / AT / CVT 未启用'};return selectEVRange(s,Number(value.slice(3)));}
