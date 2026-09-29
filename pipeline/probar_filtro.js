const fs=require('fs'),path=require('path'),vm=require('vm');
const DIR='c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script';
const HOJAS=JSON.parse(fs.readFileSync('sheet_data.json','utf8'));
function pad(n,l){return String(n).padStart(l,'0');}
global.Utilities={formatDate:(d,tz,pat)=>{let s=pat.replace('yyyy',d.getFullYear()).replace('MM',pad(d.getMonth()+1,2)).replace('dd',pad(d.getDate(),2));return s.replace('HH',pad(d.getHours(),2)).replace('mm',pad(d.getMinutes(),2));},sleep:()=>{}};
global.Logger={log:()=>{}};
function hj(n){const f=HOJAS[n];if(!f)return null;return{getName:()=>n,getLastRow:()=>f.length,getDataRange:()=>({getValues:()=>f.map(r=>r.slice())}),appendRow:r=>f.push(r),clearContents:()=>{f.length=0;},getRange:()=>({setValue:()=>{},setValues:()=>{}})};}
global.SpreadsheetApp={openById:()=>({getName:()=>'x',getSheetByName:hj,insertSheet:n=>{HOJAS[n]=[[]];return hj(n);},getSheets:()=>Object.keys(HOJAS).map(hj)})};
global.PropertiesService={getScriptProperties:()=>({getProperty:()=>null,getProperties:()=>({}),setProperty:()=>{}})};
global.CacheService={getScriptCache:()=>({get:()=>null,put:()=>{}})};
global.HtmlService={createTemplateFromFile:()=>({evaluate:()=>({setTitle:()=>({setXFrameOptionsMode:()=>({})})})}),createHtmlOutputFromFile:()=>({getContent:()=>''}),XFrameOptionsMode:{ALLOWALL:1}};
global.ScriptApp={getProjectTriggers:()=>[]};
vm.runInThisContext(['Config.gs','Filtro_Origen.gs','Code.gs'].map(f=>fs.readFileSync(path.join(DIR,f),'utf8')).join('\n'),{filename:'b.js'});

const cop=x=>'$'+(Number(x)/1e9).toFixed(2)+' mil M';
['todos','marketing','comercial','alianzas','sin_origen'].forEach(k=>{
  const orig = k==='todos'?[]:PRESETS_ORIGEN[k];
  const d = getDashboardData('2026-01-01','2026-09-01',orig);
  const pv=d.f4.plata, f5=d.f5;
  console.log('');
  console.log('=== '+k.toUpperCase()+'  ('+d.meta.origenSedes+' sedes) ===');
  const f1=d.f1;
  console.log('  F1  sedes nuevas ago '+String((f1.share.find(x=>x.mes==='2026-08')||{}).mkt).padStart(5)+' de '+((f1.share.find(x=>x.mes==='2026-08')||{}).todas)+'   share '+((f1.share.find(x=>x.mes==='2026-08')||{}).pct)+'%');
  console.log('  F1  embudo  solicitudes '+String(f1.embudo.kpis[0].valor).padStart(7)+'   conv '+f1.embudo.kpis[1].valor+'%   plata '+cop(f1.embudo.kpis[2].valor));
  console.log('  F1  cohortes: '+f1.cohortes.resumen.sedesMkt+' sedes en el universo   leads Meta '+f1.kpis[0].valor+' (no se filtra)');
  console.log('  F2  activas '+String(d.f2.base.kpis[1].valor).padStart(5)+'%   muertas '+String(d.f2.base.kpis[2].valor).padStart(5));
  console.log('  F4  plata viva '+cop(pv.vivoMonto).padStart(14)+'  '+String(pv.vivoCreditos).padStart(5)+' cred   vencido '+cop(pv.vencidoMonto));
  console.log('  F4  ventana '+String(d.f4.ventana.total).padStart(6)+' firmas   24h '+d.f4.kpis[0].valor+'%');
  console.log('  F5  oferta activa '+String(f5.conversion.kpis[0].valor).padStart(5)+'%   ofr '+String(f5.conversion.kpis[1].valor).padStart(5)+'  gan '+String(f5.conversion.kpis[2].valor).padStart(4)+'  conv '+f5.conversion.kpis[3].valor+'%');
  console.log('  F5  canjes '+String(f5.pago.kpis[0].valor).padStart(3)+'   plata '+f5.pago.kpis[1].valor+'   incentivos '+f5.incentivos.length);
});
