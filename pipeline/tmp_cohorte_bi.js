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

// El universo del tablero, con la fecha ya reatribuida/minima aplicada
const U = universoSedes_([], {});
console.log('universo (todas):', U.total, 'de', U.totalBase, 'base (antes de origen, con rol=todos)');
console.log('deshabilitadas:', U.universo.deshabilitadas, '| sin id:', U.universo.sinId,
  '| sin plataforma:', U.universo.noPlataforma, '| otro pais:', U.universo.otroPais,
  '| invisibles (plataforma sin ficha):', U.universo.platSinFicha);

// cosecha de cada sede EN el universo (ya filtrado), con la regla min(fc,fv)
function cosechaDe_(s, vincDiaDe) {
  var iid = String(s.id_internal||'').trim();
  var fc = String(s.fecha_creacion||'').substring(0,10);
  var fv = String(vincDiaDe[iid]||'').substring(0,10);
  if (fc && fv) return (fc<fv?fc:fv).substring(0,7);
  return (fc||fv).substring(0,7);
}
const porMes = {};
U.filas.forEach(s => {
  const cos = cosechaDe_(s, U.vincDiaDe);
  if (!/^\d{4}-\d{2}$/.test(cos)) return;
  if (cos === '2025-10') return; // carga inicial
  porMes[cos] = (porMes[cos]||0) + 1;
});
console.log('\ncosecha (universo del tablero, fecha minima):');
Object.keys(porMes).sort().forEach(m => console.log('  ', m, porMes[m]));

// Ahora SIN los descartes (deshabilitadas, sin id, sin plataforma) -- solo con hs_createdate/vinculacion
const cruda = U.baseCruda; // ya sin deshabilitadas, pero SIN la regla de plataforma (pais/existe)
console.log('\nbaseCruda (sin deshabilitadas, SIN exigir cuenta en plataforma):', cruda.length);
const porMesCruda = {};
cruda.forEach(s => {
  const cos = cosechaDe_(s, U.vincDiaDe); // vinculacion solo existe si esta en plataforma; si no, usa solo hs_createdate
  if (!/^\d{4}-\d{2}$/.test(cos)) return;
  if (cos === '2025-10') return;
  porMesCruda[cos] = (porMesCruda[cos]||0) + 1;
});
console.log('cosecha (SIN exigir cuenta en plataforma):');
Object.keys(porMesCruda).sort().forEach(m => console.log('  ', m, porMesCruda[m]));
