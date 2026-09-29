const fs=require('fs'),path=require('path');
const DIR='c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script';
const HOJAS=JSON.parse(fs.readFileSync('sheet_data.json','utf8'));
function pad(n,l){return String(n).padStart(l,'0');}
global.Utilities={formatDate:(d,tz,p)=>{let s=p.replace('yyyy',d.getFullYear()).replace('MM',pad(d.getMonth()+1,2)).replace('dd',pad(d.getDate(),2));return s.replace('HH',pad(d.getHours(),2)).replace('mm',pad(d.getMinutes(),2));},sleep(){}};
global.Logger={log(){}};
function hf(n){const f=HOJAS[n];if(!f)return null;return{getName:()=>n,getLastRow:()=>f.length,getDataRange:()=>({getValues:()=>f.map(r=>r.slice())}),appendRow:r=>f.push(r),clearContents(){f.length=0;},getRange:()=>({setValue(){},setValues(){}})};}
global.SpreadsheetApp={openById:()=>({getName:()=>'x',getSheetByName:hf,insertSheet:n=>{HOJAS[n]=[[]];return hf(n);},getSheets:()=>Object.keys(HOJAS).map(hf)})};
global.PropertiesService={getScriptProperties:()=>({getProperty:()=>null,getProperties:()=>({}),setProperty(){}})};
global.CacheService={getScriptCache:()=>({removeAll(){},get:()=>null,put(){}})};
global.HtmlService={createTemplateFromFile:()=>({evaluate:()=>({})}),createHtmlOutputFromFile:()=>({getContent:()=>''}),XFrameOptionsMode:{ALLOWALL:1}};
global.ScriptApp={getProjectTriggers:()=>[]};
require('vm').runInThisContext(['Config.gs','Filtro_Origen.gs','Code.gs'].map(f=>fs.readFileSync(path.join(DIR,f),'utf8')).join('\n'),{filename:'b.js'});

console.log('===== VENTANA DEL EVENTO: 28-jul a 31-ago-2026 =====\n');
const d=getDashboardData('2026-07-28','2026-08-31',['EVENTO'],{},'');
console.log('EVENTO (con la reatribucion puesta)');
console.log('  sedes del universo:', d.meta.origenSedes);
console.log('  reatribuidas:', d.meta.reatribucion.sedes);
console.log('\nF1 · cosechas del rango:');
(d.f1.cosechas||[]).forEach(c=>console.log('   ',c.mes,'| sedes',c.todas,'| mkt',c.mktReal));
console.log('\nF1 · deals ganados por cosecha:');
((d.f1.dealsCohorte||{}).filas||[]).forEach(r=>console.log('   ',r.cosecha,'| deals',String(r.n).padStart(4),'| ganados',String(r.ganados).padStart(3),'| conv',r.conv+'%'));
console.log('\nF1 · solicitudes y aprobacion (coberturaOrigen del frente):');
const cbo=d.f1.coberturaOrigen||{};
console.log('   fichas con origen:',cbo.sedesConOrigen,'de',cbo.totSedes,'| % apps',cbo.pctApps);
const em=d.f1.embudo||{};
console.log('\nF1 · embudo de credito del rango:');
(em.kpis||[]).forEach(k=>console.log('   ',String(k.label).padEnd(34),k.valor,k.formato==='pct'?'%':''));
console.log('\nF2 · mapa de activacion (EVENTO):');
const act=(d.f2.mapas||[]).filter(m=>m.id==='activas')[0];
((act||{}).filas||[]).forEach(r=>console.log('   ',r.cosecha,'| sedes',String(r.n).padStart(4),'| M0..M3:',r.celdas.slice(0,4).map(c=>c===null?'·':c).join(',')));
