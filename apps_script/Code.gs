/**
 * Code.gs — Web App y motor de agregación del Tablero 360 Growth WELLI
 * --------------------------------------------------------------------
 * doGet()            sirve el dashboard.
 * getDashboardData() lee el Sheet, corta por el rango de fechas, calcula
 *                    el período anterior y devuelve un JSON compacto.
 *
 * Regla de oro: si una métrica no tiene fuente conectada o no es
 * comparable en el tiempo, se devuelve con pendiente:true o delta:null.
 * El frontend muestra un badge, nunca un número inventado.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('dashboard')
    .evaluate()
    .setTitle('Tablero 360 Growth — WELLI')
    .setFaviconUrl('https://ssl.gstatic.com/docs/script/images/logo/script-64.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

// =====================================================================
// Helpers de KPI
// =====================================================================

/**
 * @param {string} label
 * @param {number|string} valor
 * @param {Object} o  formato: 'num'|'cop'|'pct'|'x1'
 *                    sublabel, fuente, nota
 *                    delta: número (%) | null  -> null = no comparable
 *                    deltaInvertido: true cuando menos es mejor (CPL)
 *                    pendiente: true -> muestra '--' + badge de falta de fuente
 */
function kpi_(label, valor, o) {
  o = o || {};
  return {
    label: label,
    valor: o.pendiente ? null : valor,
    formato: o.formato || 'num',
    sublabel: o.sublabel || '',
    delta: (o.delta === undefined) ? null : o.delta,
    deltaInvertido: !!o.deltaInvertido,
    // Cuando el KPI ya es un %, su variación se expresa en PUNTOS, no en
    // "% de %": un 8,7% que venía de 16,1% no bajó "46%", bajó 7,4 puntos.
    deltaEnPuntos: !!o.deltaEnPuntos,
    deltaEtiqueta: o.deltaEtiqueta || '',
    pendiente: !!o.pendiente,
    fuente: o.fuente || '',
    nota: o.nota || '',
    notaLarga: o.notaLarga || '',
    color: o.color || 'azul'
  };
}

/**
 * KPI construido sobre uno o varios eventos fechados.
 * Si alguno de los campos está rezagado en HubSpot, el delta se suprime y
 * el badge explica por qué: un -91% causado por una sincronización rota no
 * puede llegar a comité como si fuera una caída del negocio.
 */
function kpiEvento_(label, eventos, ev, o) {
  o = o || {};
  // o.soloMkt: cuenta el evento solo en sedes cuyo origen es uno de los
  // cuatro canales de marketing. Es el default de F2.
  var bA = o.soloMkt ? (ev.actMkt || {}) : ev.act;
  var bP = o.soloMkt ? (ev.prevMkt || {}) : ev.prev;
  var a = 0, p = 0, rezagos = [];
  eventos.forEach(function (e) {
    a += bA[e] || 0;
    p += bP[e] || 0;
    var s = ev.salud[e];
    if (s && s.rezagado) rezagos.push(s);
  });
  if (rezagos.length) {
    o.delta = null;
    o.nota = 'Dato incompleto — ' + rezagos[0].motivo;
    o.notaLarga = 'La cifra del período es solo lo que quedó registrado en HubSpot, ' +
      'así que no se compara contra el período anterior. ' + rezagos[0].motivo;
  } else {
    o.delta = delta_(a, p);
  }
  return kpi_(label, a, o);
}

/**
 * Primera fecha que tiene una hoja. Sirve para saber hasta donde llega la
 * cobertura de una fuente antes de comparar periodos.
 */
function primeraFecha_(filas, campo) {
  var min = '';
  filas.forEach(function (r) {
    var iso = fechaCelda_(r[campo]);
    if (iso && (!min || iso < min)) min = iso;
  });
  return min;
}

/**
 * Delta que se NIEGA a comparar cuando el periodo anterior cae fuera de la
 * cobertura de la fuente.
 *
 * Por que existe: EMBUDO_MKT arranca en 2026-01-01. Al elegir "Todo 2026"
 * el periodo anterior es may-dic 2025, donde la tabla no tiene ni una fila,
 * y delta_() devolvia +2.433,8% en solicitudes y +3.595,8% en plata. Eso no
 * es crecimiento: es dividir por un periodo que no existe en el dato. Un
 * numero asi en comite quema el tablero completo.
 */
function deltaCubierto_(actual, anterior, primera, prevInicio) {
  if (!primera || !prevInicio) return null;
  if (primera > prevInicio) return null;      // el periodo anterior no existe
  return delta_(actual, anterior);
}

/** Delta % entre actual y anterior. null si no hay base comparable. */
function delta_(actual, anterior) {
  if (anterior === null || anterior === undefined) return null;
  if (!anterior) return null;                  // sin base, un % no dice nada
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

/**
 * ¿El mes que resulta de sumar k meses a "cosecha" todavia no ha ocurrido?
 * Sirve para dejar la celda vacia en vez de un cero, que se leeria como
 * "no convirtio" cuando en realidad ese mes no ha llegado.
 */
function mesFuturo_(cosecha, k) {
  var c = String(cosecha || '').substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(c)) return true;
  var t = Number(c.substring(0, 4)) * 12 + (Number(c.substring(5, 7)) - 1) + k;
  var hoy = hoyISO_();
  var th = Number(hoy.substring(0, 4)) * 12 + (Number(hoy.substring(5, 7)) - 1);
  return t > th;
}

/** Miles con punto, para armar sublabels en el servidor. */
function fNumSrv_(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Porcentaje con coma decimal, para las frases que se arman en el
 * servidor. El cliente formatea con fPct; sin esto las mismas cifras
 * salian con punto dentro de los textos y con coma en las tarjetas.
 */
function fPctSrv_(n) {
  var r = Math.round(n * 10) / 10;
  return String(r).replace('.', ',') + '%';
}
/** Monto compacto para las frases del servidor: $16,0 M, $2,6 mil M. */
function fCopSrv_(n) {
  var x = Math.abs(Number(n) || 0);
  function un(q) { return (Math.round(q * 10) / 10).toString().replace('.', ','); }
  if (x >= 1e12) return '$' + un(x / 1e12) + ' B';
  if (x >= 1e9) return '$' + un(x / 1e9) + ' mil M';
  if (x >= 1e6) return '$' + un(x / 1e6) + ' M';
  return '$' + fNumSrv_(x);
}


function num_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

/** Normaliza a 'yyyy-MM-dd' cualquier celda (Date o texto). */
function fechaCelda_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v).substring(0, 10);
}

// =====================================================================
// Agrupación temporal
// =====================================================================

function granularidad_(dias) {
  if (dias > 400) return 'mes';
  if (dias > 60) return 'semana';
  return 'dia';
}

function claveGrupo_(iso, gran) {
  if (gran === 'mes') return iso.substring(0, 7);
  if (gran === 'semana') return fmtFecha_(lunesDe_(parseISO_(iso)));
  return iso;
}

// =====================================================================
// Punto de entrada del frontend
// =====================================================================

/**
 * @param {string} inicio 'yyyy-MM-dd'
 * @param {string} fin    'yyyy-MM-dd'
 */
/**
 * origenes: lista de orígenes de HubSpot a incluir en F2, F4 y F5.
 * Vacía o nula = todos (el tablero es 360 por defecto). F1 no se filtra:
 * por definición mide lo que trae marketing.
 */
function getDashboardData(inicio, fin, origenes, roles, compararF2, filtroLT) {
  var t0 = new Date().getTime();

  // --- rango y período anterior ----------------------------------------
  // El anterior se calculaba SIEMPRE restando dias, y eso rompe la
  // comparacion cuando el rango es un mes: el anterior de julio (31 dias
  // atras) arrancaba el 31 de MAYO, asi que cualquier cosa que agrupara por
  // mes comparaba contra mayo + junio. La plata de social media de julio
  // salia -63,6% cuando lo real era +149,6% contra junio.
  //
  // Si el rango es un mes completo, el anterior es el MES anterior completo.
  // Si no, se sigue restando dias, que para una semana es lo correcto.
  var dFin = parseISO_(fin) || new Date();
  var dIni = parseISO_(inicio) || sumarDias_(dFin, -83);
  if (dIni > dFin) { var tmp = dIni; dIni = dFin; dFin = tmp; }
  var dias = diasEntre_(dIni, dFin);

  // Getters LOCALES, no UTC: parseISO_ construye la fecha local y mezclar los
  // dos husos hacia que la condicion no se cumpliera nunca.
  var pIni, pFin;
  var finMes = new Date(dFin.getFullYear(), dFin.getMonth() + 1, 0);
  var esMesCompleto = (dIni.getDate() === 1) &&
    (fmtFecha_(dFin) >= fmtFecha_(finMes) || fmtFecha_(dFin) === hoyISO_());
  if (esMesCompleto) {
    var nMes = (dFin.getFullYear() * 12 + dFin.getMonth()) -
               (dIni.getFullYear() * 12 + dIni.getMonth()) + 1;
    pIni = new Date(dIni.getFullYear(), dIni.getMonth() - nMes, 1);
    pFin = new Date(dIni.getFullYear(), dIni.getMonth(), 0);
    // Y si el mes va en curso, el anterior se recorta al MISMO dia. Sin
    // esto el mes corriente (7 dias) se compara contra el mes anterior
    // completo (31 dias) y todos los KPIs del tablero marcan -92%: no es
    // una caida, es que el periodo anterior es cuatro veces mas largo.
    // El recorte va al dia del mes, no a la cantidad de dias, para que la
    // comparacion sea "del 1 al 7 contra del 1 al 7".
    if (fmtFecha_(dFin) < fmtFecha_(finMes)) {
      var ultPrev = new Date(pFin.getFullYear(), pFin.getMonth() + 1, 0).getDate();
      pFin = new Date(pFin.getFullYear(), pFin.getMonth(),
                      Math.min(dFin.getDate(), ultPrev));
    }
  } else {
    pFin = sumarDias_(dIni, -1);
    pIni = sumarDias_(pFin, -(dias - 1));
  }

  var R = {
    inicio: fmtFecha_(dIni), fin: fmtFecha_(dFin),
    prevInicio: fmtFecha_(pIni), prevFin: fmtFecha_(pFin)
  };
  var gran = granularidad_(dias);

  var cfg = leerConfig_();
  var estado = estadoFuentes_();
  var U = universoSedes_(origenes, roles);

  var out = {
    meta: {
      inicio: R.inicio, fin: R.fin, prevInicio: R.prevInicio, prevFin: R.prevFin,
      dias: dias, agrupacion: gran,
      origenes: U.origenes, origenTodos: U.todos, origenEtiqueta: U.etiqueta,
      origenSedes: U.total, origenSedesBase: U.totalBase,
      // Cuantas sedes salieron por estar deshabilitadas. Va a la cinta: un
      // recorte del universo que no se declara se lee como dato bajo.
      deshabilitadas: (U.universo || {}).deshabilitadas || 0,
      // Reatribuciones de origen aplicadas (ver REATRIBUCION_ORIGEN): van a
      // la cinta para que ningún número reatribuido se lea como si viniera
      // crudo de HubSpot.
      reatribucion: U.reatribucion,
      roles: U.roles, rolesTodos: U.rolesTodos,
      rolEtiqueta: U.rolEtiqueta, catalogoRoles: U.catalogoRoles,
      catalogoOrigenes: U.catalogo, presetsOrigen: PRESETS_ORIGEN,
      etiquetasPreset: ETIQUETA_PRESET,
      ultimaActualizacion: cfg.ultima_actualizacion || '(sin refresh todavía)',
      generado: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
      // Los meses que tienen dato, para poblar el selector. Se sacan del
      // rango real de las fuentes fechadas en vez de una lista fija, asi el
      // selector no ofrece meses vacios ni se queda corto cuando entre dato
      // nuevo. Va en meta porque es el frontend quien lo consume.
      mesesDatos: mesesConDatos_()
    },
    estado: estado,
    textos: cfg
  };

  var ev = eventosEnRango_(R, U);
  out.f1 = armarF1_(R, gran, cfg, estado, U);
  out.f2 = armarF2_(R, ev, cfg, U, compararF2);
  out.f4 = armarF4_(R, gran, cfg, estado, U);
  out.f5 = armarF5_(R, ev, U);
  out.f6 = armarF6_();
  out.f7 = armarF7_(R, cfg, U, filtroLT);
  out.f8 = armarF8_(R, U);

  out.meta.ms = new Date().getTime() - t0;
  return JSON.parse(JSON.stringify(out));   // serializable para google.script.run
}

// =====================================================================
// SEDES_EVENTOS: la única tabla de sedes que el filtro puede cortar
// =====================================================================

function eventosEnRango_(R, U) {
  var filas = leerHoja_('SEDES_EVENTOS');
  // El filtro global de origen corta los eventos igual que las sedes. Sin
  // filtro, tabla entera: ya no se resta nada por deshabilitada (acordado
  // con BI el 9-sep-2026).
  if (U && !U.sinFiltro) {
    filas = filas.filter(function (f) {
      return !!U.nombres[normNombre_(f.sede)];
    });
  }
  var act = {}, prev = {}, actDet = {}, serie = {};
  // Bolsas paralelas con SOLO las sedes de origen marketing. El tablero es
  // de marketing: un KPI de profundización tiene que poder responder
  // "¿esto pasó en las sedes que nosotros trajimos?", no solo en la base.
  var actMkt = {}, prevMkt = {};
  var porMes = {};                       // histórico completo, para medir rezago
  filas.forEach(function (f) {
    var iso = fechaCelda_(f.fecha);
    if (!iso) return;
    var e = String(f.evento || '');
    var esMkt = ORIGENES_MKT.indexOf(String(f.origen_bucket || '')) >= 0;
    // Se cuenta TODO el histórico por mes, no solo el rango: es la única
    // forma de saber si un campo de HubSpot dejó de sincronizarse.
    if (!porMes[e]) porMes[e] = {};
    var mes = iso.substring(0, 7);
    porMes[e][mes] = (porMes[e][mes] || 0) + 1;

    var dentro = (iso >= R.inicio && iso <= R.fin);
    var antes = (iso >= R.prevInicio && iso <= R.prevFin);
    if (!dentro && !antes) return;
    var bolsa = dentro ? act : prev;
    bolsa[e] = (bolsa[e] || 0) + 1;
    if (esMkt) {
      var bm = dentro ? actMkt : prevMkt;
      bm[e] = (bm[e] || 0) + 1;
    }
    if (dentro) {
      if (!actDet[e]) actDet[e] = [];
      if (actDet[e].length < 500) {
        actDet[e].push({
          fecha: iso, sede: String(f.sede || ''),
          pipeline: String(f.pipeline || ''),
          origen: String(f.origen_bucket || ''),
          clas: String(f.clasificacion_aliado || ''),
          audiencia: String(f.audiencia_long_tail || ''),
          farmer: String(f.asesor_comercial || ''),
          monto: num_(f.monto)
        });
      }
      if (!serie[e]) serie[e] = {};
      serie[e][iso] = (serie[e][iso] || 0) + 1;
    }
  });
  return { act: act, prev: prev, actMkt: actMkt, prevMkt: prevMkt,
           det: actDet, serie: serie, salud: saludEventos_(porMes) };
}

/** Los meses que el tablero puede medir, del mas viejo a hoy.
    NO es el rango de profile_institucion: ahi hay creditos desde 2023 y el
    selector salia con 41 meses casi todos vacios. El piso es la primera
    COSECHA de sedes, porque antes de eso el tablero no tiene universo que
    cortar: sin sedes creadas no hay nada que medir por origen ni por ventana.
    Se excluye la carga inicial, que es la migracion historica a HubSpot. */
function mesesConDatos_() {
  var min = '9999-99';
  sedesReatribuidas_().forEach(function (r) {
    var c = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(c) || esCargaInicial_(c)) return;
    if (c < min) min = c;
  });
  var hoy = hoyISO_().substring(0, 7);
  if (min === '9999-99' || min > hoy) return [hoy];
  var out = [];
  var t = Number(min.substring(0, 4)) * 12 + (Number(min.substring(5, 7)) - 1);
  var th = Number(hoy.substring(0, 4)) * 12 + (Number(hoy.substring(5, 7)) - 1);
  for (; t <= th; t++) {
    out.push(('0000' + Math.floor(t / 12)).slice(-4) + '-' +
             ('0' + (t % 12 + 1)).slice(-2));
  }
  return out;
}


/* =====================================================================
   LA TABLA DE HECHOS
   CREDITO_DIA trae los creditos por sede y por dia. Todo lo que antes venia
   pre-agregado por origen o por owner sale de aca, y el filtro se aplica
   sobre los ATRIBUTOS DE LA SEDE. Asi cualquier filtro nuevo — un rol mas,
   una ventana, una clase — funciona sin volver a agregar nada.

   La sede viene como indice compacto y la fecha como dias desde 2025-01-01:
   sobre 116 mil filas eso son 2 MB menos de artefacto. CREDITO_SEDES trae el
   indice, y sale de la misma pasada que los hechos, asi que no se desincroniza.
   ===================================================================== */
var DIA_BASE = Date.UTC(2025, 0, 1);
var _HECHOS = null;

/** Los hechos con la sede ya resuelta a su llave de HubSpot y la fecha a ISO.
    Se cachea por ejecucion: son 116 mil filas y se recorren varias veces. */
function hechos_() {
  if (_HECHOS) return _HECHOS;
  var idx = [];
  leerHoja_('CREDITO_SEDES').forEach(function (r) {
    idx[num_(r.i)] = String(r.sede || '').trim();
  });
  _HECHOS = leerHoja_('CREDITO_DIA').map(function (r) {
    var d = num_(r.d);
    return {
      sede: idx[num_(r.s)] || '',
      fecha: new Date(DIA_BASE + d * 86400000).toISOString().substring(0, 10),
      sol: num_(r.sol), apr: num_(r.apr), conv: num_(r.conv),
      mApr: num_(r.m_apr), mConv: num_(r.m_conv)
    };
  });
  return _HECHOS;
}

/** Los atributos de cada sede que sirven para cortar los hechos: cosecha,
    origen y ventana de decision. Se arma una vez desde la hoja SEDES. */
var _ATRIB = null;
function atribSede_(U) {
  if (_ATRIB) return _ATRIB;
  _ATRIB = {};
  // sedesReatribuidas_ y no leerHoja_: este mapa alimenta la tabla "de que
  // origen salio esa plata" de F1, y con la lectura cruda seguia mostrando
  // el origen de HubSpot sin la reatribucion aplicada.
  sedesReatribuidas_().forEach(function (s) {
    var hs = String(s.id || '').trim();
    if (!hs) return;
    var interno = String(s.id_internal || '').trim();
    _ATRIB[hs] = {
      cosecha: String(s.cosecha || '').substring(0, 7),
      origen: normOrigen_(s.origen),
      ventana: ventanaDeEsp_((U.especialidadDe || {})[interno] || '').id
    };
  });
  return _ATRIB;
}

/** Recorre los hechos aplicando el filtro global y el rango, y agrega con la
    funcion que se le pase. El filtro es un lookup por sede — se evalua una
    vez por sede en universoSedes_, no una vez por fila. */
function recorrerHechos_(U, desde, hasta, cb) {
  var permitido = U.idsHS;
  var libre = U.sinFiltro;
  // Ya no se descuentan las deshabilitadas en el camino "libre" (acordado
  // con BI el 9-sep-2026): una sede dada de baja sigue contando igual que
  // en su tablero, con filtro o sin filtro.
  hechos_().forEach(function (r) {
    if (r.fecha < desde || r.fecha > hasta) return;
    if (!libre && !permitido[r.sede]) return;
    cb(r);
  });
}

/**
 * Detecta campos de fecha de HubSpot que dejaron de sincronizarse.
 *
 * Por qué existe esto: varias propiedades de fecha del objeto Sedes se
 * llenaron durante un tiempo y se apagaron. fecha_ultima_aplicacion no
 * escribe nada desde diciembre de 2025 y fecha_ultimo_desembolso pasó de
 * ~300 sedes al mes a menos de 30. Si el tablero los grafica sin más,
 * el comité lee una caída del 90% que no ocurrió.
 *
 * Regla: se compara el promedio de los últimos 3 meses contra la mediana
 * de los 9 anteriores. Si cae por debajo del 35%, o si no hay ningún dato
 * en los últimos 60 días, el evento se marca rezagado y quien lo use
 * suprime el delta y muestra un badge con la última fecha real.
 */
function saludEventos_(porMes) {
  var hoyMes = hoyISO_().substring(0, 7);
  var salud = {};
  Object.keys(porMes).forEach(function (e) {
    var meses = Object.keys(porMes[e]).sort();
    if (!meses.length) return;
    var ultima = meses[meses.length - 1];

    // Solo meses ya cerrados: el mes en curso siempre va incompleto.
    var cerrados = meses.filter(function (m) { return m < hoyMes; });
    // Ventana corta a propósito: cuando una sincronización se rompe, el
    // quiebre es abrupto. Con 3 meses el último mes bueno diluye la caída
    // y el corte pasa desapercibido.
    var recientes = cerrados.slice(-2).map(function (m) { return porMes[e][m]; });
    var previos = cerrados.slice(-11, -2).map(function (m) { return porMes[e][m]; });

    var rezagado = false, motivo = '';
    if (ultima < hoyMes) {
      var mesesQuietos = mesesEntre_(ultima, hoyMes);
      if (mesesQuietos >= 2) {
        rezagado = true;
        motivo = 'HubSpot no escribe este campo desde ' + ultima + '.';
      }
    }
    if (!rezagado && recientes.length >= 2 && previos.length >= 4) {
      var prom = recientes.reduce(function (a, b) { return a + b; }, 0) / recientes.length;
      var med = mediana_(previos);
      if (med > 0 && prom < med * 0.40) {
        rezagado = true;
        motivo = Math.round(prom) + ' registros/mes contra ' + Math.round(med) +
          ' de mediana histórica: sincronización con rezago.';
      }
    }
    salud[e] = { ultima: ultima, rezagado: rezagado, motivo: motivo };
  });
  return salud;
}

function mesesEntre_(a, b) {
  var pa = a.split('-'), pb = b.split('-');
  return (Number(pb[0]) - Number(pa[0])) * 12 + (Number(pb[1]) - Number(pa[1]));
}

function mediana_(arr) {
  if (!arr.length) return 0;
  var s = arr.slice().sort(function (x, y) { return x - y; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function serieAgrupada_(mapaISO, gran, R) {
  var acc = {};
  Object.keys(mapaISO || {}).forEach(function (iso) {
    var k = claveGrupo_(iso, gran);
    acc[k] = (acc[k] || 0) + mapaISO[iso];
  });
  return Object.keys(acc).sort().map(function (k) {
    return { x: k, y: acc[k] };
  });
}

// =====================================================================
// FRENTE 1 — Adquisición & Inbound/Outbound
// =====================================================================

// =====================================================================
// METAS DE MARKETING POR CANAL — puestas por Christian (portadas 9-sep-2026
// desde su artefacto de referencia, sin cambios). Dos tablas van al frente 1:
//
//   1. Leads del mes por canal, contra su meta. "Lead" = deal que entró al
//      pipeline comercial (fuente: DEALS_ORIGEN, la misma del punto 1 de
//      F1 — "es el equivalente de la tabla de cosechas pero un paso antes,
//      cuando todavía es un negocio y no una sede"). Sigue el filtro
//      global de fechas: si el rango no es un mes calendario exacto, la
//      meta (que es MENSUAL) se prorratea por días.
//
//   2. Vinculación de clínicas: de esos leads, cuántos llegan a cierre
//      ganado en una ventana FIJA de 3 meses corridos desde HOY. Fija a
//      propósito (acordado con Emmanuel el 9-sep-2026): el ciclo de
//      vinculación necesita esos 3 meses para completarse, así que
//      acortarlo con el filtro de fechas rompería la métrica.
//
// Las dos respetan el filtro de ORIGEN y el de HUNTER (el owner del deal)
// igual que el punto 1 — Farmer/CS no aplican, son roles de la sede.
// =====================================================================
var METAS_CANAL = {
  'Página web':   { leads: 50,  desembolso: 15000000 },
  'Social media': { leads: 200, desembolso: 10000000 },
  'Referidos':    { leads: 40,  desembolso: 8000000 },
  'Eventos':      { leads: 0,   desembolso: 6000000 }
};
// Meta de VINCULACIÓN por canal (leads que llegaron -> cerrado ganado en
// el pipeline de Hunter) a 3 meses. Puesta por Christian el 2026-09-08.
var METAS_VINCULACION = {
  'Página web': 50, 'Social media': 30, 'Referidos': 40, 'Eventos': 25
};
var CANALES_META = ['Página web', 'Social media', 'Referidos', 'Eventos'];
// DEALS_ORIGEN trae el origen crudo de HubSpot (normOrigen_), no el bucket
// de marketing — este es el mismo mapeo 1 a 1 que PRESETS_ORIGEN.marketing.
var BUCKET_DE_ORIGEN_DEAL = {
  'PAGINA WEB': 'Página web', 'SOCIAL MEDIA': 'Social media',
  'REFERIDO': 'Referidos', 'EVENTO': 'Eventos'
};

/** Resta k meses a un "YYYY-MM". */
function mesMenos_(mesISO, k) {
  var y = Number(mesISO.substring(0, 4)), m = Number(mesISO.substring(5, 7)) - 1;
  var t = y * 12 + m - k;
  return ('0000' + Math.floor(t / 12)).slice(-4) + '-' + ('0' + (t % 12 + 1)).slice(-2);
}

function armarMetasCanalF1_(R, U, dcO, ownerHunter, ownerHunterSet) {
  var selOrig = {};
  (U.origenes || []).forEach(function (o) { selOrig[o] = true; });

  function pasaFiltro_(r) {
    var ownerId = String(r.owner || '').trim();
    if (ownerHunterSet) { if (!ownerHunterSet[ownerId]) return false; }
    else if (ownerHunter && ownerId !== ownerHunter) return false;
    var o = normOrigen_(r.origen);
    if (!U.todos && !selOrig[o]) return false;
    return true;
  }

  function sumarPorCanal_(desdeMes, hastaMes) {
    var out = {};
    CANALES_META.forEach(function (c) { out[c] = { deals: 0, dealsTotales: 0, ganados: 0 }; });
    dcO.forEach(function (r) {
      var cos = String(r.cosecha || '').substring(0, 7);
      if (!/^\d{4}-\d{2}$/.test(cos)) return;
      if (cos < desdeMes || cos > hastaMes) return;
      if (!pasaFiltro_(r)) return;
      var bucket = BUCKET_DE_ORIGEN_DEAL[normOrigen_(r.origen)];
      if (!bucket) return;
      var b = out[bucket];
      b.deals += num_(r.deals);
      b.dealsTotales += num_(r.deals_totales);
      for (var i = 0; i <= 7; i++) b.ganados += num_(r['m' + i]);
    });
    return out;
  }

  // ---- 1. Leads del mes por canal, contra la meta TOTAL del mes -------
  // La meta es la del MES COMPLETO (no se prorratea por días): la pregunta
  // que responde esta tabla es "de la meta de todo septiembre, cuánto
  // llevo al 9 de septiembre", no "cuánto me tocaba hasta hoy". Se toma el
  // mes en el que cae el FIN del rango elegido — si el rango cruza varios
  // meses, "el mes" es el del último día, que es como se lee un corte
  // "al día de hoy".
  //
  // 24-sep-2026, pedido explicito de Emmanuel: "necesito que coincida 100%
  // con HubSpot" — esta tabla ahora usa dealsTotales (sin el filtro de
  // causales SARLAFT/duplicado/etc), asi que el numero calza exacto con
  // el filtro Pipeline+Origen+Fecha que el negocio usa en HubSpot. La
  // tabla de VINCULACION de abajo (seccion 2) sigue usando `deals` (el
  // limpio): mezclar duplicados/SARLAFT-fallido en el denominador de un
  // % de cierre habria deflactado esa tasa sin que signifique nada — esa
  // tabla responde una pregunta distinta (calidad del funnel, no cuantos
  // leads entraron) y no se toco.
  var mesMeta = R.fin.substring(0, 7);
  var actualPorCanal = sumarPorCanal_(R.inicio.substring(0, 7), R.fin.substring(0, 7));
  var prevPorCanal = sumarPorCanal_(R.prevInicio.substring(0, 7), R.prevFin.substring(0, 7));
  var leads = CANALES_META.map(function (canal) {
    var actual = actualPorCanal[canal].dealsTotales;
    var meta = METAS_CANAL[canal].leads;
    return {
      canal: canal, actual: actual, meta: meta,
      pct: meta ? Math.round((actual / meta) * 1000) / 10 : null,
      delta: delta_(actual, prevPorCanal[canal].dealsTotales)
    };
  });

  // ---- 2. Vinculación a 3 meses (ventana FIJA desde hoy) --------------
  var finV = hoyISO_().substring(0, 7);
  var iniV = mesMenos_(finV, 2);   // 3 meses incluido el actual
  var porCanalV = sumarPorCanal_(iniV, finV);
  // Los mismos 3 meses pero terminando un mes antes, para poder declarar
  // un delta del % de cierre — sin esto la tabla 2 se queda sin "versus
  // período anterior" pese a que el resto del frente sí lo tiene.
  var finVPrev = mesMenos_(finV, 1), iniVPrev = mesMenos_(finV, 3);
  var porCanalVPrev = sumarPorCanal_(iniVPrev, finVPrev);
  var vinculacion = CANALES_META.map(function (canal) {
    var b = porCanalV[canal], bp = porCanalVPrev[canal];
    var pct = b.deals ? Math.round((b.ganados / b.deals) * 1000) / 10 : 0;
    var pctPrev = bp.deals ? Math.round((bp.ganados / bp.deals) * 1000) / 10 : 0;
    var metaPct = METAS_VINCULACION[canal] || 0;
    return {
      canal: canal, llegaron: b.deals, cerrados: b.ganados, pct: pct,
      meta: metaPct,
      pctCumplido: metaPct ? Math.round((pct / metaPct) * 1000) / 10 : null,
      delta: bp.deals ? delta_(pct, pctPrev) : null
    };
  });

  return {
    leads: leads,
    mesMeta: mesMeta,
    ventanaVinculacion: iniV + ' a ' + finV,
    ventanaVinculacionPrev: iniVPrev + ' a ' + finVPrev,
    vinculacion: vinculacion
  };
}

function armarF1_(R, gran, cfg, estado, U) {
  var f = { kpis: [], serie: [], serieGasto: [], cosechas: [] };
  // La pauta de Meta no tiene dimension de sede, asi que el filtro de origen
  // no la puede tocar: un anuncio no "pertenece" a un origen de sede. Todo
  // lo demas de este frente (cosechas, cohortes, conversion por canal y
  // embudo) si se filtra.
  f.metaFiltrable = false;
  f.etiquetaSel = U.etiqueta;
  f.origenTodos = U.todos;

  // ---- Meta Ads (pauta) ---------------------------------------------
  var meta = leerHoja_('META_ADS');
  var hayMeta = meta.length > 0;
  var A = { leads: 0, gasto: 0, impr: 0, clics: 0 };
  var P = { leads: 0, gasto: 0, impr: 0, clics: 0 };
  var sLeads = {}, sGasto = {}, sClics = {}, sImpr = {};

  meta.forEach(function (r) {
    var iso = fechaCelda_(r.fecha);
    if (!iso) return;
    var dentro = (iso >= R.inicio && iso <= R.fin);
    var antes = (iso >= R.prevInicio && iso <= R.prevFin);
    if (!dentro && !antes) return;
    var b = dentro ? A : P;
    b.leads += num_(r.leads);
    b.gasto += num_(r.gasto);
    b.impr += num_(r.impresiones);
    b.clics += num_(r.clics);
    if (dentro) {
      sLeads[iso] = (sLeads[iso] || 0) + num_(r.leads);
      sGasto[iso] = (sGasto[iso] || 0) + num_(r.gasto);
      sClics[iso] = (sClics[iso] || 0) + num_(r.clics);
      sImpr[iso] = (sImpr[iso] || 0) + num_(r.impresiones);
    }
  });

  var estMeta = estado['Meta Ads'] || {};
  var pendMeta = !hayMeta;
  var notaMeta = pendMeta
    ? ('Falta conexión con Meta Ads' + (estMeta.detalle ? ' — ' + estMeta.detalle : ''))
    : '';

  var cplA = A.leads ? A.gasto / A.leads : 0;
  var cplP = P.leads ? P.gasto / P.leads : 0;
  var ctrA = A.impr ? (A.clics / A.impr) * 100 : 0;
  var ctrP = P.impr ? (P.clics / P.impr) * 100 : 0;

  f.kpis = [
    kpi_('Leads (Meta)', A.leads, { formato: 'num', sublabel: 'formularios de pauta',
      delta: delta_(A.leads, P.leads), pendiente: pendMeta, fuente: 'Meta Ads',
      nota: notaMeta, color: 'amarillo' }),
    kpi_('CPL', Math.round(cplA), { formato: 'cop', sublabel: 'costo por lead',
      delta: delta_(cplA, cplP), deltaInvertido: true, pendiente: pendMeta,
      fuente: 'Meta Ads', nota: notaMeta, color: 'verde' }),
    kpi_('Gasto', Math.round(A.gasto), { formato: 'cop', sublabel: 'inversión en pauta',
      delta: delta_(A.gasto, P.gasto), pendiente: pendMeta, fuente: 'Meta Ads',
      nota: notaMeta, color: 'azul' }),
    kpi_('Impresiones', A.impr, { formato: 'num', sublabel: 'alcance de pauta',
      delta: delta_(A.impr, P.impr), pendiente: pendMeta, fuente: 'Meta Ads',
      nota: notaMeta, color: 'morado' }),
    kpi_('CTR', Math.round(ctrA * 100) / 100, { formato: 'pct', sublabel: 'clics / impresiones',
      delta: delta_(ctrA, ctrP), pendiente: pendMeta, fuente: 'Meta Ads',
      nota: notaMeta, color: 'azul' })
  ];

  // combo leads (barras) + CPL (línea)
  // La serie de pauta viaja SIEMPRE en dia, sin agrupar, y el cliente decide
  // si la muestra por dia o por mes con el boton de granularidad.
  //
  // Por que no se agrupa aca: con un rango de 62 dias serieAgrupada_ agrupa
  // por SEMANA, y la semana del 1 de julio arranca el 29 de junio. Al
  // reagrupar por mes en el cliente aparecia un "2026-06" fantasma con 11
  // leads que no estaban en el rango. Y el boton "Dia" mostraba semanas.
  var gLeads = serieAgrupada_(sLeads, 'dia', R);
  var gGasto = serieAgrupada_(sGasto, 'dia', R);
  // El gasto viaja en la serie porque el CPL de un mes es gasto/leads del
  // mes: promediar los CPL diarios da un numero que no existe.
  f.serie = gLeads.map(function (p, i) {
    var g = gGasto[i] ? gGasto[i].y : 0;
    return { x: p.x, leads: p.y, gasto: g, cpl: p.y ? Math.round(g / p.y) : 0 };
  });
  f.serieGasto = gGasto;
  f.pendienteMeta = pendMeta;
  f.notaMeta = notaMeta;

  // ---- Cosechas (HubSpot) -------------------------------------------
  // Se muestran las cohortes cuyo mes cae dentro del rango.
  var mesIni = R.inicio.substring(0, 7), mesFin = R.fin.substring(0, 7);
  // Se arman desde SEDES en vez de la hoja COSECHAS, que venia pre-agregada
  // solo para los cuatro origenes de marketing y no respetaba el filtro.
  // La hoja cruda, a proposito: "sedes nuevas del mes" cuenta todo lo que se
  // creo en HubSpot, que es la fuente de verdad de la EXISTENCIA en el
  // negocio. La regla del universo (existir en institucion_medica) se aplica
  // donde hace falta cruzar por id; aca subreportaria el titular del frente
  // por un campo de CRM sin llenar. Las que no se pueden cruzar se declaran
  // en el panel de activacion en vez de desaparecer del conteo.
  var sedesF1 = U.baseCruda || sedesReatribuidas_();
  var selF1 = {};
  (U.origenes || []).forEach(function (o) { selF1[o] = true; });
  function selF1_(x) {
    return U.todos || !!selF1[normOrigen_(x.origen)];
  }
  var agCos = {};
  // El corte por origen va ACA ARRIBA. Antes estaba despues de acumular
  // todas/ids/mktReal, asi que la tarjeta de sedes nuevas, las dos donas y la
  // activacion seguian mostrando todos los origenes con el filtro puesto en
  // marketing — solo b.total cortaba. Ahora todo el frente respeta el filtro
  // global, y el desglose de marketing es "marketing DENTRO del filtro".
  var fueraDelFiltro = 0;
  sedesF1.forEach(function (x) {
    var m = String(x.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    if (!selF1_(x)) { fueraDelFiltro++; return; }
    if (!agCos[m]) {
      agCos[m] = { cosecha: m, total: 0, eventos: 0, referidos: 0, web: 0,
                   social: 0, a: 0, aa: 0, aaa: 0, todas: 0, mktReal: 0,
                   // Clasificacion por separado para los dos universos del
                   // mes: todas las que entraron y las que trajo marketing.
                   clsTodas: { a: 0, aa: 0, aaa: 0, sin: 0 },
                   clsMkt: { a: 0, aa: 0, aaa: 0, sin: 0 },
                   // Canal de las de marketing del mes, para el desglose que
                   // va al lado de la dona.
                   canMkt: { Eventos: 0, Referidos: 0, 'Pagina web': 0,
                             'Social media': 0 },
                   // Los ids se guardan porque la activacion de la cosecha se
                   // cruza sede por sede contra ACT_SEDE_MES.
                   ids: [], idsMkt: [] };
    }
    var b = agCos[m];
    var cl = String(x.clasificacion_aliado || '').toUpperCase();
    var esMktX = ORIGENES_MKT.indexOf(String(x.origen_bucket || '')) >= 0;
    function clasificar(o) {
      if (cl === 'A') o.a++;
      else if (cl === 'AA') o.aa++;
      else if (cl === 'AAA') o.aaa++;
      else o.sin++;
    }

    b.todas++;                                  // toda la base, como contexto
    clasificar(b.clsTodas);
    var idInt = String(x.id_internal || '').trim();
    if (idInt) b.ids.push(idInt);
    if (esMktX) {
      b.mktReal++;
      clasificar(b.clsMkt);
      if (idInt) b.idsMkt.push(idInt);
      var obX = String(x.origen_bucket || '');
      if (b.canMkt[obX] !== undefined) b.canMkt[obX]++;
    }

    b.total++;
    var ob = String(x.origen_bucket || '');
    if (ob === 'Eventos') b.eventos++;
    else if (ob === 'Referidos') b.referidos++;
    else if (ob === 'Pagina web') b.web++;
    else if (ob === 'Social media') b.social++;
    if (cl === 'A') b.a++;
    else if (cl === 'AA') b.aa++;
    else if (cl === 'AAA') b.aaa++;
  });
  Object.keys(agCos).sort().forEach(function (m) {
    if (m < mesIni || m > mesFin) return;
    if (esCargaInicial_(m)) return;        // no es una cosecha, es la migración
    // ids/idsMkt son los UUID de las sedes de la cosecha: los usa
    // activacionDe_() ACA en el servidor y NADIE en el frontend. Iban en el
    // payload igual — ~300 UUID por cosecha, miles de caracteres por fila
    // que el navegador descarga y nunca abre. Se quedan en agCos (que sigue
    // vivo mas abajo) y no viajan.
    var b = agCos[m], fila = {};
    Object.keys(b).forEach(function (k) {
      if (k === 'ids' || k === 'idsMkt') return;
      fila[k] = b[k];
    });
    f.cosechas.push(fila);
  });
  f.cosechasCaveat = '';

  // ---- Cuánta de la base NUEVA la trae marketing ---------------------
  // Es el argumento más fuerte del tablero y estaba escondido como dos
  // columnas sueltas de la tabla de cosechas, sin dividir. Marketing pasó
  // de traer el 22% de las sedes nuevas en enero al 55% en agosto: ya trae
  // más de la mitad de la base nueva.
  //
  // Se excluye la cosecha de carga inicial de HubSpot: ese mes tiene 1.922
  // sedes cargadas de golpe y hunde el share a 0,4% sin que signifique nada.
  f.share = [];
  Object.keys(agCos).sort().forEach(function (m) {
    if (esCargaInicial_(m)) return;
    var b = agCos[m];
    if (!b.todas) return;
    // mkt = las del universo elegido (para el grafico cuando hay filtro);
    // mktReal = siempre los cuatro canales de marketing, para el titular.
    f.share.push({ mes: m, mkt: b.total, todas: b.todas, mktReal: b.mktReal,
                   pct: Math.round((b.total / b.todas) * 1000) / 10,
                   pctMkt: b.todas ? Math.round((b.mktReal / b.todas) * 1000) / 10 : 0 });
  });
  var shDentro = f.share.filter(function (x) {
    return x.mes >= R.inicio.substring(0, 7) && x.mes <= R.fin.substring(0, 7);
  });
  // El ultimo mes DENTRO del rango, no el ultimo del dataset. De este mes
  // cuelgan la tarjeta de sedes nuevas, las dos donas, la activacion y el
  // embudo de la cosecha: si no respeta el filtro, toda la pantalla habla de
  // agosto aunque el calendario diga julio.
  // Solo meses DENTRO del rango. Antes caia al ultimo mes del dataset: con un
  // equipo que no trajo sedes en el periodo, la tarjeta mostraba el conteo de
  // otro mes como si fuera del periodo filtrado.
  var shUlt = shDentro.length ? shDentro[shDentro.length - 1] : null;
  var shPrim = shDentro.length ? shDentro[0] : (f.share.length ? f.share[0] : null);
  // Con el filtro en "Todos" el share es 100% por definicion y la linea sale
  // plana: no dice nada. En ese caso la seccion mide el ABSOLUTO de sedes
  // nuevas, que si es la pregunta de adquisicion.
  // La tarjeta muestra el TOTAL de sedes nuevas del negocio y debajo cuantas
  // trajo marketing con su porcentaje, siempre — no importa que filtro este
  // puesto. Es el titular del frente y se pide que se lea de un golpe.
  f.shareAbsoluto = U.todos;
  var mktUlt = shUlt ? shUlt.mktReal : 0;
  // El delta de esta tarjeta compara SIEMPRE contra el mes calendario
  // anterior a shUlt.mes, no contra shPrim (que es "el primer mes DENTRO
  // del rango filtrado" — sirve para la lectura de tendencia de abajo, pero
  // con un filtro angosto a un solo mes shPrim === shUlt y el delta salia
  // null: "sin comparativo" aunque el mes anterior sí exista en el dataset.
  var shMesAnt = shUlt ? mesMenos_(shUlt.mes, 1) : '';
  var shPrevMes = shUlt
    ? f.share.filter(function (x) { return x.mes === shMesAnt; })[0] : null;
  f.shareKpi = shUlt
    ? kpi_('Sedes nuevas en el mes', shUlt.todas, { formato: 'num',
        sublabel: 'de todos los orígenes · ' + shUlt.mes,
        delta: (shPrevMes && shPrevMes.todas)
          ? delta_(shUlt.todas, shPrevMes.todas) : null,
        deltaEtiqueta: shPrevMes ? 'vs ' + shPrevMes.mes : '',
        fuente: 'HubSpot · hs_createdate', color: 'azul',
        nota: 'Excluye la cosecha ' + COSECHA_CARGA_INICIAL + ': ahí se cargó la base ' +
          'histórica a HubSpot de un golpe y no son sedes nuevas de ese mes.' })
    : null;
  // El segundo dato de la tarjeta, para pintarlo destacado debajo del total.
  // El desglose de marketing solo se muestra cuando dice algo. Con el filtro
  // puesto en marketing seria "100 de 100 · 100%" y con el filtro en Farmer
  // seria un cero: en los dos casos es ruido al lado del titular.
  var mktAporta = shUlt && mktUlt > 0 && mktUlt < shUlt.todas;
  f.shareMkt = mktAporta
    ? { sedes: mktUlt, todas: shUlt.todas, pct: shUlt.pctMkt, mes: shUlt.mes,
        etiqueta: 'las trajo marketing' }
    : null;

  f.shareLectura = (shPrim && shUlt && shPrim !== shUlt)
    ? (U.todos
        ? 'De ' + fNumSrv_(shPrim.todas) + ' a ' + fNumSrv_(shUlt.todas) +
          ' sedes nuevas por mes entre ' + shPrim.mes + ' y ' + shUlt.mes + '.'
        : 'De ' + fPctSrv_(shPrim.pct) + ' a ' + fPctSrv_(shUlt.pct) +
          ' de las sedes nuevas entre ' + shPrim.mes + ' y ' + shUlt.mes + '.')
    : '';

  // ---- Conversión por origen ----------------------------------------
  var totApps = 0, appsConOrigen = 0, sedesConOrigen = 0, totSedes = 0;
  // Se agrupa desde SEDES por origen_bucket, filtrando por el universo, en
  // vez de leer CONV_ORIGEN que estaba pre-agregada sobre toda la base.
  var agCo = {};
  sedesF1.forEach(function (x) {
    var k = String(x.origen_bucket || 'Sin origen') || 'Sin origen';
    if (!agCo[k]) {
      agCo[k] = { origen: k, sedes: 0, apps: 0, aprobados: 0, desembolsos: 0, monto: 0 };
    }
    var b = agCo[k];
    if (!selF1_(x)) return;
    b.sedes++;
    b.apps += num_(x.aplicaciones);
    b.aprobados += num_(x.total_aprobados);
    b.desembolsos += num_(x.desembolsos);
    b.monto += num_(x.monto_total_desembolsado);
  });
  var co = Object.keys(agCo).map(function (k) {
    var b = agCo[k];
    return { origen: b.origen, sedes: b.sedes, apps: b.apps,
             aprobados: b.aprobados, desembolsos: b.desembolsos, monto: b.monto,
             tasa_aprob: b.apps ? Math.round((b.aprobados / b.apps) * 1000) / 10 : 0,
             tasa_conv: b.apps ? Math.round((b.desembolsos / b.apps) * 1000) / 10 : 0 };
  }).filter(function (r) { return r.sedes > 0; })
    .sort(function (a, b) { return b.sedes - a.sedes; });
  co.forEach(function (r) {
    var o = String(r.origen || '');
    totApps += num_(r.apps);
    totSedes += num_(r.sedes);
    if (o !== 'Sin origen') { appsConOrigen += num_(r.apps); sedesConOrigen += num_(r.sedes); }
  });
  // Composicion por clasificacion del universo elegido, para la dona.
  // A no viene como columna: es la resta del total menos AA y AAA menos las
  // que no tienen clasificacion.
  // ---------- Composicion de las sedes que ENTRARON en el mes --------
  // Antes esto contaba las 3.545 sedes del universo entero, mientras la
  // seccion 1 decia 183 sedes nuevas del mes: dos numeros distintos en la
  // misma pantalla para lo que parece la misma cosa. Ahora las dos donas se
  // refieren al MISMO mes que la tarjeta de arriba.
  var mesComp = shUlt ? shUlt.mes : '';
  var bComp = mesComp ? agCos[mesComp] : null;
  function filasCls_(o) {
    return [
      { clase: 'AAA', n: o.aaa },
      { clase: 'AA', n: o.aa },
      { clase: 'A', n: o.a },
      { clase: 'Sin clasificar', n: o.sin }
    ].filter(function (r) { return r.n > 0; });
  }
  f.composicion = bComp
    ? { mes: mesComp,
        todas: { n: bComp.todas, filas: filasCls_(bComp.clsTodas) },
        mkt: { n: bComp.mktReal, filas: filasCls_(bComp.clsMkt),
               pct: bComp.todas
                 ? Math.round((bComp.mktReal / bComp.todas) * 1000) / 10 : 0,
               canales: [
                 { canal: 'Página web', n: bComp.canMkt['Pagina web'] },
                 { canal: 'Social media', n: bComp.canMkt['Social media'] },
                 { canal: 'Referidos', n: bComp.canMkt.Referidos },
                 { canal: 'Eventos', n: bComp.canMkt.Eventos }
               ].filter(function (r) { return r.n > 0; })
                .sort(function (a, b) { return b.n - a.n; })
                .map(function (r) {
                  r.pct = bComp.mktReal
                    ? Math.round((r.n / bComp.mktReal) * 1000) / 10 : 0;
                  return r;
                }) } }
    : null;

  // ---------- Activación de la cosecha del mes ------------------------
  // La pregunta que faltaba: de las sedes que entraron este mes, cuántas
  // llegaron a usar el producto. Una sede creada que nunca radica una
  // solicitud es una sede que costó plata y no existe para el negocio.
  //
  //   activa  = radicó al menos 1 solicitud en el mes en que entró
  //   exitosa = radicó 3 o más, o ya tiene un desembolso
  //
  // El umbral de 3 es la definición de la casa: con una sola solicitud no se
  // distingue una sede que arrancó de una que probó el sistema una vez.
  //
  // Se mide en el MISMO mes de la cosecha, no acumulado: es activación, no
  // supervivencia. La supervivencia mes a mes ya está en los mapas de
  // cohorte de profundización.
  var actF1 = leerHoja_('ACT_SEDE_MES');
  var actIdx = {};
  actF1.forEach(function (r) {
    var m = String(r.mes || '').substring(0, 7);
    if (m !== mesComp) return;
    actIdx[String(r.id_sede || '').trim()] = {
      sol: num_(r.solicitudes), apr: num_(r.aprobados), des: num_(r.desembolsos)
    };
  });
  // total viene declarado por la cosecha (lo que dice la tarjeta de arriba) y
  // no de la longitud de ids: hay sedes de HubSpot sin id_internal que no se
  // pueden cruzar contra la plataforma. Se cuentan en el total y se declaran
  // como no verificables, en vez de bajar el numero del mes sin avisar.
  function activacionDe_(ids, total) {
    var t = total, act = 0, exi = 0, sol = 0, des = 0;
    (ids || []).forEach(function (id) {
      var a = actIdx[id];
      if (!a) return;
      sol += a.sol;
      des += a.des;
      if (a.sol >= 1) act++;
      if (a.sol >= 3 || a.des >= 1) exi++;
    });
    return { total: t, activas: act, exitosas: exi, dormidas: t - act,
             verificables: (ids || []).length,
             sinId: Math.max(0, t - (ids || []).length),
             solicitudes: sol, desembolsos: des,
             pctAct: t ? Math.round((act / t) * 1000) / 10 : 0,
             pctExi: t ? Math.round((exi / t) * 1000) / 10 : 0,
             pctExiDeAct: act ? Math.round((exi / act) * 1000) / 10 : 0 };
  }
  var actM = bComp ? activacionDe_(bComp.idsMkt, bComp.mktReal) : null;
  var actT = bComp ? activacionDe_(bComp.ids, bComp.todas) : null;
  f.activacion = (actM && actT && actT.total)
    ? { mes: mesComp, mkt: actM, todas: actT,
        pasos: [
          { etapa: 'Nuevas', valor: actM.total, pct: 100 },
          { etapa: 'Activas', valor: actM.activas, pct: actM.pctAct },
          { etapa: 'Exitosas', valor: actM.exitosas, pct: actM.pctExi }
        ],
        // La version GLOBAL: todas las sedes que entraron, sin importar quien
        // las trajo. Es la que pinta el frente; la de marketing se deja
        // calculada porque el dato ya esta y no cuesta nada.
        pasosTodas: [
          { etapa: 'Nuevas', valor: actT.total, pct: 100 },
          { etapa: 'Activas', valor: actT.activas, pct: actT.pctAct },
          { etapa: 'Exitosas', valor: actT.exitosas, pct: actT.pctExi }
        ],
        kpisTodas: [
          kpi_('Sedes activas', actT.activas, { formato: 'num', color: 'azul',
            sublabel: 'de ' + fNumSrv_(actT.total) + ' que entraron en ' + mesComp +
              ' · ' + fPctSrv_(actT.pctAct),
            fuente: 'profile_institucion',
            nota: 'Activa = radicó al menos una solicitud de crédito en el mes ' +
              'en que la sede entró. Todos los orígenes.' +
              (actT.sinId
                ? ' Ojo: ' + fNumSrv_(actT.sinId) + ' de las ' + fNumSrv_(actT.total) +
                  ' no tienen id_internal en HubSpot, así que no se pueden cruzar ' +
                  'contra la plataforma y cuentan como dormidas sin poder ' +
                  'verificarlo.'
                : '') }),
          kpi_('Sedes exitosas', actT.exitosas, { formato: 'num', color: 'verde',
            sublabel: '3 o más solicitudes, o ya con desembolso · ' +
              fPctSrv_(actT.pctExi) + ' de las nuevas',
            fuente: 'profile_institucion',
            nota: 'Con una sola solicitud no se distingue una sede que arrancó ' +
              'de una que probó el sistema una vez. De las activas, ' +
              fPctSrv_(actT.pctExiDeAct) + ' llegó a exitosa.' }),
          kpi_('Sedes dormidas', actT.dormidas, { formato: 'num', color: 'ambar',
            sublabel: 'entraron y no radicaron nada en el mes',
            fuente: 'profile_institucion',
            nota: 'Son el objetivo natural de activación: ya están creadas y ' +
              'no cuestan adquisición, solo acompañamiento.' })
        ],
        // La comparación contra toda la base nueva del mes dice si marketing
        // trae sedes que arrancan mejor o solo trae más sedes.
        comparar: [
          { grupo: 'Las que trajo marketing', nuevas: actM.total,
            activas: actM.activas, pctAct: actM.pctAct,
            exitosas: actM.exitosas, pctExi: actM.pctExi },
          { grupo: 'Toda la base nueva del mes', nuevas: actT.total,
            activas: actT.activas, pctAct: actT.pctAct,
            exitosas: actT.exitosas, pctExi: actT.pctExi }
        ],
        kpis: [
          kpi_('Sedes activas', actM.activas, { formato: 'num', color: 'azul',
            sublabel: 'de ' + fNumSrv_(actM.total) + ' que trajo marketing en ' +
              mesComp + ' · ' + fPctSrv_(actM.pctAct),
            fuente: 'profile_institucion',
            nota: 'Activa = radicó al menos una solicitud de crédito en el mes ' +
              'en que la sede entró.' +
              (actM.sinId
                ? ' Ojo: ' + fNumSrv_(actM.sinId) + ' de las ' + fNumSrv_(actM.total) +
                  ' no tienen id_internal en HubSpot, así que no se pueden cruzar ' +
                  'contra la plataforma y cuentan como dormidas sin poder ' +
                  'verificarlo. El piso real de activación es ' +
                  fPctSrv_(actM.verificables
                    ? Math.round((actM.activas / actM.verificables) * 1000) / 10 : 0) +
                  ' sobre las que sí se pueden medir.'
                : '') }),
          kpi_('Sedes exitosas', actM.exitosas, { formato: 'num', color: 'verde',
            sublabel: '3 o más solicitudes, o ya con desembolso · ' +
              fPctSrv_(actM.pctExi) + ' de las nuevas',
            fuente: 'profile_institucion',
            nota: 'Con una sola solicitud no se distingue una sede que arrancó ' +
              'de una que probó el sistema una vez. De las activas, ' +
              fPctSrv_(actM.pctExiDeAct) + ' llegó a exitosa.' }),
          kpi_('Sedes dormidas', actM.dormidas, { formato: 'num', color: 'ambar',
            sublabel: 'entraron y no radicaron nada en el mes',
            fuente: 'profile_institucion',
            nota: 'Son el objetivo natural de activación: ya están creadas y ' +
              'no cuestan adquisición, solo acompañamiento.' +
              (actM.sinId
                ? ' Incluye ' + fNumSrv_(actM.sinId) + ' sin id_internal en HubSpot, ' +
                  'que no son verificables: hay que llenarles el campo.'
                : '') })
        ] }
    : null;

  // ---------- Cohortes de DEALS de HubSpot ----------------------------
  // Cuantos negocios entraron cada mes y cuantos se fueron convirtiendo en
  // cierre ganado, mes a mes. Es el equivalente de la tabla de cosechas pero
  // en el pipeline comercial, antes de que la sede exista.
  //
  // RESPONDE AL FILTRO GLOBAL: la fuente es DEALS_ORIGEN, agregada por
  // cosecha x origen x owner, asi que si el filtro dice "Evento" la tabla
  // muestra los deals de evento. Con el filtro en "Todos" muestra el
  // pipeline completo (menos las dos exclusiones permanentes de abajo).
  //
  // Alineado 2026-09-08 con el reporte real de HubSpot que usa el negocio
  // (screenshot de Emmanuel, filtros 1-4):
  //   1. Fecha de creación = este año fiscal (= calendario) hasta hoy —
  //      COSECHA_PISO_DEALS ya era 2026-01, sigue igual.
  //   2. Propietario del negocio = el equipo Hunter (GENTE_ROL.hunter) — se
  //      filtra por el owner DEL DEAL cuando el selector global de rol
  //      "Hunter" tiene una persona elegida. Farmer y CS SI se declaran
  //      como no aplicables: un deal abierto no tiene farmer ni CS, esos
  //      son roles de la sede.
  //   3. Origen no es PROSPECCION ni HUNTER — exclusion PERMANENTE,
  //      acordada con el negocio: no es atribucion real.
  //   4. Causal de cerrado perdido: se excluyen 8 causales que son
  //      registro-que-no-debio-existir, no oportunidad perdida real. Un
  //      deal sin causal (abierto o ganado) SIEMPRE cuenta.
  //   5. Pipeline: HubSpot tiene 9 pipelines de deals mezclados en la misma
  //      fuente (Farmer, B2B Distribuidores, Alianzas, Bot...), y son
  //      procesos de negocio DISTINTOS a la adquisicion. Hallazgo
  //      2026-09-08: el reporte de HubSpot que el negocio usa como
  //      referencia SOLO mira un pipeline a la vez. Por eso este filtro es
  //      LOCAL a la pestaña (no al selector global): cada pipeline se
  //      manda pre-agregado y el clic solo cambia que tabla ya calculada
  //      se muestra, sin ida y vuelta al servidor.
  var COSECHA_PISO_DEALS = '2026-01';
  var ORIGEN_FUERA_DEALS = { 'PROSPECCION': true, 'HUNTER': true };
  var dcO = leerHoja_('DEALS_ORIGEN');
  var selDc = {};
  (U.origenes || []).forEach(function (o) { selDc[o] = true; });
  var ownerHunter = String((U.roles || {}).hunter || '').trim();
  // '__equipo__' = "cualquiera de los 4 hunters", no una persona puntual.
  // GENTE_ROL viene de Filtro_Origen.gs (carga antes que este archivo).
  var ownerHunterSet = null;
  if (ownerHunter === '__equipo__') {
    ownerHunterSet = {};
    Object.keys(GENTE_ROL.hunter || {}).forEach(function (id) { ownerHunterSet[id] = true; });
  }

  function construirFilasCohorte_(agCosechas) {
    return Object.keys(agCosechas).sort().map(function (cos) {
      var b = agCosechas[cos], acum = 0, celdas = [];
      for (var m = 0; m <= 7; m++) {
        acum += b.m[m];
        // Acumulado: "cuantos de esta cosecha YA ganaron al mes N". Solo sube,
        // igual que la tabla Acumulada de cosechas de sedes.
        celdas.push(mesFuturo_(cos, m) ? null : acum);
      }
      // nTotal = los mismos deals SIN la exclusion de causal de calidad
      // (SARLAFT/duplicado/pruebas/etc) -- pedido de la jefa de Emmanuel el
      // 14-sep-2026: Growth reporta el total de leads que entraron, no solo
      // los que ya pasaron el filtro de calidad que le importa a Hunter. El
      // mapa de cohortes (celdas/ganados/conv) sigue calculado SOLO con los
      // deals limpios (b.deals) -- eso no cambia.
      return { cosecha: cos, n: b.deals, nTotal: b.dealsTotal, celdas: celdas,
               ganados: acum,
               conv: b.deals ? Math.round((acum / b.deals) * 1000) / 10 : 0 };
    }).filter(function (r) { return r.n > 0 || r.nTotal > 0; });
  }

  var agDc = {};              // "Todos los pipelines" (default de la vista)
  var agPorPipe = {};         // pipeline -> { cosecha -> {...} }
  var totalPorPipe = {};      // pipeline -> total deals, para ordenar el selector
  dcO.forEach(function (r) {
    var cos = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(cos) || cos < COSECHA_PISO_DEALS) return;
    var o = normOrigen_(r.origen);
    if (ORIGEN_FUERA_DEALS[o]) return;
    if (!U.todos && !selDc[o]) return;
    var ownerId = String(r.owner || '').trim();
    if (ownerHunterSet) {
      if (!ownerHunterSet[ownerId]) return;
    } else if (ownerHunter && ownerId !== ownerHunter) {
      return;
    }
    var pipe = String(r.pipeline || '(otro pipeline)');
    var n = num_(r.deals);
    var nTot = num_(r.deals_totales);

    if (!agDc[cos]) agDc[cos] = { cosecha: cos, deals: 0, dealsTotal: 0, m: [0, 0, 0, 0, 0, 0, 0, 0] };
    agDc[cos].deals += n;
    agDc[cos].dealsTotal += nTot;
    if (!agPorPipe[pipe]) agPorPipe[pipe] = {};
    if (!agPorPipe[pipe][cos]) agPorPipe[pipe][cos] = { cosecha: cos, deals: 0, dealsTotal: 0, m: [0, 0, 0, 0, 0, 0, 0, 0] };
    agPorPipe[pipe][cos].deals += n;
    agPorPipe[pipe][cos].dealsTotal += nTot;
    totalPorPipe[pipe] = (totalPorPipe[pipe] || 0) + n;
    for (var i = 0; i <= 7; i++) {
      var mv = num_(r['m' + i]);
      agDc[cos].m[i] += mv;
      agPorPipe[pipe][cos].m[i] += mv;
    }
  });

  var porPipeline = {};
  Object.keys(agPorPipe).forEach(function (p) {
    porPipeline[p] = construirFilasCohorte_(agPorPipe[p]);
  });

  f.dealsCohorte = {
    hay: dcO.length > 0,
    offsets: 7,
    universo: U.etiqueta,
    // Farmer/CS no aplican (son roles de la sede, que en un deal abierto
    // todavia no existe); Hunter SI aplica, porque es el propio owner del
    // deal — se dice cual de los dos esta pasando.
    notaRoles: ((U.roles || {}).farmer || (U.roles || {}).cs)
      ? 'El filtro de Farmer / Customer Success no se aplica a los deals: ' +
        'esos roles son de la sede, que en un deal abierto todavía no ' +
        'existe. El filtro de Hunter sí se aplica — es el propio owner ' +
        'del deal.'
      : '',
    // Estas causales YA NO se restan del total que se muestra (columna
    // "Deals totales") -- solo definen cuales deals cuentan como "limpios"
    // (la columna de al lado, la que alimenta el mapa de cohortes). Antes
    // del 14-sep-2026 estos deals desaparecian sin dejar rastro visible.
    excluidos: 'Duplicado/Existente · No pasó SARLAFT · Medicina Alternativa · ' +
      'Pruebas · No es del sector salud · Sin tarjeta profesional · ' +
      '>1 año constitución · Equipos Médicos',
    excluidoOrigen: 'Prospección y Hunter (no es atribución real)',
    filas: construirFilasCohorte_(agDc),
    // Selector LOCAL de pipeline: cada entrada ya trae sus filas listas
    // para pintar, ordenadas por volumen — "Pipeline de Hunter" primero.
    pipelines: Object.keys(totalPorPipe)
      .sort(function (a, b) { return totalPorPipe[b] - totalPorPipe[a]; })
      .map(function (p) { return { nombre: p, deals: totalPorPipe[p] }; }),
    porPipeline: porPipeline
  };

  // ---- Metas de marketing por canal (punto 2) ------------------------
  // Misma fuente que el punto 1 (DEALS_ORIGEN) y el mismo filtro de Hunter
  // — se reutiliza pasando dcO, ownerHunter y ownerHunterSet ya calculados
  // arriba, para no releer la hoja ni duplicar la logica del owner.
  f.metasCanal = armarMetasCanalF1_(R, U, dcO, ownerHunter, ownerHunterSet);

  // El denominador de este aviso es la hoja CRUDA de HubSpot, no el
  // universo de los mapas: F1 cuenta FICHAS del CRM a proposito (ver el
  // comentario de sedesF1). Eso lo deja SIEMPRE por encima de la cinta de
  // arriba, y una diferencia sin explicar al lado de la cinta se lee como
  // error de cuentas — asi que se declara con su descomposicion exacta.
  var uni = U.universo || {};
  var difUniverso = totSedes - (U.total === undefined ? totSedes : U.total);
  f.coberturaOrigen = {
    sedesConOrigen: sedesConOrigen, totSedes: totSedes,
    pctApps: totApps ? Math.round((appsConOrigen / totApps) * 1000) / 10 : 0,
    aviso: 'El origen solo está registrado en ' + fNumSrv_(sedesConOrigen) + ' de ' +
      fNumSrv_(totSedes) + ' fichas de HubSpot, que concentran apenas el ' +
      (totApps ? Math.round((appsConOrigen / totApps) * 1000) / 10 : 0) +
      '% de las aplicaciones. La comparación por canal aplica a esa fracción, no al total.' +
      (difUniverso > 0
        ? ' Este frente cuenta fichas del CRM, así que el total va ' +
          fNumSrv_(difUniverso) + ' por encima de las ' +
          fNumSrv_(U.total) + ' sedes de la cinta: ' + fNumSrv_(num_(uni.sinId)) +
          ' sin id_internal y ' + fNumSrv_(num_(uni.noPlataforma)) +
          ' sin cuenta en la plataforma.'
        : '')
  };

  // ---- Cohortes: las tres tablas M0..M7 -----------------------------

  // ---- La seccion 5 se acota a la COSECHA y respeta filtro y rango ----
  // Dos cortes, los dos obligatorios:
  //   1. la sede entro en un mes que toca el rango   (cosecha)
  //   2. el credito se radico dentro del rango       (fecha)
  // Y el ORIGEN sale del filtro global, no esta fijo en marketing: si el
  // usuario filtra "Evento", esta seccion mide los creditos de las sedes de
  // evento. Con el filtro en "Todos" mide toda la base nueva del periodo.
  // El corte de la cohorte sale de la tabla de hechos: la sede entro en un
  // mes que toca el rango Y el credito se radico dentro del rango. El filtro
  // global (origen y los tres roles) ya viene resuelto en U.idsHS.
  var AT = atribSede_(U);
  function mesMas_(c, k) {
    if (!/^\d{4}-\d{2}$/.test(String(c || ''))) return '';
    var t = Number(c.substring(0, 4)) * 12 + (Number(c.substring(5, 7)) - 1) + k;
    return ('0000' + Math.floor(t / 12)).slice(-4) + '-' + ('0' + (t % 12 + 1)).slice(-2);
  }
  var mesIni = R.inicio.substring(0, 7), mesFin = R.fin.substring(0, 7);
  var mesPrevIni = mesMas_(mesIni, -1), mesPrevFin = mesMas_(mesFin, -1);

  var sedesPer = 0, sedesPerPrev = 0;
  Object.keys(agCos).forEach(function (m) {
    if (esCargaInicial_(m)) return;
    var b = agCos[m];
    if (m >= mesIni && m <= mesFin) sedesPer += b.total;
    if (m >= mesPrevIni && m <= mesPrevFin) sedesPerPrev += b.total;
  });

  function cortarCd_(desde, hasta, mDesde, mHasta, conCargaInicial) {
    var t = { sol: 0, apr: 0, conv: 0, monto: 0 };
    var dia = {}, org = {};
    recorrerHechos_(U, desde, hasta, function (r) {
      var a = AT[r.sede];
      if (!a) return;
      var cos = a.cosecha;
      if (cos < mDesde || cos > mHasta) return;
      if (!conCargaInicial && esCargaInicial_(cos)) return;
      t.sol += r.sol; t.apr += r.apr; t.conv += r.conv; t.monto += r.mConv;
      dia[r.fecha] = (dia[r.fecha] || 0) + r.mConv;
      var o = a.origen;
      if (!org[o]) {
        org[o] = { origen: o, sol: 0, apr: 0, des: 0, monto: 0, firm: {} };
      }
      var b = org[o];
      b.sol += r.sol; b.apr += r.apr; b.des += r.conv; b.monto += r.mConv;
      // Sede lograda = sede que firmo. Como conjunto y no como suma: la misma
      // sede aparece en varios dias del periodo.
      if (r.conv > 0) b.firm[r.sede] = true;
    });
    t.dia = dia;
    t.org = org;
    return t;
  }
  var todoPer = cortarCd_(R.inicio, R.fin, '0000-00', '9999-99', true);
  var cohA = cortarCd_(R.inicio, R.fin, mesIni, mesFin);
  var cohP = cortarCd_(R.prevInicio, R.prevFin, mesPrevIni, mesPrevFin);
  var hayCoh = cohA.sol > 0;
  var mesEti = mesIni === mesFin ? mesIni : mesIni + ' a ' + mesFin;
  var mesPrevEti = mesPrevIni === mesPrevFin
    ? mesPrevIni : mesPrevIni + ' a ' + mesPrevFin;
  // Siempre se toma el corte de cohorte, incluso cuando da cero: si no hay
  // sedes nuevas de ese equipo en el periodo, la respuesta es cero, no el
  // resultado de otra poblacion. Antes cA se quedaba con el calculo viejo
  // (marketing, sin filtrar por equipo) y la seccion mostraba 1.198
  // solicitudes donde la verdad era cero.
  cA = cohA;
  cP = cohP;
  var emComparable = cohP.sol > 0;
  // Share por origen de esa misma plata, ordenado por monto.
  var totCoh = cohA.monto;
  // Para el "vs período anterior" de esta tabla: la misma plata por origen
  // pero de la cosecha del período ANTERIOR (cohP.org), que ya se calcula
  // arriba con la misma función. Sin esto la tabla se queda sin delta pese
  // a que el resto del frente sí lo tiene.
  var canalesCohPrev = cohP.org || {};
  var canalesCoh = Object.keys(cohA.org).map(function (k) {
    var b = cohA.org[k];
    var logradas = Object.keys(b.firm || {}).length;
    var bPrev = canalesCohPrev[k];
    return { canal: k === '(SIN ORIGEN)' ? 'Sin origen' : k,
             sol: b.sol, apr: b.apr, des: b.des, monto: b.monto,
             // Sedes que firmaron, y la plata que puso cada una. Es lo que
             // distingue un origen que trae una sede grande de uno que trae
             // varias chicas: el ticket habla del credito, esto de la sede.
             sedes: logradas,
             porSede: logradas ? Math.round(b.monto / logradas) : 0,
             pct: totCoh ? Math.round((b.monto / totCoh) * 1000) / 10 : 0,
             ticket: b.des ? Math.round(b.monto / b.des) : 0,
             conv: b.apr ? Math.round((b.des / b.apr) * 1000) / 10 : 0,
             deltaMonto: bPrev ? delta_(b.monto, bPrev.monto) : null };
  }).sort(function (a, b) { return b.monto - a.monto || b.sol - a.sol; });

  f.embudo = {
    hay: hayCoh,
    // Alcance declarado, para que el frontend no tenga que adivinarlo.
    cohorte: hayCoh,
    mes: hayCoh ? mesEti : '',
    mesPrev: hayCoh ? mesPrevEti : '',
    sedes: sedesPer,
    universo: U.etiqueta,
    origenTodos: U.todos,
    // Cuanto pesa la cosecha nueva dentro del total del periodo.
    contexto: (hayCoh && todoPer.sol) ? {
      sol: todoPer.sol, apr: todoPer.apr, conv: todoPer.conv,
      monto: Math.round(todoPer.monto),
      pctSol: Math.round((cohA.sol / todoPer.sol) * 1000) / 10,
      pctMonto: todoPer.monto
        ? Math.round((cohA.monto / todoPer.monto) * 1000) / 10 : 0,
      montoResto: Math.round(todoPer.monto - cohA.monto)
    } : null,
    // Se guarda para poder contrastar las dos definiciones sin salir del
    // tablero: convertidos del mapeo de estados contra desembolsos de t_des_v2.
    kpis: [
      kpi_('Solicitudes de crédito', cA.sol, { formato: 'num',
        sublabel: hayCoh
          ? 'radicadas en el período por las ' + fNumSrv_(sedesPer) +
            ' sedes que entraron en el período'
          : 'radicadas por pacientes de las sedes del universo',
        delta: emComparable ? delta_(cA.sol, cP.sol) : null,
        deltaEtiqueta: hayCoh ? 'vs cosecha de ' + mesPrevEti : '',
        fuente: 'BigQuery · profile_institucion',
        nota: (hayCoh
          ? 'Doble corte: la sede entró en el período Y el crédito se radicó en ' +
            'el período. No incluye las sedes que entraron antes, que son la ' +
            'mayor parte de la plata del negocio. Universo: ' + U.etiqueta + '.'
          : (emComparable ? '' : 'No hay cosecha del universo elegido en el período anterior, así que no hay con qué comparar.')), color: 'amarillo' }),
      kpi_('Tasa de aprobación',
        cA.sol ? Math.round(((cA.apr || 0) / cA.sol) * 1000) / 10 : 0, {
        formato: 'pct',
        sublabel: hayCoh
          ? 'el motor aprobó / solicitudes · cosecha del período'
          : 'el motor aprobó / solicitudes',
        delta: delta_(cA.sol ? (cA.apr || 0) / cA.sol : 0,
                      cP.sol ? (cP.apr || 0) / cP.sol : null),
        deltaEtiqueta: hayCoh ? 'vs cosecha de ' + mesPrevEti : '',
        fuente: 'BigQuery · profile_institucion',
        nota: 'El motor aprueba o rechaza. Es el paso que t_sol_v2 no expone, así que ' +
          'sale del mapeo de estados de profile_institucion.', color: 'azul' }),
      // Desembolsados sobre APROBADOS, no sobre solicitudes: un credito que el
      // motor rechazo no se puede convertir, asi que meterlo en el
      // denominador mezcla riesgo con comercial y esconde la tasa que si
      // depende de la gestion.
      kpi_('Tasa de conversión',
        cA.apr ? Math.round((cA.conv / cA.apr) * 1000) / 10 : 0, {
        formato: 'pct',
        sublabel: hayCoh
          ? 'desembolsados / aprobados · cosecha del período'
          : 'desembolsados / aprobados',
        // La TASA si es comparable aunque el universo crezca: es un ratio.
        delta: delta_(cA.apr ? cA.conv / cA.apr : 0, cP.apr ? cP.conv / cP.apr : null),
        deltaEtiqueta: hayCoh ? 'vs cosecha de ' + mesPrevEti : '',
        fuente: 'BigQuery · profile_institucion',
        nota: 'De los créditos que el motor APROBÓ, cuántos se tomaron. Sobre ' +
          'solicitudes mezclaría el riesgo (a quién aprueba el motor) con lo comercial ' +
          '(a quién convence la sede). Y es de cohorte: los créditos radicados en el ' +
          'período, no las firmas del período.',
        color: 'verde' }),
      kpi_('Plata firmada', Math.round(cA.monto), { formato: 'copC',
        sublabel: hayCoh
          ? 'lo que puso la cosecha del período · ' + U.etiqueta
          : 'crédito desembolsado en esas sedes',
        delta: emComparable ? delta_(cA.monto, cP.monto) : null,
        deltaEtiqueta: hayCoh ? 'vs cosecha de ' + mesPrevEti : '',
        fuente: 'BigQuery · profile_institucion',
        nota: (hayCoh
          ? 'Es lo que rindió la adquisición DEL PERÍODO, no todo el stock. ' +
            'Sirve para calcular CAC contra el gasto del período. El aporte del ' +
            'stock completo es varias veces mayor y crece con cada cosecha que ' +
            'sobrevive.'
          : (emComparable ? '' : 'No hay cosecha del universo elegido en el período anterior, así que no hay con qué comparar.')), color: 'morado' })
    ],
    // Si hay cosecha, la serie es la de la cosecha (dia a dia, todo el mes),
    // no la del universo de marketing recortada al rango.
    // Share de ESA plata por origen, con % y ticket.
    canales: hayCoh ? canalesCoh : [],
    montoCanales: totCoh
  };

  // ---- Lo que devolvió la pauta --------------------------------------
  // La pauta de Meta es a MEDICOS (campaña "Médicos_Formulario_de_Facebook"),
  // no a pacientes, así que las sedes de origen "Social media" son el
  // resultado de ese gasto y se le pueden atribuir.
  //
  // El retorno se mide contra la COSECHA: la plata que pusieron las sedes de
  // social media que entraron ese mes. Contra el stock de todas las sedes de
  // social media daría un múltiplo mucho más alto, pero mezclaría el gasto de
  // este mes con sedes que trajo el gasto de hace seis.
  //
  // OJO CON LA PALABRA ROI: el monto desembolsado es capital del crédito, no
  // margen de WELLI. Esto es originación por peso de pauta, que es un
  // múltiplo de volumen. El ROI de verdad necesita el margen por crédito, que
  // hoy no está en ninguna fuente del tablero.
  var metaRoi = leerHoja_('META_ADS');
  var agRoi = {};
  function bRoi_(m) {
    if (!agRoi[m]) {
      agRoi[m] = { mes: m, leads: 0, gasto: 0, sedes: 0, sol: 0, apr: 0,
                   des: 0, plata: 0, plataM0: 0, desM0: 0 };
    }
    return agRoi[m];
  }
  metaRoi.forEach(function (r) {
    var m = String(fechaCelda_(r.fecha) || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    var b = bRoi_(m);
    b.leads += num_(r.leads);
    b.gasto += num_(r.gasto);
  });
  // La plata de social media, de la tabla de hechos: respeta el filtro de
  // roles igual que todo lo demas.
  recorrerHechos_(U, '2000-01-01', '9999-12-31', function (r) {
    var a = AT[r.sede];
    if (!a || a.origen !== 'SOCIAL MEDIA') return;
    var m = a.cosecha;
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    var b = bRoi_(m);
    b.sol += r.sol; b.apr += r.apr; b.des += r.conv; b.plata += r.mConv;
    if (r.fecha.substring(0, 7) === m) {
      b.plataM0 += r.mConv;
      b.desM0 += r.conv;
    }
  });
  // Las sedes de social media por cosecha salen de agCos, que ya las cuenta.
  Object.keys(agCos).forEach(function (m) {
    if (esCargaInicial_(m)) return;
    var s = agCos[m].canMkt['Social media'];
    if (s) bRoi_(m).sedes = s;
  });
  // Solo meses CON gasto: la tabla mide que devolvio la pauta, asi que un mes
  // sin pauta no tiene nada que devolver y solo mete ruido.
  var serieRoi = Object.keys(agRoi).sort().filter(function (m) {
    return agRoi[m].gasto > 0;
  }).map(function (m) {
    var b = agRoi[m];
    return { mes: m, leads: b.leads, gasto: Math.round(b.gasto),
             cpl: b.leads ? Math.round(b.gasto / b.leads) : 0,
             sedes: b.sedes,
             leadASede: b.leads ? Math.round((b.sedes / b.leads) * 1000) / 10 : 0,
             costoSede: b.sedes ? Math.round(b.gasto / b.sedes) : 0,
             plata: Math.round(b.plata),
             plataM0: Math.round(b.plataM0),
             des: b.des, desM0: b.desM0,
             multiplo: b.gasto ? Math.round((b.plata / b.gasto) * 10) / 10 : 0,
             multiploM0: b.gasto ? Math.round((b.plataM0 / b.gasto) * 10) / 10 : 0 };
  });
  // El gasto de Meta viene por mes, pero los KPIs tienen que respetar el
  // rango: anclados al ultimo mes, con el filtro en todo el año mostraban
  // solo agosto y el resto del año quedaba invisible.
  function sumaRoi_(desde, hasta) {
    var t = { mes: '', leads: 0, gasto: 0, sedes: 0, plata: 0, plataM0: 0,
              des: 0, meses: 0 };
    serieRoi.forEach(function (x) {
      if (x.mes < desde || x.mes > hasta) return;
      t.leads += x.leads; t.gasto += x.gasto; t.sedes += x.sedes;
      t.plata += x.plata; t.plataM0 += x.plataM0; t.des += x.des;
      t.meses++;
    });
    t.cpl = t.leads ? Math.round(t.gasto / t.leads) : 0;
    t.costoSede = t.sedes ? Math.round(t.gasto / t.sedes) : 0;
    t.leadASede = t.leads ? Math.round((t.sedes / t.leads) * 1000) / 10 : 0;
    // El multiplo titular usa la plata DEL PERIODO, que es comparable entre
    // meses. El acumulado va aparte: una cosecha de enero ha tenido ocho
    // meses para rendir y una de agosto unos dias, asi que compararlos da
    // caidas de 70% que solo miden la diferencia de edad.
    t.multiplo = t.gasto ? Math.round((t.plataM0 / t.gasto) * 10) / 10 : 0;
    t.multiploAcum = t.gasto ? Math.round((t.plata / t.gasto) * 10) / 10 : 0;
    t.mes = desde === hasta ? desde : desde + ' a ' + hasta;
    return t;
  }
  // BUG que esto arregla: el periodo anterior se calculaba en DIAS, asi que
  // el anterior de julio (31 dias atras) arrancaba el 31 de MAYO y al cortar
  // a mes daba "mayo a junio" — dos meses de plata contra uno. Julio ($24,0 M)
  // salia -63,6% cuando junio hizo $9,6 M y lo real es +149,6%.
  //
  // El retorno de la pauta es mensual por naturaleza (el gasto de Meta viene
  // por mes), asi que el comparativo tiene que contar MESES: tantos meses
  // atras como meses tenga el rango.
  var mIniRoi = R.inicio.substring(0, 7), mFinRoi = R.fin.substring(0, 7);
  var nMeses = (Number(mFinRoi.substring(0, 4)) * 12 + Number(mFinRoi.substring(5, 7))) -
               (Number(mIniRoi.substring(0, 4)) * 12 + Number(mIniRoi.substring(5, 7))) + 1;
  var rMes = sumaRoi_(mIniRoi, mFinRoi);
  var rPrev = sumaRoi_(mesMas_(mIniRoi, -nMeses), mesMas_(mIniRoi, -1));
  if (!rMes.meses) rMes = null;
  if (!rPrev.meses) rPrev = null;
  f.retorno = rMes
    // Ya no viaja la serie mes a mes ni el acumulado: alimentaban la tabla y
    // la lectura que se borraron. Las tarjetas solo necesitan el corte del
    // periodo y su comparativo.
    ? { mes: rMes.mes, fila: rMes, meses: rMes.meses,
        kpis: [
          kpi_('Plata de social media', Math.round(rMes.plataM0), { formato: 'copC',
            sublabel: 'firmada DENTRO del período por las ' + fNumSrv_(rMes.sedes) +
              ' sedes que entraron por social media · ' + rMes.mes,
            delta: rPrev && rPrev.plataM0
              ? delta_(rMes.plataM0, rPrev.plataM0) : null,
            deltaEtiqueta: rPrev ? 'vs ' + rPrev.mes : '',
            fuente: 'profile_institucion + HubSpot', color: 'morado',
            nota: 'Es la MISMA medida que la tabla de abajo: la sede entró en el ' +
              'período y el crédito se firmó en el período. El acumulado hasta hoy ' +
              'va debajo, y casi siempre es mayor porque una cosecha sigue ' +
              'rindiendo después de su mes.' }),
          kpi_('Originación por peso de pauta', rMes.multiplo, { formato: 'x',
            sublabel: 'plata del período / gasto de Meta del período',
            delta: rPrev && rPrev.multiplo ? delta_(rMes.multiplo, rPrev.multiplo) : null,
            deltaEtiqueta: rPrev ? 'vs ' + rPrev.mes : '',
            fuente: 'Meta Ads + profile_institucion', color: 'verde',
            nota: 'NO es ROI. El monto desembolsado es capital del crédito, no ' +
              'margen de WELLI, así que esto mide cuánta originación compra cada ' +
              'peso de pauta. Para un ROI real falta el margen por crédito, que ' +
              'no está en ninguna fuente conectada.' }),
          kpi_('Costo por sede', rMes.costoSede, { formato: 'cop',
            sublabel: 'gasto de Meta / sedes de social media · ' +
              fPctSrv_(rMes.leadASede) + ' de los leads llegó a sede',
            delta: rPrev && rPrev.costoSede
              ? delta_(rMes.costoSede, rPrev.costoSede) : null,
            deltaEtiqueta: rPrev ? 'vs ' + rPrev.mes : '',
            deltaInvertido: true, fuente: 'Meta Ads + HubSpot', color: 'ambar',
            nota: 'El CPL solo dice qué cuesta un formulario. Esto dice qué cuesta ' +
              'una sede, que es lo que el negocio compra.' })
        ] }
    : null;

  // ---- Canales sin fuente conectada, dichos explícitamente ----------
  // El negocio genera demanda por Meta, SEO, AEO, eventos y referidos.
  // De esos, hoy solo hay datos de eventos y referidos (por el origen de
  // la sede en HubSpot). Se listan para que no se lean como inexistentes.
  f.canalesSinFuente = [
    { canal: 'SEO — tráfico orgánico y posiciones',
      fuente: 'Google Search Console + Analytics',
      detalle: 'No hay conector. Se necesita la propiedad de Search Console para ver ' +
        'impresiones, clics y consultas que traen clínicas.' },
    { canal: 'AEO — menciones en respuestas de IA',
      fuente: 'sin herramienta definida',
      detalle: 'No existe fuente automática todavía. Requiere definir qué se mide ' +
        '(share of answer, citaciones) y con qué herramienta.' },
    { canal: 'Pauta pagada — leads, CPL, gasto',
      fuente: 'Meta Ads',
      detalle: pendMeta ? notaMeta : 'conectada' }
  ];

  f.textos = {
    funcionando: cfg.f1_funcionando || '',
    cuello: cfg.f1_cuello || '',
    atencion: cfg.f1_atencion || '',
    fecha: cfg.textos_fecha || ''
  };
  return f;
}

// =====================================================================
// COHORTES — las tres tablas de cosecha
// =====================================================================
/* Los cuatro buckets de origen que marketing genera, tal como los escribe
   la hoja SEDES en origen_bucket. Los demas valores son "Otros origenes" y
   "Sin origen". Se usa para el desglose de marketing de F1, que va aparte del
   filtro global de origen. */
var ORIGENES_MKT = ['Eventos', 'Referidos', 'Pagina web', 'Social media'];

/* Cuanto vale un Welli Point en COP. El programa entrega puntos y la sede los
   redime por tarjeta debito, asi que para hablar de plata hay que convertir.
   Si cambia el canje, se cambia aca y todo F5 sigue cuadrando. */
var COP_POR_PUNTO = 2000;

/* Primera cosecha que entra a profundizacion. Las de 2025 arrastran la
   migracion a HubSpot y un pipeline que ya no existe, asi que ensucian la
   comparacion entre cosechas sin aportar nada accionable. Si algun dia se
   quiere ver mas historia, se cambia aca y los cinco mapas la toman juntos. */
var COSECHA_PISO_F2 = '2026-01';

/* =====================================================================
   FRENTE 2 · PROFUNDIZACION
   Cinco mapas de cohorte y nada mas. La historia, en este orden:

     1. ACTIVAS     ¿arrancan?            >= 1 solicitud
     2. EXITOSAS    ¿arrancan de verdad?  >= 3 solicitudes o >= 1 desembolso
     3. INACTIVAS   ¿se enfrian?          30+ dias sin radicar
     4. DESEMBOLSOS ¿cuanta plata dejan?  numero y COP
     5. MUERTAS     ¿cuantas se pierden?  mas de 90 dias sin radicar

   Los tres primeros y el quinto son ACUMULADOS de estado al cierre del mes
   N despues de la cosecha. Activas y exitosas solo suben (una sede que ya
   radico no puede des-radicar). Inactivas y muertas NO son acumuladas: son
   una foto del estado a ese mes, asi que pueden bajar si la sede vuelve.

   Denominador de todos: las sedes de la cosecha que se pueden cruzar por
   id_internal contra la plataforma. Las de HubSpot sin id_internal no
   entran porque no hay llave para saber si aplicaron; van declaradas.

   Inactiva y muerta se miden SOLO sobre las que alguna vez radicaron: una
   sede que nunca radico no se "enfrio", nunca arranco, y eso ya lo dice el
   mapa 1. Si se contaran ahi, inactivas seria casi igual al total y el mapa
   no diria nada.
   ===================================================================== */
function armarF2_(R, ev, cfg, U, comparar) {
  var f = {};
  var MAXM = 7;
  var hoyMes = hoyISO_().substring(0, 7);

  function mesMasF2_(c, k) {
    if (!/^\d{4}-\d{2}$/.test(String(c || ''))) return '';
    var t = Number(c.substring(0, 4)) * 12 + (Number(c.substring(5, 7)) - 1) + k;
    return ('0000' + Math.floor(t / 12)).slice(-4) + '-' + ('0' + (t % 12 + 1)).slice(-2);
  }

  // ---- Cosechas, por GRUPO -----------------------------------------
  // Grupo A = el universo del filtro global (U.filas, ya cortado por origen
  // y por rol). Grupo B = el preset elegido en el comparador, tomado de
  // U.base para que traiga el MISMO universo (regla de plataforma + roles)
  // pero otro origen. Sin eso la comparacion mezclaria dos poblaciones.
  // LA FECHA DE LA COSECHA — UNA SOLA, ACORDADA CON BI (7-sep-2026).
  //
  // Es la MAS TEMPRANA entre la creacion de la ficha en HubSpot y la
  // vinculacion en la plataforma. En BigQuery vive como
  // fecha_minima_admin_hubspot, en la vista welli-data.data_ops.v_datos_hubspot,
  // y aca se recalcula desde las dos fuentes originales.
  //
  // Se puede recalcular en vez de leer la vista porque se valido llave por
  // llave: 3.743 de 3.743 fechas identicas, cero diferencias. Y hay una
  // razon para preferir el recalculo: el lado de HubSpot de esa vista es una
  // tabla EXTERNAL sobre un CSV estatico del 4-sep, asi que para una sede
  // creada despues la vista se queda vieja y esto no.
  //
  // Antes habia un selector con tres relojes ('crm', 'vinc', 'final').
  // Existia para poder discutir con BI cual era la definicion correcta. Ya
  // se decidio, asi que el selector sobra: dejarlo puesto invita a leer el
  // mapa con una regla que el otro equipo no usa, que es exactamente el
  // problema que veniamos a cerrar.
  //
  // Por que la mas temprana y no una de las dos: la ficha y la cuenta no se
  // crean el mismo dia, y el desfase va en las dos direcciones. A veces la
  // sede opera semanas antes de tener ficha (en enero-2026 se cargaron 41
  // fichas de golpe el dia 16 a las 17:44, de sedes vinculadas hasta 97 dias
  // antes); a veces el prospecto entra al CRM y se vincula despues (mediana
  // 14 dias). El primer evento pone las dos direcciones bajo la misma regla.
  //
  // Verificado con el test que decide — sedes con solicitudes ANTERIORES a
  // su propia cosecha, que es fisicamente imposible: 6,0% con la fecha de
  // HubSpot sola, 0,4% con la de vinculacion sola, 0,4% con esta.
  var vincDiaDe = U.vincDiaDe || {};

  function cosechaDe_(s) {
    var iid = String(s.id_internal || '').trim();
    var fc = String(s.fecha_creacion || '').substring(0, 10);
    var fv = String(vincDiaDe[iid] || '').substring(0, 10);
    if (fc && fv) return (fc < fv ? fc : fv).substring(0, 7);
    return (fc || fv).substring(0, 7);
  }

  // Mes en que cada sede SALE de Customer Success hacia Farmer. Es el dato
  // que zanja la discusion de atribucion: en vez de suponer que el traspaso
  // ocurre en M2, se mide.
  //
  // Sale de fecha_salida_pipeline_cs, que es la propiedad acordada con BI, y
  // no de fecha_entrada_farmer, que se venia usando. La diferencia importa y
  // se midio sobre las 1.969 sedes que alguna vez entraron a CS:
  //   fecha_salida_pipeline_cs  llena en 0,9% de las que NUNCA entraron a CS
  //                             y 0,1% de salidas anteriores a la entrada
  //   fecha_salida_cs           81,3% y 0,6%
  //   fecha_entrada_farmer      92,9% y 2,9%
  // Que las otras dos esten llenas para sedes que nunca pasaron por CS
  // significa que miden otra cosa; la acordada es la unica limpia.
  // Quien ENTRO a Customer Success. Es el denominador honesto del mapa de
  // salida: una sede que nunca entro no puede salir, y meterla en el
  // denominador diluye el porcentaje con sedes que no pasaron por ese
  // embudo.
  //
  // Esto es lo que explica el desajuste contra el mapa de exitosas. CS no
  // fue universal desde el principio: de la cosecha de febrero solo el 31%
  // entro a CS, y de mayo en adelante el 91-100%. Con el denominador de la
  // cosecha completa, febrero se ve como si CS hubiera fallado, cuando lo
  // que pasa es que 126 de sus 183 sedes nunca estuvieron ahi.
  var entroCS = {};
  (U.base || []).forEach(function (s) {
    var iid = String(s.id_internal || '').trim();
    if (iid && String(s.cs_fecha_entrada || '').trim()) entroCS[iid] = true;
  });

  var trasDe = {};
  var trasDia = {};
  (U.base || []).forEach(function (s) {
    var iid = String(s.id_internal || '').trim();
    var d = String(s.salida_cs || '').substring(0, 10);
    var t = d.substring(0, 7);
    if (iid && /^\d{4}-\d{2}$/.test(t)) {
      trasDe[iid] = t;
      trasDia[d] = (trasDia[d] || 0) + 1;
    }
  });

  // CUIDADO CON EL DIA. La propiedad se escribe por LOTES, no el dia en que
  // cada sede se graduo: hay dias con 171, 79 y 78 salidas de golpe. El
  // hecho de haber salido es confiable; el dia no, y por lo tanto el MES
  // tampoco del todo. Un mapa mensual que no lo diga hace leer "104 sedes
  // se graduaron en agosto" donde lo que hubo fue un proceso que las
  // estampo el 5 de agosto.
  //
  // Se mide en vez de escribirse a mano: dia de lote = 20 salidas o mas en
  // la misma fecha.
  var LOTE_MIN = 20;
  var trasTot = 0, trasLote = 0, trasLoteDias = [];
  Object.keys(trasDia).forEach(function (d) {
    trasTot += trasDia[d];
    if (trasDia[d] >= LOTE_MIN) {
      trasLote += trasDia[d];
      trasLoteDias.push({ dia: d, n: trasDia[d] });
    }
  });
  trasLoteDias.sort(function (a, b) { return b.n - a.n; });
  var trasAviso = trasLote
    ? 'Ojo con el mes: la propiedad se escribe por lotes, no el día en que ' +
      'cada sede se graduó. ' + fNumSrv_(trasLote) + ' de las ' +
      fNumSrv_(trasTot) + ' salidas (' +
      fPctSrv_(Math.round((trasLote / trasTot) * 1000) / 10) +
      ') caen en apenas ' + fNumSrv_(trasLoteDias.length) + ' fechas, la más ' +
      'grande el ' + trasLoteDias[0].dia + ' con ' +
      fNumSrv_(trasLoteDias[0].n) + '. Así que una celda alta puede ser un ' +
      'proceso que estampó muchas sedes ese día, no un mes de muchas ' +
      'graduaciones. Lo que sí es confiable es el acumulado al final: ' +
      'cuántas ya salieron.'
    : '';

  var sinIdTot = 0;
  function cosechasDe_(filas) {
    var cos = {};
    filas.forEach(function (s) {
      var c = cosechaDe_(s);
      if (!/^\d{4}-\d{2}$/.test(c) || esCargaInicial_(c)) return;
      if (c < COSECHA_PISO_F2) return;
      if (!cos[c]) cos[c] = { cosecha: c, ids: [], total: 0, sinId: 0 };
      var b = cos[c];
      b.total++;
      var id = String(s.id_internal || '').trim();
      if (id) b.ids.push(id);
      else { b.sinId++; sinIdTot++; }
    });
    return cos;
  }
  var cos = cosechasDe_(U.filas);

  var cmpKey = String(comparar || '').trim();
  var cmpOrig = {};
  (PRESETS_ORIGEN[cmpKey] || []).forEach(function (o) { cmpOrig[o] = true; });
  var hayCmp = !!cmpKey && !!PRESETS_ORIGEN[cmpKey] &&
    (PRESETS_ORIGEN[cmpKey].length > 0);
  var cosB = hayCmp
    ? cosechasDe_((U.base || []).filter(function (s) {
        return !!cmpOrig[normOrigen_(s.origen)];
      }))
    : null;

  // ---- Estado de cada sede al cierre de cada mes --------------------
  var em = leerHoja_('SEDE_ESTADO_MES');
  var estado = {};                    // mes -> id -> fila
  em.forEach(function (r) {
    var m = String(r.mes || '').substring(0, 7);
    if (!estado[m]) estado[m] = {};
    estado[m][String(r.id_sede || '').trim()] = r;
  });

  // La lista de cosechas es la UNION de los dos grupos: si marketing arranco
  // en enero y comercial en noviembre, la tabla tiene que mostrar las dos sin
  // que una desaparezca.
  var setCos = {};
  Object.keys(cos).forEach(function (c) { setCos[c] = true; });
  if (cosB) Object.keys(cosB).forEach(function (c) { setCos[c] = true; });
  var cosechas = Object.keys(setCos).sort();

  /** Construye un mapa: para cada cosecha, el valor en M0..M7.
      medir(fila, ids) recibe el estado del mes y devuelve {n, extra}. */
  function mapa_(medir, cosSet, cosLista, base) {
    cosSet = cosSet || cos;
    return (cosLista || cosechas).filter(function (c) {
      return !!cosSet[c];
    }).map(function (c) {
      var b = cosSet[c];
      var celdas = [], extras = [];
      for (var k = 0; k <= MAXM; k++) {
        var m = mesMasF2_(c, k);
        if (!m || m > hoyMes) { celdas.push(null); extras.push(null); continue; }
        var idx = estado[m] || {};
        var v = medir(idx, b.ids, m);
        celdas.push(v.n);
        extras.push(v.extra === undefined ? null : v.extra);
      }
      // nBase: denominador propio del mapa, cuando la cosecha completa no
      // es la base correcta. El mapa de salida de CS lo usa porque su
      // universo son las sedes que entraron a CS, no todas.
      var fila = { cosecha: c, n: b.total, sinId: b.sinId,
                   cruzables: b.ids.length, celdas: celdas, extras: extras };
      if (base) {
        fila.nBase = b.ids.filter(function (id) { return base[id]; }).length;
      }
      return fila;
    }).filter(function (r) { return r.n > 0; });
  }

  function contar_(idx, ids, cond) {
    var n = 0;
    ids.forEach(function (id) {
      var r = idx[id];
      if (r && cond(r)) n++;
    });
    return { n: n };
  }

  // 1 · ACTIVAS -------------------------------------------------------
  var MEDIR = {};
  MEDIR.activas = function (idx, ids) {
    return contar_(idx, ids, function (r) { return num_(r.apps_acum) >= 1; });
  };

  // 2 · EXITOSAS ------------------------------------------------------
  MEDIR.exitosas = function (idx, ids) {
    return contar_(idx, ids, function (r) {
      return num_(r.apps_acum) >= 3 || num_(r.des_acum) >= 1;
    });
  };

  // 3 · INACTIVAS -----------------------------------------------------
  MEDIR.inactivas = function (idx, ids) {
    return contar_(idx, ids, function (r) {
      var d = num_(r.dias_sin_app);
      return num_(r.apps_acum) >= 1 && d >= 30 && d <= 90;
    });
  };

  // 3.5 · TRASPASO A FARMER -------------------------------------------
  // Acumulado: al mes N, cuantas sedes de la cosecha ya habian SALIDO de
  // Customer Success. Se mide con fecha_salida_pipeline_cs, que es la
  // propiedad acordada con BI el 7-sep-2026, y no con fecha_entrada_farmer,
  // que es lo que se usaba antes.
  //
  // El cambio no es cosmetico. Sobre las 1.969 sedes que alguna vez
  // entraron a CS, fecha_entrada_farmer esta llena en el 92,9% de las que
  // NUNCA entraron a CS y tiene 2,9% de salidas anteriores a la entrada;
  // la acordada, 0,9% y 0,1%. Las otras candidatas miden otra cosa.
  //
  // Este mapa existe para que nadie tenga que creerle a nadie: puesto al
  // lado de cualquier otro, dice que porcion de cada celda ya no era de
  // Customer Success.
  //
  // No usa el indice `estado` porque el traspaso no depende del mes de
  // cierre sino de una fecha fija por sede: se compara contra el mes de la
  // celda, que mapa_ pasa en `mesCelda`.
  MEDIR.traspaso = function (idx, ids, mesCelda) {
    var n = 0;
    ids.forEach(function (id) {
      var t = trasDe[id];
      if (t && mesCelda && t <= mesCelda) n++;
    });
    return { n: n };
  };

  // 4 · DESEMBOLSOS -----------------------------------------------------
  // Pedido de Emmanuel 24-sep-2026: n tiene que ser CUANTAS SEDES
  // desembolsan, no cuantos desembolsos hubo (una sede con 3 creditos
  // contaba como 3, no como 1) -- asi se puede sacar el % contra la
  // cosecha igual que activas/exitosas. La plata sigue siendo la suma
  // acumulada de esas sedes.
  MEDIR.desembolsos = function (idx, ids) {
    var n = 0, monto = 0;
    ids.forEach(function (id) {
      var r = idx[id];
      if (!r) return;
      if (num_(r.des_acum) >= 1) n++;
      monto += num_(r.monto_acum);
    });
    return { n: n, extra: monto };
  };

  // 5 · MUERTAS -------------------------------------------------------
  MEDIR.muertas = function (idx, ids) {
    return contar_(idx, ids, function (r) {
      return num_(r.apps_acum) >= 1 && num_(r.dias_sin_app) > 90;
    });
  };

/* El complemento EXACTO del mapa de "activas": de las sedes cruzables de la
   cosecha (con id_internal, las unicas que se pueden medir contra
   SEDE_ESTADO_MES), cuantas siguen en CERO solicitudes a ese mes. Se deriva
   restando "activas" de "cruzables" celda por celda -- no hace falta una
   query nueva, y no puede desincronizarse del mapa de activas porque nace
   de el.

   Pedido 16/17-sep-2026, a raiz de reconciliar contra la query de la jefa
   de Emmanuel: su bucket "Muerto" mezclaba dos poblaciones -- sedes que
   aplicaron y llevan 90+ dias sin volver (nuestra "muerta") Y sedes que
   NUNCA aplicaron y ya son viejas (algo que el tablero no mostraba en
   ningun mapa de cosecha). "Nunca vivas" es esa segunda poblacion,
   aislada: nunca cruzo la puerta ni una vez.

   El denominador NO es la cosecha completa (b.n): las sedes SIN
   id_internal no tienen como cruzarse contra SEDE_ESTADO_MES, asi que no
   se puede saber si aplicaron o no -- se excluyen del % (mismo patron que
   el mapa de traspaso a CS, que divide por "las que entraron a CS" y no
   por la cosecha completa). */
function nuncaVivas_(filasActivas) {
  return filasActivas.map(function (r) {
    var celdas = r.celdas.map(function (c) {
      return (c === null || c === undefined) ? null : r.cruzables - c;
    });
    // extras tiene que ser un ARREGLO (de nulls), no null a secas:
    // promedio_ hace r.extras[k] sin chequear que exista.
    var extras = celdas.map(function () { return null; });
    return { cosecha: r.cosecha, n: r.n, sinId: r.sinId,
             cruzables: r.cruzables, celdas: celdas, extras: extras,
             nBase: r.cruzables };
  });
}

/* Deriva el mapa "sin acumular" del acumulado: MISMAS sedes por celda (para
   que los dos mapas se hablen restando columnas), pero la plata sí es solo
   la de ese mes puntual. Pedido de Emmanuel 24-sep-2026: antes 'sedes' de
   este mapa media actividad real del mes (incluyendo sedes que ya habian
   desembolsado antes y volvieron a hacerlo), lo que hacia que 49-20=29 en
   el acumulado no calzara con el 38 de aca -- correcto desde el punto de
   vista de negocio, pero confuso porque las dos tablas no se hablaban en
   sedes. Ahora comparten la MISMA columna de sedes; solo cambia la plata. */
function mesDineroSolo_(filas) {
  return filas.map(function (r) {
    var extras = [];
    var prevM = 0;
    for (var k = 0; k < r.celdas.length; k++) {
      if (r.celdas[k] === null || r.celdas[k] === undefined) {
        extras.push(null);
        continue;
      }
      extras.push((r.extras[k] || 0) - prevM);
      prevM = r.extras[k] || 0;
    }
    return { cosecha: r.cosecha, n: r.n, sinId: r.sinId,
             cruzables: r.cruzables, celdas: r.celdas.slice(), extras: extras };
  });
}

/* Corre los cinco medidores sobre un grupo de cosechas. El sexto mapa (la
   plata sin acumular) se deriva del cuarto vía mesDineroSolo_, asi que sale
   gratis y nunca puede desincronizarse en sedes. */
function mapasDe_(cosSet) {
  var m = {};
  ['activas', 'exitosas', 'inactivas', 'desembolsos', 'muertas']
    .forEach(function (k) { m[k] = mapa_(MEDIR[k], cosSet); });
  // El mapa de salida de CS lleva su propio denominador: las sedes de la
  // cosecha que ENTRARON a CS. Con la cosecha completa, febrero se leia
  // como un fracaso de CS cuando lo que pasa es que 126 de sus 183 sedes
  // nunca estuvieron en ese pipeline.
  m.traspaso = mapa_(MEDIR.traspaso, cosSet, null, entroCS);
  m.desembolsos_mes = mesDineroSolo_(m.desembolsos);
  return m;
}
var A = mapasDe_(cos);
var B = cosB ? mapasDe_(cosB) : null;
// nuncavivas no sale de mapasDe_ (es un complemento derivado de activas,
// no un MEDIR nuevo) -- se agrega aca para que el grupo B del comparador
// tambien lo tenga, igual que los demas mapas.
if (B) B.nuncavivas = nuncaVivas_(B.activas);

/** Titular de un mapa: la ultima celda cerrada de la cosecha mas madura
      con al menos 20 sedes, para no titular con una muestra de 3. */
  function ultimo_(filas) {
    var mejor = null;
    filas.forEach(function (r) {
      if (r.n < 20) return;
      for (var k = r.celdas.length - 1; k >= 0; k--) {
        if (r.celdas[k] !== null) {
          if (!mejor || k > mejor.k) mejor = { cosecha: r.cosecha, k: k, n: r.celdas[k], de: r.n };
          break;
        }
      }
    });
    return mejor;
  }

  /* PROMEDIO por columna. Para los mapas de % es la tasa AGRUPADA (suma de
     n sobre suma de sedes de las cosechas que ya llegaron a ese mes), no el
     promedio de los porcentajes: promediar tasas de cohortes de 60 y de 241
     sedes le da el mismo peso a las dos y no es lo que pasa en la realidad.

     Para los mapas de plata es el promedio POR COSECHA (suma / cuantas
     llegaron a ese mes), que es lo comparable con la celda de una cosecha.

     En las dos, el denominador son solo las cosechas CON dato en esa columna:
     M7 promedia dos cosechas y M0 promedia ocho, y mezclarlas seria comparar
     cosas distintas. */
  function promedio_(filas, esMonto) {
    if (!filas.length) return null;
    var celdas = [], extras = [], cuantas = [];
    for (var k = 0; k <= MAXM; k++) {
      var sn = 0, sm = 0, sSedes = 0, n = 0;
      filas.forEach(function (r) {
        if (r.celdas[k] === null || r.celdas[k] === undefined) return;
        sn += r.celdas[k];
        sm += (r.extras[k] || 0);
        sSedes += r.n;
        n++;
      });
      cuantas.push(n);
      if (!n) { celdas.push(null); extras.push(null); continue; }
      // La plata (extras) SIEMPRE se promedia por cosecha (sm/n), tenga o
      // no % la celda -- desde 24-sep-2026 hay mapas (desembolsos,
      // desembolsos_mes) que muestran sedes-con-% Y plata a la vez.
      extras.push(Math.round(sm / n));
      if (esMonto) {
        celdas.push(Math.round(sn / n));
      } else {
        // n de la celda = total, y el % sale de dividirlo por sSedes. Se
        // guarda sSedes como 'base' para que el frontend calcule la tasa
        // agrupada en vez de dividir por el total de una cosecha.
        celdas.push(sn);
      }
    }
    // La base del promedio tiene que ser la MISMA que la de las filas: si
    // una fila divide por las sedes que entraron a CS y el promedio divide
    // por la cosecha completa, la ultima fila contradice a las de arriba.
    var base = [];
    for (var k2 = 0; k2 <= MAXM; k2++) {
      var sS = 0;
      filas.forEach(function (r) {
        if (r.celdas[k2] === null || r.celdas[k2] === undefined) return;
        sS += (r.nBase === undefined ? r.n : r.nBase);
      });
      base.push(sS);
    }
    var totSedes = 0;
    filas.forEach(function (r) {
      totSedes += (r.nBase === undefined ? r.n : r.nBase);
    });
    return { cosecha: 'PROMEDIO', n: esMonto ? filas.length : totSedes,
             celdas: celdas, extras: extras, base: base, cuantas: cuantas,
             esPromedio: true, esMonto: !!esMonto };
  }

  f.mapas = [
    { id: 'activas', orden: 1,
      titulo: 'Sedes activas',
      pregunta: '¿Cuántas de la cosecha llegaron a radicar al menos una solicitud?',
      sub: 'Acumulado: al mes N después de entrar, cuántas ya habían radicado. Solo sube.',
      def: 'activa = al menos 1 solicitud de crédito',
      formato: 'num', clase: 'acum', escala: '% de la cosecha ya activa',
      colN: 'Sedes', pctCelda: true, filas: A['activas'], ultimo: ultimo_(A['activas']) },

    { id: 'exitosas', orden: 2,
      titulo: 'Sedes exitosas',
      pregunta: '¿Cuántas pasaron de probar el sistema a usarlo?',
      sub: 'Acumulado. Con una sola solicitud no se distingue una sede que arrancó ' +
        'de una que probó una vez.',
      def: 'exitosa = 3 o más solicitudes, o al menos 1 desembolso',
      formato: 'num', clase: 'acum', escala: '% de la cosecha ya exitosa',
      colN: 'Sedes', pctCelda: true, filas: A['exitosas'], ultimo: ultimo_(A['exitosas']) },

    { id: 'desembolsos', orden: 3,
      titulo: 'Sedes que desembolsan · acumulado',
      pregunta: '¿Cuántas sedes de la cosecha ya desembolsaron al mes N, y cuánto?',
      sub: 'Acumulado: sedes con al menos 1 desembolso hasta ese mes, y toda la plata ' +
        'que han movido. Es el argumento de por qué una cosecha vale más que su mes ' +
        'de entrada. Pedido 24-sep-2026: antes esta celda sumaba DESEMBOLSOS (una ' +
        'sede con 3 créditos contaba como 3), no sedes.',
      def: 'desembolsa = al menos 1 crédito desembolsado; monto = plata acumulada',
      formato: 'num', clase: 'acum', escala: '% de la cosecha que ya desembolsó',
      colN: 'Sedes', pctCelda: true, conMonto: true,
      filas: A['desembolsos'], ultimo: ultimo_(A['desembolsos']) },

    { id: 'desembolsos_mes', orden: 4,
      titulo: 'Sedes que desembolsan · plata sin acumular',
      pregunta: '¿Cuánta plata se desembolsó justo en ESE mes, con las mismas sedes de arriba?',
      sub: 'Mismo conteo de sedes que el mapa de arriba (acumulado) — los dos se ' +
        'hablan restando columnas. Lo único que cambia es la plata: aquí es solo la ' +
        'de ese mes puntual, no la acumulada, así que se ve en qué mes de vida pica ' +
        'una cosecha y en cuál se apaga.',
      def: 'sedes = mismo acumulado del mapa de arriba; monto = plata de ese mes, no acumulada',
      formato: 'num', clase: 'plata', escala: '% de la cosecha que ya desembolsó',
      colN: 'Sedes', pctCelda: true, conMonto: true,
      filas: A['desembolsos_mes'], ultimo: ultimo_(A['desembolsos_mes']) },

    { id: 'traspaso', orden: 5,
      titulo: 'Salida de Customer Success',
      pregunta: '¿En qué mes dejó de ser de Customer Success?',
      sub: 'Acumulado: al mes N, cuántas sedes de la cosecha ya habían salido ' +
        'de CS hacia Farmer, medido con fecha_salida_pipeline_cs sede por ' +
        'sede — la propiedad acordada con BI. Puesto al lado de cualquier ' +
        'otro mapa dice qué porción de esa celda ya no era de Customer ' +
        'Success, que es lo que decide a quién se le atribuye.',
      nota: trasAviso,
      // Por que este mapa no cuadra con el de exitosas. La pregunta sale
      // sola al ponerlos lado a lado, asi que mejor contestarla aca que
      // dejar que cada lector saque su propia conclusion.
      nota3: 'Este mapa NO cuadra celda por celda con «Sedes exitosas», y ' +
        'no es un error: son tres cosas distintas. (1) CS no fue universal ' +
        '— de la cosecha de febrero solo 56 de 183 sedes entraron a CS, y ' +
        'una sede que nunca entró no puede salir; por eso el denominador de ' +
        'este mapa son las que sí entraron, y va en la columna de sedes. ' +
        '(2) Salir de CS no es solo graduarse: 195 sedes de 2026 salieron ' +
        'sin ser exitosas, 102 de ellas con cero solicitudes — también se ' +
        'sale por rendirse o por limpieza de pipeline. (3) Quedan 43 sedes ' +
        'que entraron a CS, ya son exitosas y no tienen fecha de salida: ' +
        'ese sí es el hueco de dato.',
      nota2: 'Y la cobertura de la propiedad no es uniforme: llega al 95% ' +
        'en las sedes que entraron a CS en abril y mayo, pero solo al 25% ' +
        'de las 969 que entraron en febrero, que fue una carga masiva. Las ' +
        'cosechas de julio en adelante se ven bajas por otra razón, y es la ' +
        'correcta: esas sedes todavía están en CS.',
      def: 'sedes ya entregadas a Farmer, sobre las que ENTRARON a CS',
      formato: 'num', clase: 'acum', escala: '% de la cosecha ya entregada',
      colN: 'Sedes', pctCelda: true,
      filas: A['traspaso'], promedio: promedio_(A['traspaso'], false),
      filasB: B ? B['traspaso'] : null,
      promedioB: B ? promedio_(B['traspaso'], false) : null,
      ultimo: ultimo_(A['traspaso']) },

    { id: 'inactivas', orden: 6,
      titulo: 'Sedes inactivas',
      pregunta: '¿Cuántas dejaron de radicar y todavía se pueden recuperar?',
      sub: 'Foto del estado a ese mes, NO acumulado: puede bajar si la sede vuelve. ' +
        'Solo cuenta sedes que alguna vez radicaron.',
      def: 'inactiva = entre 30 y 90 días sin radicar',
      formato: 'num', clase: 'riesgo', escala: '% de la cosecha inactiva',
      colN: 'Sedes', pctCelda: true, filas: A['inactivas'], ultimo: ultimo_(A['inactivas']) },

    { id: 'muertas', orden: 7,
      titulo: 'Sedes muertas',
      pregunta: '¿Cuántas ya no vuelven?',
      sub: 'Foto del estado a ese mes. Más de 90 días sin radicar es el umbral de la ' +
        'casa para dar una sede por perdida.',
      def: 'muerta = más de 90 días sin radicar',
      formato: 'num', clase: 'muerte', escala: '% de la cosecha muerta',
      colN: 'Sedes', pctCelda: true, filas: A['muertas'], ultimo: ultimo_(A['muertas']) },

    // Pedido 16/17-sep-2026: aisla la poblacion que "muertas" NUNCA
    // incluyo -- sedes que jamas radicaron ni una sola solicitud. Se
    // encontro reconciliando contra una query externa cuyo bucket
    // "Muerto" mezclaba esta poblacion con la de "muertas" de arriba.
    { id: 'nuncavivas', orden: 8,
      titulo: 'Sedes que nunca han hecho nada',
      pregunta: '¿Cuántas de la cosecha jamás llegaron a radicar ni una sola solicitud?',
      sub: 'Es lo contrario de "Sedes activas": empieza alta y BAJA con el tiempo, ' +
        'a medida que algunas por fin radican su primera solicitud. No es lo ' +
        'mismo que "muertas" — una sede muerta sí llegó a probar el producto ' +
        'y dejó de volver; esta nunca llegó a probarlo.',
      def: 'nunca viva = cero solicitudes de crédito hasta ese mes',
      nBaseEtq: 'con id_internal (cruzables)',
      formato: 'num', clase: 'muerte', escala: '% de la cosecha que nunca ha aplicado',
      colN: 'Sedes', pctCelda: true, filas: nuncaVivas_(A['activas']),
      ultimo: ultimo_(nuncaVivas_(A['activas'])) }
  ];

  // A cada mapa se le cuelga su promedio y, si hay comparacion, las filas del
  // grupo B con su propio promedio. El frontend intercala.
  f.mapas.forEach(function (m) {
    // Si el mapa tiene %, la celda SIEMPRE es tasa agrupada (suma), aunque
    // tambien traiga plata -- conMonto ya no basta solo para decidirlo
    // desde que 'desembolsos'/'desembolsos_mes' tienen las dos cosas.
    var esMonto = !!m.conMonto && !m.pctCelda;
    m.promedio = promedio_(m.filas, esMonto);
    if (B) {
      m.filasB = B[m.id] || [];
      m.promedioB = promedio_(m.filasB, esMonto);
    }
  });

  // El reloj activo se declara SIEMPRE en pantalla. Un mapa de cohortes sin
  // decir con que fecha se armo es exactamente lo que produjo la discusion
  // entre Growth y BI.
  // ---- LA ESCALERA DEL UNIVERSO ---------------------------------------
  // Acordado con BI el 9-sep-2026: el tablero ya NO resta nada de esto —
  // deshabilitada, sin id_internal, sin plataforma y de otro pais se
  // cuentan pero no excluyen, porque BI tampoco lo hace y era exactamente
  // la fuente de que los dos conteos de cosecha nunca cuadraran exacto. La
  // escalera se deja en pantalla para declarar la CALIDAD del dato (cuantas
  // fichas tienen cada problema), no para explicar un recorte que ya no
  // existe.
  var uv = U.universo || {};
  f.escalera = {
    filas: [
      { paso: 'Fichas de sede en HubSpot', n: num_(uv.totalHubSpot),
        signo: 0, nota: 'todo el objeto Sedes, sin filtrar' },
      { paso: 'Deshabilitadas', n: -num_(uv.deshabilitadas), signo: -1,
        nota: 'pipeline Aliados_deshabilitados: aliados con los que ya no ' +
          'operamos, y varias son fichas duplicadas del mismo consultorio. ' +
          'Se cuentan pero YA NO SE RESTAN (acordado con BI el 9-sep-2026): ' +
          'sigen sumando a los mapas igual que en su tablero.' },
      { paso: 'Sin id_internal', n: -num_(uv.sinId), signo: -1,
        nota: 'no se pueden cruzar con la plataforma, así que no se les ' +
          'puede medir actividad de créditos — pero sí cuentan como sede ' +
          'de su cosecha, igual que en BI.' },
      { paso: 'No existen en la plataforma', n: -num_(uv.noPlataforma),
        signo: -1, nota: 'el id_internal no aparece en institucion_medica; ' +
          'igual cuentan en la cosecha.' },
      { paso: 'De otro país', n: -num_(uv.otroPais), signo: -1,
        nota: 'informativo — ya no se excluye ninguna sede por país.' },
      // baseSinFiltro y NO totalBase: el segundo se mueve con los filtros
      // de origen y rol, y hacia que la escalera no cerrara y se
      // contradijera con su propia nota.
      { paso: 'Sedes que entran a los mapas (= fichas de HubSpot, sin recortes)',
        n: num_(uv.baseSinFiltro),
        signo: 0, nota: 'ya no se le resta nada a este número: es la misma ' +
          'regla que usa BI. Antes del 9-sep-2026 salían de acá las cuatro ' +
          'filas de arriba.' }
    ],
    // La exclusion que va en direccion contraria y que el tablero no puede
    // ver solo: arranca de HubSpot, asi que una cuenta de plataforma sin
    // ficha sigue siendo invisible (no hay ficha de la que colgarla).
    //
    // SE PROBO inyectarlas como sede sintetica (9-sep-2026) para que este
    // numero cuadrara exacto con BI, y midio PEOR: el error promedio contra
    // las cosechas reales de BI subio de 2,50 a 4,17 sedes/mes (enero pasó
    // de +3 a +17). Conclusion: BI tampoco las ve — su reporte no arranca
    // de institucion_medica cruda, arranca de algo tambien ligado a
    // HubSpot — asi que la brecha de 1 a 7 sedes/mes que queda es la real,
    // no un hueco que se pueda cerrar inyectando cuentas.
    invisibles: num_(uv.platSinFicha),
    ignoraFiltro: !U.sinFiltro,
    totalConFiltro: num_(U.total),
    notaInvisibles: 'Además hay ' + num_(uv.platSinFicha) + ' cuentas ' +
      'vinculadas en la plataforma (país COL) que ninguna ficha de HubSpot ' +
      'referencia. El tablero arranca del CRM, así que esas sedes no ' +
      'aparecen en ningún mapa — y probablemente tampoco en el de BI: se ' +
      'probó inyectarlas para cuadrar exacto y el error subió, no bajó ' +
      '(ver nota de código). Es la única brecha de universo que queda ' +
      'después del 9-sep-2026, y es chica (del orden de 1 a 7 sedes/mes).'
  };

  // La fecha de la cosecha, declarada en pantalla. Ya no es un selector:
  // es UNA definicion acordada con BI, y decir cual es en la propia pestana
  // es lo que evita que la proxima reunion vuelva a discutir el dato.
  // Cuantas cuentas de otro pais trae la vista de BI en cada cosecha de
  // 2026. Se cuenta en vez de escribirse a mano: es el numero con el que se
  // les pide el filtro, y un numero viejo en esa conversacion cuesta caro.
  var perMes = {}, perTot = 0;
  (function () {
    var pais = U.paisDe || {}, dias = U.vincDiaDe || {};
    Object.keys(pais).forEach(function (id) {
      if (pais[id] === 'COL') return;
      var m = String(dias[id] || '').substring(0, 7);
      if (!/^\d{4}-\d{2}$/.test(m) || m < COSECHA_PISO_F2) return;
      perMes[m] = (perMes[m] || 0) + 1;
      perTot++;
    });
  }());
  var perTxt = Object.keys(perMes).sort().map(function (m) {
    return fNumSrv_(perMes[m]) + ' en ' + m;
  }).join(', ');

  f.fechaCosecha = {
    campo: 'fecha_minima_admin_hubspot',
    vista: 'welli-data.data_ops.v_datos_hubspot',
    acordada: '2026-09-09',
    nota: 'Las cosechas usan la FECHA UNIFICADA: por cada sede, la más ' +
      'temprana entre la creación de la ficha en HubSpot y la vinculación ' +
      'en la plataforma. Es la misma que BI publica como ' +
      'fecha_minima_admin_hubspot, validada llave por llave — 3.743 de ' +
      '3.743 fechas idénticas, cero diferencias.',
    notaUniverso: 'Universo: todas las fichas de HubSpot, sin ningún ' +
      'recorte (ni país, ni deshabilitadas, ni sin plataforma) — acordado ' +
      'con BI el 9-sep-2026, porque la fecha ya coincidía desde el 7-sep y ' +
      'aun así las cosechas no cuadraban: la causa era que el tablero SÍ ' +
      'recortaba y BI no. Con el mismo recorte que BI (ninguno), las ' +
      'cosechas de 2026 quedan a 1-7 sedes por mes, contra 20-40 antes.' +
      (perTot
        ? ' Queda sólo ' + fNumSrv_(perTot) + ' cuentas de otro país en ' +
          'las cosechas de 2026 (' + perTxt + '), que ya no se excluyen.'
        : ''),
    otroPais: perTot,
    otroPaisPorMes: perMes,
    // El recalculo local no es un atajo: es mas fresco que la vista.
    notaFrescura: 'El tablero recalcula la fecha desde las dos fuentes en ' +
      'vez de leer la vista, porque el lado de HubSpot de esa vista es una ' +
      'tabla EXTERNAL sobre un CSV estático del 4-sep. Para una sede creada ' +
      'después, la vista se queda vieja y esto no.'
  };

  f.comparar = {
    activo: !!B,
    clave: cmpKey,
    etiquetaA: U.todos ? 'Todos los orígenes' : U.etiqueta,
    etiquetaB: B ? (ETIQUETA_PRESET[cmpKey] || cmpKey) : '',
    // Los presets que se pueden elegir, con su conteo de sedes en el universo
    // actual: un grupo con cero sedes no es una comparacion util.
    opciones: Object.keys(PRESETS_ORIGEN).filter(function (k) {
      return PRESETS_ORIGEN[k].length > 0;
    }).map(function (k) {
      var set = {}, n = 0;
      PRESETS_ORIGEN[k].forEach(function (o) { set[o] = true; });
      (U.base || []).forEach(function (x) {
        if (set[normOrigen_(x.origen)]) n++;
      });
      return { clave: k, nombre: ETIQUETA_PRESET[k] || k, sedes: n };
    }).filter(function (o) { return o.sedes > 0; })
  };

  f.hay = cosechas.length > 0;
  f.universo = U.etiqueta;
  f.sinId = sinIdTot;
  f.cosechas = cosechas.length;
  f.offsets = MAXM;
  f.notaCarga = 'Desde ' + COSECHA_PISO_F2 + ': las cosechas de 2025 arrastran ' +
    'la migración a HubSpot (la de ' + COSECHA_CARGA_INICIAL + ' son 1.922 sedes ' +
    'cargadas de golpe) y un pipeline que ya no existe.';

  f.textos = { funcionando: cfg.f2_funcionando || '', cuello: cfg.f2_cuello || '',
               atencion: cfg.f2_atencion || '', fecha: cfg.textos_fecha || '' };
  return f;
}

// =====================================================================
// FRENTE 4 — Rescate de créditos estancados
// =====================================================================

function armarF4_(R, gran, cfg, estado, U) {
  var f = {};

  // ---- FUERA CREDITUP -------------------------------------------------
  // CreditUp es una tablet en el mostrador de la clinica: el paciente ve a
  // Welli, Addi y otros al mismo tiempo y elige ahi. No hay ventana de 30
  // dias que trabajar — si no nos eligio, ya eligio a otro. Ese credito no
  // es un "aprobado sin firmar" esperando una llamada, es un credito
  // perdido en el mostrador, y meterlo en la bolsa infla el denominador con
  // casos que nadie podia rescatar.
  //
  // ALCANCE REAL, que hay que tener presente: se filtra por origen de la
  // SEDE (11 clinicas con origen CREDITOP), porque es la unica marca que
  // existe hoy. Eso es 0,2% de los aprobados del periodo. Si el volumen de
  // verdad esta marcado por SOLICITUD — que es lo que el negocio describe —
  // ese campo vive en welli-data.data_ops.t_solicitudes y hay que traerlo:
  // con lo de hoy el filtro es correcto pero casi no mueve nada, y decirlo
  // es mejor que dejar creer que CreditUp ya salio.
  //
  // Ojo con una cosa mas: estas 11 sedes firman MAS TARDE que el resto
  // (46,9% despues del dia 4, contra 12,9%), no mas temprano. Con 32 firmas
  // medidas no alcanza para concluir nada, pero es lo contrario de lo que
  // predice el flujo de mostrador.
  // Se arma por las TRES llaves con las que las distintas tablas nombran
  // una sede, porque cada fuente trae una distinta: los hechos traen el id
  // de HubSpot, RESCATE_BQ2 trae el uuid de plataforma y las hojas de la
  // gestion traen el nombre. Con una sola llave el filtro se aplicaria en
  // un tercio del frente y nadie lo notaria.
  var ORIGEN_FUERA_RESCATE = { 'CREDITOP': true };
  var fueraResc = {}, fueraRescInt = {}, fueraRescNom = {}, fueraRescN = 0;
  sedesReatribuidas_().forEach(function (s) {
    if (!ORIGEN_FUERA_RESCATE[normOrigen_(s.origen)]) return;
    fueraRescN++;
    var hs = String(s.id || '').trim();
    if (hs) fueraResc[hs] = true;
    var iid = String(s.id_internal || '').trim();
    if (iid) fueraRescInt[iid] = true;
    var nm = normNombre_(s.nombre_sede);
    if (nm) fueraRescNom[nm] = true;
  });

  /** Recorre los hechos del frente 4: como recorrerHechos_ pero sin los
      origenes que no se pueden rescatar. Un wrapper y no un filtro dentro
      de recorrerHechos_ porque la exclusion es de ESTE frente: en F1 y F2
      esas sedes si cuentan, se ganaron igual. */
  function recorrerResc_(desde, hasta, cb) {
    recorrerHechos_(U, desde, hasta, function (r) {
      if (fueraResc[r.sede]) return;
      cb(r);
    });
  }


  // Inventario real: aprobados que no firmaron (HubSpot).
  // Se recalcula desde el universo elegido en vez de leer la hoja
  // pre-agregada, que ignoraba el filtro de origen.
  var invTot = 0, inv30 = 0, inv60 = 0, invSedes = 0;
  U.filas.forEach(function (r) {
    var t = num_(r.aprobados_no_firmados);
    if (t > 0) { invTot += t; invSedes++; }
    inv30 += num_(r.aprob_no_firmados_30d);
    inv60 += num_(r.aprob_no_firmados_60d);
  });
  function iv(k) {
    if (k === 'Aprobados sin firmar (total)') return invTot;
    if (k === 'Aprobados sin firmar (30d)') return inv30;
    if (k === 'Aprobados sin firmar (60d)') return inv60;
    if (k === 'Sedes con inventario') return invSedes;
    return 0;
  }

  // Resultado del rescate: sale de BigQuery, que hoy no está conectado.
  // RESCATE_BQ2 = lo mismo que RESCATE_BQ pero con id_sede, asi que el
  // filtro de origen cruza por llave (99,0% de las filas) y no por nombre.
  var bq = leerHoja_('RESCATE_BQ2');
  if (!bq.length) bq = leerHoja_('RESCATE_BQ');       // respaldo
  bq = bq[0] && bq[0].id_sede !== undefined
    ? filtrarPorId_(bq, 'id_sede', U)
    : filtrarPorNombre_(bq, 'sede', U);
  // Y fuera CREDITOP tambien de aca: esta tabla alimenta el reparto por
  // dia y la lectura de las tres ventanas, que se muestra en pantalla.
  if (fueraRescN) {
    bq = bq.filter(function (r) {
      return !fueraRescInt[String(r.id_sede || '').trim()] &&
             !fueraRescNom[normNombre_(r.sede)];
    });
  }
  var hayBQ = bq.length > 0;
  // RESCATE_BQ arranca el 1 de enero: mismo problema de cobertura que
  // EMBUDO_MKT. Si el periodo anterior queda antes, no se compara.
  var primeraRes = primeraFecha_(bq, 'fecha_desembolso');
  var estBQ = estado['BigQuery'] || {};
  var notaBQ = 'Falta conexión con BigQuery' +
    (estBQ.detalle ? ' — ' + estBQ.detalle : '') +
    '. Se necesita profile_institucion + otp_log para saber quién desembolsó tras el contacto.';

  // Baldes por tiempo entre aprobación y desembolso. Los 'normal_*' son el
  // flujo sano (96,4% firma en 15 días o menos); rescate es la cola.
  var A = { resc: 0, montoResc: 0, total: 0, monto: 0, b: {}, m: {},
            dia: {}, diaMonto: {}, dentro30: 0, vent: {} };
  var P = { resc: 0, montoResc: 0, total: 0, monto: 0, b: {}, m: {},
            dia: {}, diaMonto: {}, dentro30: 0, vent: {} };
  var serie = {};
  bq.forEach(function (r) {
    var iso = fechaCelda_(r.fecha_desembolso);
    if (!iso) return;
    var dentro = (iso >= R.inicio && iso <= R.fin);
    var antes = (iso >= R.prevInicio && iso <= R.prevFin);
    if (!dentro && !antes) return;
    var bal = String(r.balde || '');
    var m = num_(r.monto);
    var b = dentro ? A : P;
    b.total++;
    b.monto += m;
    b.b[bal] = (b.b[bal] || 0) + 1;
    b.m[bal] = (b.m[bal] || 0) + m;
    // Histograma día por día. La columna cruda ya viene en la hoja, así que
    // no hace falta otra query: el reparto real dentro de la ventana es el
    // dato que decide CUÁNDO tiene que salir la pieza.
    var d = num_(r.dias_aprobado_a_desembolso);
    if (d >= 0 && d <= 30) {
      b.dia[d] = (b.dia[d] || 0) + 1;
      b.diaMonto[d] = (b.diaMonto[d] || 0) + m;
      b.dentro30++;
      // Ventana de decision segun la especialidad de la sede. Es la
      // definicion del negocio, no un balde estadistico.
      var v = ventanaDeEsp_((U.especialidadDe || {})[String(r.id_sede || '').trim()]);
      if (!b.vent[v.id]) {
        b.vent[v.id] = { id: v.id, n: 0, monto: 0, suma: 0, dia: {} };
      }
      var bv = b.vent[v.id];
      bv.n++;
      bv.monto += m;
      bv.suma += d;
      bv.dia[d] = (bv.dia[d] || 0) + 1;
    }
    // El monto que interesa es el de las firmas del día 16 al 30: es el
    // crédito que se salvó de vencerse.
    if (bal === 'normal_16_30') {
      b.montoResc += m;
      if (dentro) serie[iso] = (serie[iso] || 0) + 1;
    }
    if (bal.indexOf('rescate') === 0) b.resc++;
  });

  // ---- LA OPORTUNIDAD Y LO QUE CERRAMOS, POR VENTANA -------------------
  // Reemplaza la seccion de "plata sobre la mesa". Esa cifra era un STOCK
  // historico de 15.845 aprobados sin firmar: no es meta de nadie y no se
  // mueve con nada que hagamos este mes.
  //
  // Aca la pregunta es de cohorte y si tiene dueno: de los creditos que el
  // motor APROBO en el periodo, cuantos firmamos. Numerador y denominador son
  // el MISMO grupo de creditos, asi que "cerramos X de lo que podiamos" es una
  // division honesta. Y todo va contra el periodo anterior, que es la unica
  // referencia que dice si mejoramos.
  // La oportunidad y el cierre por ventana, tambien de la tabla de hechos.
  var AT4 = atribSede_(U);

  function cortarRv_(desde, hasta) {
    var t = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
    var porV = {}, porDia = {};
    recorrerResc_(desde, hasta, function (r) {
      var a = AT4[r.sede];
      var v = (a && a.ventana) ? a.ventana : '-';
      t.apr += r.apr; t.firm += r.conv; t.mApr += r.mApr; t.mFirm += r.mConv;
      if (!porV[v]) porV[v] = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      var b = porV[v];
      b.apr += r.apr; b.firm += r.conv; b.mApr += r.mApr; b.mFirm += r.mConv;
      if (!porDia[r.fecha]) {
        porDia[r.fecha] = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      }
      porDia[r.fecha].apr += r.apr;
      porDia[r.fecha].firm += r.conv;
      porDia[r.fecha].mApr += r.mApr;
      porDia[r.fecha].mFirm += r.mConv;
    });
    t.porV = porV;
    t.porDia = porDia;
    return t;
  }
  var rA = cortarRv_(R.inicio, R.fin);
  var rP = cortarRv_(R.prevInicio, R.prevFin);
  var hayRv = rA.apr > 0;

  function cierre_(b) { return b && b.apr ? (b.firm / b.apr) : null; }

  // ---- LA VENTANA: CUANTO TIEMPO TENEMOS -------------------------------
  // Solo las tres ventanas del negocio. Antes la tabla traia dos filas mas
  // — "Sede fuera de HubSpot" y "Especialidad sin ventana" — que no son
  // ventanas sino huecos de datos, y ademas repetian lo que ya decian las
  // tarjetas de abajo. Se sacan del desglose, pero NO se esconden: lo que
  // caia ahi se declara aparte, porque si no la suma de las tres ventanas
  // dejaria de cuadrar con los KPIs y eso se lee como un error del tablero.
  var ORDEN_V = ['C', 'B', 'A'];
  function filaVent_(v) {
    var a = rA.porV[v] || { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
    var p = rP.porV[v] || { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
    var cA2 = cierre_(a), cP2 = cierre_(p);
    var vv = ventanasOrdenadas_().filter(function (x) { return x.id === v; })[0];
    return {
      id: v, ventana: vv ? vv.nombre : 'Sin ventana',
      nombre: vv ? vv.nombre : 'Sin ventana asignada',
      especialidades: vv && vv.especialidades && vv.especialidades.length
        ? vv.especialidades.join(' · ') : '(sin clasificar)',
      comportamiento: vv ? vv.comportamiento : '',
      apr: a.apr, firm: a.firm,
      pct: cA2 === null ? 0 : Math.round(cA2 * 1000) / 10,
      mApr: Math.round(a.mApr), mFirm: Math.round(a.mFirm),
      mSinCerrar: Math.round(a.mApr - a.mFirm),
      sinCerrar: a.apr - a.firm,
      aprPrev: p.apr, firmPrev: p.firm,
      pctPrev: cP2 === null ? null : Math.round(cP2 * 1000) / 10,
      dPct: (cA2 !== null && cP2 !== null)
        ? Math.round((cA2 - cP2) * 1000) / 10 : null,
      // El peso de la ventana dentro del periodo: es lo que dice si una
      // ventana con buen cierre mueve la aguja o es un caso de borde.
      pesoApr: rA.apr ? Math.round((a.apr / rA.apr) * 1000) / 10 : 0,
      pesoMonto: rA.mApr ? Math.round((a.mApr / rA.mApr) * 1000) / 10 : 0
    };
  }
  var filasV = ORDEN_V.filter(function (v) {
    return (rA.porV[v] && rA.porV[v].apr) || (rP.porV[v] && rP.porV[v].apr);
  }).map(filaVent_);

  // Lo que quedo fuera del desglose por ventana, con su nombre, para poder
  // decir en pantalla exactamente cuanto es y por que no tiene ventana.
  var NOMV = { '-': 'sedes que no existen en HubSpot',
               '—': 'sedes cuya especialidad no está clasificada' };
  var fueraV = { apr: 0, firm: 0, mApr: 0, mFirm: 0, motivos: [] };
  Object.keys(rA.porV).forEach(function (v) {
    if (ORDEN_V.indexOf(v) >= 0) return;
    var a = rA.porV[v];
    fueraV.apr += a.apr; fueraV.firm += a.firm;
    fueraV.mApr += a.mApr; fueraV.mFirm += a.mFirm;
    fueraV.motivos.push({ motivo: NOMV[v] || 'sin ventana', apr: a.apr,
                          mApr: Math.round(a.mApr) });
  });
  fueraV.motivos.sort(function (x, y) { return y.apr - x.apr; });
  fueraV.mApr = Math.round(fueraV.mApr);
  fueraV.mFirm = Math.round(fueraV.mFirm);
  fueraV.pctApr = rA.apr ? Math.round((fueraV.apr / rA.apr) * 1000) / 10 : 0;

  // ---- LA PLATA QUE SE PUEDE RECUPERAR ---------------------------------
  // Lo aprobado sin firmar es la oportunidad, pero no toda esta disponible:
  // el credito vive 30 dias desde la aprobacion. Partirlo por la fecha de
  // aprobacion es la unica forma de separar lo que todavia se puede rescatar
  // de lo que ya se murio. Sin esta division el frente pide rescatar plata
  // que ya no existe.
  var VIDA_CREDITO = 30;
  var hoyR = hoyISO_();
  var hoyMs = parseISO_(hoyR).getTime();
  function diasDesde_(iso) {
    return Math.round((hoyMs - parseISO_(iso).getTime()) / 86400000);
  }
  var vivo = { n: 0, monto: 0 }, muerto = { n: 0, monto: 0 };
  Object.keys(rA.porDia).forEach(function (d) {
    var b = rA.porDia[d];
    var sc = b.apr - b.firm, msc = b.mApr - b.mFirm;
    if (sc <= 0 && msc <= 0) return;
    var dest = (diasDesde_(d) <= VIDA_CREDITO) ? vivo : muerto;
    dest.n += sc;
    dest.monto += msc;
  });
  vivo.monto = Math.round(vivo.monto);
  muerto.monto = Math.round(muerto.monto);

  f.oportunidad = {
    hay: hayRv,
    universo: U.etiqueta,
    filas: filasV,
    fuera: fueraV,
    // La ventana de vida del credito, ya resuelta a numeros del periodo.
    recuperable: {
      sinFirmar: rA.apr - rA.firm,
      mSinFirmar: Math.round(rA.mApr - rA.mFirm),
      vivos: vivo.n, mVivos: vivo.monto,
      vencidos: muerto.n, mVencidos: muerto.monto,
      pctVivo: (rA.mApr - rA.mFirm)
        ? Math.round((vivo.monto / (rA.mApr - rA.mFirm)) * 1000) / 10 : 0,
      dias: VIDA_CREDITO,
      corte: hoyR
    },
    kpis: [
      kpi_('La oportunidad del período', Math.round(rA.mApr), { formato: 'copC',
        sublabel: fNumSrv_(rA.apr) + ' créditos que el motor aprobó · ' + U.etiqueta,
        delta: rP.mApr ? delta_(rA.mApr, rP.mApr) : null,
        fuente: 'BigQuery · profile_institucion', color: 'azul',
        nota: 'Plata de los créditos APROBADOS radicados en el período. Es la ' +
          'oportunidad que sí le pertenece a este período, no el stock histórico ' +
          'de aprobados sin firmar.' }),
      kpi_('Cerró solo', Math.round(rA.mFirm), { formato: 'copC',
        sublabel: fNumSrv_(rA.firm) + ' créditos firmados · ' +
          fPctSrv_(rA.apr ? Math.round((rA.firm / rA.apr) * 1000) / 10 : 0) +
          ' de lo aprobado',
        delta: rP.mFirm ? delta_(rA.mFirm, rP.mFirm) : null,
        fuente: 'BigQuery · profile_institucion', color: 'verde',
        nota: 'La mayoría de estas firmas ocurre el mismo día de la aprobación, ' +
          'sin que nadie las toque. El rescate no compite con esto: trabaja lo ' +
          'que queda.' }),
      kpi_('Quedó sin firmar', Math.round(rA.mApr - rA.mFirm), { formato: 'copC',
        sublabel: fNumSrv_(rA.apr - rA.firm) + ' créditos aprobados que nadie tomó',
        delta: (rP.mApr - rP.mFirm)
          ? delta_(rA.mApr - rA.mFirm, rP.mApr - rP.mFirm) : null,
        deltaInvertido: true,
        fuente: 'BigQuery · profile_institucion', color: 'morado',
        nota: 'Esta es la bolsa completa. Abajo se parte en lo que todavía está ' +
          'dentro de sus 30 días y lo que ya se venció.' }),
      kpi_('Rescatable hoy', vivo.monto, { formato: 'copC',
        sublabel: fNumSrv_(vivo.n) + ' créditos aún dentro de sus ' +
          VIDA_CREDITO + ' días',
        delta: null, deltaEtiqueta: 'foto al ' + hoyR,
        fuente: 'BigQuery · días desde la aprobación', color: 'ambar',
        nota: 'Lo único que una acción de rescate puede mover hoy. Los ' +
          fCopSrv_(muerto.monto) + ' restantes ya pasaron los ' + VIDA_CREDITO +
          ' días desde la aprobación: ese crédito ya no existe, habría que ' +
          'volver a radicarlo.' })
    ]
  };
  // dPct_ vive aca porque lo usan la tabla semanal y el guardarrail de
  // deltas de la gestion. Lo que habia arriba — el conteo de impactos long
  // tail para el bloque "el canal automatico" — salio del frente: medía
  // impactos a SEDES y este frente mide la oportunidad de rescate sobre
  // PACIENTES, asi que ninguna de sus cifras se podia sumar ni comparar con
  // las de al lado. Los workflows long tail se leen en F7, que es su frente.
  function dPct_(a, b) {
    return b ? Math.round(((a - b) / b) * 1000) / 10 : null;
  }

  // ---- LA GESTION DE RESCATE: LA OPERACION HUMANA -----------------------
  // Lo de arriba mide comunicaciones automaticas a SEDES. Esto mide la
  // operacion humana sobre PACIENTES con credito aprobado sin firmar: la
  // lista diaria que trabaja el equipo de rescate.
  //
  // Contrato de datos (tres hojas, todas con fecha para que el selector
  // global las corte igual que al resto del tablero):
  //   RESCATE_GESTION  fecha | sede | casos | llamadas | contesto | colgo |
  //                    tercero | hablo | interesado | firmo |
  //                    monto_trabajado | sin_nota
  //   RESCATE_CAUSAL   fecha | sede | causal | casos | monto
  //   RESCATE_POOL     fecha | sede | rescatados | monto_rescatado |
  //                    churn_casos | churn_monto | pool_trabajable |
  //                    entraron | entraron_recuperables | monto_recuperable
  //
  // `sede` es el nombre de la clinica tal como lo trae lista_dia. Va en las
  // tres para que el filtro global corte esta seccion igual que las demas.
  //
  // Origen: welli-growth.rescate.gestion / .seguimiento / .lista_dia.
  // Mientras esas hojas no existan la seccion muestra la FOTO documentada
  // mas abajo, con su fecha en pantalla. No se inventa serie diaria: sin
  // fuente viva no hay comparativo contra el periodo anterior.
  var gCols = ['casos', 'llamadas', 'contesto', 'colgo', 'tercero', 'hablo',
               'interesado', 'firmo', 'monto_trabajado', 'sin_nota'];
  // RESCATE_POOL trae el desenlace de lo GESTIONADO. El "133 rescatados /
  // $892 M" del correo diario lo calcula rescatados.resumen() sobre el pool
  // trabajable completo, y ese SQL no lo tenemos: se probaron cinco
  // definiciones contra profile_institucion y ninguna lo reproduce (la mas
  // cercana da 41 casos / $377 M). Mientras no llegue, el tablero muestra lo
  // exacto y declara que la cifra del pool esta pendiente.
  var pCols = ['rescatados', 'monto_rescatado', 'trabajados',
               'monto_trabajado'];

  // Las dos hojas llevan columna `sede` (el nombre de la clinica donde se
  // atiende el paciente) para que el filtro global tambien corte aca. Es la
  // misma leccion de CREDITO_DIA: si la fila trae la llave de sede, cualquier
  // filtro nuevo funciona sin volver a agregar la fuente.
  //
  // Si la columna no viene, el corte no se puede hacer y la seccion lo dice
  // en pantalla en vez de mostrar el total disfrazado de filtrado.
  function sumaHoja_(hoja, cols, desde, hasta) {
    var t = {}, n = 0;
    cols.forEach(function (c) { t[c] = 0; });
    (hoja || []).forEach(function (r) {
      var fch = String(r.fecha || '').substring(0, 10);
      if (fch < desde || fch > hasta) return;
      if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
      n++;
      cols.forEach(function (c) { t[c] += num_(r[c]); });
    });
    t._dias = n;
    return t;
  }

  var hjGes = leerHoja_('RESCATE_GESTION');
  var hjCau = leerHoja_('RESCATE_CAUSAL');
  var hjPool = leerHoja_('RESCATE_POOL');
  var hjDes = leerHoja_('RESCATE_DESENLACE');
  var hjHist = leerHoja_('RESCATE_HIST');
  // gestion_historica no trae monto, pero SI trae documento y
  // marcado_firma_credito: cruzando esos documentos contra t_sol_v2
  // (monto_aprobado + fecha_firma_contrato) se reconstruye la plata de la
  // operacion vieja. Ver pull_hist_plata.py. 878 de 887 casos marcados
  // como firmados cruzaron, $5.045 M reconstruidos oct-2024 a jul-2026.
  var hjHistPlata = leerHoja_('RESCATE_HIST_PLATA');
  // DESEMBOLSO_RESCATE_DIA: lo que la empresa desembolso que fue RESULTADO
  // DE RESCATE — no toda la empresa (esa fue la version 1 de este pull,
  // corregida el mismo dia). Rescate es un frente con poblacion propia
  // (creditos aprobados que casi se pierden) y Kevin es UNA PALANCA de
  // ese frente, no todo el frente — van a sumarse mas palancas despues.
  // pull_desembolso_rescate.py usa la query de la jefa (profile_institucion
  // + t_solicitudes, por fecha_firma_contrato) CON su filtro
  // DATE_DIFF(fecha_firma_contrato, creado, DAY) > 2: ese filtro es la
  // definicion misma de "necesito rescate" — un credito que firma en <=2
  // dias se convirtio solo, organico, sin que ninguna palanca interviniera.
  // "Kevin" y "Rescate total" son dos poblaciones distintas a proposito
  // (Rescate total >= Kevin, incluye lo que otras palancas o nadie tocaron
  // pero igual tardo en firmar): no dos formas de medir lo mismo.
  var hjDesembRescateTotal = leerHoja_('DESEMBOLSO_RESCATE_DIA');

  // Las cuatro hojas de la gestion se filtran UNA vez, aca, y no en cada uno
  // de los diez bucles que las recorren mas abajo: un filtro que hay que
  // recordar aplicar en diez sitios es un filtro que en el once se olvida.
  // Cruzan por nombre de sede porque lista_dia no trae la llave.
  function sinCreditUp_(hoja) {
    if (!fueraRescN) return hoja;
    return (hoja || []).filter(function (r) {
      return !fueraRescNom[normNombre_(r.sede)];
    });
  }
  var gesAntes = hjGes.length;
  hjGes = sinCreditUp_(hjGes);
  hjCau = sinCreditUp_(hjCau);
  hjPool = sinCreditUp_(hjPool);
  hjDes = sinCreditUp_(hjDes);
  var gesQuitadas = gesAntes - hjGes.length;
  // La operacion arranco el 31-jul-2026. Comparar agosto contra julio da
  // +38.200% porque julio tiene un caso: un delta asi no informa, desinforma.
  // Por debajo de este piso no se muestra comparativo y se dice por que.
  var GES_ARRANQUE = '2026-07-31';
  var MIN_PREV_GES = 20;
  var fuenteViva = hjGes.length > 0;

  // Se evalua DESPUES de leer la hoja: puesto antes, hjGes todavia es
  // undefined y armarF4_ revienta con "Cannot read properties of undefined".
  var gesConSede = false;
  (function () {
    for (var i = 0; i < hjGes.length; i++) {
      if (String(hjGes[i].sede || '').trim()) { gesConSede = true; return; }
    }
  })();
  var filtraGes = gesConSede && !U.sinFiltro;

  // FOTO del 2-sep-2026. Dos ventanas distintas a proposito, cada una
  // rotulada: el embudo es del 31-jul al 27-ago (analisis de priorizacion)
  // y el pool es de los 30 dias al 2-sep (tablero diario del equipo).
  // Cuando entre la fuente viva las dos salen del mismo selector.
  var FOTO_GESTION = {
    fecha: '2026-09-02',
    ventanaEmbudo: '31 jul al 27 ago 2026',
    ventanaPool: '30 días al 2 sep 2026',
    casos: 340, llamadas: 336, contesto: 179, colgo: 58, tercero: 6,
    hablo: 115, interesado: 22, firmo: 10,
    vivos: 259, vencidos: 44, sinCruce: 24,
    rescatados: 133, monto_rescatado: 892000000,
    pool_trabajable: 900, churn_casos: 34, churn_monto: 192000000,
    causales: [
      ['No contesta', 202], ['Cuelga', 79], ['No realiza el tratamiento', 67],
      ['Otro', 47], ['Interesado · va a firmar', 17], ['Duda de tasa', 12],
      ['Pospone', 11], ['Desconoce la solicitud', 5], ['No lo necesita', 4],
      ['Se fue con otro (Addi/otro)', 3], ['Ya pagó de contado', 2],
      ['Duda de monto', 1]
    ]
  };

  function dGes_(act, prev, prevCasos) {
    if (prevCasos === null || prevCasos === undefined) return null;
    if (prevCasos < MIN_PREV_GES) return null;
    return dPct_(act, prev);
  }

  var gA, gP, pA, pP, causales = [], embudoBase;
  if (fuenteViva) {
    gA = sumaHoja_(hjGes, gCols, R.inicio, R.fin);
    gP = sumaHoja_(hjGes, gCols, R.prevInicio, R.prevFin);
    pA = sumaHoja_(hjPool, pCols, R.inicio, R.fin);
    pP = sumaHoja_(hjPool, pCols, R.prevInicio, R.prevFin);
    var agC = {};
    hjCau.forEach(function (r) {
      var fch = String(r.fecha || '').substring(0, 10);
      if (fch < R.inicio || fch > R.fin) return;
      if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
      var k = String(r.causal || '(sin causal)');
      if (!agC[k]) agC[k] = { causal: k, casos: 0, monto: 0 };
      agC[k].casos += num_(r.casos);
      agC[k].monto += num_(r.monto);
    });
    var totC = 0;
    Object.keys(agC).forEach(function (k) { totC += agC[k].casos; });
    causales = Object.keys(agC).map(function (k) { return agC[k]; })
      .sort(function (a, b) { return b.casos - a.casos; })
      .map(function (r) {
        r.pct = totC ? Math.round((r.casos / totC) * 1000) / 10 : 0;
        return r;
      });
    embudoBase = gA;
  } else {
    gA = FOTO_GESTION; gP = null; pA = FOTO_GESTION; pP = null;
    var totF = 0;
    FOTO_GESTION.causales.forEach(function (c) { totF += c[1]; });
    causales = FOTO_GESTION.causales.map(function (c) {
      return { causal: c[0], casos: c[1], monto: 0,
               pct: totF ? Math.round((c[1] / totF) * 1000) / 10 : 0 };
    });
    embudoBase = FOTO_GESTION;
  }

  // ---- EL EMBUDO, EN CASOS Y EN PLATA ----------------------------------
  // Un solo embudo desde la bolsa completa. Antes eran dos paneles — la
  // cobertura a la izquierda y el embudo a la derecha — y el lector tenia
  // que cruzarlos a mano para saber que el 3,8% de cierre era sobre el 13%
  // que alcanzamos a tocar, no sobre todo. Con los dos primeros pasos
  // dentro del mismo embudo eso se lee de corrido.
  //
  // La plata de cada paso NO viene dada: la fuente solo trae
  // monto_trabajado. Pero las causales SI traen monto y descomponen los
  // casos exactamente, asi que la plata de cada paso se deduce de ahi:
  //   contesto  = trabajado - monto(No contesta)
  //   colgo     =             monto(Cuelga)
  //   hablo     = trabajado - monto(No contesta) - monto(Cuelga)
  // Y cuadra: la suma de los montos de las causales da 5.491.096.765, que
  // es monto_trabajado al peso. Se verifica en caliente igual que los
  // casos: si deja de cuadrar, la columna de plata no se muestra.
  var bTot = num_(embudoBase.casos) || 0;
  var mTrab = num_(gA.monto_trabajado);
  var mCau = 0, mNoContesta = 0, mColgo = 0, mInteres = 0;
  causales.forEach(function (c) {
    var n = String(c.causal);
    mCau += c.monto;
    if (/no\s*contesta|no\s*contactad/i.test(n)) mNoContesta += c.monto;
    else if (/cuelga/i.test(n)) mColgo += c.monto;
    if (/interesad/i.test(n)) mInteres += c.monto;
  });
  // Tolerancia de un peso por redondeo, no un porcentaje: los montos son
  // enteros y si la fuente cuadra, cuadra exacto.
  var cuadraMonto = mTrab > 0 && Math.abs(mCau - mTrab) <= 1;
  // La plata firmada sale del DESENLACE y no de las causales: la causal
  // dice como termino la llamada y una firma queda registrada como "No
  // contesta" cuando el paciente cerro despues por WhatsApp.
  var mFirmo = 0;
  hjDes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (fch < R.inicio || fch > R.fin) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    if (String(r.desenlace || '') === 'firmo') mFirmo += num_(r.monto);
  });

  // La bolsa es el paso 0: el embudo arranca en la oportunidad completa y
  // no en la lista, que es lo que hacia que el cierre se leyera mal.
  var oprCasos = rA.apr - rA.firm;
  var oprMonto = rA.mApr - rA.mFirm;

  function pasoEmb_(etq, casos, monto, sub, opt) {
    opt = opt || {};
    return {
      paso: etq,
      casos: Math.round(num_(casos)),
      pct: oprCasos ? Math.round((num_(casos) / oprCasos) * 1000) / 10 : 0,
      monto: cuadraMonto || opt.montoFiable ? Math.round(num_(monto)) : null,
      pctMonto: (cuadraMonto || opt.montoFiable) && oprMonto
        ? Math.round((num_(monto) / oprMonto) * 1000) / 10 : null,
      sub: sub || '',
      fuga: !!opt.fuga,
      // Ancla del embudo: la barra se dibuja contra la bolsa completa, no
      // contra el paso anterior. Encadenar porcentajes esconde el tamano
      // real de cada fuga.
      hito: !!opt.hito,
      // El paso no sale del registro de llamadas sino del cruce contra el
      // credito, asi que no es un subconjunto del paso de arriba.
      cruzado: !!opt.cruzado
    };
  }
  var embudoGes = [
    pasoEmb_('Aprobado sin firmar', oprCasos, oprMonto,
             'la bolsa del período', { hito: true, montoFiable: true }),
    pasoEmb_('Entró a la lista', embudoBase.casos, mTrab,
             'lo que el equipo alcanzó a trabajar', { hito: true,
               montoFiable: true }),
    pasoEmb_('Contestó alguien', embudoBase.contesto,
             mTrab - mNoContesta, ''),
    pasoEmb_('…y colgó', embudoBase.colgo, mColgo,
             'cortó al identificarnos', { fuga: true }),
    pasoEmb_('Habló con el equipo', embudoBase.hablo,
             mTrab - mNoContesta - mColgo, ''),
    pasoEmb_('Se mostró interesado', embudoBase.interesado, mInteres, ''),
    pasoEmb_('Firmó', embudoBase.firmo, mFirmo,
             'cruzado contra el crédito', { hito: true, cruzado: true,
               montoFiable: true })
  ];

  // ---- LAS CAUSALES, SIN REPETIR EL EMBUDO ------------------------------
  // La tabla de causales repetia el embudo en dos tercios de sus filas: "No
  // contesta" y "Cuelga" no son razones para no tomar el credito, son los
  // pasos donde se cayo la llamada, y ya estan arriba con su barra.
  //
  // La descomposicion es exacta y se verifica en caliente:
  //   casos trabajados - hablo = casos que nunca llegaron a conversacion
  //                            = "No contesta" + "Cuelga"
  // En el periodo medido: 499 - 185 = 314 = 227 + 87. Cuadra al caso.
  //
  // Si algun dia deja de cuadrar (una causal nueva de no-contacto, un cambio
  // de formulario) la bandera `cuadra` se apaga y la vista muestra la lista
  // completa sin afirmar la identidad. No se asume: se comprueba.
  var CAUSAL_NO_CONTACTO = /no\s*contesta|cuelga|no\s*contactad/i;
  var cauEmbudo = [], cauReal = [];
  causales.forEach(function (c) {
    (CAUSAL_NO_CONTACTO.test(String(c.causal)) ? cauEmbudo : cauReal).push(c);
  });
  var nEmbudo = 0, nReal = 0;
  cauEmbudo.forEach(function (c) { nEmbudo += c.casos; });
  cauReal.forEach(function (c) { nReal += c.casos; });
  var hablaron = num_(embudoBase.hablo);
  var cuadraCausal = (nReal === hablaron) && (nEmbudo === bTot - hablaron);
  // Los porcentajes se recalculan sobre la base nueva: un 14,6% "de todas
  // las causales" y un 39,5% "de los que hablaron" son el mismo numerador
  // diciendo cosas distintas, y la segunda es la que sirve.
  cauReal.forEach(function (c) {
    c.pctBase = nReal ? Math.round((c.casos / nReal) * 1000) / 10 : 0;
  });

  // ---- LA COBERTURA: CUANTO DE LA OPORTUNIDAD TOCAMOS -------------------
  // Es la cifra que le faltaba al frente. El embudo decia "de los casos que
  // trabajamos, tantos firmaron" sin decir nunca cuantos casos habia para
  // trabajar: con 499 casos sobre una bolsa de 3.781 el 3,8% de cierre se
  // lee como fracaso, y en realidad es el 3,8% del 13% que alcanzamos a
  // tocar.
  //
  // Dos coberturas, no una, y la diferencia entre las dos es el hallazgo:
  // en casos tocamos el 13,2% y en plata el 27,0%. La lista esta priorizada
  // por monto y se nota — toca la mitad de casos y el doble de plata.
  var mtGes = mTrab;
  var sedesGes = {};
  var diasGes = {};
  hjGes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (fch < R.inicio || fch > R.fin) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    var nm = String(r.sede || '').trim();
    if (nm) sedesGes[nm] = true;
    diasGes[fch] = true;
  });
  // El filtro de CreditUp, declarado. Un filtro que no se ve en pantalla es
  // un filtro que el proximo lector no sabe que esta puesto — y este cambia
  // el denominador de todo el frente.
  f.excluido = {
    origenes: Object.keys(ORIGEN_FUERA_RESCATE),
    sedes: fueraRescN,
    filasGestion: gesQuitadas,
    razon: 'CreditUp es una tablet en el mostrador: el paciente ve a Welli, ' +
      'Addi y otros al mismo tiempo y elige ahí. No hay ventana de 30 días ' +
      'que trabajar — si no nos eligió, ya eligió a otro. Ese crédito no es ' +
      'un aprobado sin firmar esperando una llamada, así que no entra a la ' +
      'bolsa de rescate.',
    alcance: 'Hoy se filtra por el origen de la SEDE, que es la única marca ' +
      'que existe: ' + fNumSrv_(fueraRescN) + ' clínicas. Si el volumen real ' +
      'viene marcado por SOLICITUD, ese campo está en ' +
      'welli-data.data_ops.t_solicitudes y hay que traerlo — con lo de hoy ' +
      'el filtro es correcto pero mueve poco.'
  };

  f.cobertura = {
    hay: bTot > 0 && oprCasos > 0,
    casos: bTot,
    oprCasos: oprCasos,
    pctCasos: oprCasos ? Math.round((bTot / oprCasos) * 1000) / 10 : 0,
    monto: Math.round(mtGes),
    oprMonto: Math.round(oprMonto),
    pctMonto: oprMonto ? Math.round((mtGes / oprMonto) * 1000) / 10 : 0,
    sedes: Object.keys(sedesGes).length,
    dias: Object.keys(diasGes).length,
    // El ticket promedio de lo que se trabaja contra el de la bolsa: es la
    // prueba directa de la priorizacion por monto, sin pedirle al lector
    // que divida dos porcentajes de cabeza.
    ticketTrabajado: bTot ? Math.round(mtGes / bTot) : 0,
    ticketBolsa: oprCasos ? Math.round(oprMonto / oprCasos) : 0
  };
  f.cobertura.veces = (f.cobertura.ticketBolsa && f.cobertura.ticketTrabajado)
    ? Math.round((f.cobertura.ticketTrabajado / f.cobertura.ticketBolsa) * 10) / 10
    : null;

  // ---- EL EMBUDO DE WHATSAPP -------------------------------------------
  // Reescrito 25-sep-2026: la version anterior (RESCATE_WA_EMBUDO_DIA)
  // sumaba "pacientes contactados" POR DIA dentro del rango elegido -- un
  // mismo paciente escrito en varios dias del rango se sumaba una vez POR
  // CADA DIA, y el universo contra el que se armaba el embudo (telefonos
  // aprobados alguna vez desde jun-2026) NO estaba acotado al rango,
  // mientras que el denominador que se mostraba en pantalla ("creditos
  // que llegaron a aprobarse en el periodo") SI lo estaba. Las dos cosas
  // juntas rompian la aritmetica: filtrando agosto se veian "18.254
  // contactados de 3.638 aprobados" -- 501,8%, matematicamente imposible
  // para "recibio al menos un mensaje". Emmanuel lo encontro comparando
  // contra un hueco de contacto real que ya conocia.
  //
  // Arreglo: RESCATE_WA_PACIENTES trae UNA FILA POR PACIENTE (no por dia),
  // con su fecha_aprobacion (la mas temprana, si aparece aprobado mas de
  // una vez) y flags 0/1 de si ALGUNA VEZ (sin importar el dia) hubo un
  // enviado/entregado/leido/respondio. Code.gs filtra esas filas por
  // fecha_aprobacion en R.inicio..R.fin y CUENTA filas (no suma eventos),
  // asi que el % nunca puede pasar de 100 por diseño, y "aprobados" y
  // "recibieron mensaje" son SIEMPRE la misma poblacion.
  //
  // SEGUNDA VUELTA, mismo dia: "cualquier mensaje de whatsapp" (la primera
  // version de este arreglo) diluia el problema real -- con esa definicion
  // agosto se veia 96-98% sano, porque mensajes de cobranza/bot tapaban el
  // hueco. Emmanuel necesitaba mostrarle al CEO el hueco de la CONFIRMACION
  // DE CREDITO APROBADO especificamente: hubo casi 5 semanas (5-ago a
  // 9-sep-2026) donde esa plantilla no se envio a NADIE. `enviado`/
  // `entregado`/`leido` en RESCATE_WA_PACIENTES ya vienen acotados a la
  // familia de plantillas de esa confirmacion (ver PLANTILLAS_CONFIRMACION
  // en pull_wa_pacientes.py, encontradas por CONTENIDO del mensaje, no por
  // un solo id) -- filtrando por fecha en el tablero, el hueco y la
  // recuperacion se ven solos, sin necesidad de un panel de comparacion.
  /* TERCERA VUELTA (28-sep-2026): el embudo ahora mide SOLO a los
     RESCATABLES — los que siguen aprobados esperando actuar.

     El hallazgo que lo motivo: cruzando los aprobados del 20 al 28 de sep
     contra su estado actual, los que NO recibieron el mensaje ya habian
     desembolsado en su mayoria (59,5% contra 13,0% de los que si lo
     recibieron), y los que si lo recibieron estaban casi todos parados en
     `approved` (82,1%). O sea que el mensaje no se le manda a quien ya
     desembolso -- y contarlo como "no le llego" convertia un exito
     operativo en una falla inventada. Medido: de los 522 "sin
     confirmacion" de esa ventana, 388 (74%) ya habian avanzado. El hueco
     real eran 134 pacientes (12,6%), no 522 (32,5%).

     Por eso se dejan fuera los estados que ya avanzaron. Ojo con lo que
     esto implica y esta declarado en pantalla: `estado` es la FOTO DE HOY,
     no el estado que tenia el paciente el dia que lo aprobaron. Un
     aprobado de julio que desembolso en agosto hoy NO cuenta en el embudo
     de julio. Es lo correcto para la pregunta "¿a quien le falto el
     aviso?", pero significa que el embudo de un mes cerrado puede
     encogerse con el tiempo — no es un bug, es la definicion. */
  var ESTADOS_YA_AVANZO = {
    desembolsado: 1, fulfilled: 1, pendiente_desembolso: 1,
    pendiente_aprobacion_medico: 1, pendiente_validacion_cliente: 1
  };
  var hjWaPac = leerHoja_('RESCATE_WA_PACIENTES');
  var waAg = { universo: 0, enviados: 0, entregados: 0, leidos: 0, respuestas: 0 };
  var waFechaIni = '', waFechaFin = '';
  var waYaAvanzaron = 0;
  hjWaPac.forEach(function (r) {
    var fch = String(r.fecha_aprobacion || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
    if (R.inicio && fch < R.inicio) return;
    if (R.fin && fch > R.fin) return;
    if (ESTADOS_YA_AVANZO[String(r.estado || '').trim()]) { waYaAvanzaron++; return; }
    waAg.universo++;
    if (num_(r.enviado)) waAg.enviados++;
    if (num_(r.entregado)) waAg.entregados++;
    if (num_(r.leido)) waAg.leidos++;
    if (num_(r.respondio)) waAg.respuestas++;
    if (!waFechaIni || fch < waFechaIni) waFechaIni = fch;
    if (fch > waFechaFin) waFechaFin = fch;
  });
  var waHay = waAg.universo > 0;
  function pasoWa_(paso, n, base, hito) {
    var pct = base ? Math.round((n / base) * 1000) / 10 : 0;
    return { paso: paso, n: n, pct: pct, hito: !!hito };
  }
  // Los % van SIEMPRE sobre el universo de aprobados (no sobre el paso
  // anterior): asi "leidos" dice de verdad que porcion de TODOS los
  // aprobados llego a leer el mensaje, no una tasa encadenada que se
  // vuelve ilegible a la tercera etapa.
  // "Respondieron" SALIO del embudo secuencial (26-sep-2026): no esta
  // acotado por la plantilla de confirmacion (un INBOUND no dice a que
  // plantilla responde), asi que puede ser MAYOR que "Leido" -- dentro de
  // una barra de embudo eso se lee como un error visual, aunque el numero
  // sea correcto y ya estuviera declarado en el subtitulo. Se saca de la
  // secuencia y se expone aparte (ver waAg.respuestas mas abajo en el
  // payload) para no romper la lectura de "cada barra mas chica que la
  // anterior" que un embudo promete.
  var embudoWa = waHay ? [
    pasoWa_('Aprobados', waAg.universo, waAg.universo, true),
    pasoWa_('Recibieron confirmación', waAg.enviados, waAg.universo),
    pasoWa_('Entregado', waAg.entregados, waAg.universo),
    pasoWa_('Leído', waAg.leidos, waAg.universo, true)
  ] : [];

  // ---- APROBADOS SIN MENSAJE (por-paciente, real) -----------------------
  // Restaurado el acceso a welli-growth.rescate.eventos_hilos (8-sep-2026),
  // ya se puede cruzar POR PACIENTE (no por campaña como arriba): de los
  // creditos hoy 'approved' (vivos, sin firmar) con celular, cuantos nunca
  // recibieron un mensaje OUTBOUND, y cuantos mensajes en promedio le llegan
  // al que si. Se arma en pull_aprob_msj.py (cruce de dos regiones de
  // BigQuery que no se pueden unir en una sola query) y llega ya calculado
  // en RESCATE_APROB_MSJ, una sola fila.
  // Dos formas de la misma cuenta, por orden de preferencia:
  //   1. RESCATE_APROB_MSJ_DIA — por dia, asi la tarjeta responde al filtro
  //      de fecha como todo lo demas (pedido del negocio, 9-sep-2026).
  //   2. RESCATE_APROB_MSJ — la foto de hoy, de una sola fila. Es el
  //      respaldo: si el pull por dia no se ha corrido, la tarjeta sigue
  //      mostrando algo cierto, pero declarado como foto.
  var hjAprobDia = leerHoja_('RESCATE_APROB_MSJ_DIA');
  var aprobMsj = null, aprobMsjEsFoto = false;
  if (hjAprobDia.length) {
    var acAp = { tel: 0, sin: 0, con: 0 };
    hjAprobDia.forEach(function (r) {
      var fch = String(r.fecha || '').substring(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
      if (R.inicio && fch < R.inicio) return;
      if (R.fin && fch > R.fin) return;
      acAp.tel += num_(r.aprobados_con_telefono);
      acAp.sin += num_(r.sin_mensaje);
      acAp.con += num_(r.con_mensaje);
    });
    if (acAp.tel) {
      aprobMsj = { aprobados_con_telefono: acAp.tel, sin_mensaje: acAp.sin,
                   con_mensaje: acAp.con };
    }
  } else {
    var hjAprobMsj = leerHoja_('RESCATE_APROB_MSJ');
    if (hjAprobMsj.length) {
      aprobMsj = hjAprobMsj[0];
      aprobMsjEsFoto = true;
    }
  }

  // ---- SEMANA A SEMANA, CONTRA LA OPORTUNIDAD DE ESA SEMANA -------------
  // El comparativo contra el periodo anterior no existe: la operacion
  // arranco el 31-jul-2026, asi que "julio" es UN caso de UN dia. Pero la
  // variacion si existe semana a semana, que es como se opera esto.
  //
  // Y va con la COBERTURA de la semana, que era lo que faltaba: sin el
  // denominador, "185 casos" no dice si fue una buena semana. Con el, se ve
  // la rampa real de la operacion — 8,9% · 3,5% · 10,6% · 19,4% · 33,6%.
  function lunesISO_(iso) {
    var d = parseISO_(iso);
    var dow = d.getDay();               // 0=domingo
    return fmtFecha_(sumarDias_(d, dow === 0 ? -6 : 1 - dow));
  }

  // La oportunidad de cada semana sale de la misma tabla de hechos que los
  // KPIs de arriba, para que las dos cifras no puedan discrepar. Pero se
  // recorre el span COMPLETO de la operacion y no el periodo elegido: esta
  // tabla y las cosechas no se cortan con el selector, y con el denominador
  // recortado al periodo todas las semanas viejas quedaban con "sin firmar
  // = 0" y cobertura "--", que se lee como dato roto.
  var spanIni = '', spanFin = '';
  hjGes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
    if (!spanIni || fch < spanIni) spanIni = fch;
    if (fch > spanFin) spanFin = fch;
  });
  var oprSem = {};
  if (spanIni) {
    recorrerResc_(lunesISO_(spanIni), spanFin, function (r) {
      var k = lunesISO_(r.fecha);
      if (!oprSem[k]) oprSem[k] = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      var o = oprSem[k];
      o.apr += r.apr; o.firm += r.conv; o.mApr += r.mApr; o.mFirm += r.mConv;
    });
  }

  // ultimoCredito = el ultimo dia con filas en CREDITO_DIA (se calcula aca,
  // antes de agregar por semana, porque lo necesita el corte de mas abajo).
  var oprDia = {};
  var ultimoCredito = '';
  if (spanIni) {
    recorrerResc_(lunesISO_(spanIni), spanFin, function (r) {
      if (!oprDia[r.fecha]) {
        oprDia[r.fecha] = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      }
      var o = oprDia[r.fecha];
      o.apr += r.apr; o.firm += r.conv; o.mApr += r.mApr; o.mFirm += r.mConv;
      if (r.fecha > ultimoCredito) ultimoCredito = r.fecha;
    });
  }

  var semAg = {};
  hjGes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    var k = lunesISO_(fch);
    if (!semAg[k]) {
      semAg[k] = { semana: k, casos: 0, contesto: 0, hablo: 0, firmo: 0,
                   monto: 0, dias: {} };
    }
    var b2 = semAg[k];
    b2.casos += num_(r.casos);
    b2.contesto += num_(r.contesto);
    b2.hablo += num_(r.hablo);
    b2.firmo += num_(r.firmo);
    // La cobertura compara monto TRABAJADO contra monto que ENTRÓ (via
    // recorrerResc_/CREDITO_DIA). Si CREDITO_DIA todavia no se refresco
    // para un dia que YA tiene gestion, ese dia entra al trabajado pero no
    // a la bolsa, y la cobertura se infla comparando flujos de dias
    // distintos. Se corta en ultimoCredito para que ambos lados midan lo
    // mismo.
    if (!ultimoCredito || fch <= ultimoCredito) {
      b2.monto += num_(r.monto_trabajado);
    }
    b2.dias[fch] = true;
  });
  var semanas = Object.keys(semAg).sort().map(function (k) {
    var b2 = semAg[k];
    var o = oprSem[k] || { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
    b2.dias = Object.keys(b2.dias).length;
    b2.oportunidad = o.apr - o.firm;
    b2.mOportunidad = Math.round(o.mApr - o.mFirm);
    // Cobertura = de lo que quedo aprobado sin firmar esa semana, cuanto
    // entro a la lista. Puede pasar de 100%: la lista tambien trabaja
    // sobrantes de semanas anteriores, y eso es informacion, no un error.
    b2.cobertura = b2.oportunidad
      ? Math.round((b2.casos / b2.oportunidad) * 1000) / 10 : null;
    b2.tasaContacto = b2.casos
      ? Math.round((b2.contesto / b2.casos) * 1000) / 10 : 0;
    b2.tasaCierre = b2.casos
      ? Math.round((b2.firmo / b2.casos) * 1000) / 10 : 0;
    return b2;
  });
  // Las semanas con uno o dos casos no son una semana de operacion: son el
  // arranque. Dejarlas hace ver una caida del 6.400% que no ocurrio.
  //
  // OJO: esta lista filtrada es para comparar semana contra semana anterior
  // (dCasos, dFirmo...) — NO para las metas. Si "esta semana" saliera de
  // aca, una semana actual que todavia no llega a 5 casos (porque apenas
  // lleva 1-2 dias) desaparecia del todo y la meta mostraba la ULTIMA
  // semana completa de hace mas de una semana, mientras que "este mes" si
  // mostraba el mes en curso — dos relojes distintos en el mismo panel.
  // Por eso semanasTodas (sin este filtro) es la base de `metas`.
  var semanasTodas = semanas;
  var MIN_SEMANA = 5;
  semanas = semanas.filter(function (x) { return x.casos >= MIN_SEMANA; });
  semanas.forEach(function (x, i) {
    var pv = i > 0 ? semanas[i - 1] : null;
    x.dCasos = pv ? dPct_(x.casos, pv.casos) : null;
    x.dFirmo = pv ? dPct_(x.firmo, pv.firmo) : null;
    x.dContacto = pv
      ? Math.round((x.tasaContacto - pv.tasaContacto) * 10) / 10 : null;
    x.dCobertura = (pv && pv.cobertura !== null && x.cobertura !== null)
      ? Math.round((x.cobertura - pv.cobertura) * 10) / 10 : null;
  });

  // ---- EL CALENDARIO DE LA GESTION -------------------------------------
  // Lunes a viernes, que es como opera el equipo: en 19 días de gestión no
  // hay un solo sábado ni domingo.
  //
  // Cada celda responde la pregunta del día en plata y en casos: cuánto
  // entró a la bolsa, cuánto tocamos, quién contestó y qué se firmó.
  //
  // OJO CON EL DENOMINADOR, que es la decisión de fondo de este bloque.
  // "Cuánto había disponible" se puede leer de dos formas que dan números
  // 45 veces distintos:
  //   STOCK  todo lo aprobado sin firmar y vivo ese día — unos $19.400 M,
  //          porque la bolsa acumula 30 días de aprobaciones
  //   FLUJO  lo que ENTRÓ a la bolsa ese día — unos $800 M
  // Con el stock la cobertura diaria da 2,5% y se lee como que el equipo no
  // hace nada, cuando lo que pasa es que se compara un flujo de un día
  // contra un acumulado de treinta. El calendario usa el FLUJO, que es
  // flujo contra flujo, y el stock va una sola vez en el encabezado para
  // que nadie crea que el flujo del día es todo lo que hay.
  //
  // La cobertura puede pasar del 100%: la lista también trabaja sobrantes
  // de días anteriores. Eso es información sobre cómo se prioriza, no un
  // error de cálculo.
  //
  // (oprDia y ultimoCredito ya se calcularon arriba, antes de semAg, porque
  // el corte de "monto trabajado" por semana los necesita.)

  // El stock vivo al último día con gestión. Misma definición que la bolsa
  // de la sección 1, para que las dos cifras no puedan discrepar.
  var stockN = 0, stockM = 0;
  if (spanFin) {
    var corteStock = spanFin < ultimoCredito ? spanFin : ultimoCredito;
    for (var ks = 0; ks <= 30 && corteStock; ks++) {
      var dS = fmtFecha_(sumarDias_(parseISO_(corteStock), -ks));
      var oS = oprDia[dS];
      if (!oS) continue;
      stockN += oS.apr - oS.firm;
      stockM += oS.mApr - oS.mFirm;
    }
  }

  // Gestión por día, con la plata de cada paso deducida igual que en el
  // embudo: la causal trae monto y descompone los casos exactamente.
  var gDia = {};
  function celda_(d) {
    if (!gDia[d]) {
      gDia[d] = { fecha: d, casos: 0, contesto: 0, hablo: 0, firmo: 0,
                  monto: 0, mNoContesta: 0, mColgo: 0, mFirmo: 0, mCau: 0 };
    }
    return gDia[d];
  }
  hjGes.forEach(function (r) {
    var d = String(r.fecha || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    // Pedido 16-sep-2026: el calendario dia a dia tiene que respetar el
    // filtro de fecha global -- antes mostraba TODA la historia desde el
    // arranque (31-jul-2026) sin importar el rango elegido arriba, mientras
    // otras cifras de esta misma seccion (via sumaHoja_) si lo respetaban.
    // hjCau/hjDes de abajo heredan el recorte solo, porque solo escriben en
    // celdas que gDia ya tiene (dias dentro de R.inicio..R.fin).
    if (d < R.inicio || d > R.fin) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    var c = celda_(d);
    c.casos += num_(r.casos);
    c.contesto += num_(r.contesto);
    c.hablo += num_(r.hablo);
    c.firmo += num_(r.firmo);
    c.monto += num_(r.monto_trabajado);
  });
  hjCau.forEach(function (r) {
    var d = String(r.fecha || '').substring(0, 10);
    if (!gDia[d]) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    var n = String(r.causal || ''), c = gDia[d];
    c.mCau += num_(r.monto);
    if (/no\s*contesta|no\s*contactad/i.test(n)) c.mNoContesta += num_(r.monto);
    else if (/cuelga/i.test(n)) c.mColgo += num_(r.monto);
  });
  hjDes.forEach(function (r) {
    var d = String(r.fecha || '').substring(0, 10);
    if (!gDia[d]) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    if (String(r.desenlace || '') === 'firmo') gDia[d].mFirmo += num_(r.monto);
  });

  // CUANTOS DIAS HABILES NO TIENEN NI UNA FILA DE GESTION. Se verifica
  // contra CREDITO_DIA para saber si es un vacio real del registro de
  // llamadas o un problema de extraccion: si el negocio SI aprobaba y
  // desembolsaba creditos ese dia (hay filas en oprDia) pero
  // welli-growth.rescate.gestion no tiene ni una fila trabajada, el hueco
  // es del registro de Kevin, no del pull. Se cuenta en vez de dejarlo
  // como una fila gris sin explicacion.
  var diasHabiles = [], diasSinGestion = [];
  if (spanIni && spanFin) {
    for (var dh = parseISO_(spanIni); fmtFecha_(dh) <= spanFin;
         dh = sumarDias_(dh, 1)) {
      var dow2 = dh.getDay();
      if (dow2 === 0 || dow2 === 6) continue;      // fin de semana, no cuenta
      var iso2 = fmtFecha_(dh);
      diasHabiles.push(iso2);
      if (!gDia[iso2]) diasSinGestion.push(iso2);
    }
  }
  var sinGestionConCredito = diasSinGestion.filter(function (d) {
    return !!oprDia[d];
  }).length;

  var DOW_CAL = ['lun', 'mar', 'mié', 'jue', 'vie'];
  var calSem = {};
  Object.keys(gDia).sort().forEach(function (d) {
    var k = lunesISO_(d);
    if (!calSem[k]) calSem[k] = { semana: k, dias: [] };
  });
  var calendario = Object.keys(calSem).sort().map(function (k) {
    var lun = parseISO_(k);
    var dias = [];
    for (var i = 0; i < 5; i++) {
      var d = fmtFecha_(sumarDias_(lun, i));
      // La semana que toca el borde del filtro (lunes antes de R.inicio, o
      // viernes despues de R.fin) igual necesita sus 5 celdas -- el
      // calendario del frontend alinea por posicion (lun..vie), no por
      // fecha, asi que saltarse un dia correria las columnas. Se marca
      // "fueraRango" y se sigue mandando la celda, vacia.
      if (d < R.inicio || d > R.fin) {
        dias.push({ fecha: d, dia: Number(d.substring(8, 10)), dow: DOW_CAL[i],
                    hubo: false, fueraRango: true });
        continue;
      }
      var g2 = gDia[d];
      var o2 = oprDia[d];
      // Un día sin fila de créditos no es un día con cero aprobaciones: es
      // que la tabla de hechos todavía no llegó ahí. Se marca y no se
      // divide, porque dividir por cero pintaba coberturas de mil millones
      // por ciento.
      var sinCredito = !o2 || (ultimoCredito && d > ultimoCredito);
      var enN = o2 ? o2.apr - o2.firm : 0;
      var enM = o2 ? o2.mApr - o2.mFirm : 0;
      var cuadra = g2 && g2.monto > 0 && Math.abs(g2.mCau - g2.monto) <= 1;
      dias.push({
        fecha: d,
        dia: Number(d.substring(8, 10)),
        dow: DOW_CAL[i],
        hubo: !!g2,
        sinCredito: !!sinCredito,
        // Dos dias traen casos trabajados y monto_trabajado en cero: son
        // 47 y 1 casos sin monto registrado en la fuente. Pintarlos como
        // 0% de cobertura seria acusar al equipo de un hueco del dato.
        sinMonto: !!(g2 && g2.casos > 0 && g2.monto === 0),
        entroCasos: Math.round(enN),
        entroMonto: Math.round(enM),
        casos: g2 ? g2.casos : 0,
        contesto: g2 ? g2.contesto : 0,
        hablo: g2 ? g2.hablo : 0,
        firmo: g2 ? g2.firmo : 0,
        monto: g2 ? Math.round(g2.monto) : 0,
        mFirmo: g2 ? Math.round(g2.mFirmo) : 0,
        mHablo: (g2 && cuadra)
          ? Math.round(g2.monto - g2.mNoContesta - g2.mColgo) : null,
        // Dos coberturas, la de plata primero: es la que dice si el día se
        // trabajó bien, porque la lista prioriza por monto.
        cobertura: (g2 && !sinCredito && enM > 0 && g2.monto > 0)
          ? Math.round((g2.monto / enM) * 1000) / 10 : null,
        coberturaCasos: (g2 && !sinCredito && enN > 0)
          ? Math.round((g2.casos / enN) * 1000) / 10 : null
      });
    }
    return { semana: k, dias: dias };
  });

  // ---- COSECHAS DE GESTION ---------------------------------------------
  // La idea que pediste: el rescate tiene que ocurrir dentro de los 30 dias
  // del credito, asi que la pregunta de cosecha es "de los casos que
  // trabajamos la semana X, cuantos ya se resolvieron y como".
  //
  // Un caso trabajado tiene tres desenlaces posibles y solo dos son
  // resultado: firmo o se vencio. "Sigue vivo" no es un resultado, es que
  // todavia no se sabe — y es la razon por la que un cierre semanal recien
  // horneado se ve altisimo y no significa nada.
  //
  // Por eso la tabla trae DOS tasas: sobre todos los casos (que subestima
  // las semanas recientes) y sobre los ya resueltos (que las sobreestima).
  // La unica semana legible es la que ya cerro casi todo, y eso se marca.
  var cohAg = {};
  hjDes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    var k = lunesISO_(fch);
    if (!cohAg[k]) {
      cohAg[k] = { semana: k, firmo: 0, vivo: 0, vencido: 0, sinCruce: 0,
                   mFirmo: 0, mVivo: 0, mVencido: 0 };
    }
    var b3 = cohAg[k];
    var d3 = String(r.desenlace || '');
    var n3 = num_(r.casos), m3 = num_(r.monto);
    if (d3 === 'firmo') { b3.firmo += n3; b3.mFirmo += m3; }
    else if (d3 === 'vivo') { b3.vivo += n3; b3.mVivo += m3; }
    else if (d3 === 'vencido') { b3.vencido += n3; b3.mVencido += m3; }
    else { b3.sinCruce += n3; }
  });
  // cohAg queda como esta: la usa el motor de metas (mFirmo por semana),
  // aunque la tabla de cosechas que antes se construia aqui ya no se
  // muestra (punto 7 del frente, eliminado).

  // ---- METAS DE RESCATE, SEMANA A SEMANA -------------------------------
  // Kevin trabaja el rescate a medio tiempo desde que arrancó el software
  // (31-jul-2026): tiene otras responsabilidades, y por eso hay días sin
  // gestión que no son un hueco del dato. Desde el KEVIN_100_DESDE vuelve a
  // dedicación completa.
  //
  // La meta NO puede ser un número fijo: cada semana trae una bolsa distinta
  // (más o menos crédito aprobado sin firmar) y un número distinto de días
  // hábiles. Así que la meta sale de dos cosas medidas, no inventadas:
  //   1. cuánto desembolsa Kevin, en plata, POR CADA DÍA que sí trabaja
  //   2. cuántos días hábiles tiene esta semana en concreto
  // Meta de la semana = esa tasa diaria × sus días hábiles, aplicada sobre
  // la bolsa de ESA semana. Una semana con más días hábiles o más bolsa
  // pide más; una semana corta o con poca bolsa pide menos.
  //
  // OJO CON EL BENCHMARK: hoy solo hay 5 semanas de historial, y las 5 son
  // de Kevin al 50% de dedicación — no existe todavía ni una semana a
  // dedicación completa contra la cual calibrar. Con una muestra así de
  // chica y así de floja, la MEDIANA es "lo típico de un operador a medio
  // tiempo", que es un piso, no una meta. Por eso el benchmark arranca del
  // MEJOR resultado que YA se demostró (el máximo de las semanas con al
  // menos 2 días de gestión), no el promedio.
  //
  // Y sobre ese mejor resultado se pone un ESTIRÓN: esto es una startup, no
  // se compite contra el pasado, se compite contra lo que todavía no se ha
  // hecho. STRETCH = 1.4 exige un 40% más que la mejor semana ya demostrada.
  // Se va a recalibrar sola — y a subir de nuevo — en cuanto haya semanas
  // reales a dedicación completa (desde el KEVIN_100_DESDE) para comparar.
  var STRETCH = 1.4;
  var KEVIN_100_DESDE = '2026-09-14';

  // Dias habiles de CALENDARIO entre dos fechas (lunes a viernes), sin
  // depender de hasta donde llego el ultimo refresh de datos. Es la base
  // correcta para "dias habiles de esta semana/mes": si se calculara sobre
  // diasHabiles (que solo llega hasta spanFin, el ultimo dia CON DATOS),
  // un mes recien empezado con solo 3 dias de datos se leia como "el mes ya
  // tiene sus 3 dias habiles completos" en vez de "van 3 de ~21".
  function habilesCalendario_(desde, hasta) {
    if (hasta < desde) return 0;
    var n = 0;
    for (var d = parseISO_(desde); fmtFecha_(d) <= hasta; d = sumarDias_(d, 1)) {
      var dow = d.getDay();
      if (dow !== 0 && dow !== 6) n++;
    }
    return n;
  }
  var hoyParaHabiles_ = hoyISO_();
  var diasHabTotalSemana = {}, diasHabTranscurridosSemana = {};
  semanasTodas.forEach(function (w) {
    var finSemana = fmtFecha_(sumarDias_(parseISO_(w.semana), 4));
    var finTranscurrido = finSemana < hoyParaHabiles_ ? finSemana : hoyParaHabiles_;
    diasHabTotalSemana[w.semana] = habilesCalendario_(w.semana, finSemana);
    diasHabTranscurridosSemana[w.semana] = habilesCalendario_(w.semana, finTranscurrido);
  });
  // Retrocompatibilidad de nombre: el resto del bloque de mas abajo (y el
  // payload de depuracion) sigue leyendo diasHabilesPorSemana.
  var diasHabilesPorSemana = diasHabTranscurridosSemana;

  // La tasa objetivo de la SEMANA es su propia calibracion, NO la tasa
  // diaria multiplicada por los dias habiles transcurridos. Multiplicar asi
  // tenia el mismo defecto que ya se corrigio en el mes: una semana recien
  // empezada (pocos dias habiles, bolsa todavia chica) recibia una meta
  // chiquita en las DOS puntas a la vez, asi que el lunes y el martes de la
  // semana en curso pedian menos que un solo dia bueno del historico (66M
  // el 26-ago contra 24M de meta para una semana de 2 dias). Se calibra
  // igual que el mes: la mejor SEMANA ya cerrada (desembolsado / bolsa de
  // esa semana), con el mismo estiron, aplicada sobre la bolsa PROYECTADA a
  // los 5 dias habiles completos cuando la semana todavia esta en curso.
  var basePorSemana = [];
  semanasTodas.forEach(function (w) {
    var finSemana = fmtFecha_(sumarDias_(parseISO_(w.semana), 4));
    if (finSemana > hoyParaHabiles_) return;   // semana en curso: no calibra
    var mF = (cohAg[w.semana] && cohAg[w.semana].mFirmo) || 0;
    if (!w.mOportunidad) return;
    basePorSemana.push((mF / w.mOportunidad) * 100);
  });
  // Si NINGUNA semana cerrada tiene firmas (pasa en cuanto se filtra fino:
  // un solo origen, un solo rol), el mejor resultado historico es 0 y la
  // meta saldria en $0 — con bolsa de por medio, "0 de meta $0" se lee como
  // un error de cuentas. Sin base para calibrar, la meta NO existe: null, y
  // la tarjeta muestra su estado vacio en vez de un cero falso.
  var mejorSemana = basePorSemana.length ? Math.max.apply(null, basePorSemana) : 0;
  var tasaObjetivoSemana = mejorSemana > 0
    ? Math.min(100, Math.round(mejorSemana * STRETCH * 10) / 10)
    : null;

  // La meta de CONTACTO es distinta a la de desembolso: ya es un porcentaje
  // (contestó / casos trabajados), así que no hace falta proyectarla contra
  // días ni bolsa — la tasa objetivo es directamente el mejor resultado
  // histórico entre las semanas con al menos 2 días de gestión.
  var contactosHist = semanas
    .filter(function (w) { return w.dias >= 2; })
    .map(function (w) { return w.tasaContacto; });
  // Misma regla que la meta de desembolso: sin un mejor resultado > 0 no
  // hay con qué calibrar, y una meta en 0% no es una meta.
  var mejorContacto = contactosHist.length ? Math.max.apply(null, contactosHist) : 0;
  var tasaObjetivoContacto = mejorContacto > 0
    ? Math.min(100, mejorContacto * STRETCH) : null;

  // La meta de COBERTURA es la tercera pata: antes de poder contactar o
  // desembolsar nada, el equipo tiene que ALCANZAR A TRABAJAR la bolsa. Sin
  // esta meta, una semana con buen desembolso pero que solo tocó el 10% de
  // la bolsa se ve bien y no lo está: le queda casi toda la plata sin
  // intentar. Misma lógica que contacto: ya es un porcentaje (monto
  // trabajado / bolsa de la semana), el mejor resultado histórico es la meta.
  var coberturaHist = semanas
    .filter(function (w) { return w.dias >= 2 && w.cobertura !== null; })
    .map(function (w) { return w.cobertura; });
  var mejorCobertura = coberturaHist.length ? Math.max.apply(null, coberturaHist) : 0;
  var tasaObjetivoCobertura = mejorCobertura > 0
    ? Math.min(100, mejorCobertura * STRETCH) : null;

  // Aca SI se usa semanasTodas (sin el filtro de 5 casos): la meta tiene
  // que poder mostrar la semana EN CURSO aunque todavia lleve pocos casos,
  // igual que ya hace la version mensual — si no, "esta semana" muestra una
  // semana vieja mientras "este mes" muestra el mes de hoy, y las dos
  // tarjetas dejan de ser comparables.
  var metas = tasaObjetivoSemana === null ? [] : semanasTodas.map(function (w) {
    var diasHabTotal = diasHabTotalSemana[w.semana] || 5;
    var diasHabTranscurridos = diasHabTranscurridosSemana[w.semana] || 0;
    var finSemana = fmtFecha_(sumarDias_(parseISO_(w.semana), 4));
    var esSemanaEnCurso = finSemana > hoyParaHabiles_;
    var bolsaProyectada = (esSemanaEnCurso && diasHabTranscurridos)
      ? Math.round(((w.mOportunidad || 0) / diasHabTranscurridos) * diasHabTotal)
      : (w.mOportunidad || 0);
    var metaPct = tasaObjetivoSemana;
    var metaMonto = Math.round(bolsaProyectada * metaPct / 100);
    var mF = Math.round((cohAg[w.semana] && cohAg[w.semana].mFirmo) || 0);
    return {
      // Mismo par de campos que metasMes, y con el mismo significado:
      // diasHabiles = TOTAL del periodo (5, salvo festivos), diasHabiles-
      // Transcurridos = de esos, cuantos ya pasaron. Antes "diasHabiles" a
      // secas significaba cosas distintas en semana y mes — el frontend
      // que arma el texto de asistencia ya asume esta convencion unica.
      semana: w.semana, dias: w.dias,
      diasHabiles: diasHabTranscurridos, diasHabilesTotal: diasHabTotal,
      bolsa: w.mOportunidad, bolsaProyectada: bolsaProyectada,
      proyectado: esSemanaEnCurso,
      metaPct: metaPct, meta: metaMonto,
      desembolsado: mF,
      cumplimiento: metaMonto ? Math.round((mF / metaMonto) * 1000) / 10 : null,
      contacto: w.tasaContacto,
      cumplimientoContacto: tasaObjetivoContacto
        ? Math.round((w.tasaContacto / tasaObjetivoContacto) * 1000) / 10 : null,
      cobertura: w.cobertura,
      cumplimientoCobertura: (tasaObjetivoCobertura && w.cobertura !== null)
        ? Math.round((w.cobertura / tasaObjetivoCobertura) * 1000) / 10 : null
    };
  });

  // ---- LA MISMA META, PERO POR MES -------------------------------------
  // Mismas tres tasas objetivo (ya son "por día trabajado", no "por
  // semana"), aplicadas a los días hábiles del MES en vez de la semana, y
  // sobre la bolsa que entró ese mes. Es la misma meta vista con otro lente,
  // no una segunda calibración.
  var oprMes = {};
  if (spanIni) {
    recorrerResc_(spanIni, spanFin, function (r) {
      var k = r.fecha.substring(0, 7);
      if (!oprMes[k]) oprMes[k] = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      var o = oprMes[k];
      o.apr += r.apr; o.firm += r.conv; o.mApr += r.mApr; o.mFirm += r.mConv;
    });
  }
  var mesAg = {};
  hjGes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    var k = fch.substring(0, 7);
    if (!mesAg[k]) mesAg[k] = { mes: k, casos: 0, contesto: 0, monto: 0, dias: {} };
    var b4 = mesAg[k];
    b4.casos += num_(r.casos);
    b4.contesto += num_(r.contesto);
    // La cobertura del mes compara monto TRABAJADO contra monto que ENTRÓ
    // (oprMes, que sale de CREDITO_DIA). Si un día ya tiene gestión pero
    // CREDITO_DIA todavía no se refrescó para ese día (como el 3-sep en
    // este corte), oprMes ya lo excluye solo — pero si el trabajado de ese
    // mismo día SÍ se suma, la cobertura se infla comparando plata
    // trabajada de un día contra la bolsa de días distintos. Por eso el
    // trabajado también se corta en ultimoCredito, igual que la bolsa.
    if (!ultimoCredito || fch <= ultimoCredito) {
      b4.monto += num_(r.monto_trabajado);
    }
    b4.dias[fch] = true;
  });
  var cohAgMes = {};
  // firmasCountMes: cuantos CASOS (no plata) firmaron ese mes — la misma
  // unidad que gestion_historica.firmas, para poder unir la tasa de firma
  // de hoy con la de antes en una sola serie comparable (ver 'historiaUnida'
  // mas abajo).
  var firmasCountMes = {};
  hjDes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    if (String(r.desenlace || '') !== 'firmo') return;
    var k = fch.substring(0, 7);
    cohAgMes[k] = (cohAgMes[k] || 0) + num_(r.monto);
    firmasCountMes[k] = (firmasCountMes[k] || 0) + num_(r.casos);
  });
  // La tasa objetivo del MES es su propia calibración, NO la del día
  // multiplicada por los días hábiles del mes. Multiplicar así doblaba el
  // crecimiento: metaPct crecía con los días Y bolsaProyectada también crece
  // con los días (es la bolsa acumulada del mes), así que la meta terminaba
  // creciendo con el CUADRADO de los días — por eso agosto pedía 3.388M
  // (18x lo desembolsado) y septiembre, apenas proyectado a 6 días, ya
  // pedía 4.012M. Se calibra igual que la semana: el mejor MES ya cerrado
  // (desembolsado / bolsa de ese mes), con el mismo ESTIRÓN. Con un solo mes
  // cerrado hoy (agosto) el objetivo parte de ahí y se recalibra solo en
  // cuanto haya más meses completos para comparar — mismo principio que ya
  // aplica la meta semanal.
  var basePorMes = [];
  Object.keys(mesAg).forEach(function (k) {
    var anioM = Number(k.substring(0, 4)), mesM = Number(k.substring(5, 7));
    var finMesCalK = fmtFecha_(sumarDias_(new Date(anioM, mesM, 1), -1));
    if (finMesCalK > hoyParaHabiles_) return;   // mes en curso: no calibra, distorsiona
    var oK = oprMes[k] || { mApr: 0, mFirm: 0 };
    var bolsaK = oK.mApr - oK.mFirm;
    if (!bolsaK) return;
    basePorMes.push(((cohAgMes[k] || 0) / bolsaK) * 100);
  });
  // Igual que la semanal: sin un mes cerrado CON firmas no hay como
  // calibrar, y la meta en $0 se lee como error. null = tarjeta vacia.
  var mejorMes = basePorMes.length ? Math.max.apply(null, basePorMes) : 0;
  var tasaObjetivoMes = mejorMes > 0
    ? Math.min(100, Math.round(mejorMes * STRETCH * 10) / 10)
    : null;

  var metasMes = tasaObjetivoMes === null ? [] : Object.keys(mesAg).sort()
    .map(function (k) {
      var b4 = mesAg[k];
      var dias = Object.keys(b4.dias).length;
      var o = oprMes[k] || { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      var mOportunidad = Math.round(o.mApr - o.mFirm);
      // La meta mensual tiene que ser la meta del MES COMPLETO, no una que
      // crece dia a dia — si no, "vamos al 15%" un dia y "al 90%" el
      // siguiente sin que haya pasado nada, solo porque la meta se iba
      // recalculando mas chica. Dos piezas separadas:
      //   diasHabTotal   dias habiles de TODO el mes (el mes ya acabado, o
      //                  los ~21 que le tocan si sigue en curso)
      //   bolsaProyectada  la bolsa que ha entrado por dia, proyectada a
      //                  esos mismos dias totales — el mes en curso solo
      //                  trae bolsa de los dias que ya pasaron, y sin
      //                  proyectar, la meta se ve deflactada exactamente
      //                  igual que antes, solo que ahora en el numerador.
      var iniMes = k + '-01';
      var anioMes = Number(k.substring(0, 4)), mesMes = Number(k.substring(5, 7));
      var finMesCal = fmtFecha_(sumarDias_(new Date(anioMes, mesMes, 1), -1));
      var esMesEnCurso = finMesCal > hoyParaHabiles_;
      var finTranscurrido = esMesEnCurso ? hoyParaHabiles_ : finMesCal;
      var diasHabTotal = habilesCalendario_(iniMes, finMesCal);
      var diasHabTranscurridos = habilesCalendario_(iniMes, finTranscurrido);
      var bolsaProyectada = (esMesEnCurso && diasHabTranscurridos)
        ? Math.round((mOportunidad / diasHabTranscurridos) * diasHabTotal)
        : mOportunidad;
      var metaPct = tasaObjetivoMes;
      var metaMonto = Math.round(bolsaProyectada * metaPct / 100);
      var mF = Math.round(cohAgMes[k] || 0);
      var contacto = b4.casos
        ? Math.round((b4.contesto / b4.casos) * 1000) / 10 : 0;
      var cobertura = mOportunidad
        ? Math.round((b4.monto / mOportunidad) * 1000) / 10 : null;
      return {
        // Misma convencion que "metas" (semana): diasHabiles = TRANSCURRIDOS,
        // diasHabilesTotal = el periodo completo.
        mes: k, dias: dias, diasHabiles: diasHabTranscurridos,
        diasHabilesTotal: diasHabTotal,
        bolsa: mOportunidad, bolsaProyectada: bolsaProyectada,
        proyectado: esMesEnCurso,
        metaPct: metaPct, meta: metaMonto, desembolsado: mF,
        cumplimiento: metaMonto ? Math.round((mF / metaMonto) * 1000) / 10 : null,
        contacto: contacto,
        cumplimientoContacto: tasaObjetivoContacto
          ? Math.round((contacto / tasaObjetivoContacto) * 1000) / 10 : null,
        cobertura: cobertura,
        cumplimientoCobertura: (tasaObjetivoCobertura && cobertura !== null)
          ? Math.round((cobertura / tasaObjetivoCobertura) * 1000) / 10 : null
      };
    }).filter(function (x) { return x.dias >= 2; });

  // ---- LA MISMA META, PERO PARA EL RANGO EXACTO ELEGIDO -----------------
  // Pedido de Emmanuel 24-sep-2026: si el filtro global dice "24-ago a
  // 24-sep", la tarjeta tiene que mostrar EXACTAMENTE esos 32 días, no
  // aproximar al mes calendario que toca el final del rango (que es lo que
  // hacian "metas"/"metasMes" solas, disenadas para el selector local
  // semana/mes, no para un rango libre). Mismo modelo de las dos de arriba
  // (mismas tasaObjetivo* ya calibradas, %-based sobre bolsa), solo que
  // agregado sobre R.inicio..R.fin literal en vez de una semana o mes fijo.
  var diasHabTotalRango = habilesCalendario_(R.inicio, R.fin);
  var finTranscurridoRango = R.fin < hoyParaHabiles_ ? R.fin : hoyParaHabiles_;
  var diasHabTranscurridosRango = habilesCalendario_(R.inicio, finTranscurridoRango);
  var esRangoEnCurso = R.fin > hoyParaHabiles_;
  var oAprRango = 0, oFirmRango = 0;
  Object.keys(oprDia).forEach(function (d) {
    if (d < R.inicio || d > R.fin) return;
    oAprRango += oprDia[d].mApr; oFirmRango += oprDia[d].mFirm;
  });
  var mOportunidadRango = Math.round(oAprRango - oFirmRango);
  var casosRango = 0, contestoRango = 0, montoRango = 0, diasConGestionRango = {};
  hjGes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (fch < R.inicio || fch > R.fin) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    casosRango += num_(r.casos); contestoRango += num_(r.contesto);
    if (!ultimoCredito || fch <= ultimoCredito) montoRango += num_(r.monto_trabajado);
    diasConGestionRango[fch] = true;
  });
  var mFRango = 0;
  hjDes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (fch < R.inicio || fch > R.fin) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    if (String(r.desenlace || '') !== 'firmo') return;
    mFRango += num_(r.monto);
  });
  var bolsaProyectadaRango = (esRangoEnCurso && diasHabTranscurridosRango)
    ? Math.round((mOportunidadRango / diasHabTranscurridosRango) * diasHabTotalRango)
    : mOportunidadRango;
  var contactoRango = casosRango ? Math.round((contestoRango / casosRango) * 1000) / 10 : 0;
  var coberturaRango = mOportunidadRango
    ? Math.round((montoRango / mOportunidadRango) * 1000) / 10 : null;
  // Se arma con las dos lentes (tasa calibrada por semana y por mes) sobre
  // los MISMOS datos exactos del rango — el toggle "esta semana"/"este mes"
  // deja de decidir QUE DIAS se miran (eso ya lo decide el filtro global,
  // section 13) y pasa a decidir solo con QUE VARA se compara.
  function armarMetaRango_(tasaObjetivo) {
    var metaMonto = tasaObjetivo
      ? Math.round(bolsaProyectadaRango * tasaObjetivo / 100) : null;
    return {
      dias: Object.keys(diasConGestionRango).length,
      diasHabiles: diasHabTranscurridosRango, diasHabilesTotal: diasHabTotalRango,
      bolsa: mOportunidadRango, bolsaProyectada: bolsaProyectadaRango,
      proyectado: esRangoEnCurso,
      metaPct: tasaObjetivo, meta: metaMonto, desembolsado: Math.round(mFRango),
      cumplimiento: metaMonto ? Math.round((mFRango / metaMonto) * 1000) / 10 : null,
      contacto: contactoRango,
      cumplimientoContacto: tasaObjetivoContacto
        ? Math.round((contactoRango / tasaObjetivoContacto) * 1000) / 10 : null,
      cobertura: coberturaRango,
      cumplimientoCobertura: (tasaObjetivoCobertura && coberturaRango !== null)
        ? Math.round((coberturaRango / tasaObjetivoCobertura) * 1000) / 10 : null
    };
  }
  var metaRango = armarMetaRango_(tasaObjetivoMes);
  var metaRangoSemanal = armarMetaRango_(tasaObjetivoSemana);

  // ---- META "RESCATE TOTAL" (todas las palancas, no solo Kevin) --------
  // Corregido el 9-sep-2026: la primera version de esto media TODA la
  // empresa (~42x Kevin, sin sentido para esta pestana). Rescate total es
  // los desembolsos que tardaron MAS de 2 dias en firmar — la definicion
  // de "necesito rescate", venga la ayuda de Kevin, de otra palanca
  // futura, o de nadie (y aun asi tardo). Sigue siendo mucho mas grande
  // que Kevin (agosto: $919,5M rescate total contra $311M de Kevin, ~3x)
  // porque Kevin hoy no alcanza a tocar todo lo que cae en esa definicion
  // — la diferencia ES el argumento para sumar mas palancas.
  // No comparte bolsa ni tasa con la meta de Kevin: es una meta EN PESOS,
  // el mejor periodo ya cerrado x 1.4, sin proyectar contra ninguna
  // oportunidad (esta poblacion no se mide contra una bolsa de "aprobado
  // sin firmar" del dia, se mide contra si misma en el tiempo).
  var rescateTotalPorDia = {};
  hjDesembRescateTotal.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
    rescateTotalPorDia[fch] = { casos: num_(r.casos), monto: num_(r.monto) };
  });
  var rescateTotalPorSemana = {}, rescateTotalPorMes = {};
  Object.keys(rescateTotalPorDia).forEach(function (fch) {
    var b = rescateTotalPorDia[fch];
    var ks = lunesISO_(fch), km = fch.substring(0, 7);
    if (!rescateTotalPorSemana[ks]) rescateTotalPorSemana[ks] = { semana: ks, casos: 0, monto: 0 };
    rescateTotalPorSemana[ks].casos += b.casos; rescateTotalPorSemana[ks].monto += b.monto;
    if (!rescateTotalPorMes[km]) rescateTotalPorMes[km] = { mes: km, casos: 0, monto: 0 };
    rescateTotalPorMes[km].casos += b.casos; rescateTotalPorMes[km].monto += b.monto;
  });

  var mejorSemanaRescateTotal = 0;
  Object.keys(rescateTotalPorSemana).forEach(function (k) {
    var finSemanaG = fmtFecha_(sumarDias_(parseISO_(k), 4));
    if (finSemanaG > hoyParaHabiles_) return;   // semana en curso: no calibra
    if (rescateTotalPorSemana[k].monto > mejorSemanaRescateTotal) mejorSemanaRescateTotal = rescateTotalPorSemana[k].monto;
  });
  var metaRescateTotalSemana = mejorSemanaRescateTotal > 0
    ? Math.round(mejorSemanaRescateTotal * STRETCH) : null;

  var mejorMesRescateTotal = 0;
  Object.keys(rescateTotalPorMes).forEach(function (k) {
    var finMesG = fmtFecha_(sumarDias_(new Date(Number(k.substring(0, 4)),
      Number(k.substring(5, 7)), 1), -1));
    if (finMesG > hoyParaHabiles_) return;   // mes en curso: no calibra
    if (rescateTotalPorMes[k].monto > mejorMesRescateTotal) mejorMesRescateTotal = rescateTotalPorMes[k].monto;
  });
  var metaRescateTotalMes = mejorMesRescateTotal > 0
    ? Math.round(mejorMesRescateTotal * STRETCH) : null;

  var metasRescateTotal = metaRescateTotalSemana === null ? [] : Object.keys(rescateTotalPorSemana).sort()
    .map(function (k) {
      var b = rescateTotalPorSemana[k];
      return {
        semana: k, casos: b.casos, desembolsado: b.monto, meta: metaRescateTotalSemana,
        cumplimiento: Math.round((b.monto / metaRescateTotalSemana) * 1000) / 10
      };
    });
  var metasMesRescateTotal = metaRescateTotalMes === null ? [] : Object.keys(rescateTotalPorMes).sort()
    .map(function (k) {
      var b = rescateTotalPorMes[k];
      return {
        mes: k, casos: b.casos, desembolsado: b.monto, meta: metaRescateTotalMes,
        cumplimiento: Math.round((b.monto / metaRescateTotalMes) * 1000) / 10
      };
    });

  // ---- RESCATE TOTAL, PERO PARA EL RANGO EXACTO ELEGIDO -----------------
  // Mismo pedido que metaRango (arriba): esta meta es en PESOS fijos, no
  // %-based, calibrada para una semana (5 dias habiles) o un mes (~21.7
  // dias habiles en promedio) — para un rango libre se prorratea la meta
  // fija por los dias habiles reales del rango elegido, y el desembolsado
  // se suma dia por dia, exacto. Dos lentes, igual que Kevin: el toggle
  // "esta semana"/"este mes" decide con que vara prorratear, no que dias
  // se miran (eso ya lo fija el filtro global).
  var casosRangoRT = 0, montoRangoRT = 0;
  Object.keys(rescateTotalPorDia).forEach(function (fch) {
    if (fch < R.inicio || fch > R.fin) return;
    casosRangoRT += rescateTotalPorDia[fch].casos;
    montoRangoRT += rescateTotalPorDia[fch].monto;
  });
  var DIAS_HAB_PROMEDIO_MES = 21.7;
  function armarMetaRangoRT_(metaMonto, diasHabBase) {
    var metaProrrateado = metaMonto
      ? Math.round((metaMonto / diasHabBase) * diasHabTotalRango) : null;
    return {
      casos: casosRangoRT, desembolsado: Math.round(montoRangoRT), meta: metaProrrateado,
      cumplimiento: metaProrrateado ? Math.round((montoRangoRT / metaProrrateado) * 1000) / 10 : null
    };
  }
  var metaRangoRescateTotalSemanal = armarMetaRangoRT_(metaRescateTotalSemana, 5);
  var metaRangoRescateTotalMensual = armarMetaRangoRT_(metaRescateTotalMes, DIAS_HAB_PROMEDIO_MES);

  // ---- LA LÍNEA DE TIEMPO, DÍA A DÍA, INDEPENDIENTE DEL FILTRO GLOBAL --
  // Todo el histórico de gestión (no solo el período elegido arriba), para
  // que el selector local de la gráfica (7d / 30d / 3 meses / todo) pueda
  // contar la historia completa sin depender de la fecha del tablero.
  var serieDiaria = Object.keys(gDia).sort().map(function (d) {
    var g2 = gDia[d];
    var o2 = oprDia[d];
    return {
      fecha: d,
      trabajado: Math.round(g2.monto),
      desembolsado: Math.round(g2.mFirmo),
      casos: g2.casos,
      contesto: g2.contesto,
      entroMonto: o2 ? Math.round(o2.mApr - o2.mFirm) : 0,
      tasaContacto: g2.casos
        ? Math.round((g2.contesto / g2.casos) * 1000) / 10 : null,
      cobertura: (o2 && (o2.mApr - o2.mFirm) > 0 && g2.monto > 0)
        ? Math.round((g2.monto / (o2.mApr - o2.mFirm)) * 1000) / 10 : null
    };
  });

  f.gestion = {
    hay: bTot > 0,
    kevin: {
      corteSoftware: GES_ARRANQUE,
      dedicacionHoy: 50,
      dedicacion100Desde: KEVIN_100_DESDE,
      nota: 'Antes del 31 de julio de 2026 el rescate se trabajaba a mano: ' +
        'un Excel con las sedes y los pacientes en ventana, priorizado por ' +
        'score crediticio, con dedicación del 100% — así se lograron los ' +
        'resultados históricos de más abajo. Desde el 31 de julio hay ' +
        'software (clasifica por WhatsApp: contactado, no contesta, ' +
        'pospone, en duda), pero Kevin trabaja al 50% con otras ' +
        'responsabilidades — por eso hay días sin gestión. Vuelve a ' +
        'dedicación completa desde el ' + KEVIN_100_DESDE + '.'
    },
    // ---- HISTORIA LARGA: la operacion anterior (oct-2024 a jul-2026) ----
    // gestion_historica es la operacion MANUAL de antes del software (31-jul
    // -2026): 15 a 21 personas del equipo comercial entero, sin priorizacion
    // ni la taxonomia de causales de hoy, y CERO solape con RESCATE_GESTION.
    // No hay plata (gestion_historica no trae monto): solo casos, firmas y
    // tasa de cierre. Se muestra como CONTEXTO de largo plazo, marcado como
    // discontinuo — no se une con la serie de hoy como si fuera la misma
    // medicion. Pedido explicito: la vista de "como va la gestion" solo
    // tenia 22 dias (desde que arranco el software) y hacia falta mas
    // historial para juzgar la tendencia.
    historia: hjHist.map(function (r) {
      var casos = num_(r.casos), firmas = num_(r.firmas);
      return { mes: String(r.mes || ''), casos: casos, firmas: firmas,
               personas: num_(r.personas),
               tasaFirma: casos ? Math.round((firmas / casos) * 1000) / 10 : 0,
               porWhatsapp: num_(r.por_whatsapp), porLlamada: num_(r.por_llamada) };
    }),
    // ---- UNA SOLA SERIE: antes + ahora, misma unidad -----------------
    // Pedido explicito (8-sep-2026): un solo grafico ejecutivo que cuente
    // la historia completa (antes/despues del software) y explique la meta,
    // sin eje doble. La unica metrica que existe en las DOS operaciones con
    // la MISMA definicion es la tasa de firma (firmas/casos). La plata SI
    // se pudo reconstruir para 'antes' (ver hjHistPlata arriba), aunque por
    // una via distinta (documento -> t_sol_v2), asi que tambien viaja en la
    // misma serie. meses ANTES: hjHist (casos/firmas) + hjHistPlata (monto,
    // reconstruido). meses AHORA: mesAg (casos) + firmasCountMes (firmo) +
    // cohAgMes (monto) — las mismas cuentas que ya usa metasMes arriba.
    historiaUnida: (function () {
      var antes = {};
      hjHist.forEach(function (r) {
        var k = String(r.mes || '');
        if (k) antes[k] = { casos: num_(r.casos), firmas: num_(r.firmas) };
      });
      var platAntes = {};
      hjHistPlata.forEach(function (r) {
        var k = String(r.mes || '');
        if (k) platAntes[k] = num_(r.monto_reconstruido);
      });
      // El quiebre real es a mitad de mes (31-jul-2026): ese mes YA tiene
      // fila completa en 'antes' (el mes entero, operacion vieja). El mismo
      // mes en mesAg trae solo el ultimo dia (1 caso) — sumarlo pisaria un
      // mes real por una esquirla de un dia. Por eso 'ahora' solo entra
      // desde el mes SIGUIENTE al ultimo que ya trae 'antes'.
      var ultimoMesAntes = Object.keys(antes).sort().slice(-1)[0] || '';
      var todos = {};
      Object.keys(antes).forEach(function (k) { todos[k] = antes[k]; });
      Object.keys(mesAg).forEach(function (k) {
        if (k <= ultimoMesAntes) return;
        todos[k] = { casos: mesAg[k].casos, firmas: firmasCountMes[k] || 0 };
      });
      var meses = Object.keys(todos).sort();
      var hoyMes7 = hoyParaHabiles_.substring(0, 7);
      return meses.map(function (k) {
        var b = todos[k];
        // Plata: reconstruida (platAntes) para 'antes', el acumulado real
        // (cohAgMes) para 'ahora'. Si ninguna fuente tiene ese mes, null —
        // no cero: cero dice "no se desembolso nada" y null dice "no hay
        // como saberlo".
        var desembolsado = k > ultimoMesAntes
          ? (cohAgMes[k] !== undefined ? Math.round(cohAgMes[k]) : null)
          : (platAntes[k] !== undefined ? Math.round(platAntes[k]) : null);
        return {
          mes: k, casos: b.casos, firmas: b.firmas,
          tasaFirma: b.casos ? Math.round((b.firmas / b.casos) * 1000) / 10 : null,
          desembolsado: desembolsado,
          ahora: k > ultimoMesAntes,
          enCurso: k === hoyMes7
        };
      });
    })(),
    // La meta de la UNA-sola-grafica: el mejor mes YA CERRADO (de toda la
    // serie, antes o ahora, el que sea) con estiron — mismo principio que
    // tasaObjetivoMes/Semana, aplicado a esta metrica en vez de a la plata.
    tasaObjetivoFirma: (function () {
      var candidatos = [];
      hjHist.forEach(function (r) {
        var casos = num_(r.casos), firmas = num_(r.firmas);
        if (casos) candidatos.push((firmas / casos) * 100);
      });
      Object.keys(mesAg).forEach(function (k) {
        var fin = fmtFecha_(sumarDias_(new Date(Number(k.substring(0, 4)),
          Number(k.substring(5, 7)), 1), -1));
        if (fin > hoyParaHabiles_) return;   // mes en curso: no calibra
        var casos = mesAg[k].casos, firmas = firmasCountMes[k] || 0;
        if (casos) candidatos.push((firmas / casos) * 100);
      });
      // Sin ningun mes con firmas no hay meta: null, y la grafica se pinta
      // sin la linea de referencia en vez de con una meta de 0%.
      var mejor = candidatos.length ? Math.max.apply(null, candidatos) : 0;
      return mejor > 0
        ? Math.min(100, Math.round(mejor * STRETCH * 10) / 10)
        : null;
    })(),
    metas: metas,
    metasMes: metasMes,
    metaRango: metaRango,
    metaRangoSemanal: metaRangoSemanal,
    metasRescateTotal: metasRescateTotal,
    metasMesRescateTotal: metasMesRescateTotal,
    metaRangoRescateTotalMensual: metaRangoRescateTotalMensual,
    metaRangoRescateTotalSemanal: metaRangoRescateTotalSemanal,
    metaRescateTotalSemana: metaRescateTotalSemana,
    metaRescateTotalMes: metaRescateTotalMes,
    tasaObjetivoSemana: tasaObjetivoSemana,
    tasaObjetivoMes: tasaObjetivoMes,
    tasaObjetivoContacto: tasaObjetivoContacto,
    tasaObjetivoCobertura: tasaObjetivoCobertura,
    serieDiaria: serieDiaria,
    semanas: semanas,
    calendario: calendario,
    // El hueco de dias sin gestion, declarado con su verificacion: si
    // faltara solo por un problema de extraccion, estos dias SI tendrian
    // creditos moviendose y gestion en cero seria sospechoso. Se cuenta
    // cuantos de los dias vacios tienen credito (oprDia) para distinguir
    // "no se registro nada" de "no se pudo cruzar el dato".
    diasHabiles: diasHabiles.length,
    diasSinGestion: diasSinGestion.length,
    diasSinGestionConCredito: sinGestionConCredito,
    // El stock vivo va al lado del calendario para que el flujo diario no
    // se confunda con todo lo que hay.
    stock: { casos: Math.round(stockN), monto: Math.round(stockM),
             corte: spanFin < ultimoCredito ? spanFin : ultimoCredito },
    ultimoCredito: ultimoCredito,
    cuadraMonto: cuadraMonto,
    whatsapp: waHay ? {
      embudo: embudoWa,
      universo: waAg.universo,
      contactados: waAg.enviados,
      // Aparte del embudo (ver comentario arriba de embudoWa): no es
      // subconjunto de "Leido" a proposito, asi que no se dibuja en la
      // misma barra.
      respondieron: waAg.respuestas,
      // Cuantos aprobados del rango quedaron FUERA por haber avanzado ya
      // (ver ESTADOS_YA_AVANZO). Va al payload para declararlo en pantalla:
      // un universo recortado que no se declara se lee como dato bajo.
      yaAvanzaron: waYaAvanzaron,
      periodo: waFechaIni + ' a ' + waFechaFin,
      // Cruce real por paciente (celular contra eventos_hilos), no la
      // aproximación por campaña de arriba. sinMensajePendiente queda en
      // true solo si no hay NINGUNA de las dos tablas.
      sinMensajePendiente: !aprobMsj,
      // true = viene de la foto de una sola fila (no responde al filtro).
      // La tarjeta lo declara para que nadie lea un numero fijo como si se
      // hubiera movido con el rango.
      aprobMsjEsFoto: aprobMsjEsFoto,
      aprobadosConTelefono: aprobMsj ? num_(aprobMsj.aprobados_con_telefono) : null,
      aprobadosSinMensaje: aprobMsj ? num_(aprobMsj.sin_mensaje) : null,
      aprobadosConMensaje: aprobMsj ? num_(aprobMsj.con_mensaje) : null
    } : null,
    fuenteViva: fuenteViva,
    foto: fuenteViva ? null : {
      fecha: FOTO_GESTION.fecha,
      ventanaEmbudo: FOTO_GESTION.ventanaEmbudo,
      ventanaPool: FOTO_GESTION.ventanaPool
    },
    embudo: embudoGes,
    // Las causales ya vienen partidas: solo las de quien SI hablo. Las de
    // no-contacto viajan aparte para poder decir en pantalla de donde
    // salieron, en vez de que desaparezcan sin explicacion.
    causales: cauReal,
    causalesEmbudo: cauEmbudo,
    hablaron: hablaron,
    casosSinContacto: bTot - hablaron,
    cuadraCausal: cuadraCausal,
    etiquetaPeriodo: R.inicio + ' a ' + R.fin,
    etiquetaPrev: R.prevInicio + ' a ' + R.prevFin,
    // Si hay filtro puesto pero la fuente no trae sede, se avisa: un bloque
    // que ignora el filtro y no lo dice se lee como si lo respetara.
    filtroAplicado: filtraGes,
    filtroImposible: fuenteViva && !gesConSede && !U.sinFiltro,
    // Limites del dato que hay que leer JUNTO a los numeros, no en un pie de
    // pagina. Cada uno cambia como se lee una cifra de arriba.
    limites: [
      'La tasa de cierre sobre casos trabajados es un PISO, no el resultado: ' +
        'de los casos de este período la mayoría sigue aprobada y dentro de ' +
        'su ventana de 30 días. La cifra que sí se puede comparar entre ' +
        'períodos es el cierre sobre los casos ya resueltos.',
      'La cobertura no es una meta de esfuerzo. La lista está priorizada por ' +
        'monto: tocar el 100% de los casos bajaría el ticket promedio y el ' +
        'cierre. Lo que la cobertura dice es cuánta plata queda sin que ' +
        'nadie la llame.',
      'La causal describe cómo terminó la LLAMADA, no cómo terminó el caso: ' +
        'buena parte de las firmas quedan registradas como «No contesta» ' +
        'porque el paciente cerró después por otro canal (WhatsApp, por ' +
        'ejemplo) que hoy no se puede cruzar contra el caso.',
      'Las llamadas que se cuentan son las que el equipo registra a mano. ' +
        'Wolkvox no exporta a BigQuery, así que no hay log de marcación: ni ' +
        'duración, ni intentos, ni horas.',
      'El «133 rescatados / $892 M» del correo diario se calcula sobre todo ' +
        'el pool trabajable con una consulta que el tablero todavía no ' +
        'replica. Acá está lo gestionado, que es un subconjunto: los dos ' +
        'medirían cosas distintas con el mismo nombre.'
    ]
  };

  // ---- CUÁNDO se firma dentro de la ventana de 30 días ---------------
  // Esta era la lectura invertida del frente. El tablero celebraba las
  // firmas del día 16 al 30 como "el comportamiento que el rescate busca
  // provocar", pero el reparto real dice otra cosa: el 68,9% de los
  // desembolsos ocurre en las primeras 24 horas y el 88,3% en los
  // primeros 3 días. La ventana de 30 días es teórica; la decisión del
  // paciente se toma en 72 horas.
  //
  // Eso NO significa que el rescate no sirva: significa que el territorio
  // del rescate es todo lo que pasa del día 4 en adelante, y que hoy la
  // primera pieza sale al día 15, cuando ya se fue la mitad de la ventana.
  //
  // Ojo con la interpretación: esto es el reparto de las firmas que SÍ
  // ocurrieron, no una probabilidad condicional. No dice "quien no firmó
  // el día 3 no va a firmar"; dice dónde está la masa.
  function baldeDias_(b, desde, hasta) {
    var n = 0, m = 0;
    for (var d = desde; d <= hasta; d++) {
      n += b.dia[d] || 0;
      m += b.diaMonto[d] || 0;
    }
    return { n: n, monto: m };
  }
  var BALDES = [
    { etiqueta: 'Día 0 y 1', desde: 0, hasta: 1 },
    { etiqueta: 'Días 2 y 3', desde: 2, hasta: 3 },
    { etiqueta: 'Días 4 a 7', desde: 4, hasta: 7 },
    { etiqueta: 'Días 8 a 15', desde: 8, hasta: 15 },
    { etiqueta: 'Días 16 a 30', desde: 16, hasta: 30 }
  ];
  var totVent = A.dentro30 || 0;
  function pctV_(n) { return totVent ? Math.round((n / totVent) * 1000) / 10 : 0; }

  var primeras24 = baldeDias_(A, 0, 1);
  var hastaDia3 = baldeDias_(A, 0, 3);
  var dia4mas = baldeDias_(A, 4, 30);
  var dia4a15 = baldeDias_(A, 4, 15);
  var p24 = baldeDias_(P, 0, 1);
  var pTot = P.dentro30 || 0;

  f.kpis = [
    kpi_('Se firma en las primeras 24 horas', pctV_(primeras24.n), { formato: 'pct',
      sublabel: fNumSrv_(primeras24.n) + ' de ' + fNumSrv_(totVent) + ' desembolsos del período',
      // El KPI es un %, asi que su variacion va en PUNTOS, no en % de %.
      delta: (pTot && p24.n) ? Math.round((pctV_(primeras24.n) -
              (p24.n / pTot) * 100) * 10) / 10 : null,
      deltaEnPuntos: true,
      pendiente: !hayBQ, fuente: 'BigQuery · días entre aprobación y desembolso',
      color: 'verde',
      nota: 'La ventana de crédito es de 30 días, pero el paciente decide el mismo día. ' +
        'Al día 3 ya se firmó el ' + fPctSrv_(pctV_(hastaDia3.n)) + '.' }),
    kpi_('Territorio del rescate', dia4mas.n, { formato: 'num',
      sublabel: 'firmas del día 4 en adelante · ' + fPctSrv_(pctV_(dia4mas.n)) + ' del total',
      delta: null, pendiente: !hayBQ, fuente: 'BigQuery', color: 'amarillo',
      nota: 'Todo lo que se firma tarde es, por definición, lo único que una pieza de ' +
        'rescate puede mover. Es un territorio chico en firmas y grande en no-firmas: ' +
        'ahí están los créditos que se vencen.' }),
    kpi_('Plata de esas firmas tardías', Math.round(dia4mas.monto), { formato: 'copC',
      sublabel: 'crédito firmado después del día 3', delta: null,
      pendiente: !hayBQ, fuente: 'BigQuery', color: 'morado' }),
    kpi_('Ventanas medidas desde el contacto', 0, { formato: 'num',
      sublabel: 'días entre que escribimos y que firmó', pendiente: true,
      fuente: 'Hilos × BigQuery', color: 'azul',
      nota: 'Todo lo de arriba se mide desde la APROBACIÓN. Para saber si la pieza fue ' +
        'la que movió la firma hay que medir desde el CONTACTO, y eso necesita cruzar ' +
        'Hilos con BigQuery por teléfono. Sin eso, nada de este frente prueba causalidad.' })
  ];

  // Curva acumulada: es la forma más rápida de ver el colapso del día 3.
  var acum = 0;
  f.curva = [];
  for (var dd = 0; dd <= 30; dd++) {
    acum += A.dia[dd] || 0;
    f.curva.push({ dia: dd, firmas: A.dia[dd] || 0,
                   pctAcum: totVent ? Math.round((acum / totVent) * 1000) / 10 : 0 });
  }

  // Las tres ventanas del negocio en vez de los tramos por dia. Cada una
  // trae su comportamiento declarado y el medido, para poder contrastarlos.
  f.ventanas = ventanasOrdenadas_().map(function (v) {
    var b = A.vent[v.id] || { n: 0, monto: 0, suma: 0, dia: {} };
    function tramo(desde, hasta) {
      var n = 0;
      for (var d = desde; d <= hasta; d++) n += b.dia[d] || 0;
      return n;
    }
    return {
      id: v.id, ventana: v.id + ' · ' + v.nombre, nombre: v.nombre,
      comportamiento: v.comportamiento,
      especialidades: v.especialidades.length
        ? v.especialidades.join(' · ') : '(sin clasificar)',
      firmas: b.n, pct: pctV_(b.n), monto: b.monto,
      dias: b.n ? Math.round((b.suma / b.n) * 10) / 10 : 0,
      pctMismoDia: b.n ? Math.round((tramo(0, 0) / b.n) * 1000) / 10 : 0,
      pctHasta3: b.n ? Math.round((tramo(0, 3) / b.n) * 1000) / 10 : 0,
      pct16a30: b.n ? Math.round((tramo(16, 30) / b.n) * 1000) / 10 : 0,
      // El reparto interno de cada ventana, en % de SI MISMA: es lo que hace
      // comparables tres grupos de tamano muy distinto (16.081 contra 400).
      tramos: BALDES.map(function (t) {
        var n = tramo(t.desde, t.hasta);
        return { etiqueta: t.etiqueta,
                 pct: b.n ? Math.round((n / b.n) * 1000) / 10 : 0, n: n };
      }),
      curva: (function () {
        var acum = 0, out = [];
        for (var d = 0; d <= 30; d++) {
          acum += b.dia[d] || 0;
          out.push({ dia: d, pctAcum: b.n ? Math.round((acum / b.n) * 1000) / 10 : 0 });
        }
        return out;
      }())
    };
  }).filter(function (r) { return r.firmas > 0; });

  f.ventana = {
    filas: BALDES.map(function (b) {
      var r = baldeDias_(A, b.desde, b.hasta);
      return { balde: b.etiqueta, creditos: r.n, pct: pctV_(r.n), monto: r.monto };
    }).filter(function (r) { return r.creditos > 0; }),
    total: totVent,
    fuera: (A.b['rescate_31_60'] || 0) + (A.b['rescate_60_mas'] || 0),
    // La lectura que corrige el frente. Se arma con los números del período,
    // no a mano, para que no se desincronice como pasó con los textos de CONFIG.
    lectura: (function () {
      if (!totVent) return '';
      var A_ = null, C_ = null;
      (f.ventanas || []).forEach(function (v) {
        if (v.id === 'A') A_ = v;
        if (v.id === 'C') C_ = v;
      });
      if (!A_ || !C_) {
        return fPctSrv_(pctV_(hastaDia3.n)) + ' firma antes del día 4.';
      }
      // La lectura se arma con los numeros del periodo, no a mano, para que
      // no se desincronice. Ahora habla de CIERRE por ventana, que es lo que
      // el frente mide desde que dejo de contar el stock historico.
      var oC = null, oA = null;
      ((f.oportunidad && f.oportunidad.filas) || []).forEach(function (r) {
        if (r.id === 'C') oC = r;
        if (r.id === 'A') oA = r;
      });
      var base = 'La ventana larga concentra ' + fPctSrv_(A_.pct16a30) +
        ' de sus firmas entre el día 16 y el 30, contra ' + fPctSrv_(C_.pct16a30) +
        ' de la corta: el rescate sirve en cirugía plástica, no en odontología.';
      if (oC && oA && oC.apr && oA.apr) {
        base += ' Y cierra ' + fPctSrv_(oA.pct) + ' de lo que le aprueban contra ' +
          fPctSrv_(oC.pct) + ' de la corta, así que ahí están los ' +
          fCopSrv_(oA.mSinCerrar) + ' que se quedaron sin firmar.';
      }
      return base;
    }()),
    // Con una ventana de 30 días esto no debería existir: se muestra como
    // anomalía a revisar, no como logro del rescate.
    avisoFuera: ((A.b['rescate_31_60'] || 0) + (A.b['rescate_60_mas'] || 0))
      ? ((A.b['rescate_31_60'] || 0) + (A.b['rescate_60_mas'] || 0)) +
        ' desembolsos del período ocurrieron a más de 30 días de la ' +
        'aprobación, y con una ventana de 30 días eso no debería pasar. Lo más probable ' +
        'es que sean solicitudes re-aprobadas (un crédito nuevo sobre el mismo paciente) ' +
        'contadas contra la primera aprobación. Vale revisarlo antes de usarlo como cifra.'
      : ''
  };

  // El bloque que calculaba "WhatsApp de rescate (Hilos)" e "Historico del
  // canal" vivia aca, con dos pasadas completas sobre HILOS_BROADCAST. Se
  // quito: ninguno de sus resultados (bcA/bcP/serieWA/topCamp/hi/ventanas/
  // diasApagado) llegaba a f.*, asi que no pintaba nada — quedo huerfano
  // desde que el frente se reenfoco en la gestion humana (seccion 2-3) y
  // el canal automatico paso a leerse solo en F7.

  f.pendienteBQ = !hayBQ;
  f.notaBQ = notaBQ;
  f.textos = { funcionando: cfg.f4_funcionando || '', cuello: cfg.f4_cuello || '',
               atencion: cfg.f4_atencion || '',
               // Estos textos los escribe el equipo a mano y se desincronizan:
               // el de F4 llego a decir 170 firmas donde el KPI decia 52. La
               // fecha va a pantalla para que la proxima vez se note.
               fecha: cfg.textos_fecha || '' };
  return f;
}

// =====================================================================
// FRENTE 5 — Welli Points: adopción de la plataforma y su cruce con plata
//
// Reenfocado el 18-sep-2026 (segunda vuelta). La primera version media el
// efecto CAUSAL de canjear (antes/despues, control emparejado, intervalos
// de confianza) y Emmanuel la devolvio completa: eso no es lo que pide el
// negocio hoy. Lo que pide es mas directo y mas facil de leer de un
// vistazo:
//   1. Sedes habilitadas en WelliPoints, cuantas inician sesion, adopcion.
//   2. Las sedes que SI entran a points.welli.com.co, ¿desembolsan mas que
//      las que nunca entran?
//   3. Como se mueven, mes a mes, los WP ganados y la plata desembolsada.
//
// Esto es un CRUCE, no una prueba causal: no hay control emparejado ni
// intervalo de confianza. Sirve para lo que se pidio (ver el patron), no
// para afirmar que iniciar sesion CAUSA mas desembolso — las sedes que
// entran a la plataforma tambien tienden a ser las mas grandes/activas por
// otras razones. Un renglon lo dice en pantalla, no un capitulo entero.
//
// Fuente: welli-growth.wp_data (wellipoints_snapshot, wp_dashboard_visitas)
// cruzada contra CREDITO_DIA por id_internal. Dos hojas nuevas:
// WP_HABILITADAS (universo completo, antes solo se tenia el KPI agregado)
// y WP_LOGIN_SEDES (primer login por sede, antes solo se tenia top-20).
// =====================================================================

var _WP_HS2INT = null;

/** HubSpot id -> id_internal (UUID de plataforma), la llave con la que
    vienen TODAS las tablas de Welli Points. hechos_() ya guarda el id de
    HubSpot en r.sede (via CREDITO_SEDES), asi que este es el unico cruce
    de llaves que hace falta para llegar a id_internal. */
function wpHs2Int_() {
  if (_WP_HS2INT) return _WP_HS2INT;
  var m = {};
  sedesReatribuidas_().forEach(function (s) {
    var hs = String(s.id || '').trim();
    var iid = String(s.id_internal || '').trim();
    if (hs && iid) m[hs] = iid;
  });
  _WP_HS2INT = m;
  return m;
}

// Marcas excluidas de TODA la pestana de Welli Points (pedido de negocio,
// 21-sep-2026): ni WP ganados, ni pendientes, ni adopcion, ni cruce, ni
// correlacion -- nada de estas sedes se cuenta en ningun panel de F5.
// Coincide por substring en el nombre, sin tildes/mayusculas, para que una
// sede nueva de la misma cadena quede excluida sola, sin tocar codigo.
var WP_MARCAS_EXCLUIDAS = ['sonria', 'dentisalud', 'odontofamily', 'citydent'];
var _WP_EXCLUIDAS = null;

/** id_internal de toda sede que pertenezca a una marca excluida. Punto
    unico (regla 3): cualquier lector nuevo de una hoja WP_* pasa por
    leerWP_ en vez de leerHoja_ directo, para heredar esta regla sin
    tener que acordarse de aplicarla a mano. */
function wpExcluidas_() {
  if (_WP_EXCLUIDAS) return _WP_EXCLUIDAS;
  var out = {};
  function marca_(txt) {
    var t = String(txt || '').toLowerCase();
    for (var i = 0; i < WP_MARCAS_EXCLUIDAS.length; i++) {
      if (t.indexOf(WP_MARCAS_EXCLUIDAS[i]) >= 0) return true;
    }
    return false;
  }
  // Cruce por DOS fuentes independientes, union — no basta con
  // SEDES.nombre_sede (HubSpot): se encontro "City Suba" (una sede real de
  // CityDent) cuyo nombre en HubSpot Y en la plataforma de credito NO dice
  // "citydent" en ningun lado — solo el correo de facturacion
  // (citydentsuba@yahoo.co) delata la cadena. Y "Sonria sede Toberin" SI
  // decia "sonria" en la plataforma de credito pero NO en el nombre que
  // tenia cargado en HubSpot ese dia. Ninguna de las dos fuentes sola
  // alcanza — hay que cruzar nombre_sede (HubSpot) + nombre + correo
  // (institucion_medica, via PLATAFORMA_SEDES) y unir los tres resultados.
  sedesReatribuidas_().forEach(function (s) {
    if (!marca_(s.nombre_sede)) return;
    var iid = String(s.id_internal || '').trim();
    if (iid) out[iid] = true;
  });
  leerHoja_('PLATAFORMA_SEDES').forEach(function (r) {
    if (!marca_(r.nombre) && !marca_(r.email)) return;
    var iid = String(r.id_sede || '').trim();
    if (iid) out[iid] = true;
  });
  _WP_EXCLUIDAS = out;
  return out;
}

/** Lee una hoja de Welli Points (todas usan 'id_sede' = id_internal) y le
    quita las filas de las marcas excluidas. Reemplaza a leerHoja_ para
    CUALQUIER hoja WP_SEDE_MES/WP_SEDE_INC/WP_CANJES2/WP_HABILITADAS/
    WP_LOGIN_SEDES/WP_LOGIN_DIA/WP_PTS_SEDE_MES. */
function leerWP_(nombre) {
  var excl = wpExcluidas_();
  return leerHoja_(nombre).filter(function (r) {
    var iid = String(r.id_sede || '').trim();
    return !iid || !excl[iid];
  });
}

/**
 * Cruce adopcion x desembolso: para cada mes, compara las sedes
 * habilitadas en WelliPoints que YA iniciaron sesion contra las que nunca
 * lo han hecho — cuanto desembolsa cada grupo en promedio, y que
 * proporcion de cada grupo desembolsa algo ese mes.
 *
 * El filtro global (origen/rol) muerde las DOS poblaciones por igual: si
 * no, con un origen elegido el grupo se angostaria de un lado y no del
 * otro (mismo error que se corrigio en la version anterior de este
 * frente — ver CLAUDE.md seccion 25, punto 2).
 */
function wpCruceLogin_(U) {
  var hs2int = wpHs2Int_();
  function enU_(iid) { return U.sinFiltro || !!U.ids[iid]; }

  var habilitadas = {};
  leerWP_('WP_HABILITADAS').forEach(function (r) {
    var iid = String(r.id_sede || '').trim();
    if (iid && enU_(iid)) habilitadas[iid] = true;
  });
  var conLogin = {};
  var minLogin = '9999-99';
  leerWP_('WP_LOGIN_SEDES').forEach(function (r) {
    var iid = String(r.id_sede || '').trim();
    if (!iid) return;
    conLogin[iid] = true;
    var mesLogin = String(r.primer_login || '').substring(0, 7);
    if (mesLogin && mesLogin < minLogin) minLogin = mesLogin;
  });

  // porMes[mes].con / .sin = { id_internal: monto acumulado ese mes }
  var porMes = {};
  function celda(mes) {
    if (!porMes[mes]) porMes[mes] = { con: {}, sin: {} };
    return porMes[mes];
  }
  hechos_().forEach(function (r) {
    var iid = hs2int[r.sede];
    if (!iid || !habilitadas[iid]) return;
    var mes = r.fecha.substring(0, 7);
    var grupo = conLogin[iid] ? 'con' : 'sin';
    var c = celda(mes)[grupo];
    c[iid] = (c[iid] || 0) + r.mConv;
  });

  var nCon = Object.keys(habilitadas).filter(function (i) { return conLogin[i]; }).length;
  var nSin = Object.keys(habilitadas).length - nCon;

  // Piso dinamico, no hardcodeado: el primer mes con login REAL en
  // WP_LOGIN_SEDES (verificado 21-sep-2026: junio-2026, cuando arranco
  // la plataforma). Antes de eso, mostrar la brecha con/sin login solo
  // confundia -- la plataforma ni existia, asi que no habia con quien
  // comparar. Pedido de Emmanuel: "muestra solo desde junio que hay
  // visitas reales".
  var meses = Object.keys(porMes).filter(function (m) { return m >= minLogin; }).sort();
  var serie = meses.map(function (mes) {
    var c = porMes[mes].con, s = porMes[mes].sin;
    var idsCon = Object.keys(c), idsSin = Object.keys(s);
    var sumaCon = idsCon.reduce(function (a, k) { return a + c[k]; }, 0);
    var sumaSin = idsSin.reduce(function (a, k) { return a + s[k]; }, 0);
    var desembCon = idsCon.filter(function (k) { return c[k] > 0; }).length;
    var desembSin = idsSin.filter(function (k) { return s[k] > 0; }).length;
    return {
      mes: mes,
      promCon: nCon ? Math.round(sumaCon / nCon) : 0,
      promSin: nSin ? Math.round(sumaSin / nSin) : 0,
      pctDesembCon: nCon ? Math.round((desembCon / nCon) * 1000) / 10 : 0,
      pctDesembSin: nSin ? Math.round((desembSin / nSin) * 1000) / 10 : 0
    };
  });

  // Promedio del periodo completo con datos, para el titular.
  var totCon = 0, totSin = 0;
  serie.forEach(function (x) { totCon += x.promCon; totSin += x.promSin; });
  var promCon = serie.length ? Math.round(totCon / serie.length) : 0;
  var promSin = serie.length ? Math.round(totSin / serie.length) : 0;

  return {
    hay: nCon > 0 && nSin > 0 && serie.length > 0,
    nCon: nCon, nSin: nSin,
    promCon: promCon, promSin: promSin,
    multiplicador: promSin ? Math.round((promCon / promSin) * 10) / 10 : null,
    serie: serie
  };
}

/**
 * Correlacion mes a mes entre WP GANADOS (toda la base, por la tabla de
 * tramos B1 sobre cada desembolso) y la PLATA DESEMBOLSADA total del mismo
 * periodo — dos medidas de magnitud muy distinta (puntos vs pesos), por
 * eso se grafican en dos ejes, igual que ya hace F4 con plata/tasa
 * (chBarrasLinea2Ejes, ver su comentario: es la unica otra situacion del
 * tablero que necesita dos escalas).
 *
 * OJO CON LA FUENTE — esto se corrigio el 18-sep-2026 porque el numero
 * salia absurdamente chico (250-435 puntos/mes contra $8-14 mil M
 * desembolsados) y Emmanuel lo noto a ojo: la version anterior leia
 * WP_SEDE_MES, que viene de wp_incentivos_diario.wp_ganado_mes — una
 * CAMPANA DE INCENTIVOS especifica (con oferta/vencimiento propios), NO
 * los puntos que gana TODA la base por desembolsar. La fuente correcta es
 * WP_PTS_SEDE_MES (de wp_desembolsos_snapshot.pts_ganados, por sede x mes),
 * que trae un punto por desembolso real, calculado con la tabla de tramos
 * B1 — la misma regla de negocio documentada en la seccion 2 de este
 * archivo de contexto. WP_SEDE_MES sigue siendo la fuente correcta para las
 * secciones 4-6 de este frente (panorama del incentivo, conversion,
 * detalle por incentivo): esas SI hablan de la campana especifica, no del
 * total de la base, y ahi el nombre de la seccion lo deja claro.
 *
 * El filtro global se aplica UNA vez, con recorrerHechos_ — el punto unico
 * de lectura de CREDITO_DIA (regla 3) — en vez de reconstruir el filtro
 * a mano.
 */
function wpCorrelacion_(U) {
  // WP_PTS_SEDE_MES viene por sede x mes (con id_sede = id_internal), asi
  // que el filtro global la corta igual que a la plata desembolsada — sin
  // esto, con un origen elegido "ganado" seguiria siendo el total de TODA
  // la base mientras "desembolsado" si se angostaria, y las dos series
  // terminarian midiendo universos distintos en el mismo grafico.
  var ganadoPorMes = {};
  filtrarPorId_(leerWP_('WP_PTS_SEDE_MES'), 'id_sede', U).forEach(function (r) {
    var mes = String(r.mes || '').trim();
    if (!mes) return;
    ganadoPorMes[mes] = (ganadoPorMes[mes] || 0) + num_(r.pts);
  });
  var totPorMes = {};
  var hs2int = wpHs2Int_(), excl = wpExcluidas_();
  // recorrerHechos_ exige un rango: se le da uno bien amplio para agregar
  // TODO el historico disponible, filtrado igual que el resto del tablero.
  // hechos_() no pasa por ninguna hoja WP_*, asi que la exclusion de marca
  // se aplica aca a mano — es la unica lectura de esta funcion que no usa
  // leerWP_.
  recorrerHechos_(U, '2000-01-01', '2099-12-31', function (r) {
    var iid = hs2int[r.sede];
    if (iid && excl[iid]) return;
    var mes = r.fecha.substring(0, 7);
    totPorMes[mes] = (totPorMes[mes] || 0) + r.mConv;
  });
  // Piso dinamico (21-sep-2026, mismo pedido y mismo patron que
  // wpCruceLogin_): arrancar en el primer mes con WP ganados REALES
  // (hoy junio-2026, cuando el programa empezo a generar pts_ganados en
  // wp_desembolsos_snapshot), no en un literal fijo — meses antes solo
  // mostraban una barra en cero que no aportaba nada a la comparacion.
  var mesesGanado = Object.keys(ganadoPorMes).sort();
  var pisoCorrelacion = mesesGanado.length ? mesesGanado[0] : '2026-01';
  var meses = Object.keys(ganadoPorMes).concat(Object.keys(totPorMes))
    .filter(function (m, i, arr) { return arr.indexOf(m) === i; })
    .filter(function (m) { return m >= pisoCorrelacion; })
    .sort();
  return meses.map(function (mes) {
    return { mes: mes, ganado: ganadoPorMes[mes] || 0, desembolsado: totPorMes[mes] || 0 };
  });
}

/**
 * Sedes que inician sesion cada dia, y cuanto desembolsaron ESE MISMO dia
 * (pedido 18-sep-2026: agregar la comparacion a la grafica de tendencia de
 * adopcion). WP_LOGIN_DIA trae una fila por sede y dia con al menos un
 * login — antes solo existia el PRIMER login por sede (WP_LOGIN_SEDES) y
 * el conteo ya agregado por dia (WP_ADOPCION_TENDENCIA, sin desglose de
 * sede), ninguno de los dos alcanzaba para cruzar contra CREDITO_DIA.
 *
 * No responde al filtro de origen/rol, igual que el resto de esta seccion
 * (es la misma foto que ve producto, sedes 'a proposito'): mezclar un
 * conteo de login sin filtrar con un desembolso SI filtrado dejaria las
 * dos series midiendo universos distintos en el mismo grafico.
 */
function wpAdopcionDia_() {
  var hs2int = wpHs2Int_();
  var loginDia = {};
  leerWP_('WP_LOGIN_DIA').forEach(function (r) {
    var f = String(r.fecha || '').substring(0, 10);
    var iid = String(r.id_sede || '').trim();
    if (!f || !iid) return;
    if (!loginDia[f]) loginDia[f] = {};
    loginDia[f][iid] = true;
  });
  var montoDia = {};
  hechos_().forEach(function (r) {
    var iid = hs2int[r.sede];
    if (!iid || !r.mConv) return;
    if (!montoDia[r.fecha]) montoDia[r.fecha] = {};
    montoDia[r.fecha][iid] = (montoDia[r.fecha][iid] || 0) + r.mConv;
  });
  // El panel dice "ultimos 60 dias": se recorta aca para que el texto no
  // mienta si WP_LOGIN_DIA algun dia trae mas historia de la que cabe.
  var piso = new Date(new Date(hoyISO_() + 'T00:00:00Z').getTime() - 60 * 86400000)
    .toISOString().substring(0, 10);
  return Object.keys(loginDia).filter(function (f) { return f >= piso; }).sort()
    .map(function (f) {
      var sedes = loginDia[f];
      var mm = montoDia[f] || {};
      var tot = 0;
      for (var iid in sedes) { tot += mm[iid] || 0; }
      return { x: f, sedes: Object.keys(sedes).length, monto: tot };
    });
}

function armarF5_(R, ev, U) {
  var f = {};

  // WP_KPI2 ya no se usa: todos los numeros de este frente salen de las
  // tablas por sede, que si respetan el filtro de origen.

  function pctSedes_(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }

  // ---- Cruce adopcion x desembolso: las que entran a la plataforma, --
  // ---- ¿desembolsan mas? (18-sep-2026, segunda vuelta) ----------------
  f.cruce = wpCruceLogin_(U);

  // ---- 0. Adopcion de la plataforma WelliPoints (pedido 14-sep-2026) ----
  // Replica el tablero externo points.welli.com.co/admin, con una
  // diferencia declarada: ese tablero cuenta "habilitadas" desde el
  // auth_user de la app (2.467 en su ultima foto), que NO es una tabla de
  // BigQuery y no se puede consultar desde aca. Se usa en su lugar
  // wellipoints_snapshot (el ledger de puntos, 3.104 sedes) como universo
  // -- es el mas cercano que SI se puede verificar, y se declara la
  // diferencia en pantalla en vez de fingir que es el mismo numero.
  // No responde al filtro de origen/rol: es la foto de adopcion de TODA
  // la base, igual que el tablero externo -- filtrar por origen aca
  // compararia un grupo contra si mismo.
  var wpKpi = leerHoja_('WP_ADOPCION_KPI')[0] || {};
  var habilitadas = num_(wpKpi.habilitadas), conLogin = num_(wpKpi.con_login);
  var nuncaLogin = num_(wpKpi.nunca_login);
  var pctAdopcion = pctSedes_(conLogin, habilitadas);
  var NOMBRE_MUNDO = { farmer: 'Farmer', cs: 'Customer Success', autogest: 'Autogestión',
                       muertos: 'Dead', 'sin clasificar': 'Sin clasificar' };
  f.adopcion = {
    nuncaLogin: nuncaLogin,
    kpis: [
      kpi_('Sedes habilitadas en WelliPoints', habilitadas, { formato: 'num',
        sublabel: 'universo con cuenta creada (BigQuery wellipoints_snapshot)',
        fuente: 'BigQuery wellipoints_snapshot', color: 'azul' }),
      kpi_('Han iniciado sesión alguna vez', conLogin, { formato: 'num',
        sublabel: fNumSrv_(nuncaLogin) + ' nunca han entrado',
        fuente: 'BigQuery wp_dashboard_visitas', color: 'verde' }),
      kpi_('Adopción', pctAdopcion, { formato: 'pct',
        sublabel: 'de las habilitadas, cuántas usan la plataforma',
        fuente: 'calculado · login / habilitadas', color: 'morado',
        nota: 'El tablero de producto (points.welli.com.co) reporta 22,1% sobre su ' +
          'propio universo de cuentas habilitadas (auth_user, no consultable desde ' +
          'BigQuery). Este ' + pctAdopcion + '% usa wellipoints_snapshot como universo ' +
          '— más amplio, por eso el número es distinto; ambos miden lo mismo con una ' +
          'vara distinta.' })
    ],
    mundo: leerHoja_('WP_ADOPCION_MUNDO').map(function (r) {
      var k = String(r.mundo || '');
      return { mundo: NOMBRE_MUNDO[k] || k, sedes: num_(r.sedes) };
    }).sort(function (a, b) { return b.sedes - a.sedes; }),
    // Reemplaza WP_ADOPCION_TENDENCIA (18-sep-2026): esa hoja solo traia el
    // conteo diario, sin desglose de sede, y no alcanzaba para cruzar
    // contra CREDITO_DIA. wpAdopcionDia_ trae las dos series (sedes con
    // login y su desembolso ese mismo dia) de la MISMA fuente cruda
    // (WP_LOGIN_DIA), asi que nunca pueden desincronizarse entre si.
    tendencia: wpAdopcionDia_(),
    top: leerHoja_('WP_ADOPCION_TOP').map(function (r) {
      return { sede: String(r.sede || ''), email: String(r.email || ''),
               visitas: num_(r.visitas), ultimo: String(r.ultimo_acceso || '') };
    })
  };

  // WP_SEDE_MES viene por sede x mes (con id_sede), asi que el filtro de
  // origen la corta y despues se agrega. Antes se leia WP_SERIE, ya
  // agregada por mes y sin llave de sede.
  var wpSede = filtrarPorId_(leerWP_('WP_SEDE_MES'), 'id_sede', U);
  var agMes = {};
  wpSede.forEach(function (r) {
    var k = String(r.mes || '');
    if (!k) return;
    if (!agMes[k]) {
      agMes[k] = { mes: k, sedes: 0, conOferta: 0, ganaron: 0,
                   ofrecido: 0, ganado: 0, pendiente: 0 };
    }
    var b = agMes[k];
    b.sedes++;
    if (num_(r.con_oferta) > 0) b.conOferta++;
    var gan = num_(r.wp_ganado);
    if (gan > 0) b.ganaron++;
    b.ofrecido += num_(r.wp_ofrecido);
    b.ganado += gan;
    b.pendiente += num_(r.wp_pendiente);
  });
  var serie = Object.keys(agMes).sort().map(function (k) {
    var b = agMes[k];
    b.conversion = b.ofrecido ? Math.round((b.ganado / b.ofrecido) * 1000) / 10 : 0;
    return b;
  });
  f.serie = serie;

  // ---- Correlacion: WP ganados vs plata desembolsada, en el tiempo ----
  f.correlacion = wpCorrelacion_(U);

  // Los KPI usan el ultimo mes CERRADO, no el mes en curso: el 1 de
  // septiembre el mes lleva un dia y su conversion (7,2%) se leeria como una
  // caida contra el 8,7% de agosto cuando en realidad es un mes incompleto.
  // La grafica si muestra todos los meses, incluido el parcial.
  var mesActual = hoyISO_().substring(0, 7);
  var cerrados = serie.filter(function (x) { return x.mes < mesActual; });
  var base = cerrados.length ? cerrados : serie;
  var ult = base.length ? base[base.length - 1] : null;
  var pen = base.length > 1 ? base[base.length - 2] : null;
  f.mesEnCurso = serie.length && serie[serie.length - 1].mes === mesActual
    ? serie[serie.length - 1].mes : '';
  f.mesCerrado = ult ? ult.mes : '';

  // hayBQ mide si la fuente esta conectada, NO si el filtro dejo filas: con
  // un origen elegido la serie viene vacia pero los canjes si se filtran.
  f.hayBQ = leerWP_('WP_SEDE_MES').length > 0 || leerHoja_('WP_SERIE').length > 0;

  // ---- 1. ¿El incentivo convierte? ----------------------------------
  f.conversion = {
    kpis: [
      // Antes esta tarjeta decia "Sedes en el programa: 1.909" con delta verde.
      // Era vanidad: de esas 1.909 solo 44 tenian una oferta activa. El
      // programa no tiene problema de adopcion, tiene problema de COBERTURA
      // DE OFERTA — no le estamos ofreciendo nada a 1.865 sedes.
      kpi_('Sedes con oferta activa', ult ? pctSedes_(ult.conOferta, ult.sedes) : 0, {
        formato: 'pct',
        sublabel: ult ? fNumSrv_(ult.conOferta) + ' de ' + fNumSrv_(ult.sedes) +
          ' sedes del programa en ' + ult.mes : '',
        delta: (pen && pen.sedes && pen.conOferta)
          ? Math.round((pctSedes_(ult.conOferta, ult.sedes) -
                        pctSedes_(pen.conOferta, pen.sedes)) * 10) / 10 : null,
        deltaEnPuntos: true, deltaEtiqueta: pen ? 'vs ' + pen.mes : '',
        fuente: 'BigQuery wp_incentivos_diario', color: 'azul',
        nota: 'Este es el cuello real del frente: el programa está montado para ' +
          fNumSrv_(ult ? ult.sedes : 0) + ' sedes y solo ' + fNumSrv_(ult ? ult.conOferta : 0) +
          ' tienen algo que ganar hoy. Sin oferta no hay nada que convertir.' }),
      kpi_('WP ofrecidos en el mes', ult ? ult.ofrecido : 0, { formato: 'num',
       
        sublabel: ult ? 'mes ' + ult.mes : '',
        delta: (pen && pen.ofrecido) ? delta_(ult.ofrecido, pen.ofrecido) : null,
        // La tarjeta NO se mueve con el filtro de fecha (es el último
        // snapshot del mes), asi que el delta tiene que decir contra que
        // mes compara: sin la etiqueta se lee como "vs el periodo elegido".
        deltaEtiqueta: pen ? 'vs ' + pen.mes : '',
        fuente: 'BigQuery wp_incentivos_diario', color: 'amarillo',
        nota: 'Acumulado del mes por sede, tomado del último snapshot diario. No se ' +
          'suman los días: cada día repite el acumulado.' }),
      kpi_('WP que se ganaron', ult ? ult.ganado : 0, { formato: 'num',
       
        sublabel: ult ? fNumSrv_(ult.ganaron) + ' sedes se lo ganaron' : '',
        delta: (pen && pen.ganado) ? delta_(ult.ganado, pen.ganado) : null,
        deltaEtiqueta: pen ? 'vs ' + pen.mes : '',
        fuente: 'BigQuery wp_incentivos_diario', color: 'verde' }),
      kpi_('Conversión del incentivo', ult ? ult.conversion : 0, { formato: 'pct',
       
        // Sin delta: un % de cambio sobre un % ya es ilegible. La variacion
        // va en puntos, que es como se lee.
        sublabel: 'de los puntos prometidos, cuántos se ganaron',
        delta: pen ? Math.round((ult.conversion - pen.conversion) * 10) / 10 : null,
        deltaEnPuntos: true, deltaEtiqueta: pen ? 'vs ' + pen.mes : '',
        fuente: 'calculado · ganado / ofrecido', color: 'morado',
        nota: 'Es la métrica limpia del frente: no compara sedes distintas, compara la ' +
          'promesa contra el resultado en el mismo grupo.' })
    ]
  };

  var hoyIso = hoyISO_();
  var agInc = {};
  filtrarPorId_(leerWP_('WP_SEDE_INC'), 'id_sede', U).forEach(function (r) {
    var k = String(r.incentivo || '(sin incentivo)');
    if (!agInc[k]) {
      agInc[k] = { incentivo: k, sedes: 0, ganaron: 0, ofrecido: 0, ganado: 0,
                   vigentes: 0, vencidos: 0 };
    }
    var b = agInc[k];
    b.sedes++;
    var gan = num_(r.wp_ganado);
    if (gan > 0) b.ganaron++;
    b.ofrecido += num_(r.wp_ofrecido);
    b.ganado += gan;
    var exp = String(r.expira || '').substring(0, 10);
    if (exp) { if (exp >= hoyIso) b.vigentes++; else b.vencidos++; }
  });
  f.incentivos = Object.keys(agInc).map(function (k) {
    var b = agInc[k];
    b.pctGanaron = b.sedes ? Math.round((b.ganaron / b.sedes) * 1000) / 10 : 0;
    return b;
  }).filter(function (r) { return r.sedes > 0; })
    .sort(function (a, b) { return b.sedes - a.sedes; });

  // ---- Saldo REAL canjeable, desde wp_resumen_semanal ------------------
  // Corregido 21-sep-2026: "Puntos ganados sin reclamar" usaba
  // wp_incentivos_diario.wp_pendiente_actual, que mide algo DISTINTO — lo
  // prometido y NO GANADO todavia de una campana de incentivos puntual,
  // no el saldo YA GANADO y sin canjear. Emmanuel trajo la query oficial
  // que usa para ver "los WP que tienen las sedes en su plataforma para
  // canjear" (wp_resumen_semanal.saldo_canjeable, ya resuelto: lifetime
  // de tramos B1 + concursos + ajustes manuales, menos lo ya canjeado) y
  // los dos numeros coincidian por casualidad (54.645 vs 54.657), no
  // porque fueran la misma cosa — mismo tipo de error que la seccion 29.
  var saldoReal = filtrarPorId_(leerWP_('WP_RESUMEN'), 'id_sede', U);
  var saldoCanjeableTotal = 0, lifetimeTotal = 0, canjeadoWpResumen = 0;
  saldoReal.forEach(function (r) {
    saldoCanjeableTotal += num_(r.saldo_canjeable);
    lifetimeTotal += num_(r.lifetime_pts);
    canjeadoWpResumen += num_(r.canjeado_total);
  });

  // ---- 2. ¿Le pagamos a la sede? ------------------------------------
  var canjHoja = leerWP_('WP_CANJES2');
  var canjFil = canjHoja.length
    ? filtrarPorId_(canjHoja, 'id_sede', U)
    : filtrarPorNombre_(leerHoja_('WP_CANJES'), 'sede_nombre', U);
  var canjes = canjFil.map(function (r) {
    return { fecha: fechaCelda_(r.fecha), sede: String(r.sede_nombre || ''),
             pipeline: String(r.pipeline || ''), pts: num_(r.pts_solicitados),
             cop: num_(r.cop_solicitados), formato: String(r.formato || ''),
             estado: String(r.estado || ''),
             descontado: String(r.descontado_wp).toLowerCase() === 'true',
             dias: num_(r.dias) };
  });
  // El estado real que trae la fuente hoy es 'pendiente' / 'finalizado'
  // (verificado contra BigQuery el 2026-09-08 — 80 de 92 ya estaban en
  // 'finalizado'). 'pagado' / 'entregado' / 'aprobado' se dejan por si la
  // fuente cambia de nombre otra vez, pero 'finalizado' es el que hoy
  // importa: sin él, el tablero decía "0 pagados" cuando en realidad el
  // 87% ya estaba resuelto.
  var PAGADO = ['finalizado', 'pagado', 'entregado', 'aprobado'];
  function esPagado_(c) { return PAGADO.indexOf(c.estado.toLowerCase()) >= 0; }

  // Todo esto sale del arreglo YA filtrado por origen, no de WP_KPI2, que
  // esta pre-agregado sobre toda la base.
  var nCanj = canjes.length, pagados = 0;
  var ptsPend = 0, copPend = 0, diasMax = 0, copPagado = 0, ptsPagado = 0;
  canjes.forEach(function (c) {
    if (esPagado_(c)) { pagados++; copPagado += c.cop; ptsPagado += c.pts; return; }
    ptsPend += c.pts;
    copPend += c.cop;
    if (c.dias > diasMax) diasMax = c.dias;
  });
  var nPend = nCanj - pagados;

  f.pago = {
    kpis: [
      // Pedido 14-sep-2026: el "cuánto hemos pagado en total" es el numero
      // C-level que faltaba arriba — antes solo se veia lo PENDIENTE, nunca
      // el acumulado ya entregado. Va primero, como titular de la seccion.
      kpi_('Total pagado en redenciones', copPagado, { formato: 'copC',
        sublabel: fNumSrv_(ptsPagado) + ' WP canjeados, histórico', delta: null,
        fuente: 'BigQuery wp_canjeos_solicitados', color: 'verde' }),
      kpi_('Canjes solicitados', nCanj, { formato: 'num',
        sublabel: 'sedes que pidieron su premio, histórico', delta: null,
        fuente: 'BigQuery wp_canjeos_solicitados', color: 'azul' }),
      kpi_('Canjes pagados', pagados, { formato: 'num',
        sublabel: nCanj ? fNumSrv_(pagados) + ' de ' + fNumSrv_(nCanj) +
          ' resueltos (finalizado)' : '', delta: null,
        fuente: 'BigQuery wp_canjeos_solicitados', color: pagados ? 'verde' : 'morado' }),
      kpi_('Canjes pendientes', nPend, { formato: 'num',
        sublabel: 'todavía sin resolver', delta: null,
        deltaInvertido: true, fuente: 'BigQuery wp_canjeos_solicitados',
        color: nPend ? 'amarillo' : 'verde' }),
      kpi_('Plata pendiente de pagar', copPend, { formato: 'copC',
        sublabel: fNumSrv_(ptsPend) + ' puntos a ' + fNumSrv_(COP_POR_PUNTO) +
          ' COP, sobre lo YA SOLICITADO', delta: null,
        fuente: 'BigQuery wp_canjeos_solicitados', color: 'amarillo' }),
      kpi_('El más viejo pendiente lleva', diasMax, { formato: 'num',
        sublabel: nPend ? 'días desde que la sede lo pidió' : 'no hay pendientes',
        delta: null, deltaInvertido: true,
        fuente: 'BigQuery wp_canjeos_solicitados', color: 'morado' }),
      // El pasivo completo, no solo lo ya pedido: son puntos ganados que la
      // sede puede reclamar en cualquier momento. Es la pregunta de un CFO.
      // Fuente: wp_resumen_semanal.saldo_canjeable (ver nota arriba de
      // saldoReal) — NO wp_incentivos_diario. Es una FOTO (fecha_corte de
      // la tabla), no una serie mensual, asi que no hay delta que mostrar.
      kpi_('Puntos ganados sin reclamar', saldoCanjeableTotal * COP_POR_PUNTO, {
        formato: 'copC',
        sublabel: fNumSrv_(saldoCanjeableTotal) + ' WP a ' + fNumSrv_(COP_POR_PUNTO) +
          ' COP · exposición si todas reclaman', delta: null,
        fuente: 'BigQuery wp_resumen_semanal', color: 'amarillo',
        nota: 'Es un pasivo contingente, no un gasto: la sede ya se ganó estos puntos ' +
          '(tramos B1 + concursos + ajustes manuales) y puede pedirlos cuando quiera. ' +
          'De ' + fNumSrv_(lifetimeTotal) + ' WP ganados en total, ' +
          fNumSrv_(canjeadoWpResumen) + ' ya se canjearon — el resto es este saldo.' })
    ]
  };

  f.textos = null;
  return f;
}

// =====================================================================
// FRENTE 6 — Novedades de producto (se llena a mano en el Sheet)
// =====================================================================

/* =====================================================================
 FRENTE 7 · LONG TAIL
 La pregunta: cuando impactamos a la cola larga, ¿aplican más?

 Tres piezas:
   1. la linea de solicitudes por dia de la poblacion de los workflows
   2. los impactos reales marcados sobre esa linea, encendibles y
      apagables uno por uno
   3. la cadencia declarada de cada workflow, que es la ficha tecnica:
      dia 0 impacta, espera 4 dias, vuelve a impactar con otra pieza

 Los impactos NO son fechas de calendario sueltas: cada sede entra al
 workflow y recibe la cadencia relativa a SU dia de entrada. Como las
 entradas son en lote, en el calendario se ven como picos.
 ===================================================================== */
function armarF7_(R, cfg, U, filtroLT) {
  var f = {};
  // TODAS_ACC es fija (los cinco clusters/audiencias del negocio). ACC es
  // la que de verdad recorta el frente: si filtroLT trae uno valido, el
  // resto de esta funcion — poblacion, serie de solicitudes, impactos,
  // workflows, KPIs — queda escrito para leer de ACC, asi que angostarla a
  // un solo elemento angosta TODO el frente de una sola vez, sin tener que
  // repetir el filtro en cada bloque.
  var TODAS_ACC = ['PERFILAMIENTO', 'REACTIVAR', 'DESEMBOLSO', 'RECONOCIMIENTO', 'ESTRENA'];
  var NOMBRE = {
    PERFILAMIENTO: 'Qué paciente sí pasa',
    REACTIVAR: 'Vuelve a aplicar',
    DESEMBOLSO: 'Tu trabajo sí sirve',
    RECONOCIMIENTO: 'Reconocimiento',
    ESTRENA: 'Estrena tu primer paciente'
  };
  var filtro = String(filtroLT || '').trim().toUpperCase();
  var ACC = TODAS_ACC.indexOf(filtro) >= 0 ? [filtro] : TODAS_ACC;
  f.filtroActivo = ACC.length === 1 ? ACC[0] : '';

  // ---- Poblacion: sedes del universo elegido que estan en una audiencia --
  // Responde al filtro global de origen como todo lo demas.
  var pob = {}, porAud = {};
  ACC.forEach(function (a) { porAud[a] = 0; });
  U.filas.forEach(function (s) {
    var a = String(s.audiencia_long_tail || '').trim().toUpperCase();
    if (ACC.indexOf(a) < 0) return;
    var id = String(s.id_internal || '').trim();
    if (id) pob[id] = a;
    porAud[a]++;
  });
  var totalPob = 0;
  ACC.forEach(function (a) { totalPob += porAud[a]; });
  f.hay = totalPob > 0;
  f.universo = U.etiqueta;
  f.poblacion = totalPob;

  // ---- Catálogo de clusters para el selector, con su cuenta SIN el filtro
  // de cluster (solo con el filtro global de origen/rol) — así el chip de
  // un cluster que no está elegido igual dice cuántas sedes tiene, y no un
  // cero que se leería como "está vacío".
  var porAudTodas = {};
  TODAS_ACC.forEach(function (a) { porAudTodas[a] = 0; });
  U.filas.forEach(function (s) {
    var a = String(s.audiencia_long_tail || '').trim().toUpperCase();
    if (TODAS_ACC.indexOf(a) >= 0) porAudTodas[a]++;
  });
  f.clusters = TODAS_ACC.map(function (a) {
    return { clave: a, nombre: NOMBRE[a], sedes: porAudTodas[a] };
  });

  // ---- Plata: desembolsos REALES de las sedes de la poblacion -----------
  // Misma fuente que el resto del tablero (hechos_()/CREDITO_DIA — la tabla
  // diaria de creditos que ya usan F1 y F2), no un numero nuevo inventado
  // para este frente. La poblacion de long tail viene por id_internal (uuid
  // de plataforma) y hechos_() viene por id de HubSpot, asi que se cruza
  // primero por esa llave. Respeta el filtro de cluster solo: `pob` ya viene
  // acotado a ACC (un solo cluster o los cinco).
  var hsDeInterno = {};
  U.filas.forEach(function (s) {
    var iid = String(s.id_internal || '').trim(), hs = String(s.id || '').trim();
    if (iid && hs) hsDeInterno[iid] = hs;
  });
  var audDeHS = {};
  Object.keys(pob).forEach(function (iid) {
    var hs = hsDeInterno[iid];
    if (hs) audDeHS[hs] = pob[iid];
  });
  var montoPorAud = {}, montoDia = {};
  ACC.forEach(function (a) { montoPorAud[a] = { des: 0, monto: 0 }; });
  hechos_().forEach(function (r) {
    var a = audDeHS[r.sede];
    if (!a) return;
    if (r.fecha < R.inicio || r.fecha > R.fin) return;
    montoPorAud[a].des += r.conv;
    montoPorAud[a].monto += r.mConv;
    montoDia[r.fecha] = (montoDia[r.fecha] || 0) + r.mConv;
  });
  var totalMonto = 0, totalDesembolsos = 0;
  ACC.forEach(function (a) {
    totalMonto += montoPorAud[a].monto;
    totalDesembolsos += montoPorAud[a].des;
  });

  // ---- Serie de solicitudes por dia, dentro del rango ------------------
  // LT_APPS_DIA trae id_sede desde el 7-sep-2026: antes se agregaba solo
  // por (fecha, audiencia) y el filtro global no tenia por donde cortarla
  // — la poblacion de arriba SI respondia al filtro y esta serie no, que
  // es exactamente la inconsistencia que habia que cerrar. filtrarPorId_
  // aplica el mismo criterio que el resto del tablero (origen + rol +
  // deshabilitadas).
  var ap = filtrarPorId_(leerHoja_('LT_APPS_DIA'), 'id_sede', U);
  var dia = {}, audSet = {};
  ap.forEach(function (r) {
    var a = String(r.audiencia || '').trim().toUpperCase();
    if (ACC.indexOf(a) < 0) return;
    var fch = String(r.fecha || '');
    if (fch < R.inicio || fch > R.fin) return;
    if (!dia[fch]) {
      dia[fch] = { x: fch, sol: 0, des: 0, sedes: {}, por: {} };
    }
    var b = dia[fch];
    var sol = num_(r.solicitudes);
    b.sol += sol;
    b.des += num_(r.desembolsos);
    var idS = String(r.id_sede || '').trim();
    if (idS) b.sedes[idS] = true;
    b.por[a] = (b.por[a] || 0) + sol;
    audSet[a] = true;
  });
  // Se rellenan los dias sin actividad: un hueco en la linea se lee como
  // "no hay dato" cuando en realidad es un cero, y en una serie diaria eso
  // cambia la forma de la curva.
  var serie = [];
  var d0 = new Date(R.inicio + 'T00:00:00Z');
  var d1 = new Date(R.fin + 'T00:00:00Z');
  for (var t = d0.getTime(); t <= d1.getTime(); t += 86400000) {
    var k = new Date(t).toISOString().substring(0, 10);
    var b = dia[k] || { x: k, sol: 0, des: 0, sedes: {}, por: {} };
    var nSedes = Object.keys(b.sedes).length;
    serie.push({ x: k, y: b.sol, sol: b.sol, des: b.des, sedes: nSedes, por: b.por,
                 monto: montoDia[k] || 0 });
}
f.serie = serie;

// ---- Impactos reales, del historial de lt_ultima_pieza ---------------
// Igual que arriba: LT_TOUCHES trae id_sede desde el 7-sep-2026 para poder
// filtrar por origen/rol.
var tc = filtrarPorId_(leerHoja_('LT_TOUCHES'), 'id_sede', U);
var ag = {};
tc.forEach(function (r) {
  var a = String(r.audiencia || '').trim().toUpperCase();
  if (ACC.indexOf(a) < 0) return;
  var fch = String(r.fecha || '');
  if (fch < R.inicio || fch > R.fin) return;
  var k = fch + '|' + a + '|' + String(r.pieza || '');
  if (!ag[k]) {
    ag[k] = { fecha: fch, audiencia: a, nombre: NOMBRE[a] || a,
              pieza: String(r.pieza || ''), canal: String(r.canal || ''),
              sedes: 0 };
  }
  ag[k].sedes += num_(r.sedes);
});
// Se agrupa por (audiencia, pieza), NO por dia. Una pieza de la cadencia
// gotea varios dias seguidos porque las sedes entran al workflow cuando
// cumplen la condicion: 04_wa_1w salio 5 dias corridos a 211, 6, 1, 2 y 12
// sedes. Eso es UN toque de la cadencia, no cinco comunicaciones, y
// pintarlo como cinco marcas llena la grafica de escalera.
var agP = {};
Object.keys(ag).forEach(function (kk) {
  var b = ag[kk];
  var kp = b.audiencia + '|' + b.pieza;
  if (!agP[kp]) {
    agP[kp] = { audiencia: b.audiencia, nombre: b.nombre, pieza: b.pieza,
                canal: b.canal, sedes: 0, fecha: b.fecha, fechaFin: b.fecha,
                dias: [], picoSedes: 0, fechaPico: b.fecha };
  }
  var q = agP[kp];
  q.sedes += b.sedes;
  if (b.fecha < q.fecha) q.fecha = b.fecha;
  if (b.fecha > q.fechaFin) q.fechaFin = b.fecha;
  q.dias.push({ fecha: b.fecha, sedes: b.sedes });
  // La marca se ancla al dia del LOTE grande, que es cuando de verdad se
  // mando; los dias siguientes son goteo de sedes que entraron despues.
  if (b.sedes > q.picoSedes) { q.picoSedes = b.sedes; q.fechaPico = b.fecha; }
});
ag = agP;
Object.keys(ag).forEach(function (kk) {
  var b = ag[kk];
  b.dias.sort(function (a, c) { return a.fecha < c.fecha ? -1 : 1; });
  b.tramo = Math.round(
    (new Date(b.fechaFin + 'T00:00:00Z') - new Date(b.fecha + 'T00:00:00Z'))
    / 86400000) + 1;
  b.fecha = b.fechaPico;
});

f.impactos = Object.keys(ag).sort(function (a, c) {
  return ag[a].fecha < ag[c].fecha ? -1 : (ag[a].fecha > ag[c].fecha ? 1 : 0);
}).map(function (kk, i) {
  var b = ag[kk];
  b.id = 'imp' + i;
  // Solicitudes del dia del impacto y de los 3 dias siguientes, para poder
  // leer el efecto sin salir de la marca. No es causalidad, es vecindad.
  var idx = -1;
  for (var j = 0; j < serie.length; j++) if (serie[j].x === b.fecha) { idx = j; break; }
  b.solDia = idx >= 0 ? serie[idx].sol : null;
  var post = 0, npost = 0, pre = 0, npre = 0;
  for (var d = 1; d <= 3; d++) {
    if (idx + d < serie.length) { post += serie[idx + d].sol; npost++; }
    if (idx - d >= 0) { pre += serie[idx - d].sol; npre++; }
  }
  b.antes3 = npre ? Math.round((pre / npre) * 10) / 10 : null;
  b.despues3 = npost ? Math.round((post / npost) * 10) / 10 : null;
  b.delta = (b.antes3 !== null && b.despues3 !== null && b.antes3 > 0)
    ? Math.round(((b.despues3 - b.antes3) / b.antes3) * 1000) / 10 : null;
  return b;
});

// ---- Cadencia declarada de cada workflow ------------------------------
var cd = leerHoja_('LT_CADENCIA');
var wf = {};
cd.forEach(function (r) {
  var wid = String(r.workflow_id || '');
  if (!wid) return;
  if (!wf[wid]) {
    // El nombre viene como "[Growth] <emoji> 04 Vuelve a aplicar". Se quita
    // el prefijo de equipo y la basura no imprimible del emoji, que en la
    // hoja llega mutilada.
    var nom = String(r.workflow || '')
      .replace(/^\s*(LT|\[Growth\])\s*/i, '')
      .replace(/[^A-Za-z0-9À-ſ .\-]/g, '')
      .replace(/^[\s.\-]+/, '').trim();
    wf[wid] = { id: wid, nombre: nom || ('workflow ' + wid),
                audiencia: String(r.audiencia || ''), activo: String(r.activo) === 'si',
                sedes: porAud[String(r.audiencia || '').toUpperCase()] || 0,
                pasos: [], vacio: false };
  }
  if (String(r.pieza || '') === '(VACIO)') { wf[wid].vacio = true; return; }
  wf[wid].pasos.push({ impacto: num_(r.impacto), dia: num_(r.dia),
                       canal: String(r.canal || ''), pieza: String(r.pieza || '') });
});
f.workflows = Object.keys(wf).map(function (k) {
  var w = wf[k];
  w.pasos.sort(function (a, b) { return a.dia - b.dia || a.impacto - b.impacto; });
  w.impactos = w.pasos.length;
  w.duracion = w.pasos.length ? w.pasos[w.pasos.length - 1].dia : 0;
  // Solicitudes del periodo de esa audiencia, para poder poner el esfuerzo
  // al lado del resultado. Es el numero que hace hablar a la tabla.
  var sol = 0;
  serie.forEach(function (p) { sol += (p.por[w.audiencia] || 0); });
  w.solicitudes = sol;
  w.solPorSede = w.sedes ? Math.round((sol / w.sedes) * 100) / 100 : 0;
  // Plata: desembolsos reales de la audiencia, del mismo cruce de arriba
  // (hechos_() vía id_internal -> id de HubSpot).
  var mb = montoPorAud[w.audiencia] || { des: 0, monto: 0 };
  w.desembolsos = mb.des;
  w.monto = mb.monto;
  w.montoPorSede = w.sedes ? Math.round(mb.monto / w.sedes) : 0;
  return w;
}).filter(function (w) {
  // '(ENRUTADOR)' nunca es un cluster real. Con un cluster elegido, solo se
  // muestra SU workflow — los otros cuatro quedarian en 0 sedes/0
  // solicitudes (porAud no los tiene) y listarlos igual seria ruido.
  return w.audiencia !== '(ENRUTADOR)' && ACC.indexOf(w.audiencia) >= 0;
})
  .sort(function (a, b) { return b.sedes - a.sedes; });

// LT_CADENCIA es la ficha tecnica del workflow (que dia, que canal, que
// pieza): no tiene sede detras, asi que el filtro de origen/rol no la puede
// cortar. Las columnas "sedes" y "solicitudes" de esta misma tabla SI
// responden — salen de porAud (poblacion filtrada) y de la serie filtrada
// de arriba — asi que solo los PASOS de la cadencia quedan fijos.
f.notaCadencia = 'Los pasos de cada cadencia (día, canal, pieza) no responden ' +
  'al filtro: es la ficha técnica del workflow y no tiene una sede detrás. ' +
  'Las columnas de sedes y solicitudes de esta misma tabla sí — ya vienen ' +
  'del universo filtrado de arriba.';

// ---- Detalle pieza por pieza -------------------------------------------
// Pedido 14-sep-2026: como le fue a CADA pieza (asunto real, open rate,
// clics), no solo cuantas sedes toco. LT_PIEZAS sale de decodificar la
// definicion VIVA de los 5 workflows en HubSpot (automation/v4/flows), no
// del texto libre de LT_CADENCIA -- así el asunto y el content_id de cada
// email son reales, verificados contra /marketing/v3/emails.
//
// Email trae metricas reales (sent/delivered/open/click), via
// /marketing/v3/emails/statistics/list.
//
// WhatsApp: Long Tail manda por el canal NATIVO de HubSpot (Conversations),
// un sistema DISTINTO al que usa Rescate (Hilos/eventos_hilos) -- cruzar
// por telefono contra Hilos no sirve (probado: de 149 sedes con telefono
// solo 5 aparecian ahi). Se resolvio el 14-sep-2026 creando una Private
// App de HubSpot con el scope `conversations.read` (no lo tenia la
// conexion de Composio) y cruzando telefono+fecha del toque (ventana de
// +3 dias, igual de aproximada que la de Email) contra
// /conversations/v3/conversations/threads/{id}/messages, que SI trae
// estado real (SENT/DELIVERED/READ/FAILED) por mensaje. Cobertura
// parcial a proposito: de las 123 sedes con contacto encontrado en
// HubSpot, solo hay conversacion real para una parte de las piezas —
// las demas quedan en null (no en 0), que es honesto: "no hay dato
// suficiente" no es lo mismo que "no se leyo nada".
function vacia_(v) { return v === '' || v === null || v === undefined; }
// audiencia puede venir como "ESTRENA" o, en un email compartido entre
// varios workflows, "ESTRENA,PERFILAMIENTO,REACTIVAR" -- se parte en
// arreglo para poder responder al MISMO filtro de cluster de arriba
// (f.filtroActivo/ACC) sin inventar un segundo selector.
function tocaCluster_(audienciaCsv) {
  if (!ACC || ACC.length === TODAS_ACC.length) return true; // "todos"
  var auds = String(audienciaCsv || '').split(',');
  return auds.some(function (a) { return ACC.indexOf(a) >= 0; });
}
f.piezas = leerHoja_('LT_PIEZAS').map(function (r) {
  return { workflow: String(r.workflow || ''), orden: num_(r.orden),
           canal: String(r.canal || ''), dia: num_(r.dia),
           etiqueta: String(r.etiqueta || ''),
           muestra: vacia_(r.muestra) ? '' : String(r.muestra),
           audiencia: String(r.audiencia || ''),
           sent: vacia_(r.sent) ? null : num_(r.sent),
           delivered: vacia_(r.delivered) ? null : num_(r.delivered),
           open: vacia_(r.open) ? null : num_(r.open),
           click: vacia_(r.click) ? null : num_(r.click),
           openrate: vacia_(r.openrate) ? null : num_(r.openrate),
           clickrate: vacia_(r.clickrate) ? null : num_(r.clickrate),
           respondio: vacia_(r.respondio) ? null : num_(r.respondio) };
}).filter(function (p) { return tocaCluster_(p.audiencia); })
  .sort(function (a, b) {
    return a.workflow < b.workflow ? -1 : (a.workflow > b.workflow ? 1 : a.orden - b.orden);
  });
f.notaPiezas = 'Email trae métricas reales de HubSpot (enviados/entregados/' +
  'abiertos/clics). WhatsApp también, cruzando teléfono y fecha del envío ' +
  '(ventana de hasta 3 días) contra las conversaciones reales de HubSpot — ' +
  'algunas piezas no alcanzan volumen suficiente en esa ventana y quedan ' +
  'en "--", que significa "sin datos", no "cero". Sigue el mismo filtro de ' +
  'cluster de arriba.';

// ---- Franja horaria y embudo de contacto (solo WhatsApp) --------------
// Pedido 14-sep-2026. Sale de los mismos mensajes reales de HubSpot
// Conversations que arman f.piezas (arriba) -- NO de Email: la API de
// eventos de email de HubSpot ignora el filtro por campana pase lo que
// pase (probado tres veces, la ultima con un ID de campana 100% valido),
// asi que no hay forma barata de sacar hora-de-apertura ni contacto por
// contacto de Email. Declarado en pantalla, no silenciado.
//
// El "top de sedes por lecturas" que hubo antes SE QUITO el mismo
// 14-sep-2026: Emmanuel lo marco con razon ("esto no me dice nada") --
// era un ranking de quien leyo mas, pero leer un WhatsApp no es una
// decision de la sede, es solo que el mensaje se entrego. El HALLAZGO
// real (y el que si importa) es que de 672 sedes tocadas, 149 tienen
// telefono conocido, 71 leyeron al menos un mensaje, y de esas
// PRACTICAMENTE NINGUNA responde por texto (1 telefono de toda la
// cuenta, y ese ni siquiera es una sede confirmada) -- es un canal de
// AVISO unidireccional, no de conversacion. Eso se muestra como embudo,
// no como leaderboard. Responde al mismo filtro de cluster de arriba.
// El embudo se calcula EN VIVO sobre LT_TOUCHES (con fecha) cruzado con
// LT_TEL_SEDES/LT_WA_EVENTOS (crudos, con fecha) -- NO sobre un agregado
// ya fijo (LT_WA_EMBUDO, que quedo de un calculo de una sola vez y por
// eso no se movia con el filtro de fecha global; Emmanuel lo detecto
// probando ago-sep y viendo que no cambiaba nada -- seccion 13 de
// CLAUDE.md: un filtro global tiene que cortar sobre datos crudos con
// fecha, un precalculo sin fecha rompe eso).
var telDeSedeWa = {};
leerHoja_('LT_TEL_SEDES').forEach(function (r) {
  if (r.id_internal) telDeSedeWa[String(r.id_internal)] = String(r.telefono || '');
});
var evPorTel = {};
leerHoja_('LT_WA_EVENTOS').forEach(function (r) {
  var t = String(r.telefono || '');
  if (!t) return;
  if (!evPorTel[t]) evPorTel[t] = { leido: {}, respondio: {} };
  evPorTel[t][String(r.tipo)][String(r.fecha)] = true;
});
function ventana3d_(fechaIso) {
  var d0 = new Date(fechaIso + 'T00:00:00Z').getTime();
  var out = [fechaIso];
  for (var i = 1; i <= 3; i++) {
    out.push(new Date(d0 + i * 86400000).toISOString().substring(0, 10));
  }
  return out;
}
var embudoVisto = {}; // (audiencia|id_sede) ya contado, para no duplicar sedes con varios toques
var emb = { tocadas: 0, con_tel: 0, leyeron: 0, respondieron: 0 };
leerHoja_('LT_TOUCHES').forEach(function (r) {
  if (String(r.canal) !== 'WhatsApp') return;
  var fch = String(r.fecha || '');
  if (fch < R.inicio || fch > R.fin) return;
  if (!tocaCluster_(String(r.audiencia))) return;
  var idS = String(r.id_sede || '');
  var key = r.audiencia + '|' + idS;
  if (embudoVisto[key]) return;
  embudoVisto[key] = true;
  emb.tocadas++;
  var tel = telDeSedeWa[idS];
  if (!tel) return;
  emb.con_tel++;
  var ev = evPorTel[tel];
  if (!ev) return;
  var ventana = ventana3d_(fch);
  var leyo = ventana.some(function (f2) { return ev.leido[f2]; });
  var respondio = ventana.some(function (f2) { return ev.respondio[f2]; });
  if (leyo) emb.leyeron++;
  if (respondio) emb.respondieron++;
});

f.wa = {
  franja: leerHoja_('LT_WA_FRANJA').map(function (r) {
    return { hora: num_(r.hora), leidos: num_(r.leidos), respondio: num_(r.respondio) };
  }),
  embudo: emb
};
f.notaWa = 'Solo WhatsApp: cruce real de teléfono contra las conversaciones de ' +
  'HubSpot, dentro del período y el cluster que tengas elegidos arriba ' +
  '(hay conversaciones reales cruzadas desde 25-nov-2025). Email no tiene ' +
  'equivalente — su API de eventos no deja filtrar por campaña.';

// Audiencias sin workflow que las toque: quedan declaradas, no escondidas.
var conWf = {};
f.workflows.forEach(function (w) {
  if (w.activo && !w.vacio) conWf[w.audiencia] = true;
});
f.sinTocar = ACC.filter(function (a) {
  return porAud[a] > 0 && !conWf[a];
}).map(function (a) {
  var sol = 0;
  serie.forEach(function (p) { sol += (p.por[a] || 0); });
  var mb = montoPorAud[a] || { des: 0, monto: 0 };
  return { audiencia: a, nombre: NOMBRE[a], sedes: porAud[a], solicitudes: sol,
           monto: mb.monto };
});

// ---- KPIs -------------------------------------------------------------
var totSol = 0, totDes = 0;
serie.forEach(function (p) { totSol += p.sol; totDes += p.des; });
var totImp = 0, sedesToc = {};
f.impactos.forEach(function (i) { totImp += i.sedes; });
var dias = serie.length || 1;
var etqCluster = f.filtroActivo ? (NOMBRE[f.filtroActivo] || f.filtroActivo) + ' · ' : '';
f.kpis = [
  kpi_('Sedes en la cola larga', totalPob, { formato: 'num', color: 'azul',
    sublabel: etqCluster + (f.filtroActivo ? 'este cluster' : 'población de los workflows') +
      ' · ' + U.etiqueta,
    fuente: 'HubSpot · audiencia_long_tail',
    nota: 'Las cinco audiencias con pieza asignada. No incluye "No contactar" ' +
      'ni "Sin pieza asignada".' + (f.filtroActivo
        ? ' Con el cluster puesto en "' + (NOMBRE[f.filtroActivo] || f.filtroActivo) +
          '", todo este frente — serie, impactos y solicitudes — queda acotado a esa audiencia.'
        : '') }),
  kpi_('Solicitudes del período', totSol, { formato: 'num', color: 'verde',
    sublabel: fNumSrv_(Math.round((totSol / dias) * 10) / 10) + ' por día en ' +
      fNumSrv_(dias) + ' días',
    fuente: 'BigQuery · profile_institucion',
    nota: 'Radicadas por pacientes de las sedes que están en la población de ' +
      'los workflows.' }),
  kpi_('Impactos enviados', totImp, { formato: 'num', color: 'ambar',
    sublabel: f.impactos.length + ' piezas de cadencia en el período',
    fuente: 'HubSpot · historial de lt_ultima_pieza',
    nota: 'Cada impacto es un envío de una pieza a un lote de sedes. Sale del ' +
      'historial de la propiedad, que es el log que escriben los workflows.' }),
  kpi_('Solicitudes por sede', totalPob ? Math.round((totSol / totalPob) * 100) / 100 : 0,
    { formato: 'num', color: 'morado',
      sublabel: 'en el período, por sede de la cola larga',
      fuente: 'BigQuery + HubSpot',
      nota: 'Es la unidad de comparación entre audiencias: una audiencia con ' +
        'muchas sedes y pocas solicitudes es esfuerzo mal puesto.' }),
  kpi_('Plata desembolsada', Math.round(totalMonto), { formato: 'copC', color: 'verde',
    sublabel: fNumSrv_(totalDesembolsos) + ' desembolsos en el período',
    fuente: 'BigQuery · profile_institucion (misma fuente que F1/F2)',
    nota: 'Desembolsos reales de las sedes de la población, cruzados por ' +
      'id_internal -> id de HubSpot. Si la sede no cruza (falta el id_internal ' +
      'o no existe en la plataforma) su plata no puede contarse aquí, igual que ' +
      'en el resto del tablero.' })
];

f.textos = { funcionando: cfg.f7_funcionando || '', cuello: cfg.f7_cuello || '',
             atencion: cfg.f7_atencion || '', fecha: cfg.textos_fecha || '' };
return f;
}

function armarF6_() {
  var filas = leerHoja_('NOVEDADES');
  return {
    novedades: filas.map(function (r) {
      return { producto: String(r.producto || ''), descripcion: String(r.descripcion || ''),
               estado: String(r.estado || ''), inicio: fechaCelda_(r.fecha_inicio),
               fin: fechaCelda_(r.fecha_fin), inversion: num_(r.inversion_cop),
               acciones: String(r.acciones || ''), piezas: String(r.piezas || ''),
               metricas: [1, 2, 3, 4].map(function (i) {
                 return { nombre: String(r['metrica_' + i + '_nombre'] || ''),
                          valor: r['metrica_' + i + '_valor'] };
               }).filter(function (m) { return m.nombre; }) };
    }),
    aviso: 'La plataforma de cupones no tiene API conectada. Este frente se llena a mano ' +
      'en la hoja NOVEDADES del Sheet y se refleja aquí al recargar.'
  };
}

// =====================================================================
// FRENTE 8 — SEGUNDOS CREDITOS  (28-sep-2026)
// =====================================================================
/* Producto nuevo: el paciente que ya pago y cerro su primer credito, con
   buen comportamiento, puede tomar un segundo. Arranco el 22-sep-2026 (las
   primeras solicitudes reales son de ese dia, junto con los workflows
   "[Growth] 2do credito" de ActiveCampaign).

   OJO CON EL DENOMINADOR — es la trampa de este frente. SEG_ELEGIBLES sale
   de la solicitud MAS RECIENTE de cada paciente, asi que apenas alguien
   aplica a su segundo credito deja de ser "elegible" y se cae de esa hoja.
   Verificado el 28-sep-2026: 0 de los 19 que ya aplicaron estaban entre los
   8.696 elegibles. O sea que "aptos" es EL DISPONIBLE DE HOY, un stock que
   se encoge cuando el programa funciona, no la base historica. Cualquier
   tasa de conversion se calcula contra (aptos + ya aplicaron), nunca contra
   aptos solo: si no, la tasa mejora sola por encogimiento del denominador.
   Mismo error de familia que la seccion 7 de CLAUDE.md.

   Filtro de fecha: las solicitudes SI se cortan por R.inicio..R.fin (tienen
   fecha propia); el pool de aptos NO, porque es una foto del estado actual y
   "cuantos aptos habia en agosto" no es una pregunta que la fuente pueda
   responder. Va declarado en pantalla, no escondido (seccion 20). */
function armarF8_(R, U) {
  var f = {};

  /* Misma definicion de "desembolso" que pull_credito_dia.py / el resto del
     tablero, SIN 'dismissed' (seccion 11). Si F8 usara una propia, el mismo
     credito se contaria distinto en F1 y en F8.

     VALIDADO EXPLICITAMENTE POR EMMANUEL el 28-sep-2026, no lo cambies. El
     mismo dia que se publico el frente pregunto por que la tarjeta decia 6
     desembolsos si su query no mostraba ninguno en estado 'desembolsado'
     (los 6 eran 5 en `pendiente_desembolso` + 1 en
     `pendiente_aprobacion_medico`). Se midio el alcance — en 2026 el 96,4%
     de los creditos de este bucket si termina desembolsando, 3,2% de la
     plata queda pendiente — y se empezo a separarlo en dos conceptos
     ("desembolsadas" contra "aprobadas en camino"). Emmanuel reviso y
     confirmo que para el negocio esos estados SI cuentan como desembolso, y
     se revirtio el cambio. O sea: esto ya se cuestiono una vez, con datos, y
     la respuesta fue que asi esta bien. */
  var CONV = {
    pendiente_aprobacion_medico: 1, desembolsado: 1,
    pendiente_validacion_cliente: 1, fulfilled: 1, pendiente_desembolso: 1
  };

  // ---- Pool de aptos: foto de hoy, cortada solo por origen/rol ----------
  var ele = filtrarPorId_(leerHoja_('SEG_ELEGIBLES'), 'id_sede', U);
  f.aptos = ele.length;
  f.montoPrimerCredito = 0;
  ele.forEach(function (r) { f.montoPrimerCredito += num_(r.monto); });

  // ---- Solicitudes de 2do credito: si se cortan por fecha --------------
  var todas = filtrarPorId_(leerHoja_('SEG_SOLICITUDES'), 'id_sede', U);
  var sol = todas.filter(function (r) {
    var d = String(r.fecha || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    if (R.inicio && d < R.inicio) return false;
    if (R.fin && d > R.fin) return false;
    return true;
  });

  f.solicitudes = sol.length;
  f.desembolsos = 0;
  f.monto = 0;
  sol.forEach(function (r) {
    if (!CONV[String(r.estado || '').trim()]) return;
    f.desembolsos++;
    f.monto += num_(r.monto);
  });

  // El total historico del programa (sin cortar por fecha) es lo que hace
  // legible el denominador honesto de arriba, y ademas deja ver cuando el
  // rango elegido se esta comiendo parte del programa.
  f.solicitudesTotal = todas.length;
  f.aptosTotal = f.aptos + todas.length;
  f.hay = f.aptos > 0 || todas.length > 0;

  // ---- Serie diaria: solicitudes contra desembolsos ---------------------
  /* Las DOS series se fechan por el dia de la solicitud, a proposito: asi
     "desembolsos" es el subconjunto que convirtio y siempre va por debajo,
     igual que CREDITO_DIA para todo el resto del tablero. Fechar los
     desembolsos por `fecha_solicitud_desembolso` las dejaria midiendo
     universos distintos en el mismo grafico (el error de la seccion 28). */
  var porDia = {};
  sol.forEach(function (r) {
    var d = String(r.fecha).substring(0, 10);
    if (!porDia[d]) porDia[d] = { sol: 0, des: 0 };
    porDia[d].sol++;
    if (CONV[String(r.estado || '').trim()]) porDia[d].des++;
  });

  /* Piso dinamico, no una fecha fija (secciones 31/32): la serie arranca en
     el primer dia con solicitudes de verdad, no en R.inicio. El rango por
     defecto son ~84 dias y el programa lleva menos de una semana: sin esto
     la grafica serian 80 barras en cero y despues un pico. */
  var dias = Object.keys(porDia).sort();
  f.serie = [];
  if (dias.length) {
    var ini = dias[0];
    var fin = R.fin && R.fin > dias[dias.length - 1] ? R.fin : dias[dias.length - 1];
    var cur = parseISO_(ini), tope = parseISO_(fin);
    while (cur && tope && cur <= tope) {
      var k = fmtFecha_(cur);
      var b = porDia[k] || { sol: 0, des: 0 };
      f.serie.push({ x: k, solicitudes: b.sol, desembolsos: b.des });
      cur = sumarDias_(cur, 1);
    }
  }

  // ---- Rutas de especialidad: de que se trato el 1er credito y de que el
  // 2do. Es la pregunta de cross-selling: cuantos se quedan en lo mismo y
  // cuantos cruzan a otra especialidad.
  var rutas = {};
  sol.forEach(function (r) {
    var a = String(r.especialidad_ant || '').trim() || '(sin especialidad)';
    var b = String(r.especialidad || '').trim() || '(sin especialidad)';
    var k = a + '\u0001' + b;
    if (!rutas[k]) rutas[k] = { origen: a, destino: b, n: 0, monto: 0 };
    rutas[k].n++;
    rutas[k].monto += num_(r.monto);
  });
  f.rutas = Object.keys(rutas).map(function (k) { return rutas[k]; })
    .sort(function (x, y) { return y.n - x.n; });
  f.cruzaron = 0;
  f.rutas.forEach(function (r) { if (r.origen !== r.destino) f.cruzaron += r.n; });

  // ---- ATRIBUCION: de que medio llegaron las solicitudes ----------------
  /* Agregado el 29-sep-2026, despues de la primera campana de WhatsApp a
     los elegibles de segundo credito. Las campanas mandan a la gente a
     aplicar por `pre-check`, asi que ese medio es la llave de atribucion:
     cuando sale una campana, pre-check se dispara y el resto no se mueve.
     Medido ese dia: pre-check traia 3 solicitudes en 7 dias (2 el 22-sep,
     1 el 24-sep) y la manana de la campana trajo 8.

     Esto NO es un panel de "la campana de hoy" sino de atribucion en el
     tiempo, a proposito: un panel atado a una fecha caduca y hay que
     rehacerlo en cada envio. Asi, cada campana futura se ve sola como un
     pico de pre-check, sin tocar codigo.

     La HORA viene sin convertir desde pull_segundos.py (ver el comentario
     largo de ese archivo): `created` guarda hora local de Bogota pero esta
     tipada como TIMESTAMP, y convertirla le resta 5 horas — lo que hacia
     ver las solicitudes de una campana de las 10 AM como si fueran de las
     5 AM, o sea ANTES del envio. */
  var MEDIO_CAMPANA = 'pre-check';
  var porMedio = {}, porDiaMedio = {}, porHora = {};
  var CONV_SEG = CONV;   // misma definicion de desembolso que el resto
  sol.forEach(function (r) {
    var m = String(r.medio || '(sin medio)').trim() || '(sin medio)';
    var d = String(r.fecha || '').substring(0, 10);
    var e = String(r.estado || '').trim();
    if (!porMedio[m]) {
      porMedio[m] = { medio: m, n: 0, aprobadas: 0, rechazadas: 0,
                      desembolsadas: 0, monto: 0 };
    }
    var b = porMedio[m];
    b.n++;
    if (e === 'approved') b.aprobadas++;
    if (e.indexOf('rejected') === 0) b.rechazadas++;
    if (CONV_SEG[e]) { b.desembolsadas++; b.monto += num_(r.monto); }
    if (e === 'approved') b.monto += num_(r.monto);

    if (!porDiaMedio[d]) porDiaMedio[d] = { campana: 0, otros: 0 };
    if (m === MEDIO_CAMPANA) porDiaMedio[d].campana++; else porDiaMedio[d].otros++;
  });
  f.porMedio = Object.keys(porMedio).map(function (k) { return porMedio[k]; })
    .sort(function (a, b) { return b.n - a.n; });

  var diasAtrib = Object.keys(porDiaMedio).sort();
  f.atribDia = diasAtrib.map(function (d) {
    return { x: d, campana: porDiaMedio[d].campana, otros: porDiaMedio[d].otros };
  });

  /* El dia mas activo del rango, hora por hora. Sirve para ver la respuesta
     a un envio (a que hora entro la primera solicitud, cuanto duro el
     racimo) sin tener que fijar la fecha de una campana en el codigo. */
  var diaTop = '', maxDia = 0;
  diasAtrib.forEach(function (d) {
    var t = porDiaMedio[d].campana + porDiaMedio[d].otros;
    if (t > maxDia || (t === maxDia && d > diaTop)) { maxDia = t; diaTop = d; }
  });
  f.diaPico = diaTop;
  f.diaPicoN = maxDia;
  if (diaTop) {
    sol.forEach(function (r) {
      if (String(r.fecha || '').substring(0, 10) !== diaTop) return;
      var h = Number(r.hora_num);
      if (isNaN(h)) return;
      if (!porHora[h]) porHora[h] = { campana: 0, otros: 0 };
      if (String(r.medio || '').trim() === MEDIO_CAMPANA) porHora[h].campana++;
      else porHora[h].otros++;
    });
    // Se pinta la jornada completa (6 AM a 8 PM) y no solo las horas con
    // dato: un racimo de 4 horas se lee como racimo solo si al lado se ven
    // las horas vacias.
    f.horas = [];
    for (var hh = 6; hh <= 20; hh++) {
      var bh = porHora[hh] || { campana: 0, otros: 0 };
      f.horas.push({ x: ('0' + hh).slice(-2) + ':00',
                     campana: bh.campana, otros: bh.otros });
    }
  } else {
    f.horas = [];
  }

  // Cuan MADURA es la cohorte: con horas de vida, "0 desembolsos" no es un
  // fracaso, es que no ha pasado el tiempo. Sin esto la tabla de desenlace
  // se lee al reves (ver la trampa del embudo inmaduro).
  var masNueva = '', masVieja = '';
  sol.forEach(function (r) {
    var ts = String(r.fecha || '').substring(0, 10) + ' ' + String(r.hora || '');
    if (!masVieja || ts < masVieja) masVieja = ts;
    if (ts > masNueva) masNueva = ts;
  });
  f.cohorteDesde = masVieja;
  f.cohorteHasta = masNueva;

  f.periodo = R.inicio + ' a ' + R.fin;
  f.universo = U.etiqueta;

  f.kpis = [
    { label: 'Pacientes aptos hoy', valor: f.aptos, formato: 'num',
      sublabel: f.solicitudesTotal
        ? 'foto de hoy · ' + f.solicitudesTotal + ' ya aplicaron y salieron del pool'
        : 'foto de hoy · no se corta por fecha' },
    { label: 'Solicitudes de 2º crédito', valor: f.solicitudes, formato: 'num',
      sublabel: f.solicitudes === f.solicitudesTotal
        ? 'todas las del programa caen en este rango'
        : f.solicitudesTotal + ' en total desde que arrancó' },
    { label: 'Desembolsos', valor: f.desembolsos, formato: 'num',
      sublabel: 'misma definición que el resto del tablero' },
    { label: 'Plata desembolsada', valor: f.monto, formato: 'cop',
      sublabel: 'de los segundos créditos del rango' }
  ];
  return f;
}
