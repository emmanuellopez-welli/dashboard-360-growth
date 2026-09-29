/**
 * Alertas_Sedes.gs — sedes huérfanas entre HubSpot y la plataforma
 * ================================================================
 *
 * QUÉ VIGILA. Una sede debería existir en los dos sistemas. Cuando aparece
 * en uno y no en el otro, algo falló y nadie se enteraba hasta que alguien
 * cuadraba cosechas a mano. Esto lo avisa por correo al día siguiente.
 *
 *   Tipo A · en HubSpot, sin cuenta en la plataforma
 *            La ficha del CRM no tiene id_internal, o lo tiene apuntando a
 *            un UUID que no existe en institucion_medica. Normalmente es
 *            una sede creada a mano en el CRM que nunca se vinculó.
 *
 *   Tipo B · en la plataforma, sin ficha en HubSpot
 *            Cuenta vinculada (país COL) que ninguna ficha referencia. Como
 *            el 79% de las fichas las crea una automatización, un huérfano
 *            de este tipo suele ser esa automatización que no corrió.
 *
 * POR QUÉ ESPERA TRES DÍAS. Los dos sistemas no estampan el mismo día
 * siempre. Medido sobre 1.124 sedes de marzo-2026 en adelante: 77,4% el
 * mismo día, 85,6% dentro de 1 día, 88,8% dentro de 3, 94,4% dentro de 7.
 * Alertar el mismo día sería casi todo falso positivo. Con tres días de
 * gracia, lo que sigue huérfano ya es anomalía — y el correo muestra la
 * edad de cada caso para que se distinga «recién» de «esto no se arregló».
 *
 * NO REPITE. Cada caso se avisa una vez y no se vuelve a mencionar hasta
 * siete días después si sigue sin resolverse. El estado vive en la hoja
 * ALERTAS_SEDES, que además queda como bitácora: cuándo se detectó y
 * cuándo se resolvió.
 *
 * CÓMO SE INSTALA. Correr instalarAlertaSedes() una vez. Deja un trigger
 * diario a las 7:00 (hora Colombia), después del refresh de las 6:00.
 * Los destinatarios salen de la Script Property ALERTA_TO (separados por
 * coma); si no está, usa el dueño del script.
 */

// --- Parámetros -------------------------------------------------------
var AL_DIAS_GRACIA = 3;      // días antes de considerar huérfana una sede
var AL_DIAS_REAVISO = 7;     // no repetir un caso antes de estos días
var AL_DIAS_FIRME = 7;       // a partir de acá se marca como grave
var AL_HOJA = 'ALERTAS_SEDES';
var AL_MAX_TABLA = 40;       // filas por tabla en el correo
var AL_LOOKBACK = 30;        // dias hacia atras al instalar

/**
 * FECHA DE ARRANQUE. Solo se vigilan sedes creadas desde esta fecha. Sin
 * ella, el primer correo traeria el backlog historico completo — 198 casos,
 * algunos de 1.208 dias — y seria ilegible. El backlog es un problema
 * aparte y ya esta inventariado en Conciliacion_cosechas_BI_vs_Growth.xlsx.
 *
 * instalarAlertaSedes() la estampa en la Script Property ALERTA_DESDE con
 * 30 dias de mirada atras. Para vigilar desde otra fecha, cambiar esa
 * property a mano (formato yyyy-MM-dd).
 */
function alDesde_() {
  var p = prop_('ALERTA_DESDE');
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(String(p).trim())) {
    return String(p).trim();
  }
  return fmtFecha_(sumarDias_(new Date(), -AL_LOOKBACK));
}

/**
 * Nombres que declaran por sí mismos que el registro no debe contar. Ya
 * aparecieron en la conciliación con BI: «CEDIMED - BORRAR», «Dra Valentina
 * Palacio (duplicado)», «Welli Pruebas». Sin este filtro la alerta avisaría
 * todos los días de basura conocida.
 */
var AL_PATRON_DESCARTE = /borrar|duplicad|prueba|test|no\s*usar|eliminar|inactivar/i;

// =====================================================================
// PUNTO DE ENTRADA
// =====================================================================

function alertaSedesHuerfanas() {
  try {
    var r = revisarSedesHuerfanas_();
    if (r.omitida) {
      log_('Alerta Sedes', 'OMITIDA', 0, r.motivo);
      return r;
    }
    if (r.avisar.length) {
      MailApp.sendEmail({
        to: alDestinatarios_(),
        subject: alAsunto_(r),
        htmlBody: alCuerpo_(r),
        name: 'Tablero 360 · WELLI'
      });
    }
    log_('Alerta Sedes', 'OK', r.avisar.length,
         r.tipoA.length + ' tipo A, ' + r.tipoB.length + ' tipo B, ' +
         r.resueltas + ' resueltas, ' +
         (r.avisar.length ? 'correo enviado' : 'sin novedades, no se envió'));
    return r;
  } catch (e) {
    log_('Alerta Sedes', 'ERROR', 0, String(e).substring(0, 250));
    throw e;
  }
}

/** Corre la revisión y muestra el resultado sin enviar correo. */
function probarAlertaSedes() {
  var r = revisarSedesHuerfanas_();
  Logger.log('omitida: ' + r.omitida + (r.motivo ? ' — ' + r.motivo : ''));
  Logger.log('tipo A (HubSpot sin plataforma): ' + r.tipoA.length);
  Logger.log('tipo B (plataforma sin HubSpot): ' + r.tipoB.length);
  Logger.log('a avisar en este correo: ' + r.avisar.length);
  Logger.log('resueltas desde el último aviso: ' + r.resueltas);
  r.avisar.slice(0, 15).forEach(function (c) {
    Logger.log('  [' + c.tipo + '] ' + c.nombre + ' · ' + c.dias +
               ' días · ' + (c.creadoPor || 'sin dato'));
  });
  return r;
}

function instalarAlertaSedes() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'alertaSedesHuerfanas') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('alertaSedesHuerfanas')
    .timeBased().atHour(7).everyDays(1).inTimezone(TZ).create();

  // La fecha de arranque se FIJA aca. Si se dejara calculada al vuelo, la
  // ventana se correria todos los dias y un caso viejo dejaria de avisarse
  // solo por el paso del tiempo, no porque se resolviera.
  var desde = prop_('ALERTA_DESDE');
  if (!desde) {
    desde = fmtFecha_(sumarDias_(new Date(), -AL_LOOKBACK));
    PropertiesService.getScriptProperties()
      .setProperty('ALERTA_DESDE', desde);
  }

  Logger.log('Trigger diario creado: alertaSedesHuerfanas a las 7:00 ' + TZ);
  Logger.log('Vigila sedes creadas desde: ' + desde);
  Logger.log('Destinatarios: ' + alDestinatarios_());
  Logger.log('Para cambiar destinatarios: Script Property ALERTA_TO ' +
             '(correos separados por coma)');
}

// =====================================================================
// LA REVISIÓN
// =====================================================================

function revisarSedesHuerfanas_() {
  var hoy = hoyISO_();

  // ---- la plataforma, desde la hoja que refresca el job de las 6:00 ---
  // Se lee de la hoja y no de BigQuery a propósito: es el mismo dato, sin
  // sumar una dependencia más a una alerta que debe ser confiable. Pero si
  // la hoja quedó vieja, comparar contra ella inventaría huérfanos de tipo
  // B por decenas — así que se verifica la frescura antes de mirar nada.
  var plataforma = leerHoja_('PLATAFORMA_SEDES');
  if (plataforma.length < 100) {
    return { omitida: true,
             motivo: 'PLATAFORMA_SEDES tiene ' + plataforma.length +
               ' filas: se ve incompleta y comparar contra eso daría falsos ' +
               'positivos' };
  }
  var frescura = alFrescuraPlataforma_();
  if (frescura.dias > 2) {
    return { omitida: true,
             motivo: 'PLATAFORMA_SEDES no se refresca desde ' +
               frescura.fecha + ' (' + frescura.dias + ' días). Se omite ' +
               'para no reportar huérfanos que solo son dato viejo' };
  }

  var plat = {};
  plataforma.forEach(function (r) {
    var id = String(r.id_sede || '').trim();
    if (!id) return;
    plat[id] = { pais: String(r.pais || 'COL'),
                 creada: String(r.created || '').substring(0, 10) };
  });

  // ---- HubSpot en vivo ------------------------------------------------
  var hs = alLeerSedesHubSpot_();
  var owners = alOwners_();
  var desde = alDesde_();

  var refFicha = {};
  var tipoA = [];
  hs.forEach(function (s) {
    var uuid = String(s.id_internal || '').trim();
    if (uuid) refFicha[uuid] = true;

    if (alEsDescarte_(s.nombre) || alEsDeshabilitada_(s)) return;
    var creada = String(s.creada || '').substring(0, 10);
    if (!creada || creada < desde) return;
    var dias = alDiasDesde_(creada, hoy);
    if (dias < AL_DIAS_GRACIA) return;          // todavía en ventana normal

    var falta = !uuid ? 'sin id_internal'
      : (plat[uuid] === undefined ? 'el id_internal no existe en la plataforma'
        : null);
    if (!falta) return;

    tipoA.push({
      tipo: 'A', clave: s.id, nombre: s.nombre,
      idHubSpot: s.id, uuid: uuid, creada: creada, dias: dias,
      detalle: falta,
      creadoPor: alQuienCreo_(s, owners),
      responsable: owners.porOwner[String(s.owner || '')] || '',
      origen: s.origen || '',
      etapa: (s.pipeline || '') + (s.etapa ? ' · ' + s.etapa : '')
    });
  });

  // ---- tipo B: plataforma sin ficha -----------------------------------
  var tipoB = [];
  Object.keys(plat).forEach(function (uuid) {
    var p = plat[uuid];
    if (p.pais !== 'COL') return;
    if (refFicha[uuid]) return;
    if (!p.creada || p.creada < desde) return;
    var dias = alDiasDesde_(p.creada, hoy);
    if (dias < AL_DIAS_GRACIA) return;
    tipoB.push({
      tipo: 'B', clave: uuid, nombre: '(sin nombre en la plataforma)',
      idHubSpot: '', uuid: uuid, creada: p.creada, dias: dias,
      detalle: 'ninguna ficha de HubSpot la referencia',
      creadoPor: '', responsable: '', origen: '', etapa: ''
    });
  });

  tipoA.sort(function (a, b) { return b.dias - a.dias; });
  tipoB.sort(function (a, b) { return b.dias - a.dias; });

  // ---- estado: qué es nuevo, qué se resolvió --------------------------
  var est = alEstado_(tipoA.concat(tipoB), hoy);

  return { omitida: false, motivo: '', hoy: hoy,
           tipoA: tipoA, tipoB: tipoB,
           avisar: est.avisar, nuevas: est.nuevas,
           resueltas: est.resueltas, frescura: frescura,
           totalHubSpot: hs.length,
           totalPlataforma: Object.keys(plat).length };
}

// =====================================================================
// LECTURA DE HUBSPOT
// =====================================================================

var AL_PROPS = ['nombre_sede', 'id_internal', 'hs_createdate', 'hs_pipeline',
                'origen', 'hs_created_by_user_id', 'hs_object_source_label',
                'hubspot_owner_id', 'hs_pipeline_stage'];

function alLeerSedesHubSpot_() {
  // El filtro es hs_object_id GTE 0: si se filtra POR una propiedad,
  // HubSpot la EXCLUYE de la respuesta.
  var pipes = alPipelines_();
  var out = [], after = null, vueltas = 0;
  do {
    var payload = {
      filterGroups: [{ filters: [{ propertyName: 'hs_object_id',
                                   operator: 'GTE', value: '0' }] }],
      properties: AL_PROPS, limit: 100
    };
    if (after) payload.after = after;
    var d = hsFetch_('/crm/v3/objects/2-50958246/search', payload);
    (d.results || []).forEach(function (x) {
      var p = x.properties || {};
      out.push({
        id: String(x.id || ''),
        nombre: String(p.nombre_sede || ''),
        id_internal: String(p.id_internal || ''),
        creada: String(p.hs_createdate || ''),
        pipeline: pipes.pipes[String(p.hs_pipeline || '')] ||
                  String(p.hs_pipeline || ''),
        etapa: pipes.etapas[String(p.hs_pipeline_stage || '')] || '',
        origen: String(p.origen || ''),
        creadorUser: String(p.hs_created_by_user_id || ''),
        fuente: String(p.hs_object_source_label || ''),
        owner: String(p.hubspot_owner_id || '')
      });
    });
    after = ((d.paging || {}).next || {}).after || null;
    vueltas++;
  } while (after && vueltas < 60);
  return out;
}

function alPipelines_() {
  var d = hsFetch_('/crm/v3/pipelines/2-50958246');
  var pipes = {}, etapas = {};
  (d.results || []).forEach(function (p) {
    pipes[String(p.id)] = p.label || '';
    (p.stages || []).forEach(function (e) {
      etapas[String(e.id)] = e.label || '';
    });
  });
  return { pipes: pipes, etapas: etapas };
}

/**
 * Los user ids de HubSpot NO son los owner ids: son dos numeraciones. El
 * endpoint de owners trae las dos, así que se arman los dos mapas.
 */
function alOwners_() {
  var porUser = {}, porOwner = {};
  try {
    var d = hsFetch_('/crm/v3/owners?limit=200');
    (d.results || []).forEach(function (o) {
      var nom = ((o.firstName || '') + ' ' + (o.lastName || '')).trim() ||
                o.email || '';
      if (o.userId) porUser[String(o.userId)] = nom;
      porOwner[String(o.id)] = nom;
    });
  } catch (e) {
    Logger.log('No se pudieron leer los owners: ' + e);
  }
  return { porUser: porUser, porOwner: porOwner };
}

/**
 * Quién creó la ficha. Solo el 21% de las sedes de 2026 trae
 * hs_created_by_user_id, porque el 79% las crea una automatización
 * (hs_object_source_label = AUTOMATION_PLATFORM) y ahí no hay persona.
 * Cuando no hay creador se devuelve la fuente, que ya es informativa: si
 * dice automatización, el problema es del flujo y no de alguien.
 */
function alQuienCreo_(s, owners) {
  var nom = owners.porUser[s.creadorUser];
  if (nom) return nom;
  if (s.fuente === 'AUTOMATION_PLATFORM') return 'una automatización';
  if (s.fuente === 'IMPORT') return 'una importación';
  if (s.fuente) return s.fuente;
  return '';
}

// =====================================================================
// ESTADO Y BITÁCORA
// =====================================================================

var AL_CAB = ['id_alerta', 'tipo', 'clave', 'nombre', 'detectada_en',
              'ultimo_aviso', 'resuelta_en', 'dias_para_resolver'];

/**
 * Decide qué entra en el correo. Reglas:
 *   · un caso nuevo se avisa siempre
 *   · un caso ya avisado espera AL_DIAS_REAVISO antes de volver a salir
 *   · un caso que desapareció de la lista se marca resuelto y no se avisa
 */
function alEstado_(casos, hoy) {
  var prev = {};
  leerHoja_(AL_HOJA).forEach(function (r) {
    var k = String(r.id_alerta || '');
    if (k) prev[k] = r;
  });

  var vivos = {}, avisar = [], nuevas = 0;
  casos.forEach(function (c) {
    var k = c.tipo + '|' + c.clave;
    vivos[k] = true;
    var p = prev[k];
    if (!p || String(p.resuelta_en || '')) {
      // nuevo, o reaparecido después de haberse resuelto
      c.detectada = hoy;
      c.esNuevo = true;
      nuevas++;
      avisar.push(c);
      prev[k] = { id_alerta: k, tipo: c.tipo, clave: c.clave,
                  nombre: c.nombre, detectada_en: hoy, ultimo_aviso: hoy,
                  resuelta_en: '', dias_para_resolver: '' };
      return;
    }
    c.detectada = String(p.detectada_en || hoy);
    c.esNuevo = false;
    var desde = alDiasDesde_(String(p.ultimo_aviso || ''), hoy);
    if (desde >= AL_DIAS_REAVISO) {
      avisar.push(c);
      p.ultimo_aviso = hoy;
    }
    p.nombre = c.nombre;
  });

  // Lo que ya no aparece se resolvió. Queda en la hoja como bitácora, con
  // cuántos días tomó: es la métrica de si el proceso está mejorando.
  var resueltas = 0;
  Object.keys(prev).forEach(function (k) {
    var p = prev[k];
    if (vivos[k] || String(p.resuelta_en || '')) return;
    p.resuelta_en = hoy;
    p.dias_para_resolver = alDiasDesde_(String(p.detectada_en || ''), hoy);
    resueltas++;
  });

  var filas = [AL_CAB];
  Object.keys(prev).sort().forEach(function (k) {
    var p = prev[k];
    filas.push(AL_CAB.map(function (c) { return p[c] === undefined ? '' : p[c]; }));
  });
  escribirHoja_(AL_HOJA, filas);

  return { avisar: avisar, nuevas: nuevas, resueltas: resueltas };
}

// =====================================================================
// EL CORREO
// =====================================================================

function alDestinatarios_() {
  var p = prop_('ALERTA_TO');
  if (p && String(p).trim()) return String(p).trim();
  return Session.getEffectiveUser().getEmail();
}

function alAsunto_(r) {
  var n = r.avisar.length;
  var a = r.avisar.filter(function (c) { return c.tipo === 'A'; }).length;
  var b = n - a;
  var partes = [];
  if (a) partes.push(a + ' sin plataforma');
  if (b) partes.push(b + ' sin HubSpot');
  return '[Sedes] ' + n + ' sede' + (n === 1 ? '' : 's') +
         ' desalineada' + (n === 1 ? '' : 's') +
         (partes.length ? ' · ' + partes.join(' · ') : '');
}

function alCuerpo_(r) {
  var A = r.avisar.filter(function (c) { return c.tipo === 'A'; });
  var B = r.avisar.filter(function (c) { return c.tipo === 'B'; });
  var css = 'font:14px/1.55 Inter,Arial,sans-serif;color:#141310';

  var h = '<div style="max-width:760px;margin:0;' + css + '">';
  h += '<p style="font:700 11px/1 Arial,sans-serif;letter-spacing:.12em;' +
       'text-transform:uppercase;color:#8C8577;margin:0 0 6px">' +
       'Tablero 360 · WELLI</p>';
  h += '<h2 style="font-size:20px;margin:0 0 4px;letter-spacing:-.02em">' +
       'Sedes que están en un sistema y no en el otro</h2>';
  h += '<p style="margin:0 0 18px;color:#575249">' + r.hoy +
       ' · se revisaron <b>' + r.totalHubSpot + '</b> fichas de HubSpot ' +
       'contra <b>' + r.totalPlataforma + '</b> cuentas de la plataforma. ' +
       'Solo se reportan las que llevan <b>' + AL_DIAS_GRACIA +
       ' días o más</b> desalineadas: por debajo de eso el desfase es ' +
       'normal y sería falso positivo. Se vigilan las creadas desde <b>' +
       alDesde_() + '</b>.</p>';

  if (A.length) {
    h += alBloque_(
      'En HubSpot, sin cuenta en la plataforma',
      'La ficha existe en el CRM pero no está vinculada, así que la sede no ' +
      'puede originar crédito. Mira la etapa: cuando cae en el pipeline de ' +
      'Customer Success significa que la estamos entrenando sin que pueda ' +
      'operar. Hay que crear la cuenta en el admin o corregir el ' +
      '<code>id_internal</code>.',
      A, true);
  }
  if (B.length) {
    h += alBloque_(
      'En la plataforma, sin ficha en HubSpot',
      'La sede está vinculada y puede operar, pero no existe en el CRM: no ' +
      'aparece en ningún tablero ni en ninguna cosecha. El 79% de las ' +
      'fichas las crea una automatización, así que esto suele ser esa ' +
      'automatización que no corrió.',
      B, false);
  }

  var pend = (r.tipoA.length + r.tipoB.length) - r.avisar.length;
  h += '<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #E5E1D6;' +
       'font-size:12.5px;color:#8C8577">';
  if (r.nuevas) {
    h += '<b>' + r.nuevas + '</b> caso' + (r.nuevas === 1 ? '' : 's') +
         ' nuevo' + (r.nuevas === 1 ? '' : 's') + ' hoy. ';
  }
  if (pend > 0) {
    h += '<b>' + pend + '</b> caso' + (pend === 1 ? '' : 's') +
         ' que ya se habían avisado siguen abiertos y no se repiten hasta ' +
         'dentro de ' + AL_DIAS_REAVISO + ' días. ';
  }
  if (r.resueltas) {
    h += '<b>' + r.resueltas + '</b> se resolvieron desde el último aviso. ';
  }
  h += 'La bitácora completa está en la hoja <b>' + AL_HOJA + '</b> del ' +
       'Google Sheet, con la fecha en que se detectó cada caso y cuántos ' +
       'días tomó resolverlo.</p></div>';
  return h;
}

function alBloque_(titulo, sub, casos, conCreador) {
  var h = '<h3 style="font-size:15px;margin:20px 0 2px">' + titulo +
          ' <span style="color:#8C8577;font-weight:400">(' + casos.length +
          ')</span></h3>';
  h += '<p style="margin:0 0 10px;font-size:13px;color:#575249">' + sub + '</p>';
  h += '<table cellpadding="0" cellspacing="0" style="width:100%;' +
       'border-collapse:collapse;font-size:13px">';
  h += '<tr>' + alTh_('Sede') + alTh_('Creada') + alTh_('Días', true) +
       (conCreador ? alTh_('Etapa') + alTh_('Creada por') +
                     alTh_('Responsable') : '') +
       alTh_('Qué falta') + '</tr>';
  casos.slice(0, AL_MAX_TABLA).forEach(function (c) {
    var grave = c.dias >= AL_DIAS_FIRME;
    var nuevo = c.esNuevo
      ? ' <span style="font:700 9px Arial;letter-spacing:.05em;' +
        'background:#4C7DFF;color:#fff;padding:1px 5px;border-radius:3px;' +
        'vertical-align:1px">NUEVA</span>' : '';
    h += '<tr>' +
      alTd_('<b>' + alEsc_(c.nombre || '—') + '</b>' + nuevo +
            '<br><span style="color:#8C8577;font-size:11.5px">' +
            (c.idHubSpot ? 'HubSpot ' + c.idHubSpot + ' · ' : '') +
            (c.uuid ? c.uuid : 'sin UUID') + '</span>') +
      alTd_(c.creada) +
      alTd_('<b style="color:' + (grave ? '#B4231C' : '#141310') + '">' +
            c.dias + '</b>', true) +
      (conCreador ? alTd_('<span style="font-size:12px">' +
                          alEsc_(c.etapa || '—') + '</span>') +
                    alTd_(alEsc_(c.creadoPor || '—')) +
                    alTd_(alEsc_(c.responsable || '—')) : '') +
      alTd_('<span style="color:#575249">' + alEsc_(c.detalle) + '</span>') +
      '</tr>';
  });
  h += '</table>';
  if (casos.length > AL_MAX_TABLA) {
    h += '<p style="margin:6px 0 0;font-size:12px;color:#8C8577">y ' +
         (casos.length - AL_MAX_TABLA) + ' más · la lista completa está en ' +
         'la hoja ' + AL_HOJA + '</p>';
  }
  return h;
}

function alTh_(t, der) {
  return '<th style="text-align:' + (der ? 'right' : 'left') +
    ';font:700 10px Arial,sans-serif;letter-spacing:.07em;' +
    'text-transform:uppercase;color:#8C8577;padding:7px 10px;' +
    'border-bottom:1px solid #C9C4B6;white-space:nowrap">' + t + '</th>';
}

function alTd_(t, der) {
  return '<td style="text-align:' + (der ? 'right' : 'left') +
    ';padding:8px 10px;border-bottom:1px solid #EFECE3;' +
    'vertical-align:top">' + t + '</td>';
}

function alEsc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// =====================================================================
// UTILIDADES
// =====================================================================

function alDiasDesde_(iso, hoy) {
  var a = parseISO_(String(iso).substring(0, 10));
  var b = parseISO_(String(hoy).substring(0, 10));
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function alEsDescarte_(nombre) {
  return AL_PATRON_DESCARTE.test(String(nombre || ''));
}

function alEsDeshabilitada_(s) {
  return String(s.pipeline || '').toLowerCase().indexOf('deshabilitad') >= 0;
}

/** Cuándo se refrescó PLATAFORMA_SEDES por última vez, según el _LOG. */
function alFrescuraPlataforma_() {
  var ult = '';
  leerHoja_('_LOG').forEach(function (r) {
    var f = String(r.fuente || '');
    if (f.indexOf('Plataforma') < 0) return;
    var ts = String(r.timestamp || '').substring(0, 10);
    if (ts > ult) ult = ts;
  });
  return { fecha: ult || '(sin registro)',
           dias: ult ? alDiasDesde_(ult, hoyISO_()) : 99 };
}
