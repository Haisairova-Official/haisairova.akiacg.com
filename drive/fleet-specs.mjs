import {EV_FLEET} from './ev-specs.mjs?rev=world21d';
// Configuration-specific anchors. Unpublished CG, inertia, complete curves,
// suspension and gearbox ratios are explicit estimates, never factory claims.
const radius=(w,a,r)=>(r*.0254/2+w/1000*a)*.97;
const cvt=(finalDrive=5.2)=>({label:'CVT（模拟）',factory:false,kind:'belt-cvt',min:.42,max:2.6,finalDrive,reverse:2.5,response:.6,rate:1.1,assumption:'该配置无原厂机械CVT；比值与响应为游戏估计'});
export const FLEET={
 ...EV_FLEET,
 lynk03:{label:'领克 03+',year:2019,market:'中国',configuration:'03+ 2.0TD 自动性能套装',source:'https://dm30webimages.lynkco.com.cn/LynkCoPortal/Files/dz0629/03jia/03jia.pdf',
 geometry:{length:4.692,width:1.840,height:1.461,wheelbase:2.730,frontTrack:1.587,rearTrack:1.587,outerTyreRadius:5.7},
 physical:{cgHeight:.54,cgForward:.08,drive:'awd',mu:1.05,corneringStiffness:47000},
 engine:{peakTorque:350,peakTorqueRPM:1800,peakPowerKW:187,peakPowerRPM:5500,ratios:[3.7,2.1,1.45,1.1,.86,.68],reverse:3.2,finalDrive:3.8,torqueCurve:[[700,100],[1000,175],[1800,350],[4800,350],[5500,324.7],[6500,240]],kerbMass:1615,driverMass:75,mass:1690,tyreRadius:radius(245,.35,19),dragArea:.64,engineInertia:.27,clutchCapacity:680,rollingResistance:.012,efficiency:.90,idle:800,redline:6500,gameTorqueMultiplier:1.18,gameFinalDrive:1},
 gearboxes:{mt:{label:'MT · 6挡（模拟）',factory:false,kind:'manual'},at:{label:'AT · 8挡',factory:true,kind:'torque-converter',ratios:[5.25,3.03,1.95,1.46,1.22,1,.81,.67],reverse:4.02,finalDrive:3.33,assumption:'原厂8AT类型；逐挡比值未公开，采用明确估计值'},cvt:cvt()},
 assumptions:'轮距为次级资料；转弯半径、重心、惯量、齿比与完整扭矩曲线估计'},
 civic8:{label:'本田 八代思域',year:2005,market:'日本',configuration:'Civic 1.8GL DBA-FD1 · R18A',source:'https://www.honda.co.jp/factbook/auto/CIVIC/200509/26.html',
 geometry:{length:4.540,width:1.750,height:1.440,wheelbase:2.700,frontTrack:1.500,rearTrack:1.525,outerTyreRadius:5.4},
 physical:{cgHeight:.51,cgForward:.27,drive:'fwd',mu:1,corneringStiffness:37000},
 engine:{peakTorque:174,peakTorqueRPM:4300,peakPowerKW:103,peakPowerRPM:6300,ratios:[3.142,1.869,1.235,.948,.727],reverse:3.307,finalDrive:4.294,torqueCurve:[[650,60],[1000,88],[2200,137],[4300,174],[5500,166],[6300,156.1],[6800,120]],kerbMass:1240,driverMass:75,mass:1315,tyreRadius:radius(205,.55,16),dragArea:.55,engineInertia:.20,clutchCapacity:380,rollingResistance:.012,efficiency:.9,idle:750,redline:6800,gameTorqueMultiplier:1.4,gameFinalDrive:1},
 gearboxes:{mt:{label:'MT · 5挡（模拟）',factory:false,kind:'manual',assumption:'1.8GL未配MT；比值参考同年日本1.8G'},at:{label:'AT · 5挡',factory:true,kind:'torque-converter',ratios:[2.666,1.534,1.066,.756,.550],reverse:1.956,finalDrive:4.437},cvt:cvt()},assumptions:'原厂参数均为日本1.8GL；非混动CVT，重心/惯量/阻力/曲线中间节点估计'},
 santana2000:{label:'桑塔纳 2000',year:2001,market:'中国',configuration:'时代超人1.8 · SVW7182GFi / AYJ',source:'https://www.mee.gov.cn/gkml/zj/wj/200910/t20091022_172111.htm',secondarySource:'https://auto.sina.com.cn/salon/BAICVOLKSWAGEN/BAICVOLKSWAGEN/santana2000sdcr/canshu.shtml',
 geometry:{length:4.680,width:1.700,height:1.423,wheelbase:2.656,frontTrack:1.414,rearTrack:1.422,outerTyreRadius:5.5},
 physical:{cgHeight:.52,cgForward:.28,drive:'fwd',mu:.94,corneringStiffness:33500},
 engine:{peakTorque:155,peakTorqueRPM:3800,peakPowerKW:74,peakPowerRPM:5200,ratios:[3.45,1.94,1.29,.97,.80],reverse:3.17,finalDrive:4.11,torqueCurve:[[650,65],[1000,92],[2000,127],[3800,155],[5200,135.9],[6000,100]],kerbMass:1140,driverMass:75,mass:1215,tyreRadius:radius(195,.6,14),dragArea:.62,engineInertia:.23,clutchCapacity:340,rollingResistance:.013,efficiency:.89,idle:850,redline:6000,gameTorqueMultiplier:1.5,gameFinalDrive:.95},
 gearboxes:{mt:{label:'MT · 5挡',factory:true,kind:'manual',assumption:'5MT类型有历史资料；完整齿比为估计'},at:{label:'AT（模拟）',factory:false,kind:'automated-manual-assist'},cvt:cvt()},assumptions:'发动机型号来自环保公告；尺寸/质量/功率来自历史次级资料，逐挡比与重心估计'},
 dayun:{label:'大运 N8E 半挂车',year:2021,market:'中国',configuration:'新N8E3.0 6×4 · WP10.5H430E62 / 12JSD200TA-B',source:'https://www.dayunmotor.com/news-newsdetail-63-7688',
 geometry:{length:6.85,width:2.49,height:3.5,wheelbase:3.975,frontTrack:2.03,rearTrack:1.86,outerTyreRadius:8.0},
 physical:{cgHeight:1.15,cgForward:.18,drive:'6x4',mu:.86,corneringStiffness:90000,suspensionRest:.36,suspensionSag:.09,axles:[{z:2.1,track:2.03,steer:1,drive:0,parking:0},{z:-1.2,track:1.86,steer:0,drive:.5,parking:.5},{z:-2.55,track:1.86,steer:0,drive:.5,parking:.5}]},
 engine:{peakTorque:2000,peakTorqueRPM:1000,peakPowerKW:316,peakPowerRPM:1900,ratios:[12.10,9.41,7.31,5.71,4.46,3.48,2.71,2.11,1.64,1.28,1,.78],reverse:11.56,finalDrive:3.7,torqueCurve:[[400,500],[650,1100],[1000,2000],[1400,2000],[1900,1588],[2100,1200]],kerbMass:7800,driverMass:75,mass:7875,tyreRadius:.5,dragArea:5.6,engineInertia:2.6,clutchCapacity:3200,rollingResistance:.007,efficiency:.88,idle:650,redline:2150,gameTorqueMultiplier:1.15,gameFinalDrive:1,frictionBase:65,frictionRPM:.03,coastFrictionRPM:.025,idleGain:1.4,idleMax:260,launchRPM:950,stallRPM:380,shiftUpRPM:1900,shiftDownRPM:950},
 gearboxes:{mt:{label:'MT · 12挡',factory:true,kind:'manual'},at:{label:'AT · 12挡（模拟）',factory:false,kind:'automated-manual-assist'},cvt:{...cvt(3.7),min:.78,max:12.1,rate:3,response:.85,reverse:11.56}},
 trailer:{mass:14000,emptyMass:6000,payload:8000,length:13,width:2.5,height:3.6,cgHeight:1.9,cgForward:0,radius:.5,hitch:{tractor:{x:0,y:1.25,z:-1.4},trailer:{x:0,y:1.25,z:4.75}},axles:[{z:-3.1,track:1.86},{z:-4.4,track:1.86},{z:-5.7,track:1.86}]},
 assumptions:'牵引车7800kg/驾驶室2490mm/发动机/变速箱型号为厂方；长/高/轴距/轮距/轮胎及中间齿比估计。挂车13m、空重6t+载货8t为游戏工况，并非某款原厂挂车'},
 bt7:{label:'BT-7 快速坦克',year:1935,market:'苏联',configuration:'1935型 · M-17T汽油机 / 4MT',source:'https://victorymuseum.ru/about/museum-collection/armament/legkiy-kolesno-gusenichnyy-tank-bt-7-obraztsa-1935-g/',manualSource:'https://djvu.online/file/d394HimDWZ4lX',
 geometry:{length:5.66,width:2.23,height:2.7,wheelbase:3.42,frontTrack:1.96,rearTrack:1.96,outerTyreRadius:8.2},
 physical:{cgHeight:.90,cgForward:-.10,drive:'tracks',mu:.80,corneringStiffness:85000,suspensionRest:.36,suspensionSag:.08,axles:[{z:1.65,track:1.96},{z:.55,track:1.96},{z:-.55,track:1.96},{z:-1.77,track:1.96}]},
 engine:{peakTorque:2157,peakTorqueRPM:900,peakPowerKW:294.2,peakPowerRPM:1650,ratios:[2.43,1.4,.714,.371],reverse:1.89,finalDrive:2.33*4.5,torqueCurve:[[350,650],[600,1650],[900,2157],[1200,2050],[1650,1703],[1750,1550]],kerbMass:13000,driverMass:0,mass:13000,tyreRadius:.323,dragArea:3.5,engineInertia:4.0,clutchCapacity:3600,rollingResistance:.032,efficiency:.82,idle:500,redline:1750,gameTorqueMultiplier:1,gameFinalDrive:1,frictionBase:90,frictionRPM:.04,coastFrictionRPM:.04,idleGain:2,idleMax:380,launchRPM:750,stallRPM:300,shiftUpRPM:1600,shiftDownRPM:750},
 gearboxes:{mt:{label:'MT · 4挡',factory:true,kind:'manual'},at:{label:'AT · 4挡（模拟）',factory:false,kind:'automated-manual-assist'},cvt:{...cvt(2.33*4.5),min:.371,max:2.43,reverse:1.89}},
 assumptions:'1935早期汽油型，非BT-7M柴油型。履带有效驱动半径.323m/轮式.409m按原手册最高速度推算；轮式附加比.908，重心/悬架近似。履带拆装在游戏停车切换简化。仅驾驶展示，无武器功能'}
};
export const fleetSpec=kind=>FLEET[kind];
export const FLEET_GEOMETRY=Object.fromEntries(Object.entries(FLEET).map(([k,p])=>[k,{name:`${p.year||'当前配置'} ${p.market} ${p.configuration}`,...p.geometry}]));
export const FLEET_POWERTRAINS=Object.fromEntries(Object.entries(FLEET).map(([k,p])=>[k,{name:`${p.year||'当前配置'} ${p.market} ${p.configuration}`,...(p.powertrain??p.engine)}]));
export const FLEET_GEARBOXES=Object.fromEntries(Object.entries(FLEET).map(([k,p])=>[k,{year:p.year,market:p.market,configuration:p.configuration,source:p.source,...p.gearboxes}]));
