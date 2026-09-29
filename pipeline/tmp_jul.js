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
const d=getDashboardData('2026-07-01','2026-07-31',[],{},'');
const ge=d.f4.gestion;
console.log('=== JULIO 2026 ===');
console.log('metasMes disponibles:', (ge.metasMes||[]).map(m=>m.mes).join(', '));
(ge.metasMes||[]).forEach(m=>{ if(m.mes==='2026-07'||m.mes==='2026-08') console.log('  metasMes',m.mes,'desembolsado=',m.desembolsado,'meta=',m.meta); });
console.log('\nhistoriaUnida jul/ago:');
(ge.historiaUnida||[]).forEach(m=>{ if(m.mes>='2026-06'&&m.mes<='2026-08') console.log('  ',m.mes,'| desembolsado(grafica)=',m.desembolsado,'| casos=',m.casos,'| firmas=',m.firmas,'| ahora=',m.ahora); });
console.log('\nmetas semanales que caen en julio:');
(ge.metas||[]).forEach(m=>{ if(m.semana>='2026-06-29'&&m.semana<='2026-08-03') console.log('  semana',m.semana,'| desembolsado=',m.desembolsado,'| meta=',m.meta,'| bolsa=',m.bolsa); });
console.log('\nf4.cobertura (el bloque de "cuanto tocamos"):');
console.log('  ', JSON.stringify(d.f4.cobertura));
console.log('\nf4.embudo (que paso cuando llamamos):');
(ge.embudo||[]).forEach(p=>console.log('  ', String(p.paso).padEnd(30), 'n=',p.n, '| monto=',p.monto));
console.log('\nf4.oportunidad.kpis:');
((d.f4.oportunidad||{}).kpis||[]).forEach(k=>console.log('  ', String(k.label).padEnd(34), k.valor, k.formato));
