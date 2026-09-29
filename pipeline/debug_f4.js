const fs = require('fs');
const path = require('path');
const DIR = 'c:/Users/millo/Desktop/Dashboard 360 mkt/apps_script';
const HOJAS = JSON.parse(fs.readFileSync('sheet_data.json', 'utf8'));
function pad(n, l) { return String(n).padStart(l, '0'); }
global.Utilities = {
  formatDate: function (d, tz, patron) {
    const y = d.getFullYear(), m = pad(d.getMonth() + 1, 2), dd = pad(d.getDate(), 2);
    let s = patron.replace('yyyy', y).replace('MM', m).replace('dd', dd);
    return s.replace('HH', pad(d.getHours(), 2)).replace('mm', pad(d.getMinutes(), 2));
  },
  sleep: function () {}
};
global.Logger = { log: function () {} };
function hojaFake(nombre) {
  const filas = HOJAS[nombre];
  if (!filas) return null;
  return {
    getName: () => nombre, getLastRow: () => filas.length,
    getDataRange: () => ({ getValues: () => filas.map(r => r.slice()) }),
    appendRow: (r) => filas.push(r), clearContents: () => { filas.length = 0; },
    getRange: () => ({ setValue: () => {}, setValues: () => {} })
  };
}
global.SpreadsheetApp = { openById: () => ({
  getName: () => 'qa', getSheetByName: hojaFake,
  insertSheet: (n) => { HOJAS[n] = [[]]; return hojaFake(n); },
  getSheets: () => Object.keys(HOJAS).map(hojaFake)
}) };
global.PropertiesService = { getScriptProperties: () => ({
  getProperty: () => null, getProperties: () => ({}), setProperty: () => {} }) };
global.CacheService = { getScriptCache: () => ({ removeAll: () => {}, get: () => null, put: () => {} }) };
global.HtmlService = { createTemplateFromFile: () => ({ evaluate: () => ({}) }),
  createHtmlOutputFromFile: () => ({ getContent: () => '' }), XFrameOptionsMode: { ALLOWALL: 1 } };
global.ScriptApp = { getProjectTriggers: () => [] };

const vm = require('vm');
vm.runInThisContext(['Config.gs', 'Filtro_Origen.gs', 'Code.gs']
  .map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n'),
  { filename: 'bundle.js' });

const d = getDashboardData('2026-08-24', '2026-09-24', [], {}, '');
console.log('meta.inicio/fin:', d.meta.inicio, d.meta.fin);
console.log('metaRango:', JSON.stringify(d.f4.gestion.metaRango));
