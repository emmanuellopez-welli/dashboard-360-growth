/**
 * Config.gs — Parámetros del Tablero 360 Growth WELLI
 * ---------------------------------------------------
 * Ninguna credencial vive en este archivo. Todas se guardan en las
 * Script Properties (Configuración del proyecto → Propiedades del script)
 * y se leen con prop_(). Corre setupPropiedades() una sola vez para
 * dejar las llaves creadas y vacías, y luego llénalas desde la UI.
 */

// ID del Google Sheet de datos. Ya creado y poblado.
var SHEET_ID = '1RaBqmQvA2szRI0Nd6qPvKE8VGNsq6O7jS3lKCdERqIo';

var TZ = 'America/Bogota';

// --- Fuentes de datos ---------------------------------------------------
var META_API_VERSION = 'v21.0';
var META_AD_ACCOUNT = 'act_1373974740859060';   // cuenta WELLI, moneda COP

var HUBSPOT_BASE = 'https://api.hubapi.com';
var HUBSPOT_PORTAL = '50421361';
var HS_OBJ_SEDES = '2-50958246';                // objeto personalizado Sedes

var BQ_PROJECT_CREDITO = 'welli-tecnologia';    // dataset public
// Welli Points vive en welli-growth.wp_data, pero los jobs NO se crean ahi:
// la cuenta tiene lectura del dataset y no bigquery.jobs.create en el
// proyecto. Se crea el job en BQ_PROJECT_DATA con el FROM calificado.
// BQ_PROJECT_WP queda solo como documentacion de donde viven los datos.
var BQ_PROJECT_WP = 'welli-growth';             // dataset wp_data (Welli Points)
var BQ_PROJECT_DATA = 'welli-data';             // dataset data_ops (t_solicitudes)

// Los datasets de WELLI viven en us-central1, NO en US (el default).
// Sin location explicita, BigQuery crea el job en US y responde
// "Dataset not found in location US" — y como el error llega dentro del
// job y no como excepcion HTTP, se ve como un cuelgue, no como un fallo.
var BQ_LOCATION = 'us-central1';

var HILOS_BASE = 'https://api.hilos.io/api/';   // OJO: rutas SIN slash final

// Llaves esperadas en Script Properties
var PROPS_REQUERIDAS = [
  'META_ACCESS_TOKEN',      // System User Token de larga duración
  'HUBSPOT_TOKEN',          // Private App Token
  'HILOS_API_KEY'           // header: Authorization: Token <key>
];

/**
 * Crea las llaves vacías en Script Properties. Corre esto una vez y
 * después edita los valores a mano en la UI del editor.
 */
function setupPropiedades() {
  var sp = PropertiesService.getScriptProperties();
  var actual = sp.getProperties();
  PROPS_REQUERIDAS.forEach(function (k) {
    if (!(k in actual)) sp.setProperty(k, '');
  });
  Logger.log('Propiedades listas. Llena los valores en Configuración del proyecto.');
  Logger.log(JSON.stringify(Object.keys(sp.getProperties())));
}

function prop_(clave) {
  var v = PropertiesService.getScriptProperties().getProperty(clave);
  return v && String(v).trim() ? String(v).trim() : null;
}

/** true si la credencial de esa fuente está configurada. */
function tieneCredencial_(fuente) {
  switch (fuente) {
    case 'META': return !!prop_('META_ACCESS_TOKEN');
    case 'HUBSPOT': return !!prop_('HUBSPOT_TOKEN');
    case 'HILOS': return !!prop_('HILOS_API_KEY');
    case 'BIGQUERY': return true;   // usa OAuth del propio script, no un token
    default: return false;
  }
}

// --- Acceso al Sheet ---------------------------------------------------
function libro_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function hoja_(nombre) {
  var ss = libro_();
  var sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  return sh;
}

/** Lee una hoja como array de objetos usando la fila 1 como encabezado. */
function leerHoja_(nombre) {
  var sh = libro_().getSheetByName(nombre);
  if (!sh) return [];
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var head = vals[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var fila = vals[i];
    if (fila.join('') === '') continue;
    var o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = fila[j];
    out.push(o);
  }
  return out;
}

/** Reemplaza el contenido de una hoja (encabezado + filas). */
function escribirHoja_(nombre, filas) {
  var sh = hoja_(nombre);
  sh.clearContents();
  if (!filas || !filas.length) return 0;
  sh.getRange(1, 1, filas.length, filas[0].length).setValues(filas);
  return filas.length - 1;
}

// --- Utilidades de fecha ----------------------------------------------
function hoyISO_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function fmtFecha_(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function parseISO_(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  var p = String(s).substring(0, 10).split('-');
  if (p.length !== 3) return null;
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function sumarDias_(fecha, n) {
  var d = new Date(fecha.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function diasEntre_(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

/** Lunes de la semana de esa fecha (semana Growth = lunes a domingo). */
function lunesDe_(fecha) {
  var d = new Date(fecha.getTime());
  var dow = d.getDay();               // 0=domingo
  var delta = (dow === 0) ? -6 : (1 - dow);
  d.setDate(d.getDate() + delta);
  return d;
}

// --- Bitácora ----------------------------------------------------------
function log_(fuente, estado, filas, detalle) {
  try {
    var sh = hoja_('_LOG');
    if (sh.getLastRow() === 0) {
      sh.appendRow(['timestamp', 'fuente', 'estado', 'filas', 'detalle']);
    }
    sh.appendRow([Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
                  fuente, estado, filas || 0, detalle || '']);
  } catch (e) {
    Logger.log('log_ fallo: ' + e);
  }
}

/** Estado más reciente de cada fuente, para los badges del dashboard. */
function estadoFuentes_() {
  var log = leerHoja_('_LOG');
  var ultimo = {};
  log.forEach(function (r) {
    var f = String(r.fuente || '');
    if (!f) return;
    ultimo[f] = { estado: String(r.estado || ''), cuando: String(r.timestamp || ''),
                  filas: Number(r.filas || 0), detalle: String(r.detalle || '') };
  });
  return ultimo;
}

function setConfig_(clave, valor) {
  var sh = hoja_('CONFIG');
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === clave) {
      sh.getRange(i + 1, 2).setValue(valor);
      return;
    }
  }
  sh.appendRow([clave, valor, '']);
}

function leerConfig_() {
  var out = {};
  leerHoja_('CONFIG').forEach(function (r) {
    if (r.clave) out[String(r.clave)] = r.valor;
  });
  return out;
}
