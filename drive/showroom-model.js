import{createYaris}from'./yaris-model.js?rev=world21d';
import{createCHR,prepareCHR}from'./chr-model.js?rev=world21d';
import{createFleetVehicle,setFleetVisualMode}from'./fleet-models.js?rev=world21d';
import{FLEET}from'./fleet-specs.mjs?rev=world21d';
import{vehicleSpec}from'./vehicle-specs.mjs?rev=world21d';
import{powertrainSpec}from'./powertrain-specs.mjs?rev=world21d';
import{GEARBOXES,transmissionModes}from'./gearbox-specs.mjs?rev=world21d';
export const SHOWROOM_CARS=Object.freeze([{id:'yaris',label:'丰田 Yaris / Vitz'},{id:'chr',label:'白色一代 C-HR'},...Object.entries(FLEET).map(([id,s])=>({id,label:s.label}))]);
export async function createShowroomModel(T,kind,{mode='tracks',yieldFrame}={}){
 if(!SHOWROOM_CARS.some(c=>c.id===kind))throw new Error('Unknown showroom vehicle');
 if(kind==='chr')await prepareCHR(yieldFrame);
 const car=kind==='yaris'?createYaris(T):kind==='chr'?createCHR(T):createFleetVehicle(T,kind),root=new T.Group();root.add(car);
 if(kind==='bt7')setFleetVisualMode(car,mode);
 const trailer=car.userData.trailerModel;
 if(trailer){const hitch=FLEET.dayun.trailer.hitch;trailer.position.set(hitch.tractor.x-hitch.trailer.x,hitch.tractor.y-hitch.trailer.y,hitch.tractor.z-hitch.trailer.z);root.add(trailer);}
 root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());
 root.position.set(-centre.x,-box.min.y,-centre.z);root.updateMatrixWorld(true);
 return{root,car,size,kind};
}
export function showroomFacts(kind){
 const g=vehicleSpec(kind),p=powertrainSpec(kind,'stock'),gear=GEARBOXES[kind],f=FLEET[kind],rows=[
  ['配置',`${gear.year||'当前配置（官网未标年款）'} · ${gear.market} · ${gear.configuration}`],
  [kind==='bt7'?'战斗质量参考（含乘员）':'模型整备质量',`${p.kerbMass.toLocaleString('zh-CN')} kg${kind==='yaris'?'（官方范围中点估计）':kind==='chr'?'（1320–1390 kg范围中点估计；MT/CVT共用）':kind==='et5t'?'（中国当前配置质量未公开，游戏估计）':''}`],
  ['游戏工况',`${p.mass.toLocaleString('zh-CN')} kg${f?.trailer?` 牵引车 + ${f.trailer.mass.toLocaleString('zh-CN')} kg 挂车/载荷`:p.driverMass?`（含驾驶员 ${p.driverMass} kg）`:''}`],
  ['尺寸参考',`${g.length.toFixed(3)} × ${g.width.toFixed(3)} × ${g.height.toFixed(3)} m${f?.trailer?'（牵引车；挂车另长13m）':''}`],
  ['轴距参考',`${g.wheelbase.toFixed(3)} m`],
  ['原厂峰值参考',`${p.peakPowerKW} kW · ${p.peakTorque} N·m`],
  ['变速箱', transmissionModes(kind).map(k=>gear[k].label).join(' / ')],
  [p.type==='ev'?'动力调校':'街机调校',p.type==='ev'?'原厂电驱峰值、单速固定减速；未启用街机倍率或MT/CVT模拟':`扭矩 ×${powertrainSpec(kind).gameTorqueMultiplier} · 终传 ×${powertrainSpec(kind).gameFinalDrive}；驾驶设置可切原厂参考`],
  ['估计与边界',f?.assumptions||'重心、惯量、完整扭矩曲线中间节点、悬架及阻力为游戏估计；并非整车认证仿真']
 ];
 if(p.type==='ev'){rows.push(['电驱与电池',`${p.motors.map(m=>(m.axle==='front'?'前':'后')+'电机 '+m.peakPowerKW+'kW').join(' + ')} · ${p.batteryKWh}kWh（容量资料，未模拟消耗）`],['固定减速模型',`${p.motors.map(m=>(m.axle==='front'?'前':'后')+'轴 '+m.reductionRatio.toFixed(1)+':1').join(' / ')} · 比值估计；无离合、怠速、MT或CVT模拟`]);}
 if(kind==='chr')rows.unshift(['外观与动力','中国2020外观风格化近似（车长4.405m）；动力和表中配置仍为2017英国1.2T，不是中国2.0L']);
 if(kind==='bt7')rows.push(['轮履状态','1935型；可在预览中观察轮式/履带。实际驾驶须停稳按T切换，履带拆装简化，无武器功能']);
 if(kind==='dayun')rows.push(['调色范围','只改变驾驶室车漆，挂厢、轮胎和灯具保持原色']);
 return{rows,source:gear.source};
}
