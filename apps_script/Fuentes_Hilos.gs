/**
 * Fuentes_Hilos.gs — WhatsApp (F4 rescate, F5 campañas, Resumen)
 * --------------------------------------------------------------
 * Escribe HILOS_BROADCAST, HILOS_MES, HILOS_TEMA, HILOS_FLOWS.
 *
 * Quirks de la API real:
 *  - Auth: header 'Authorization: Token <key>' (no Bearer).
 *  - Las rutas NO llevan slash final: 'broadcast' funciona, 'broadcast/' da 404.
 *  - Paginación por el campo 'next' del response (URL completa).
 *  - Con limit alto se cae por timeout: limit=40 y reintentos.
 *  - Los totales de 'flow' son ACUMULADOS desde que se creó el flow,
 *    no del período: no se pueden filtrar por fecha.
 */

function hilosGet_(urlCompleta, path, params) {
  var key = prop_('HILOS_API_KEY');
  if (!key) throw new Error('Falta HILOS_API_KEY en Script Properties');
  var url = urlCompleta;
  if (!url) {
    url = HILOS_BASE + path;
    if (params) {
      url += '?' + Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
    }
  }
  var opts = {
    headers: { Authorization: 'Token ' + key },
    muteHttpExceptions: true
  };
  for (var i = 0; i < 4; i++) {
    var res = UrlFetchApp.fetch(url, opts);
    if (res.getResponseCode() === 200) return JSON.parse(res.getContentText());
    Utilities.sleep(3000 * (i + 1));
  }
  throw new Error('Hilos: se agotaron los reintentos en ' + (path || url));
}

function hilosPaginado_(path, tope) {
  var out = [], next = null, vueltas = 0;
  do {
    var d = next ? hilosGet_(next) : hilosGet_(null, path, { limit: 40 });
    out = out.concat(d.results || []);
    next = d.next || null;
    vueltas++;
  } while (next && vueltas < (tope || 40));
  return out;
}

// El tema se deduce del nombre de la campaña: Hilos no tiene un campo
// de categoría, y el equipo nombra las campañas con un prefijo temático.
var HILOS_TEMAS = [
  ['Cobranza y pagos', ['cobranza', 'precobranza', 'pago', 'mora', 'extracto', 'recaudo', 'factura']],
  ['Rescate y activacion', ['rescate', 'activacion', 'aprobado', 'firma', 'otp', 'estanc', 'no_firm']],
  ['Sedes y aliados', ['sede', 'aliado', 'clinica', 'medico', 'farmer', 'capacit', 'onboarding']],
  ['Welli Points', ['wellipoint', 'welli_point', 'wp_', 'puntos', 'concurso', 'premio']],
  ['Producto y novedades', ['cupon', 'novedad', 'lanzamiento', 'nuevo', 'producto']],
  ['Encuestas y NPS', ['encuesta', 'nps', 'satisfacc', 'opinion']],
  ['Adquisicion pacientes', ['paciente', 'credito', 'solicitud', 'preaprob', 'campana']]
];

function hilosTema_(nombre) {
  var n = String(nombre || '').toLowerCase();
  for (var i = 0; i < HILOS_TEMAS.length; i++) {
    var kws = HILOS_TEMAS[i][1];
    for (var j = 0; j < kws.length; j++) {
      if (n.indexOf(kws[j]) >= 0) return HILOS_TEMAS[i][0];
    }
  }
  return 'Otros';
}

function refreshHilos() {
  try {
    if (!tieneCredencial_('HILOS')) {
      log_('Hilos', 'ERROR', 0, 'Falta HILOS_API_KEY en Script Properties');
      return 0;
    }
    var bc = hilosPaginado_('broadcast', 40);
    var fl = hilosPaginado_('flow', 5);

    // ---- BROADCAST detalle ------------------------------------------
    var filas = [['campana', 'fecha', 'mes', 'tema', 'estado', 'enviados', 'entregados',
      'leidos', 'respuestas', 'fallidos', 'pendientes', 'tasa_entrega_pct',
      'tasa_lectura_pct', 'tasa_respuesta_pct']];
    var porMes = {}, porTema = {};

    bc.forEach(function (b) {
      var nombre = b.name || '';
      var f = String(b.created_on || '').substring(0, 10);
      var mes = f.substring(0, 7);
      var tema = hilosTema_(nombre);
      var env = Number(b.sent || 0), ent = Number(b.delivered || 0);
      var lei = Number(b.read || 0), resp = Number(b.answered || 0);
      filas.push([nombre, f, mes, tema, b.status || '', env, ent, lei, resp,
        Number(b.failed || 0), Number(b.pending || 0),
        env ? Math.round((ent / env) * 1000) / 10 : 0,
        ent ? Math.round((lei / ent) * 1000) / 10 : 0,
        ent ? Math.round((resp / ent) * 1000) / 10 : 0]);

      if (mes) {
        if (!porMes[mes]) porMes[mes] = { c: 0, env: 0, ent: 0, lei: 0, resp: 0 };
        var m = porMes[mes];
        m.c++; m.env += env; m.ent += ent; m.lei += lei; m.resp += resp;
      }
      if (!porTema[tema]) porTema[tema] = { c: 0, env: 0, ent: 0, lei: 0, resp: 0 };
      var t = porTema[tema];
      t.c++; t.env += env; t.ent += ent; t.lei += lei; t.resp += resp;
    });

    var head = filas.shift();
    filas.sort(function (a, b) { return a[1] < b[1] ? 1 : (a[1] > b[1] ? -1 : 0); });
    escribirHoja_('HILOS_BROADCAST', [head].concat(filas));

    // ---- agregados --------------------------------------------------
    var fm = [['mes', 'campanas', 'enviados', 'entregados', 'leidos', 'respuestas',
      'tasa_lectura_pct', 'tasa_respuesta_pct']];
    Object.keys(porMes).sort().forEach(function (k) {
      var b = porMes[k];
      fm.push([k, b.c, b.env, b.ent, b.lei, b.resp,
        b.ent ? Math.round((b.lei / b.ent) * 1000) / 10 : 0,
        b.ent ? Math.round((b.resp / b.ent) * 1000) / 10 : 0]);
    });
    escribirHoja_('HILOS_MES', fm);

    var ft = [['tema', 'campanas', 'enviados', 'entregados', 'leidos', 'respuestas',
      'tasa_lectura_pct', 'tasa_respuesta_pct']];
    Object.keys(porTema).sort(function (a, b) { return porTema[b].env - porTema[a].env; })
      .forEach(function (k) {
        var b = porTema[k];
        ft.push([k, b.c, b.env, b.ent, b.lei, b.resp,
          b.ent ? Math.round((b.lei / b.ent) * 1000) / 10 : 0,
          b.ent ? Math.round((b.resp / b.ent) * 1000) / 10 : 0]);
      });
    escribirHoja_('HILOS_TEMA', ft);

    // ---- FLOWS (acumulados) ----------------------------------------
    var ff = [['flow', 'estado', 'contactos', 'completados', 'corriendo', 'fallidos',
      'tasa_completado_pct']];
    fl.sort(function (a, b) { return Number(b.num_contacts || 0) - Number(a.num_contacts || 0); });
    fl.forEach(function (x) {
      var n = Number(x.num_contacts || 0), comp = Number(x.completed || 0);
      ff.push([x.name || '', x.status || '', n, comp, Number(x.running || 0),
        Number(x.failed || 0), n ? Math.round((comp / n) * 1000) / 10 : 0]);
    });
    escribirHoja_('HILOS_FLOWS', ff);

    log_('Hilos', 'OK', bc.length, bc.length + ' broadcasts, ' + fl.length + ' flows');
    return bc.length;
  } catch (e) {
    log_('Hilos', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

function probarHilos() {
  try {
    var d = hilosGet_(null, 'broadcast', { limit: 2 });
    Logger.log('OK, ' + d.count + ' broadcasts en total');
    Logger.log(JSON.stringify(d.results[0], null, 2).substring(0, 800));
  } catch (e) {
    Logger.log('FALLO: ' + e);
  }
}
