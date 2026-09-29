/* =====================================================================
   Motor local para la vista previa / artifact.

   Antes la previa traia payloads PRE-CALCULADOS por rango de fecha. Como
   el tablero dejo de tener atajos de fecha (solo calendario), cualquier
   rango que el usuario eligiera a mano no existia en el diccionario, la
   busqueda caia al payload de respaldo y el filtro de origen parecia no
   hacer nada. Era un artefacto de la previa, no del motor.

   Ahora la previa corre el MISMO getDashboardData() de Apps Script sobre
   las mismas tablas, con estos shims de las APIs de Google. Cualquier
   combinacion de fechas y origenes se calcula en vivo, igual que
   desplegado.
   ===================================================================== */
window.MOTOR_LOCAL = true;

function __pad(n, l) { return String(n).padStart(l, '0'); }

var Utilities = {
  formatDate: function (d, tz, patron) {
    var s = patron
      .replace('yyyy', d.getFullYear())
      .replace('MM', __pad(d.getMonth() + 1, 2))
      .replace('dd', __pad(d.getDate(), 2));
    return s.replace('HH', __pad(d.getHours(), 2)).replace('mm', __pad(d.getMinutes(), 2));
  },
  sleep: function () {}
};

var Logger = { log: function () {} };

function __hoja(nombre) {
  var filas = window.HOJAS[nombre];
  if (!filas) return null;
  return {
    getName: function () { return nombre; },
    getLastRow: function () { return filas.length; },
    getDataRange: function () {
      return { getValues: function () { return filas; } };
    },
    appendRow: function (r) { filas.push(r); },
    clearContents: function () { filas.length = 0; },
    getRange: function () { return { setValue: function () {}, setValues: function () {} }; }
  };
}

var SpreadsheetApp = {
  openById: function () {
    return {
      getName: function () { return 'previa'; },
      getSheetByName: __hoja,
      insertSheet: function (n) { window.HOJAS[n] = [[]]; return __hoja(n); },
      getSheets: function () { return Object.keys(window.HOJAS).map(__hoja); }
    };
  }
};

var PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function () { return null; },
      getProperties: function () { return {}; },
      setProperty: function () {}
    };
  }
};

var CacheService = {
  getScriptCache: function () {
    return { get: function () { return null; }, put: function () {} };
  }
};

var HtmlService = {
  createTemplateFromFile: function () {
    return { evaluate: function () {
      return { setTitle: function () {
        return { setXFrameOptionsMode: function () { return {}; } };
      } };
    } };
  },
  createHtmlOutputFromFile: function () { return { getContent: function () { return ''; } }; },
  XFrameOptionsMode: { ALLOWALL: 1 }
};

var ScriptApp = { getProjectTriggers: function () { return []; } };
var UrlFetchApp = {
  fetch: function () {
    throw new Error('La vista previa no llama APIs externas: usa las tablas ya descargadas.');
  }
};
var BigQuery = null;
