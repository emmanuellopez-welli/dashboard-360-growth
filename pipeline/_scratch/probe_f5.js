/* Sonda: que devuelve de verdad el motor nuevo de F5 (cruce login x
   desembolso + correlacion), para compararlo contra el analisis
   independiente en Python. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = 'c:/Users/millo/Desktop/Dashboard 360 mkt/apps_script';
const HOJAS = JSON.parse(fs.readFileSync('sheet_data.json', 'utf8'));
function pad(n, l) { return String(n).padStart(l, '0'); }
global.Utilities = { formatDate: (d, tz, p) => {
    let s = p.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1, 2))
      .replace('dd', pad(d.getDate(), 2));
    return s.replace('HH', pad(d.getHours(), 2)).replace('mm', pad(d.getMinutes(), 2));
  }, sleep: () => {} };
global.Logger = { log: () => {} };
function hojaFake(n) {
  const filas = HOJAS[n];
  if (!filas) return null;
  return { getName: () => n, getLastRow: () => filas.length,
    getDataRange: () => ({ getValues: () => filas.map(r => r.slice()) }),
    appendRow: r => filas.push(r), clearContents: () => { filas.length = 0; },
    getRange: () => ({ setValue: () => {}, setValues: () => {} }) };
}
global.SpreadsheetApp = { openById: () => ({ getName: () => 'qa',
  getSheetByName: hojaFake, insertSheet: n => { HOJAS[n] = [[]]; return hojaFake(n); },
  getSheets: () => Object.keys(HOJAS).map(hojaFake) }) };
global.PropertiesService = { getScriptProperties: () => ({
  getProperty: () => null, getProperties: () => ({}), setProperty: () => {} }) };
global.CacheService = { getScriptCache: () => ({ removeAll: () => {}, get: () => null, put: () => {} }) };
global.HtmlService = { createTemplateFromFile: () => ({ evaluate: () => ({}) }),
  createHtmlOutputFromFile: () => ({ getContent: () => '' }), XFrameOptionsMode: { ALLOWALL: 1 } };
global.ScriptApp = { getProjectTriggers: () => [] };
vm.runInThisContext(['Config.gs', 'Filtro_Origen.gs', 'Code.gs']
  .map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n'), { filename: 'b.js' });

const d = getDashboardData('2026-08-01', '2026-09-17', [], {}, '');
console.log('--- f5.cruce ---');
console.log(JSON.stringify(d.f5.cruce, null, 1).substring(0, 1500));
console.log('--- f5.correlacion ---');
console.log(JSON.stringify(d.f5.correlacion, null, 1));
console.log('--- f5.adopcion.kpis ---');
(d.f5.adopcion.kpis || []).forEach(k => console.log('  -', k.label, '=', k.valor, k.formato));

const e = getDashboardData('2026-08-01', '2026-09-17', ['FARMER'], {}, '');
console.log('\ncon origen FARMER -> cruce nCon/nSin:', e.f5.cruce.nCon, e.f5.cruce.nSin,
  '(sin filtro:', d.f5.cruce.nCon, d.f5.cruce.nSin, ')');
