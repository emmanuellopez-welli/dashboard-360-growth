/**
 * Corre Alertas_Sedes.gs de verdad en Node, con shims: el mismo codigo que
 * va a Apps Script, sobre los datos reales. Sirve para ver que alertaria hoy
 * antes de instalar el trigger, y para revisar el HTML del correo.
 *
 * HubSpot no se llama en vivo aca: se le pasa el pull ya hecho
 * (sedes_creador.json + owners_user.json), asi que la prueba no depende de
 * la red y es repetible.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = 'C:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script';
const HOJAS = JSON.parse(fs.readFileSync('sheet_data.json', 'utf8'));
const SEDES_HS = JSON.parse(fs.readFileSync('sedes_creador.json', 'utf8'));
const OW = JSON.parse(fs.readFileSync('owners_user.json', 'utf8'));

// --- shims de Apps Script --------------------------------------------
function pad(n, l) { return String(n).padStart(l, '0'); }
global.Utilities = {
  formatDate: (d, tz, p) => {
    const y = d.getFullYear(), m = pad(d.getMonth() + 1, 2), dd = pad(d.getDate(), 2);
    return p.replace('yyyy', y).replace('MM', m).replace('dd', dd)
      .replace('HH', pad(d.getHours(), 2)).replace('mm', pad(d.getMinutes(), 2));
  },
  sleep: () => {}
};
global.Logger = { log: m => console.log('   ' + m) };
global.Session = { getEffectiveUser: () => ({ getEmail: () => 'emmanuel.lopez@welli.com.co' }) };
global.ScriptApp = { getProjectTriggers: () => [] };
global.PropertiesService = {
  getScriptProperties: () => ({ getProperty: () => null, getProperties: () => ({}), setProperty: () => {} })
};
global.CacheService = { getScriptCache: () => ({ get: () => null, put: () => {}, removeAll: () => {} }) };
global.HtmlService = {
  createTemplateFromFile: () => ({ evaluate: () => ({}) }),
  createHtmlOutputFromFile: () => ({ getContent: () => '' }),
  XFrameOptionsMode: { ALLOWALL: 1 }
};
const ESCRITAS = {};
function hojaFake(nombre) {
  const filas = HOJAS[nombre];
  if (!filas) return null;
  return {
    getName: () => nombre,
    getLastRow: () => filas.length,
    getDataRange: () => ({ getValues: () => filas.map(r => r.slice()) }),
    clearContents: () => { ESCRITAS[nombre] = []; },
    getRange: () => ({ setValues: v => { ESCRITAS[nombre] = v; }, setValue: () => {} }),
    appendRow: r => filas.push(r)
  };
}
global.SpreadsheetApp = {
  openById: () => ({
    getName: () => 'DATA (prueba)',
    getSheetByName: hojaFake,
    insertSheet: n => { HOJAS[n] = [[]]; return hojaFake(n); },
    getSheets: () => Object.keys(HOJAS).map(hojaFake)
  })
};
let CORREO = null;
global.MailApp = { sendEmail: o => { CORREO = o; } };

// --- cargar Config.gs y el archivo de alertas ------------------------
const fuentes = ['Config.gs', 'Alertas_Sedes.gs']
  .map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
vm.runInThisContext(fuentes, { filename: 'alertas.js' });

// --- HubSpot: se sustituyen las tres lecturas de red -----------------
global.alLeerSedesHubSpot_ = function () {
  return SEDES_HS.map(p => ({
    id: String(p.id || ''),
    nombre: String(p.nombre_sede || ''),
    id_internal: String(p.id_internal || ''),
    creada: String(p.hs_createdate || ''),
    pipeline: '',                        // se completa abajo
    origen: String(p.origen || ''),
    creadorUser: String(p.hs_created_by_user_id || ''),
    fuente: String(p.hs_object_source_label || ''),
    owner: String(p.hubspot_owner_id || '')
  }));
};
// El pipeline no viene en el pull de prueba: se toma de la hoja SEDES, que
// es lo que usa el filtro de deshabilitadas.
const S = HOJAS['SEDES'], sx = {};
S[0].forEach((c, i) => sx[c] = i);
const pipeDe = {};
const etapaDe = {};
S.slice(1).forEach(r => {
  pipeDe[String(r[sx['id']])] = String(r[sx['pipeline']] || '');
  etapaDe[String(r[sx['id']])] = String(r[sx['etapa']] || '');
});
const orig = global.alLeerSedesHubSpot_;
global.alLeerSedesHubSpot_ = function () {
  return orig().map(s => ({ ...s, pipeline: pipeDe[s.id] || '',
                            etapa: etapaDe[s.id] || '' }));
};
global.alOwners_ = () => ({ porUser: OW.por_user, porOwner: OW.por_owner });

// Solo para la prueba: la hoja local es del refresh del 2-sep y el
// guardarrail (con razon) se niega a correr con dato de 5 dias. Se
// simula fresca para poder ver que reportaria la alerta.
// (sin override: se prueba el guardarrail de verdad)

// --- correr -----------------------------------------------------------
console.log('PRUEBA DE probarCorreoAlertaEquipo() · ' + hoyISO_());

console.log('');
console.log('1) La corrida NORMAL debe detenerse por dato viejo:');
const normal = revisarSedesHuerfanas_();
console.log('   omitida = ' + normal.omitida);
if (normal.omitida) console.log('   motivo: ' + normal.motivo);

console.log('');
console.log('2) La PRUEBA debe pasar el guardarrail y enviar:');
const r = probarCorreoAlertaEquipo();
console.log('   destinatarios: ' + (CORREO ? CORREO.to : 'NO SE ENVIO'));
console.log('   asunto: ' + (CORREO ? CORREO.subject : '—'));
console.log('   avisa sobre: ' + r.avisar.length + ' casos (' +
            r.tipoA.length + ' tipo A, ' + r.tipoB.length + ' tipo B)');
console.log('   trae el aviso de prueba: ' +
            (CORREO && CORREO.htmlBody.indexOf('Correo de prueba') >= 0));
console.log('   menciona el dato viejo: ' +
            (CORREO && CORREO.htmlBody.indexOf('no se refresca desde') >= 0));

console.log('');
console.log('3) La bitacora NO debe haberse escrito:');
console.log('   filas escritas en ALERTAS_SEDES: ' +
            ((ESCRITAS['ALERTAS_SEDES'] || []).length));

fs.writeFileSync('correo_prueba.html', CORREO.htmlBody, 'utf8');
console.log('');
console.log('cuerpo guardado en correo_prueba.html (' +
            Math.round(CORREO.htmlBody.length / 1024) + ' KB)');
