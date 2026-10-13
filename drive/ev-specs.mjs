// Configuration-scoped EV anchors, checked against the manufacturers' current
// Chinese configurators on 2026-10-11. Unknown values are explicit estimates.
// No petrol curve, idle speed, clutch or CVT is synthesized for either vehicle.
const single={ev:{label:'EV · 单速固定减速',factory:true,kind:'fixed-reduction',assumption:'原厂单速类型；具体减速比未公开，模型比值为估计'}};
const motor=(axle,kw,nm,ratio)=>({axle,peakPowerKW:kw,peakTorque:nm,reductionRatio:ratio,maxRPM:18000});
const common={type:'ev',driverMass:75,efficiency:.95,rollingResistance:.011,gameTorqueMultiplier:1,gameFinalDrive:1,rotorInertiaModel:'刚性运动学约束，忽略未公开的转子惯量',regen:{liftOffDecel:.65,serviceMaxDecel:2.5,maxWheelPowerKW:100,fadeSpeed:1.6}};
export const EV_FLEET={
 et5t:{label:'蔚来 ET5T · 100kWh',year:2026,market:'中国',configuration:'标准版 / TT5007 · 100kWh · 19英寸',source:'https://www.nio.cn/vehicle/configuration/tt5',
 geometry:{length:4.790,width:1.960,height:1.499,wheelbase:2.888,frontTrack:1.685,rearTrack:1.685,outerTyreRadius:6.0},
 physical:{cgHeight:.49,cgForward:0,drive:'awd',driveFrontShare:150/360,mu:1.10,corneringStiffness:57000,suspensionRest:.27,suspensionSag:.055},
 powertrain:{...common,name:'2026 中国 ET5T 标准版 100kWh / 19寸 · 双电机四驱',peakTorque:700,peakPowerKW:360,kerbMass:2250,mass:2325,tyreRadius:.35155*.97,dragArea:.53,batteryKWh:100,motors:[motor('front',150,700*150/360,9),motor('rear',210,700*210/360,9)]},
 gearboxes:single,referencePerformance:{zeroTo100:4.0,topSpeedKmh:null},
 provenance:{official:['year','dimensions','wheelbase','power','totalTorque','battery','tyres','five-link/CDC'],derived:['unloadedTyreRadius'],estimated:['mass','track','turningGeometry','motorTorqueSplit','reductionRatio','maxMotorRPM','cg','inertia','grip','drag','regen','suspensionControl']},
 assumptions:'官方：2026中国标准100kWh/19寸，360kW/700N·m，前150后210kW、245/45R19、五连杆+CDC。整备质量2250kg、轮距、转弯几何、前后扭矩分配、9:1减速比及18000rpm电机上限均为游戏估计；未复现CDC控制器。转子惯量/电量消耗暂未模拟，回收为驾驶模型；不是官方续航测试。'},
 lynk10ev:{label:'领克 10 EV · 816 Ultra',year:null,market:'中国当前官方配置',configuration:'816 兆瓦智充 Ultra · 单电机后驱 · 19英寸',source:'https://www.lynkco.com.cn/cars/10ev/10-configurator',
 geometry:{length:5.050,width:1.966,height:1.468,wheelbase:3.005,frontTrack:1.700,rearTrack:1.700,outerTyreRadius:5.7},
 physical:{cgHeight:.49,cgForward:-.075,drive:'rwd',mu:1.07,corneringStiffness:59000,suspensionRest:.27,suspensionSag:.055},
 powertrain:{...common,name:'中国 领克10 EV 816兆瓦智充Ultra / 19寸 · 后驱',peakTorque:535,peakPowerKW:370,kerbMass:2317,mass:2392,tyreRadius:.3638*.97,dragArea:.51,batteryKWh:95,speedLimiterKmh:240,motors:[motor('rear',370,535,9.2)]},
 gearboxes:single,referencePerformance:{zeroTo100:5.2,topSpeedKmh:240},
 provenance:{official:['dimensions','wheelbase','mass','power','torque','battery','tyres','turningRadius','topSpeed'],derived:['unloadedTyreRadius'],estimated:['track','turningGeometry','reductionRatio','maxMotorRPM','cg','inertia','grip','drag','regen','suspensionControl']},
 assumptions:'官方当前816兆瓦智充Ultra：2317kg、370kW/535N·m后驱、95kWh、245/50R19、240km/h；官网未明示本配置年款。轮距1700mm、9.2:1减速比、18000rpm电机上限、重心/惯量/回收均为估计，5.7m转弯半径的测量口径未说明，转向几何近似。未含21寸/黄卡钳/主动尾翼选装包；转子惯量与电量消耗暂未模拟。'}
};
export const isEVKind=kind=>Object.hasOwn(EV_FLEET,kind);
