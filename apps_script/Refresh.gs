/**
 * Refresh.gs — Orquestación y trigger diario
 * ------------------------------------------
 * refreshAll()      corre todas las fuentes. Cada una está en su propio
 *                   try/catch: si Meta falla, HubSpot igual se actualiza.
 * crearTriggerDiario() programa el refresh a las 6:00 AM Colombia.
 *
 * Todo lo que pasa queda en la hoja _LOG, y el dashboard lee de ahí el
 * estado de cada fuente para pintar los badges de "falta conexión".
 */

function refreshAll() {
  var inicio = new Date();
  var res = {};

  // Cada fuente aislada: un fallo no tumba el resto del refresh.
  res.hubspot = intentar_('HubSpot', function () { return refreshHubSpot(); });
  res.hilos = intentar_('Hilos', function () { return refreshHilos(); });
  res.meta = intentar_('Meta Ads', function () { return refreshMetaAds(); });
  res.conversion = intentar_('BigQuery Conversion', function () { return refreshConversion(); });
  res.revenue = intentar_('BigQuery Revenue', function () { return refreshRevenue(); });
  // Fuentes acordadas con BI: el tablero lee estas.
  res.plataforma = intentar_('BigQuery PlataformaSedes',
    function () { return refreshPlataformaSedes(); });
  res.plataMes = intentar_('BigQuery PlataSedeMes',
    function () { return refreshPlataSedeMes(); });
  res.embudo = intentar_('BigQuery EmbudoOrigen',
    function () { return refreshEmbudoOrigen(); });
  res.embudoConv = intentar_('BigQuery EmbudoConv',
    function () { return refreshEmbudoConv(); });
  res.actSede = intentar_('BigQuery ActSedeMes',
    function () { return refreshActSedeMes(); });
  res.cosechaDia = intentar_('BigQuery CosechaDia',
    function () { return refreshCosechaDia(); });

  res.rescate = intentar_('BigQuery Rescate', function () { return refreshRescate(); });
  // Variantes con id_sede: son las que lee el tablero, porque el filtro
  // global de origen necesita la llave de sede para poder cortar.
  res.rescateSede = intentar_('BigQuery RescateSede',
    function () { return refreshRescateSede(); });
  res.plataSede = intentar_('BigQuery PlataSedeAnt',
    function () { return refreshPlataSedeAnt(); });
  res.plata = intentar_('BigQuery PlataSobreMesa',
    function () { return refreshPlataSobreMesa(); });
  // refreshCohortes() escribia PLATA_SEDE_MES desde t_solicitudes con filtro
  // de estado_final. Lo reemplaza refreshPlataSedeMes() sobre t_des_v2. La
  // funcion vieja se deja en el archivo para poder auditar la diferencia,
  // pero no corre en el refresh.
  res.wp = intentar_('BigQuery WelliPoints', function () { return refreshWelliPoints(); });
  res.wpSede = intentar_('BigQuery WP por sede',
    function () { return refreshWpPorSede(); });

  var seg = Math.round((new Date().getTime() - inicio.getTime()) / 1000);
  setConfig_('ultima_actualizacion',
    Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') + ' (' + seg + 's)');
  log_('refreshAll', 'FIN', 0, JSON.stringify(res) + ' en ' + seg + 's');

  // El caché del frontend queda viejo tras un refresh.
  try { CacheService.getScriptCache().removeAll(['dash']); } catch (e) {}
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

function intentar_(nombre, fn) {
  try {
    return fn();
  } catch (e) {
    log_(nombre, 'ERROR', 0, String(e).substring(0, 250));
    return 'ERROR: ' + String(e).substring(0, 120);
  }
}

/** Trigger diario 6:00 AM hora Colombia. Borra el anterior si existe. */
function crearTriggerDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshAll')
    .timeBased()
    .atHour(6)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(TZ)
    .create();
  Logger.log('Trigger diario creado: refreshAll a las 6:00 ' + TZ);
}

function borrarTriggers() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
    n++;
  });
  Logger.log('Triggers borrados: ' + n);
}

/**
 * Diagnóstico completo. Corre esto primero después de configurar las
 * credenciales: dice exactamente qué fuente está lista y qué falta.
 */
function diagnostico() {
  var lineas = ['=== DIAGNÓSTICO TABLERO 360 GROWTH WELLI ==='];

  lineas.push('');
  lineas.push('-- Credenciales en Script Properties --');
  PROPS_REQUERIDAS.forEach(function (k) {
    lineas.push('  ' + k + ': ' + (prop_(k) ? 'configurada' : 'FALTA'));
  });

  lineas.push('');
  lineas.push('-- Acceso al Sheet --');
  try {
    var ss = libro_();
    lineas.push('  OK: ' + ss.getName());
    lineas.push('  hojas: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  } catch (e) {
    lineas.push('  FALLO: ' + e);
  }

  lineas.push('');
  lineas.push('-- Fuentes --');

  try {
    var d = hsFetch_('/crm/v3/objects/' + HS_OBJ_SEDES + '/search', {
      filterGroups: [{ filters: [{ propertyName: 'hs_object_id', operator: 'GTE', value: '0' }] }],
      properties: ['nombre_sede'], limit: 1
    });
    lineas.push('  HubSpot: OK, ' + d.total + ' sedes');
  } catch (e) {
    lineas.push('  HubSpot: FALLO ' + String(e).substring(0, 150));
  }

  try {
    var h = hilosGet_(null, 'broadcast', { limit: 1 });
    lineas.push('  Hilos: OK, ' + h.count + ' broadcasts');
  } catch (e) {
    lineas.push('  Hilos: FALLO ' + String(e).substring(0, 150));
  }

  try {
    var m = metaFetch_('/' + META_AD_ACCOUNT, { fields: 'name,currency' });
    lineas.push('  Meta Ads: OK, ' + m.name + ' (' + m.currency + ')');
  } catch (e) {
    lineas.push('  Meta Ads: FALLO ' + String(e).substring(0, 150));
  }

  try {
    var b = bq_('SELECT 1 AS ok', BQ_PROJECT_CREDITO);
    lineas.push('  BigQuery welli-tecnologia: OK');
  } catch (e) {
    lineas.push('  BigQuery welli-tecnologia: FALLO ' + String(e).substring(0, 150));
  }

  try {
    // El job se crea en welli-data aunque el FROM sea welli-growth: la
    // cuenta lee wp_data pero no tiene bigquery.jobs.create en welli-growth.
    var w = bq_('SELECT table_name FROM `welli-growth.wp_data.INFORMATION_SCHEMA.TABLES`',
                BQ_PROJECT_DATA);
    lineas.push('  BigQuery welli-growth: OK, tablas: ' +
      w.filas.map(function (f) { return f[0]; }).join(', '));
  } catch (e) {
    lineas.push('  BigQuery welli-growth: FALLO ' + String(e).substring(0, 150));
  }

  try {
    var t = bq_('SELECT COUNT(*) AS n FROM `welli-data.data_ops.t_solicitudes`',
                BQ_PROJECT_DATA);
    lineas.push('  BigQuery welli-data: OK, ' + t.filas[0][0] + ' solicitudes');
  } catch (e) {
    lineas.push('  BigQuery welli-data: FALLO ' + String(e).substring(0, 150));
  }

  lineas.push('');
  lineas.push('-- Trigger --');
  var trs = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'refreshAll';
  });
  lineas.push('  refreshAll programado: ' + (trs.length ? 'sí' : 'NO — corre crearTriggerDiario()'));

  var txt = lineas.join('\n');
  Logger.log(txt);
  return txt;
}
