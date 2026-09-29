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
[['sin rol',{}],['equipo hunter',{hunter:'__equipo__'}],['johanna',{hunter:'83703393'}]].forEach(([etq,rol])=>{
  const d=getDashboardData('2026-08-01','2026-08-31',[],rol,'');
  const esc=(d.f2.escalera||{}).filas||[];
  console.log('\n== '+etq+' == universo '+d.meta.origenSedes+' | F1 fichas '+(d.f1.coberturaOrigen||{}).totSedes);
  esc.forEach(r=>console.log('   ',String(r.n).padStart(6),String(r.paso).substring(0,44)));
});
