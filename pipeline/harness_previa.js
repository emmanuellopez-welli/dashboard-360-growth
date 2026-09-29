/**
 * Igual que harness.js, pero usando el mismo bundle TRIMMED que build_previa.js
 * arma para el artefacto (mismo USADAS/SOBRAN/FECHADAS), para reproducir
 * cualquier bug que solo aparezca en la version recortada.
 */
const fs = require('fs');
const path = require('path');

const DIR = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script';
const RAW = JSON.parse(fs.readFileSync('sheet_data.json', 'utf8'));

const USADAS = [
  'CONFIG', '_LOG', 'SEDES', 'SEDES_EVENTOS', 'PLATAFORMA_SEDES',
  'META_ADS', 'RESCATE_BQ2',
  'WP_SEDE_MES', 'WP_SEDE_INC', 'WP_CANJES2', 'HILOS_BROADCAST', 'NOVEDADES', 'AAA', 'DEALS_COHORTE',
  'ACT_SEDE_MES', 'DEALS_ORIGEN', 'SEDE_ESTADO_MES', 'SEDE_ROLES', 'OWNERS', 'CREDITO_DIA', 'CREDITO_SEDES', 'LT_APPS_DIA', 'LT_TOUCHES', 'LT_CADENCIA',
  'RESCATE_GESTION', 'RESCATE_CAUSAL', 'RESCATE_POOL', 'RESCATE_WA',
  'RESCATE_DESENLACE', 'RESCATE_HIST', 'RESCATE_APROB_MSJ', 'RESCATE_WA_PACIENTES', 'RESCATE_HIST_PLATA', 'DESEMBOLSO_RESCATE_DIA',
  'SEG_ELEGIBLES', 'SEG_SOLICITUDES'
];
const SOBRAN = {
  SEDES_EVENTOS: ['categoria', 'sede_id', 'origen'],
  RESCATE_BQ2: ['sede'],
  SEDES: ['etapa', 'ranking', 'grupo_long_tail', 'auto_bucket', 'alert_level',
          'fecha_entrada_pipeline_actual', 'fecha_ultima_app', 'aprob_no_firmados_60d',
          'aprobados_60d', 'desembolsos_60d', 'ticket_promedio_4m', 'valor_puntos',
          'aplica_wp_raw', 'resu_apps', 'resu_desembolsos', 'resu_aprobados',
          'monto_aprobado_post_resu', 'cs_apps_bq', 'cs_firmas_bq', 'cs_hizo_1app',
          'cs_exitosa', 'cs_dias_a_1app']
};
const PISO = '2025-11';
const DIA_BASE = Date.UTC(2025, 0, 1);
const pisoDia = Math.round((Date.UTC(2025, 10, 1) - DIA_BASE) / 86400000);
const FECHADAS = {
  SEDES_EVENTOS: r => String(r[0] || '') >= PISO,
  SEDE_ESTADO_MES: r => String(r[1] || '') >= PISO,
  ACT_SEDE_MES: r => String(r[1] || '') >= PISO,
  RESCATE_BQ2: r => String(r[0] || '') >= PISO,
  CREDITO_DIA: r => Number(r[1]) >= pisoDia
};
function porFecha(nombre, filas) {
  const f = FECHADAS[nombre];
  if (!f || filas.length < 2) return filas;
  return [filas[0]].concat(filas.slice(1).filter(f));
}
function recortar(nombre, filas) {
  const fuera = SOBRAN[nombre];
  if (!fuera || !filas.length) return filas;
  const head = filas[0];
  const quedan = head.map((c, i) => i).filter(i => fuera.indexOf(head[i]) < 0);
  return filas.map(r => quedan.map(i => (r[i] === undefined ? '' : r[i])));
}
const HOJAS = {};
USADAS.forEach(n => {
  if (!RAW[n]) return;
  HOJAS[n] = recortar(n, porFecha(n, RAW[n]));
});

function pad(n, l) { return String(n).padStart(l, '0'); }
global.Utilities = {
  formatDate: function (d, tz, patron) {
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
      getName: () => 'previa',
      getSheetByName: hojaFake,
      insertSheet: (n) => { HOJAS[n] = [[]]; return hojaFake(n); },
      getSheets: () => Object.keys(HOJAS).map(hojaFake)
    };
  }
};
global.PropertiesService = {
  getScriptProperties: () => ({ getProperty: () => null, getProperties: () => ({}), setProperty: () => {} })
};
global.CacheService = { getScriptCache: () => ({ removeAll: () => {}, get: () => null, put: () => {} }) };
global.HtmlService = {
  createTemplateFromFile: () => ({ evaluate: () => ({}) }),
  createHtmlOutputFromFile: () => ({ getContent: () => '' }),
  XFrameOptionsMode: { ALLOWALL: 1 }
};
global.ScriptApp = { getProjectTriggers: () => [] };

const vm = require('vm');
const fuente = ['Config.gs', 'Filtro_Origen.gs', 'Code.gs']
  .map(f => '/* ==== ' + f + ' ==== */\n' + fs.readFileSync(path.join(DIR, f), 'utf8'))
  .join('\n');
vm.runInThisContext(fuente, { filename: 'apps_script_bundle.js' });

const ini = process.argv[2] || '2026-06-01';
const fin = process.argv[3] || '2026-08-31';
const orig = process.argv[4] ? process.argv[4].split(',') : [];
const roles = {};
(process.argv[5] || '').split(',').filter(Boolean).forEach(function (t) {
  const [k, v] = t.split(':');
  if (k && v) roles[k] = v;
});

try {
  const d = getDashboardData(ini, fin, orig, roles, '');
  console.log('OK. f4.gestion.metas:', d.f4.gestion.metas.length,
              'metasMes:', d.f4.gestion.metasMes.length,
              'dealsCohorte filas:', d.f1.dealsCohorte.filas.length);
} catch (e) {
  console.log('CRASH:', e.message);
  console.log(e.stack);
}
