import {FLEET_POWERTRAINS} from './fleet-specs.mjs?rev=world21d';
// Published anchors and ratios are kept separate from declared model assumptions and arcade tuning.
// Source PDFs are linked in README; torque curve samples between anchors are estimates.
const tyreRadius=(width,aspect,inches)=>(inches*.0254/2+width/1000*aspect)*.97;
export const POWERTRAINS={
 ...FLEET_POWERTRAINS,
 yaris:{name:'1999 UK Yaris 1.0 GLS 3dr · 1SZ-FE / C551',peakTorque:90,peakTorqueRPM:4100,peakPowerKW:50,peakPowerRPM:6000,
  ratios:[3.545,1.913,1.310,1.027,.850],reverse:3.214,finalDrive:4.294,
  torqueCurve:[[700,45],[1000,55],[2000,72],[3000,84],[4100,90],[5000,88],[6000,50000/(6000*Math.PI/30)],[6500,65]],
  kerbMass:898,driverMass:75,mass:973,tyreRadius:tyreRadius(175,.65,14),dragCoefficient:.30,frontalArea:1.660*1.500*.82,dragArea:.30*1.660*1.500*.82,
  engineInertia:.16,clutchCapacity:310,rollingResistance:.012,efficiency:.90,idle:850,redline:6500,
  gameTorqueMultiplier:2.1961,gameFinalDrive:.80},
 chr:{name:'2017 UK C-HR 1.2T FWD · 8NR-FTS / 6MT',peakTorque:185,peakTorqueRPM:1500,peakPowerKW:85,peakPowerRPM:5200,
  ratios:[3.727,2.045,1.310,.971,.764,.619],reverse:3.333,finalDrive:4.538,
  torqueCurve:[[700,75],[1000,125],[1500,185],[4000,185],[5200,85000/(5200*Math.PI/30)],[5600,85000/(5600*Math.PI/30)],[6000,125],[6500,100]],
  kerbMass:1355,driverMass:75,mass:1430,tyreRadius:tyreRadius(215,.60,17),dragCoefficient:.32,frontalArea:1.795*1.565*.82,dragArea:.32*1.795*1.565*.82,
  engineInertia:.23,clutchCapacity:430,rollingResistance:.012,efficiency:.90,idle:850,redline:6500,
  gameTorqueMultiplier:1.559,gameFinalDrive:1}
};
export const STOCK_POWERTRAINS=Object.fromEntries(Object.entries(POWERTRAINS).map(([k,p])=>[k,{...p,gameTorqueMultiplier:1,gameFinalDrive:1}]));
export const powertrainSpec=(kind,tuning='arcade')=>(tuning==='stock'?STOCK_POWERTRAINS:POWERTRAINS)[kind]||(tuning==='stock'?STOCK_POWERTRAINS.yaris:POWERTRAINS.yaris);
