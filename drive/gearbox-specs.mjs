import {FLEET_GEARBOXES} from './fleet-specs.mjs?rev=world21d';
// Configuration-level availability. A gearbox from another market/year is not inherited.
export const GEARBOXES={
 ...FLEET_GEARBOXES,
 yaris:{year:1999,market:'英国',configuration:'Yaris 1.0 GLS 三门 · 1SZ-FE',source:'https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/Gen1-Yaris-archive-press-pack.pdf',
  mt:{label:'MT · 5 挡',factory:true,kind:'manual'},at:{label:'AT（模拟）',factory:false,kind:'automated-manual-assist'},
  cvt:{label:'CVT（模拟）',factory:false,kind:'belt-cvt',min:.45,max:2.5,finalDrive:5.5,reverse:2.4,response:.48,rate:1.25,assumption:'本配置无原厂 CVT；比值、终传和控制响应为游戏假设'}},
 chr:{year:2017,market:'英国',configuration:'C-HR 1.2T FWD · 8NR-FTS',source:'https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/C-HR-gen1-Nov-2016.pdf',
  mt:{label:'MT · 6 挡',factory:true,kind:'manual'},at:{label:'AT（模拟）',factory:false,kind:'automated-manual-assist'},
  cvt:{label:'CVT · 原厂类型',factory:true,kind:'belt-cvt',min:.396,max:2.480,finalDrive:5.698,reverse:2.604,response:.52,rate:1.2,assumption:'前进比值与终传为官方参数；控制响应估计。机械 CVT，不是混动 e-CVT'}}
};
export const gearboxSpec=(kind,mode='mt')=>(GEARBOXES[kind]||GEARBOXES.yaris)[mode];
export function effectivePowertrain(base,state){
 if(base.type==='ev')return base;
 let p=base;const g=gearboxSpec(state.vehicle,state.transmission||'mt');
 if(g?.ratios)p={...p,ratios:g.ratios,reverse:g.reverse??p.reverse,finalDrive:g.finalDrive??p.finalDrive};
 if(state.transmission==='cvt')p={...p,ratioOverride:state.gear<0?-g.reverse:state.gear===0?0:(state.cvtRatio??g.max),finalDrive:g.finalDrive};
 if(state.vehicle==='bt7'&&state.driveMode==='wheels')p={...p,tyreRadius:.409,finalDrive:p.finalDrive*.908,rollingResistance:.014};
 return p;
}

export const transmissionModes=kind=>['mt','at','cvt','ev'].filter(mode=>gearboxSpec(kind,mode));
