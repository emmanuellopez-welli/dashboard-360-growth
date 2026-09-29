/**
 * Banco de pruebas: corre Config.gs + Code.gs reales en Node con shims de
 * las APIs de Apps Script. Sirve para dos cosas:
 *   1. validar que getDashboardData() no explota y devuelve lo esperado
 *   2. generar el payload de la vista previa con el MISMO motor
 *
 *   node harness.js <inicio> <fin> [salida.json]
 */
const fs = require('fs');
const path = require('path');

const DIR = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script';
const HOJAS = JSON.parse(fs.readFileSync('sheet_data.json', 'utf8'));

// ------------------------------------------------- shims de Apps Script
function pad(n, l) { return String(n).padStart(l, '0'); }

global.Utilities = {
  formatDate: function (d, tz, patron) {
    // Solo se usan yyyy-MM-dd y 'yyyy-MM-dd HH:mm'. Se ignora la zona:
    // el harness solo necesita coherencia, no la hora exacta de Bogotá.
    const y = d.getFullYear(), m = pad(d.getMonth() + 1, 2), dd = pad(d.getDate(), 2);
    let s = patron.replace('yyyy', y).replace('MM', m).replace('dd', dd);
    s = s.replace('HH', pad(d.getHours(), 2)).replace('mm', pad(d.getMinutes(), 2));
    return s;
  },
  sleep: function () {}
};

global.Logger = { log: function (m) { console.error('[Logger] ' + m); } };

function hojaFake(nombre) {
  const filas = HOJAS[nombre];
  if (!filas) return null;
  return {
    getName: () => nombre,
    getLastRow: () => filas.length,
    getDataRange: () => ({ getValues: () => filas.map(r => r.slice()) }),
    appendRow: (r) => filas.push(r),
    clearContents: () => { filas.length = 0; },
    getRange: () => ({ setValue: () => {}, setValues: () => {} })
  };
}

global.SpreadsheetApp = {
  openById: function () {
    return {
      getName: () => 'Tablero 360 Growth WELLI - DATA (harness)',
      getSheetByName: hojaFake,
      insertSheet: (n) => { HOJAS[n] = [[]]; return hojaFake(n); },
      getSheets: () => Object.keys(HOJAS).map(hojaFake)
    };
  }
};

global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: () => null,
    getProperties: () => ({}),
    setProperty: () => {}
  })
};

global.CacheService = {
  getScriptCache: () => ({ removeAll: () => {}, get: () => null, put: () => {} })
};

global.HtmlService = {
  createTemplateFromFile: () => ({ evaluate: () => ({}) }),
  createHtmlOutputFromFile: () => ({ getContent: () => '' }),
  XFrameOptionsMode: { ALLOWALL: 1 }
};

global.ScriptApp = { getProjectTriggers: () => [] };

// ------------------------------------------------------- cargar los .gs
// Se concatenan y se evaluan en ESTE contexto: asi las declaraciones de
// funcion y los var del tope quedan globales, igual que en Apps Script,
// y Code.gs ve los helpers de Config.gs.
const vm = require('vm');
const fuente = ['Config.gs', 'Filtro_Origen.gs', 'Code.gs']
  .map(f => '/* ==== ' + f + ' ==== */\n' + fs.readFileSync(path.join(DIR, f), 'utf8'))
  .join('\n');
vm.runInThisContext(fuente, { filename: 'apps_script_bundle.js' });

// ------------------------------------------------------------------ run
const ini = process.argv[2] || '2026-06-01';
const fin = process.argv[3] || '2026-08-31';
const salida = process.argv[4] || 'payload.json';
// 5to argumento: origenes separados por coma, para probar el filtro global.
const orig = process.argv[5] ? process.argv[5].split(',') : [];
// 6to argumento: equipos del owner, para probar el filtro global.
// 6to argumento: roles como hunter:id,farmer:id,cs:id
const roles = {};
(process.argv[6] || '').split(',').filter(Boolean).forEach(function (t) {
  const [k, v] = t.split(':');
  if (k && v) roles[k] = v;
});

const t0 = Date.now();
let d;
try {
  d = getDashboardData(ini, fin, orig, roles, process.argv[7] || '',
                      process.argv[8] || '',    // 8vo: reloj de la cosecha
                      process.argv[9] || '');   // 9no: modo de universo
} catch (e) {
  console.error('FALLO getDashboardData: ' + e.stack);
  process.exit(1);
}
fs.writeFileSync(salida, JSON.stringify(d));

// ------------------------------------------------------------- informe
console.log('OK en ' + (Date.now() - t0) + 'ms  ->  ' + salida);
console.log('rango ' + d.meta.inicio + ' a ' + d.meta.fin +
  '  | anterior ' + d.meta.prevInicio + ' a ' + d.meta.prevFin +
  '  | ' + d.meta.dias + ' dias, agrupado por ' + d.meta.agrupacion);
console.log('');

function ver(titulo, kpis) {
  if (!kpis) return;
  console.log('== ' + titulo);
  kpis.forEach(k => {
    const v = k.pendiente ? 'PENDIENTE' :
      (k.valor === null ? '--' : String(k.valor));
    const dl = k.delta === null || k.delta === undefined ? 'sin delta' :
      ((k.delta > 0 ? '+' : '') + k.delta + '%');
    console.log('   ' + k.label.padEnd(32) + v.padStart(16) + '  ' + dl.padStart(12) +
      (k.formato !== 'num' ? '  [' + k.formato + ']' : ''));
  });
  console.log('');
}

ver('F1 pauta', d.f1.kpis);
ver('F2 principales', d.f2.kpis);
ver('F2 ciclo de vida', d.f2.kpisSecundarios);
ver('F4 oportunidad', d.f4.oportunidad ? d.f4.oportunidad.kpis : []);
ver('F4 ventana de firma', d.f4.kpis);

ver('F5 conversion', d.f5.conversion.kpis);
ver('F5 pago', d.f5.pago.kpis);

console.log('== FILTRO DE ORIGEN');
console.log('   universo              ' + d.meta.origenEtiqueta + '  (' +
  d.meta.origenSedes + ' de ' + d.meta.origenSedesBase + ' sedes)');
console.log('   catalogo              ' + (d.meta.catalogoOrigenes || []).length + ' origenes');
console.log('');
console.log('== TAMANOS');
console.log('   f1.serie              ' + (d.f1.serie || []).length);
console.log('   f1.cosechas           ' + (d.f1.cosechas || []).length);
console.log('   f1.convOrigen         ' + (d.f1.convOrigen || []).length);
(d.f2.mapas || []).forEach(function (m) {
  console.log('   f2.' + (m.id + '            ').substring(0, 14) +
    '    ' + (m.filas || []).length + ' cosechas');
});
console.log('   f7.impactos           ' + ((d.f7||{}).impactos || []).length);
console.log('   f7.serie              ' + ((d.f7||{}).serie || []).length);
console.log('   f4.oportunidad.filas  ' + ((d.f4.oportunidad||{}).filas || []).length);
console.log('   f4.acciones.filas     ' + ((d.f4.acciones||{}).filas || []).length);
console.log('   f4.curva              ' + (d.f4.curva || []).length);
console.log('   f4.ventana.filas      ' + ((d.f4.ventana||{}).filas || []).length);
console.log('   f5.serie              ' + (d.f5.serie || []).length);
console.log('   f5.incentivos         ' + (d.f5.incentivos || []).length);
console.log('   f5.canjes             ' + (d.f5.canjes || []).length);
console.log('   f6.novedades          ' + (d.f6.novedades || []).length);

console.log('   payload KB            ' + Math.round(JSON.stringify(d).length / 1024));
