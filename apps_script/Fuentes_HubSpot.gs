/**
 * Fuentes_HubSpot.gs — Objeto personalizado "Sedes" (2-50958246)
 * -------------------------------------------------------------
 * Escribe: SEDES, SEDES_EVENTOS, COSECHAS, CONV_ORIGEN,
 *          PIPELINE_SNAPSHOT, F2_AUDIENCIA, F2_COMUNICACIONES, F2_AAA,
 *          RESCATE_INV, RESCATE_SEDES, RESCATE_PIEZAS, WP_KPI, WP_MES
 *
 * Quirks aprendidos con la API real:
 *  - Si filtras POR una propiedad, HubSpot la EXCLUYE de la respuesta.
 *    Por eso el filtro es hs_object_id GTE 0: trae todo sin esconder nada.
 *  - La paginación es por cursor (campo paging.next.after), no por offset.
 *  - Las propiedades vacías simplemente NO vienen en el objeto.
 *  - wrapped_pacientes_* son campos del Wrapped 2025 y están VACÍOS en
 *    toda la base. Los contadores vivos son aplicaciones / total_aprobados /
 *    desembolsos y sus variantes de 30 y 60 días.
 *  - no_aplica_wp tiene la etiqueta "Aplica WP": true = SÍ aplica.
 */

var HS_PROPS = [
  'nombre_sede', 'id_internal', 'origen', 'clasificacion_aliado', 'ranking', 'grupo_long_tail',
  'ciudad_municipio', 'hs_pipeline', 'hs_pipeline_stage', 'asesor_comercial', 'hs_createdate',
  'fecha_entrada_pipeline_actual', 'fecha_entrada_auto', 'fecha_entrada_farmer',
  'cs_fecha_entrada', 'fecha_entrada_capm', 'fecha_reactivacion_muertos',
  'fecha_de_reactivacion', 'fecha_primer_contacto', 'fecha_primera_capacitacion',
  'fecha_segunda_capacitacion', 'fecha_capacitado', 'cs_fecha_exitosa_real',
  'fecha_primera_firma_auto', 'fecha_ultimaapp', 'fecha_ultima_aplicacion',
  'fecha_ultimo_desembolso', 'ultimo_wp_ganado_fecha', 'fecha_de_visita',
  'aplicaciones', 'total_aprobados', 'desembolsos', 'apps_sede_actual',
  'desembolsos_mes_actual', 'total_aprobados_ultimos_30_dias',
  'total_aprobados_ultimos_60_dias', 'total_de_desembolsos_ultimos_30_dias',
  'total_de_desembolsos_ultimos_60_dias', 'aprobados_no_firmados',
  'total_aprobados_no_firmados_ultimos_30_dias',
  'total_aprobados_no_firmados_ultimos_60_dias', 'dias_desde_ultima_app',
  'monto_total_desembolsado', 'monto_desembolsado_mes', 'promedio_montos_desembolsados_4m',
  'puntos', 'wp_ganado_acumulado_mes', 'wp_ofrecido_acumulado_mes', 'wp_pendiente_actual',
  'valor_puntos', 'no_aplica_wp', 'ultimo_wp_ganado_monto',
  'audiencia_long_tail', 'lt_ultima_pieza', 'estado_comunicaciones', 'auto_bucket',
  'alert_level', 'resucitado___de_apps', 'resucitado___de_desembolsos',
  'resucitado_solicitudes_aprobadas', 'monto_aprobado_after_resucitado',
  'cs_apps_total_bq', 'cs_firmas_total_bq', 'cs_hizo_1app', 'cs_exitosa_real',
  'cs_dias_a_1app', 'visita_recibida'
];

function hsFetch_(path, payload) {
  var token = prop_('HUBSPOT_TOKEN');
  if (!token) throw new Error('Falta HUBSPOT_TOKEN en Script Properties');
  var opts = {
    method: payload ? 'post' : 'get',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  };
  if (payload) opts.payload = JSON.stringify(payload);

  for (var intento = 0; intento < 4; intento++) {
    var res = UrlFetchApp.fetch(HUBSPOT_BASE + path, opts);
    var code = res.getResponseCode();
    if (code === 200) return JSON.parse(res.getContentText());
    if (code === 429 || code >= 500) {           // rate limit o error transitorio
      Utilities.sleep(2000 * (intento + 1));
      continue;
    }
    throw new Error('HubSpot ' + code + ': ' + res.getContentText().substring(0, 300));
  }
  throw new Error('HubSpot: se agotaron los reintentos en ' + path);
}

/** Baja las 3.600+ sedes con todas las propiedades que necesita el tablero. */
function hsTraerSedes_() {
  var out = [], after = null, vueltas = 0;
  do {
    var body = {
      filterGroups: [{ filters: [{ propertyName: 'hs_object_id', operator: 'GTE', value: '0' }] }],
      properties: HS_PROPS,
      limit: 100
    };
    if (after) body.after = after;
    var d = hsFetch_('/crm/v3/objects/' + HS_OBJ_SEDES + '/search', body);
    (d.results || []).forEach(function (o) {
      var p = o.properties || {};
      p.id = o.id;
      out.push(p);
    });
    after = d.paging && d.paging.next ? d.paging.next.after : null;
    vueltas++;
  } while (after && vueltas < 100);
  return out;
}

/** Pipelines y etapas del objeto Sedes, para traducir IDs a nombres. */
function hsTraerPipelines_() {
  var d = hsFetch_('/crm/v3/pipelines/' + HS_OBJ_SEDES);
  var pipes = {}, stages = {};
  (d.results || []).forEach(function (p) {
    pipes[p.id] = p.label;
    (p.stages || []).forEach(function (s) { stages[s.id] = s.label; });
  });
  return { pipes: pipes, stages: stages };
}

// ---------------------------------------------------------------- helpers
function n_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  var x = Number(v);
  return isNaN(x) ? 0 : x;
}

/** Normaliza fechas de HubSpot (ISO o epoch ms) a yyyy-MM-dd. */
function hsFecha_(v) {
  if (!v) return '';
  var s = String(v);
  if (/^\d{12,}$/.test(s)) return Utilities.formatDate(new Date(Number(s)), TZ, 'yyyy-MM-dd');
  return s.substring(0, 10);
}

var ORIGEN_BUCKET = {
  'EVENTO': 'Eventos', 'REFERIDO': 'Referidos',
  'PAGINA WEB': 'Pagina web', 'SOCIAL MEDIA': 'Social media'
};

function origenBucket_(o) {
  if (!o) return 'Sin origen';
  return ORIGEN_BUCKET[String(o).trim().toUpperCase()] || 'Otros origenes';
}

// Eventos fechados del ciclo de vida: [propiedad, etiqueta, categoría]
var HS_EVENTOS = [
  ['fecha_entrada_pipeline_actual', 'Entrada a pipeline actual', 'ciclo'],
  ['fecha_entrada_auto', 'Entrada a Autogestionados', 'ciclo'],
  ['fecha_entrada_farmer', 'Entrada a Farmer', 'ciclo'],
  ['cs_fecha_entrada', 'Entrada a Customer Success', 'ciclo'],
  ['fecha_entrada_capm', 'Entrada a Capacitacion muertos', 'ciclo'],
  ['fecha_reactivacion_muertos', 'Reactivación de muerta', 'reactivacion'],
  ['fecha_de_reactivacion', 'Reactivación', 'reactivacion'],
  ['fecha_primer_contacto', 'Primer contacto', 'gestion'],
  ['fecha_primera_capacitacion', 'Primera capacitación', 'gestion'],
  ['fecha_segunda_capacitacion', 'Segunda capacitación', 'gestion'],
  ['fecha_capacitado', 'Capacitada', 'gestion'],
  ['cs_fecha_exitosa_real', 'CS exitosa (3 apps o 1 firma)', 'resultado'],
  ['fecha_primera_firma_auto', 'Estrena primer paciente', 'resultado'],
  ['fecha_ultimo_desembolso', 'Último desembolso', 'resultado'],
  // Existen dos propiedades para lo mismo y la poblada es fecha_ultima_aplicacion
  // (fecha_ultimaapp está vacía en las 3.601 sedes). Se leen las dos por si el
  // equipo empieza a llenar la otra.
  ['fecha_ultima_aplicacion|fecha_ultimaapp', 'Última aplicación', 'resultado'],
  ['ultimo_wp_ganado_fecha', 'Welli Point ganado', 'welli_points'],
  ['fecha_de_visita', 'Visita comercial', 'gestion'],
  ['hs_createdate', 'Sede creada', 'ciclo']
];

// =====================================================================
// Refresh de HubSpot: baja las sedes y reconstruye todas las hojas
// =====================================================================

function refreshHubSpot() {
  try {
    var pl = hsTraerPipelines_();
    var sedes = hsTraerSedes_();
    if (!sedes.length) throw new Error('HubSpot devolvió 0 sedes');

    escribirHoja_('SEDES', tablaSedes_(sedes, pl));
    escribirHoja_('SEDES_EVENTOS', tablaEventos_(sedes, pl));
    escribirHoja_('COSECHAS', tablaCosechas_(sedes));
    escribirHoja_('CONV_ORIGEN', tablaConvOrigen_(sedes));
    escribirHoja_('PIPELINE_SNAPSHOT', tablaPipelines_(sedes, pl));
    escribirHoja_('F2_AUDIENCIA', tablaAudiencia_(sedes));
    escribirHoja_('F2_COMUNICACIONES', tablaComunicaciones_(sedes));
    escribirHoja_('F2_AAA', tablaAAA_(sedes, pl));
    escribirHoja_('RESCATE_INV', tablaRescateInv_(sedes));
    escribirHoja_('RESCATE_SEDES', tablaRescateSedes_(sedes, pl));
    escribirHoja_('RESCATE_PIEZAS', tablaPiezas_(sedes));
    escribirHoja_('WP_KPI', tablaWpKpi_(sedes));
    escribirHoja_('WP_MES', tablaWpMes_(sedes));

    log_('HubSpot Sedes', 'OK', sedes.length, 'refresh completo');
    return sedes.length;
  } catch (e) {
    log_('HubSpot Sedes', 'ERROR', 0, String(e).substring(0, 250));
    throw e;
  }
}

// ------------------------------------------------------------- SEDES
function tablaSedes_(sedes, pl) {
  var head = ['id', 'id_internal', 'nombre_sede', 'pipeline', 'etapa', 'origen', 'origen_bucket',
    'clasificacion_aliado', 'ranking', 'grupo_long_tail', 'ciudad_municipio',
    'asesor_comercial', 'audiencia_long_tail', 'lt_ultima_pieza', 'estado_comunicaciones',
    'auto_bucket', 'alert_level', 'fecha_entrada_pipeline_actual', 'fecha_ultima_app',
    'fecha_ultimo_desembolso', 'fecha_capacitado', 'aplicaciones', 'total_aprobados',
    'desembolsos', 'apps_mes_actual', 'desembolsos_mes_actual', 'aprobados_no_firmados',
    'aprob_no_firmados_30d', 'aprob_no_firmados_60d', 'aprobados_30d', 'aprobados_60d',
    'desembolsos_30d', 'desembolsos_60d', 'dias_desde_ultima_app',
    'monto_total_desembolsado', 'monto_desembolsado_mes', 'ticket_promedio_4m',
    'puntos', 'wp_ganado_mes', 'wp_ofrecido_mes', 'wp_pendiente', 'valor_puntos',
    'aplica_wp_raw', 'resu_apps', 'resu_desembolsos', 'resu_aprobados',
    'monto_aprobado_post_resu', 'cs_apps_bq', 'cs_firmas_bq', 'cs_hizo_1app',
    'cs_exitosa', 'cs_dias_a_1app', 'visita_recibida'];
  var filas = [head];
  sedes.forEach(function (r) {
    var origen = (r.origen || '').trim();
    filas.push([
      r.id || '', r.id_internal || '', r.nombre_sede || '',
      pl.pipes[r.hs_pipeline] || r.hs_pipeline || '',
      pl.stages[r.hs_pipeline_stage] || r.hs_pipeline_stage || '',
      origen, origenBucket_(origen),
      r.clasificacion_aliado || '', r.ranking || '', r.grupo_long_tail || '',
      r.ciudad_municipio || '', r.asesor_comercial || '',
      r.audiencia_long_tail || '', r.lt_ultima_pieza || '',
      r.estado_comunicaciones || '', r.auto_bucket || '', r.alert_level || '',
      hsFecha_(r.fecha_entrada_pipeline_actual),
      hsFecha_(r.fecha_ultimaapp || r.fecha_ultima_aplicacion),
      hsFecha_(r.fecha_ultimo_desembolso), hsFecha_(r.fecha_capacitado),
      hsFecha_(r.hs_createdate).substring(0, 7),
      n_(r.aplicaciones), n_(r.total_aprobados), n_(r.desembolsos),
      n_(r.apps_sede_actual), n_(r.desembolsos_mes_actual), n_(r.aprobados_no_firmados),
      n_(r.total_aprobados_no_firmados_ultimos_30_dias),
      n_(r.total_aprobados_no_firmados_ultimos_60_dias),
      n_(r.total_aprobados_ultimos_30_dias), n_(r.total_aprobados_ultimos_60_dias),
      n_(r.total_de_desembolsos_ultimos_30_dias), n_(r.total_de_desembolsos_ultimos_60_dias),
      n_(r.dias_desde_ultima_app),
      n_(r.monto_total_desembolsado), n_(r.monto_desembolsado_mes),
      n_(r.promedio_montos_desembolsados_4m),
      n_(r.puntos), n_(r.wp_ganado_acumulado_mes), n_(r.wp_ofrecido_acumulado_mes),
      n_(r.wp_pendiente_actual), n_(r.valor_puntos), r.no_aplica_wp || '',
      n_(r.resucitado___de_apps), n_(r.resucitado___de_desembolsos),
      n_(r.resucitado_solicitudes_aprobadas), n_(r.monto_aprobado_after_resucitado),
      n_(r.cs_apps_total_bq), n_(r.cs_firmas_total_bq), r.cs_hizo_1app || '',
      r.cs_exitosa_real || '', n_(r.cs_dias_a_1app), r.visita_recibida || ''
    ]);
  });
  return filas;
}

// ----------------------------------------------------- SEDES_EVENTOS
function tablaEventos_(sedes, pl) {
  var filas = [['fecha', 'evento', 'categoria', 'sede_id', 'sede', 'pipeline', 'origen',
    'origen_bucket', 'clasificacion_aliado', 'audiencia_long_tail', 'asesor_comercial',
    'monto']];
  sedes.forEach(function (r) {
    var origen = (r.origen || '').trim();
    var base = [r.id || '', r.nombre_sede || '', pl.pipes[r.hs_pipeline] || '',
      origen, origenBucket_(origen), r.clasificacion_aliado || '',
      r.audiencia_long_tail || '', r.asesor_comercial || ''];
    HS_EVENTOS.forEach(function (ev) {
      // La propiedad puede venir como 'a|b': se toma la primera con valor.
      var f = '';
      ev[0].split('|').some(function (nombre) {
        f = hsFecha_(r[nombre]);
        return !!f;
      });
      if (!f) return;
      var monto = 0;
      if (ev[0] === 'fecha_ultimo_desembolso') monto = n_(r.monto_desembolsado_mes);
      if (ev[0] === 'ultimo_wp_ganado_fecha') monto = n_(r.ultimo_wp_ganado_monto);
      filas.push([f, ev[1], ev[2]].concat(base).concat([monto]));
    });
  });
  var head = filas.shift();
  filas.sort(function (a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); });
  return [head].concat(filas);
}

// ----------------------------------------------------------- COSECHAS
// La cosecha se ancla en hs_createdate: el mes en que la sede se creo en
// HubSpot. Es inmutable — una sede creada en marzo pertenece a la cosecha
// 2026-03 para siempre, sin importar a que pipeline se mueva despues.
// NO usar fecha_entrada_pipeline_actual: cambia con cada movimiento y
// concentra las sedes en el mes en que se reorganizaron los pipelines.
//
// Y el tablero es de MARKETING: la cosecha cuenta SOLO las sedes de los
// cuatro origenes que marketing genera. El total de todas las sedes va en
// la ultima columna como contexto, no como cifra principal.
var MKT_BUCKETS = ['Eventos', 'Referidos', 'Pagina web', 'Social media'];

function tablaCosechas_(sedes) {
  var coh = {};
  sedes.forEach(function (r) {
    var f = hsFecha_(r.hs_createdate);
    if (!f) return;
    var m = f.substring(0, 7);
    if (!coh[m]) coh[m] = { todas: 0, mkt: 0, o: {}, c: {} };
    var b = coh[m];
    b.todas++;
    var bucket = origenBucket_((r.origen || '').trim());
    if (MKT_BUCKETS.indexOf(bucket) < 0) return;
    b.mkt++;
    b.o[bucket] = (b.o[bucket] || 0) + 1;
    var cl = (r.clasificacion_aliado || '').trim().toUpperCase();
    if (cl) b.c[cl] = (b.c[cl] || 0) + 1;
  });
  var filas = [['cosecha', 'sedes_mkt', 'Eventos', 'Referidos', 'Pagina web',
    'Social media', 'mkt_A', 'mkt_AA', 'mkt_AAA', 'sedes_todas']];
  Object.keys(coh).sort().forEach(function (m) {
    var b = coh[m];
    filas.push([m, b.mkt, b.o['Eventos'] || 0, b.o['Referidos'] || 0,
      b.o['Pagina web'] || 0, b.o['Social media'] || 0,
      b.c['A'] || 0, b.c['AA'] || 0, b.c['AAA'] || 0, b.todas]);
  });
  return filas;
}

// -------------------------------------------------------- CONV_ORIGEN
function tablaConvOrigen_(sedes) {
  var g = {};
  sedes.forEach(function (r) {
    var k = origenBucket_((r.origen || '').trim());
    if (!g[k]) g[k] = { sedes: 0, apps: 0, aprob: 0, desemb: 0, monto: 0 };
    var b = g[k];
    b.sedes++;
    b.apps += n_(r.aplicaciones);
    b.aprob += n_(r.total_aprobados);
    b.desemb += n_(r.desembolsos);
    b.monto += n_(r.monto_total_desembolsado);
  });
  var filas = [['origen', 'sedes', 'apps', 'aprobados', 'desembolsos', 'monto_desembolsado',
    'tasa_aprobacion_pct', 'tasa_conversion_pct', 'apps_por_sede']];
  Object.keys(g).sort(function (a, b) { return g[b].apps - g[a].apps; }).forEach(function (k) {
    var b = g[k];
    filas.push([k, b.sedes, Math.round(b.apps), Math.round(b.aprob), Math.round(b.desemb),
      Math.round(b.monto),
      b.apps ? Math.round((b.aprob / b.apps) * 1000) / 10 : 0,
      b.apps ? Math.round((b.desemb / b.apps) * 1000) / 10 : 0,
      b.sedes ? Math.round((b.apps / b.sedes) * 10) / 10 : 0]);
  });
  return filas;
}

// --------------------------------------------------- PIPELINE_SNAPSHOT
function tablaPipelines_(sedes, pl) {
  var tot = {}, st = {};
  sedes.forEach(function (r) {
    var p = pl.pipes[r.hs_pipeline] || 'Sin pipeline';
    tot[p] = (tot[p] || 0) + 1;
    var e = pl.stages[r.hs_pipeline_stage] || '-';
    if (!st[p]) st[p] = {};
    st[p][e] = (st[p][e] || 0) + 1;
  });
  var filas = [['pipeline', 'etapa', 'sedes']];
  Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; }).forEach(function (p) {
    filas.push([p, '(TOTAL)', tot[p]]);
    Object.keys(st[p]).sort(function (a, b) { return st[p][b] - st[p][a]; })
      .forEach(function (e) { filas.push([p, e, st[p][e]]); });
  });
  return filas;
}

// ------------------------------------------------------ F2_AUDIENCIA
function tablaAudiencia_(sedes) {
  var g = {};
  sedes.forEach(function (r) {
    var k = r.audiencia_long_tail || 'Sin audiencia';
    if (!g[k]) g[k] = { sedes: 0, pieza: 0, act: 0, apps: 0, appsMes: 0, des: 0, desMes: 0, monto: 0 };
    var b = g[k];
    b.sedes++;
    if (r.lt_ultima_pieza) b.pieza++;
    b.apps += n_(r.aplicaciones);
    b.appsMes += n_(r.apps_sede_actual);
    b.des += n_(r.desembolsos);
    b.desMes += n_(r.desembolsos_mes_actual);
    b.monto += n_(r.monto_total_desembolsado);
    if (n_(r.apps_sede_actual) > 0) b.act++;
  });
  var filas = [['audiencia', 'sedes', 'con_pieza_enviada', 'sedes_activas_mes', 'apps_hist',
    'apps_mes', 'desembolsos_hist', 'desembolsos_mes', 'monto_desembolsado', 'pct_activas_mes']];
  Object.keys(g).sort(function (a, b) { return g[b].sedes - g[a].sedes; }).forEach(function (k) {
    var b = g[k];
    filas.push([k, b.sedes, b.pieza, b.act, Math.round(b.apps), Math.round(b.appsMes),
      Math.round(b.des), Math.round(b.desMes), Math.round(b.monto),
      b.sedes ? Math.round((b.act / b.sedes) * 1000) / 10 : 0]);
  });
  return filas;
}

// ------------------------------------------------- F2_COMUNICACIONES
function tablaComunicaciones_(sedes) {
  var g = {};
  sedes.forEach(function (r) {
    var k = r.estado_comunicaciones || 'Sin dato';
    if (!g[k]) g[k] = { sedes: 0, act: 0, apps: 0, des: 0 };
    var b = g[k];
    b.sedes++;
    b.apps += n_(r.aplicaciones);
    b.des += n_(r.desembolsos);
    if (n_(r.apps_sede_actual) > 0) b.act++;
  });
  var filas = [['estado_comunicaciones', 'sedes', 'sedes_activas_mes', 'apps_hist',
    'desembolsos_hist']];
  Object.keys(g).sort(function (a, b) { return g[b].sedes - g[a].sedes; }).forEach(function (k) {
    filas.push([k, g[k].sedes, g[k].act, Math.round(g[k].apps), Math.round(g[k].des)]);
  });
  return filas;
}

// ------------------------------------------------------------- F2_AAA
function tablaAAA_(sedes, pl) {
  var aaa = sedes.filter(function (r) {
    return (r.clasificacion_aliado || '').toUpperCase() === 'AAA';
  });
  aaa.sort(function (a, b) {
    return n_(b.monto_total_desembolsado) - n_(a.monto_total_desembolsado);
  });
  var filas = [['sede', 'pipeline', 'ranking', 'ciudad', 'apps_hist', 'apps_mes',
    'desembolsos_hist', 'desembolsos_mes', 'monto_total', 'aprob_sin_firmar',
    'visita_recibida', 'farmer', 'alerta']];
  aaa.forEach(function (r) {
    filas.push([r.nombre_sede || '', pl.pipes[r.hs_pipeline] || '', r.ranking || '',
      r.ciudad_municipio || '', Math.round(n_(r.aplicaciones)),
      Math.round(n_(r.apps_sede_actual)), Math.round(n_(r.desembolsos)),
      Math.round(n_(r.desembolsos_mes_actual)), Math.round(n_(r.monto_total_desembolsado)),
      Math.round(n_(r.aprobados_no_firmados)), r.visita_recibida || '',
      r.asesor_comercial || '', r.alert_level || '']);
  });
  return filas;
}

// -------------------------------------------------------- RESCATE_INV
function tablaRescateInv_(sedes) {
  var t = 0, d30 = 0, d60 = 0, nS = 0;
  sedes.forEach(function (r) {
    var tot = n_(r.aprobados_no_firmados);
    t += tot;
    d30 += n_(r.total_aprobados_no_firmados_ultimos_30_dias);
    d60 += n_(r.total_aprobados_no_firmados_ultimos_60_dias);
    if (tot > 0) nS++;
  });
  return [
    ['metrica', 'valor', 'fuente'],
    ['Aprobados sin firmar - total', Math.round(t), 'HubSpot aprobados_no_firmados'],
    ['Aprobados sin firmar - ultimos 30 dias', Math.round(d30), 'HubSpot 30d'],
    ['Aprobados sin firmar - ultimos 60 dias', Math.round(d60), 'HubSpot 60d'],
    ['Sedes con inventario de rescate', nS, 'calculado'],
    ['Pacientes rescatados (desembolso tras contacto)', '', 'BigQuery profile_institucion + otp_log'],
    ['Rescatados ventana corta (<15 dias)', '', 'BigQuery'],
    ['Rescatados ventana media (15-30 dias)', '', 'BigQuery']
  ];
}

function tablaRescateSedes_(sedes, pl) {
  var con = sedes.filter(function (r) { return n_(r.aprobados_no_firmados) > 0; });
  con.sort(function (a, b) {
    return n_(b.aprobados_no_firmados) - n_(a.aprobados_no_firmados);
  });
  var filas = [['sede', 'pipeline', 'clasificacion', 'aprob_no_firmados', 'ultimos_30d',
    'ultimos_60d', 'grupo_long_tail', 'ultima_pieza', 'farmer']];
  con.slice(0, 400).forEach(function (r) {
    filas.push([r.nombre_sede || '', pl.pipes[r.hs_pipeline] || '',
      r.clasificacion_aliado || '', Math.round(n_(r.aprobados_no_firmados)),
      Math.round(n_(r.total_aprobados_no_firmados_ultimos_30_dias)),
      Math.round(n_(r.total_aprobados_no_firmados_ultimos_60_dias)),
      r.grupo_long_tail || '', r.lt_ultima_pieza || '', r.asesor_comercial || '']);
  });
  return filas;
}

function tablaPiezas_(sedes) {
  var g = {};
  sedes.forEach(function (r) {
    var pz = r.lt_ultima_pieza;
    if (!pz) return;
    if (!g[pz]) g[pz] = { sedes: 0, apps: 0, des: 0, inv: 0 };
    g[pz].sedes++;
    g[pz].apps += n_(r.aplicaciones);
    g[pz].des += n_(r.desembolsos);
    g[pz].inv += n_(r.aprobados_no_firmados);
  });
  var filas = [['pieza', 'canal', 'sedes', 'apps', 'desembolsos', 'aprob_sin_firmar',
    'desemb_por_sede']];
  Object.keys(g).sort(function (a, b) { return g[b].sedes - g[a].sedes; }).forEach(function (pz) {
    var b = g[pz];
    var canal = pz.indexOf('_wa_') >= 0 ? 'WhatsApp' : (pz.indexOf('_mail_') >= 0 ? 'Email' : '-');
    filas.push([pz, canal, b.sedes, Math.round(b.apps), Math.round(b.des),
      Math.round(b.inv), b.sedes ? Math.round((b.des / b.sedes) * 100) / 100 : 0]);
  });
  return filas;
}

// ------------------------------------------------------------- WP (F5)
function tablaWpKpi_(sedes) {
  var hab = 0, act = 0, sinMarcar = 0, sinMarcarConPuntos = 0;
  var ganado = 0, ofrecido = 0, pend = 0, saldo = 0, valor = 0;
  var appsCon = 0, appsSin = 0, desCon = 0, desSin = 0, nCon = 0, nSin = 0;
  sedes.forEach(function (r) {
    var raw = r.no_aplica_wp;
    // La etiqueta del campo en HubSpot es "Aplica WP": true = habilitada.
    var habilitada = String(raw).toLowerCase() === 'true';
    var activa = n_(r.puntos) > 0 || n_(r.wp_ganado_acumulado_mes) > 0;
    if (raw === undefined || raw === null || raw === '') {
      sinMarcar++;
      if (activa) sinMarcarConPuntos++;
    }
    if (habilitada) { hab++; if (activa) act++; }
    ganado += n_(r.wp_ganado_acumulado_mes);
    ofrecido += n_(r.wp_ofrecido_acumulado_mes);
    pend += n_(r.wp_pendiente_actual);
    saldo += n_(r.puntos);
    valor += n_(r.valor_puntos);
    if (activa) { nCon++; appsCon += n_(r.aplicaciones); desCon += n_(r.desembolsos); }
    else { nSin++; appsSin += n_(r.aplicaciones); desSin += n_(r.desembolsos); }
  });
  return [
    ['metrica', 'valor', 'fuente', 'nota'],
    ['Sedes habilitadas WP', hab, 'HubSpot no_aplica_wp',
      sinMarcar + ' sedes sin marcar, ' + sinMarcarConPuntos + ' de ellas con puntos'],
    ['Sedes que han entrado (activas)', act, 'HubSpot puntos>0 o wp_ganado>0', ''],
    ['Adopcion %', hab ? Math.round((act / hab) * 1000) / 10 : 0, 'calculado', 'activas / habilitadas'],
    ['Sedes sin entrar', hab - act, 'calculado', 'target de outreach'],
    ['WP ganados (mes en curso)', Math.round(ganado), 'HubSpot wp_ganado_acumulado_mes', ''],
    ['WP ofrecidos (mes en curso)', Math.round(ofrecido), 'HubSpot wp_ofrecido_acumulado_mes', ''],
    ['WP pendientes', Math.round(pend), 'HubSpot wp_pendiente_actual', ''],
    ['Saldo total de puntos', Math.round(saldo), 'HubSpot puntos', ''],
    ['Valor de puntos (COP)', Math.round(valor), 'HubSpot valor_puntos', ''],
    ['WP redimidos', '', 'PENDIENTE', 'welli-growth.wp_data.wp_canjeos_solicitados'],
    ['Apps promedio - sedes activas con WP', nCon ? Math.round((appsCon / nCon) * 10) / 10 : 0,
      'calculado', 'n=' + nCon],
    ['Apps promedio - sedes sin entrar', nSin ? Math.round((appsSin / nSin) * 10) / 10 : 0,
      'calculado', 'n=' + nSin],
    ['Desemb. promedio - activas con WP', nCon ? Math.round((desCon / nCon) * 10) / 10 : 0,
      'calculado', 'n=' + nCon],
    ['Desemb. promedio - sin entrar', nSin ? Math.round((desSin / nSin) * 10) / 10 : 0,
      'calculado', 'n=' + nSin]
  ];
}

function tablaWpMes_(sedes) {
  var g = {};
  sedes.forEach(function (r) {
    var f = hsFecha_(r.ultimo_wp_ganado_fecha);
    if (!f) return;
    var m = f.substring(0, 7);
    if (!g[m]) g[m] = { sedes: 0, monto: 0 };
    g[m].sedes++;
    g[m].monto += n_(r.ultimo_wp_ganado_monto);
  });
  var filas = [['mes', 'sedes_con_wp_ganado', 'monto_wp']];
  Object.keys(g).sort().forEach(function (m) {
    filas.push([m, g[m].sedes, Math.round(g[m].monto)]);
  });
  return filas;
}
