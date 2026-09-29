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
function getDashboardData(inicio, fin, origenes, roles, compararF2) {
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
  out.f7 = armarF7_(R, cfg, U);

  out.meta.ms = new Date().getTime() - t0;
  return JSON.parse(JSON.stringify(out));   // serializable para google.script.run
}

// =====================================================================
// SEDES_EVENTOS: la única tabla de sedes que el filtro puede cortar
// =====================================================================

function eventosEnRango_(R, U) {
  var filas = leerHoja_('SEDES_EVENTOS');
  // El filtro global de origen corta los eventos igual que las sedes.
  if (U && !U.sinFiltro) {
    filas = filas.filter(function (f) {
      return !!U.nombres[normNombre_(f.sede)];
    });
  } else if (U) {
    // Sin filtro igual se van las deshabilitadas.
    filas = filas.filter(function (f) {
      return !(U.deshabNom || {})[normNombre_(f.sede)];
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
  leerHoja_('SEDES').forEach(function (r) {
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
  leerHoja_('SEDES').forEach(function (s) {
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
  // Las deshabilitadas se descuentan tambien en el camino "libre". Ese atajo
  // existe para no perder las sedes que no cruzan con HubSpot (el centinela
  // SIN HUBSPOT, 4,2% de los creditos), no para dejar pasar bajas.
  var negado = U.deshabHS || {};
  hechos_().forEach(function (r) {
    if (r.fecha < desde || r.fecha > hasta) return;
    if (negado[r.sede]) return;
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

function armarF1_(R, gran, cfg, estado, U) {
  var f = { kpis: [], serie: [], serieGasto: [], cosechas: [], convOrigen: [] };
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
  var sedesF1 = U.baseCruda || leerHoja_('SEDES');
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
    f.cosechas.push(agCos[m]);
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
  f.shareKpi = shUlt
    ? kpi_('Sedes nuevas en el mes', shUlt.todas, { formato: 'num',
        sublabel: 'de todos los orígenes · ' + shUlt.mes,
        delta: (shPrim && shPrim !== shUlt && shPrim.todas)
          ? delta_(shUlt.todas, shPrim.todas) : null,
        deltaEtiqueta: shPrim ? 'vs ' + shPrim.mes : '',
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
    f.convOrigen.push({
      origen: o, sedes: num_(r.sedes), apps: num_(r.apps),
      aprobados: num_(r.aprobados), desembolsos: num_(r.desembolsos),
      monto: num_(r.monto),
      tasaAprob: num_(r.tasa_aprob), tasaConv: num_(r.tasa_conv),
      appsPorSede: r.sedes ? Math.round((r.apps / r.sedes) * 10) / 10 : 0
    });
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
  // cosecha x origen, asi que si el filtro dice "Evento" la tabla muestra los
  // deals de evento. Con el filtro en "Todos" muestra el pipeline completo.
  //
  // EXCLUSIONES aplicadas en el origen (Fuentes_BigQuery / HubSpot): se sacan
  // los deals cuya causal de cierre perdido es Duplicado/Existente, No paso
  // SARLAFT o Medicina Alternativa. No son oportunidades perdidas, son
  // registros que no debieron existir, y dejarlos en el denominador hunde la
  // tasa de cierre sin que signifique nada.
  // Desde 2026 igual que profundizacion: las cosechas de 2025 son de un
  // pipeline que ya no existe y ensucian la comparacion entre meses.
  var COSECHA_PISO_DEALS = '2026-01';
  var dcO = leerHoja_('DEALS_ORIGEN');
  var selDc = {};
  (U.origenes || []).forEach(function (o) { selDc[o] = true; });
  var agDc = {};
  dcO.forEach(function (r) {
    var cos = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(cos) || cos < COSECHA_PISO_DEALS) return;
    // El origen si corta; el rol NO: el owner del deal es su propio campo y
    // los tres roles del filtro son de la SEDE, que en un deal abierto
    // todavia no existe. Se dice en el subtitulo de la seccion.
    var o = normOrigen_(r.origen);
    if (!U.todos && !selDc[o]) return;
    if (!agDc[cos]) agDc[cos] = { cosecha: cos, deals: 0, m: [0, 0, 0, 0, 0, 0, 0, 0] };
    var b = agDc[cos];
    b.deals += num_(r.deals);
    for (var i = 0; i <= 7; i++) b.m[i] += num_(r['m' + i]);
  });
  f.dealsCohorte = {
    hay: dcO.length > 0,
    offsets: 7,
    // Los deals NO responden al filtro de roles y hay que decirlo: el owner
    // del deal es su propio campo y los tres roles son de la SEDE, que en un
    // deal abierto todavia no existe.
    universo: U.etiqueta,
    notaRoles: U.rolesTodos ? ''
      : 'Los deals no se filtran por rol: el owner del deal es su propio campo ' +
        'y hunter, farmer y CS son de la sede, que en un deal abierto todavía ' +
        'no existe.',
    excluidos: 'Duplicado/Existente · No pasó SARLAFT · Medicina Alternativa · ' +
      'Le faltan Documentos · Pruebas',
    filas: Object.keys(agDc).sort().map(function (cos) {
      var b = agDc[cos], acum = 0, celdas = [];
      for (var m = 0; m <= 7; m++) {
        acum += b.m[m];
        // Acumulado: "cuantos de esta cosecha YA ganaron al mes N". Solo sube,
        // igual que la tabla Acumulada de cosechas de sedes.
        celdas.push(mesFuturo_(cos, m) ? null : acum);
      }
      return { cosecha: cos, n: b.deals, celdas: celdas, ganados: acum,
               conv: b.deals ? Math.round((acum / b.deals) * 1000) / 10 : 0 };
    }).filter(function (r) { return r.n > 0; })
  };

  f.coberturaOrigen = {
    sedesConOrigen: sedesConOrigen, totSedes: totSedes,
    pctApps: totApps ? Math.round((appsConOrigen / totApps) * 1000) / 10 : 0,
    aviso: 'El origen solo está registrado en ' + sedesConOrigen + ' de ' + totSedes +
      ' sedes, que concentran apenas el ' +
      (totApps ? Math.round((appsConOrigen / totApps) * 1000) / 10 : 0) +
      '% de las aplicaciones. La comparación por canal aplica a esa fracción, no al total.'
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
  var canalesCoh = Object.keys(cohA.org).map(function (k) {
    var b = cohA.org[k];
    var logradas = Object.keys(b.firm || {}).length;
    return { canal: k === '(SIN ORIGEN)' ? 'Sin origen' : k,
             sol: b.sol, apr: b.apr, des: b.des, monto: b.monto,
             // Sedes que firmaron, y la plata que puso cada una. Es lo que
             // distingue un origen que trae una sede grande de uno que trae
             // varias chicas: el ticket habla del credito, esto de la sede.
             sedes: logradas,
             porSede: logradas ? Math.round(b.monto / logradas) : 0,
             pct: totCoh ? Math.round((b.monto / totCoh) * 1000) / 10 : 0,
             ticket: b.des ? Math.round(b.monto / b.des) : 0,
             conv: b.apr ? Math.round((b.des / b.apr) * 1000) / 10 : 0 };
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

  // 4 · DESEMBOLSOS ---------------------------------------------------
  // Dos numeros por celda: cuantos desembolsos y cuanta plata. El % no
  // aplica aca, la plata es la unidad.
  MEDIR.desembolsos = function (idx, ids) {
    var n = 0, monto = 0;
    ids.forEach(function (id) {
      var r = idx[id];
      if (!r) return;
      n += num_(r.des_acum);
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

/* El mismo mapa de plata pero SIN acumular: cuanto se desembolso en ESE mes y
   nada mas. Se deriva restando el acumulado del mes anterior, asi que no
   necesita datos nuevos y no puede desincronizarse del acumulado.

   Los dos hacen falta y responden preguntas distintas: el acumulado dice
   cuanto vale una cosecha a los N meses (el argumento de por que
   profundizacion importa), el incremental dice en que mes de vida produce de
   verdad (el argumento de cuando intervenir). */
function incremental_(filas) {
  return filas.map(function (r) {
    var celdas = [], extras = [];
    var prevN = 0, prevM = 0;
    for (var k = 0; k < r.celdas.length; k++) {
      if (r.celdas[k] === null || r.celdas[k] === undefined) {
        celdas.push(null); extras.push(null);
        continue;
      }
      celdas.push(r.celdas[k] - prevN);
      extras.push((r.extras[k] || 0) - prevM);
      prevN = r.celdas[k];
      prevM = r.extras[k] || 0;
    }
    return { cosecha: r.cosecha, n: r.n, sinId: r.sinId,
             cruzables: r.cruzables, celdas: celdas, extras: extras };
  });
}
/* Corre los cinco medidores sobre un grupo de cosechas. El sexto mapa (la
   plata sin acumular) se deriva del cuarto, asi que sale gratis. */
function mapasDe_(cosSet) {
  var m = {};
  ['activas', 'exitosas', 'inactivas', 'desembolsos', 'muertas']
    .forEach(function (k) { m[k] = mapa_(MEDIR[k], cosSet); });
  // El mapa de salida de CS lleva su propio denominador: las sedes de la
  // cosecha que ENTRARON a CS. Con la cosecha completa, febrero se leia
  // como un fracaso de CS cuando lo que pasa es que 126 de sus 183 sedes
  // nunca estuvieron en ese pipeline.
  m.traspaso = mapa_(MEDIR.traspaso, cosSet, null, entroCS);
  m.desembolsos_mes = incremental_(m.desembolsos);
  return m;
}
var A = mapasDe_(cos);
var B = cosB ? mapasDe_(cosB) : null;

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
      if (esMonto) {
        celdas.push(Math.round(sn / n));
        extras.push(Math.round(sm / n));
      } else {
        // n de la celda = total, y el % sale de dividirlo por sSedes. Se
        // guarda sSedes como 'base' para que el frontend calcule la tasa
        // agrupada en vez de dividir por el total de una cosecha.
        celdas.push(sn);
        extras.push(null);
      }
      if (!esMonto) celdas[celdas.length - 1] = sn;
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
      titulo: 'Desembolsos por sede · acumulado',
      pregunta: '¿Cuánto crédito ha originado la cosecha al mes N?',
      sub: 'Acumulado de desembolsos y de COP. Es el argumento de por qué una cosecha ' +
        'vale más que su mes de entrada.',
      def: 'desembolsos y plata acumulados de todas las sedes de la cosecha',
      formato: 'num', clase: 'acum', escala: 'desembolsos acumulados',
      colN: 'Sedes', pctCelda: false, conMonto: true,
      filas: A['desembolsos'], ultimo: ultimo_(A['desembolsos']) },

    { id: 'desembolsos_mes', orden: 4,
      titulo: 'Desembolsos por sede · sin acumular',
      pregunta: '¿En qué mes de vida produce de verdad una cosecha?',
      sub: 'Lo que se desembolsó en ESE mes y nada más. El mapa de arriba acumula; ' +
        'este no, así que se ve en qué mes pica y en cuál se apaga.',
      def: 'desembolsos y plata del mes, no acumulados',
      formato: 'num', clase: 'plata', escala: 'desembolsos del mes',
      colN: 'Sedes', pctCelda: false, conMonto: true,
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
      colN: 'Sedes', pctCelda: true, filas: A['muertas'], ultimo: ultimo_(A['muertas']) }
  ];

  // A cada mapa se le cuelga su promedio y, si hay comparacion, las filas del
  // grupo B con su propio promedio. El frontend intercala.
  f.mapas.forEach(function (m) {
    var esMonto = !!m.conMonto;
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
  // De todas las fichas de HubSpot a las sedes que entran a los mapas, con
  // cada exclusion nombrada. Existe para que BI y Growth puedan cuadrar sus
  // numeros en pantalla: la diferencia entre los dos tableros SIEMPRE ha
  // sido una de estas lineas, nunca el dato.
  //
  // Va sin filtrar a proposito: describe la calidad del dato, no el corte
  // que el usuario eligio.
  var uv = U.universo || {};
  f.escalera = {
    filas: [
      { paso: 'Fichas de sede en HubSpot', n: num_(uv.totalHubSpot),
        signo: 0, nota: 'todo el objeto Sedes, sin filtrar' },
      { paso: 'Deshabilitadas', n: -num_(uv.deshabilitadas), signo: -1,
        nota: 'pipeline Aliados_deshabilitados: aliados con los que ya no ' +
          'operamos, y varias son fichas duplicadas del mismo consultorio' },
      { paso: 'Sin id_internal', n: -num_(uv.sinId), signo: -1,
        nota: 'no se pueden cruzar con la plataforma, así que no se les ' +
          'puede medir actividad' },
      { paso: 'No existen en la plataforma', n: -num_(uv.noPlataforma),
        signo: -1, nota: 'el id_internal no aparece en institucion_medica' },
      // Un cero sin explicacion se lee como "el filtro no funciona". Por
      // eso la nota dice por que es cero: el filtro esta puesto, pero las
      // cuentas de otro pais ya salieron un paso antes por no tener ficha.
      { paso: 'De otro país', n: -num_(uv.otroPais), signo: -1,
        nota: num_(uv.otroPais)
          ? 'la regla del universo es country_code = COL'
          : 'la regla es country_code = COL y está puesta; hoy no quita ' +
            'nada porque las cuentas de otro país no tienen ficha en ' +
            'HubSpot y ya salieron en el paso anterior. Sí entran al ' +
            'conteo de BI, cuya vista arranca de la plataforma' },
      // baseSinFiltro y NO totalBase: el segundo se mueve con los filtros
      // de origen y rol, y hacia que la escalera no cerrara y se
      // contradijera con su propia nota.
      { paso: 'Sedes que entran a los mapas', n: num_(uv.baseSinFiltro),
        signo: 0, nota: 'sobre estas se calcula todo lo de abajo, antes de ' +
          'aplicar los filtros de origen y equipo' }
    ],
    // La exclusion que va en direccion contraria y que el tablero no puede
    // ver solo: arranca de HubSpot, asi que una cuenta de plataforma sin
    // ficha es invisible.
    invisibles: num_(uv.platSinFicha),
    notaInvisibles: 'Además hay ' + num_(uv.platSinFicha) + ' cuentas ' +
      'vinculadas en la plataforma (país COL) que ninguna ficha de HubSpot ' +
      'referencia. El tablero arranca del CRM, así que esas sedes no ' +
      'aparecen en ningún mapa — y sí aparecen en el tablero de BI, que ' +
      'arranca de la plataforma. Es la causa más común de que los dos ' +
      'conteos no cuadren.'
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
    acordada: '2026-09-07',
    nota: 'Las cosechas usan la FECHA UNIFICADA: por cada sede, la más ' +
      'temprana entre la creación de la ficha en HubSpot y la vinculación ' +
      'en la plataforma. Es la misma que BI publica como ' +
      'fecha_minima_admin_hubspot, validada llave por llave — 3.743 de ' +
      '3.743 fechas idénticas, cero diferencias.',
    notaUniverso: 'Universo: solo Colombia, sin las sedes deshabilitadas y ' +
      'sin lo que no existe en HubSpot. Esos tres filtros no están en la ' +
      'vista de BI' +
      (perTot
        ? ', que mezcla ' + fNumSrv_(perTot) + ' cuentas de otro país en las ' +
          'cosechas de 2026 (' + perTxt + '). Es la diferencia que queda por ' +
          'cerrar de su lado.'
        : '.'),
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
  leerHoja_('SEDES').forEach(function (s) {
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
  var hjWa = leerHoja_('RESCATE_WA');
  var hjDes = leerHoja_('RESCATE_DESENLACE');
  var hjHist = leerHoja_('RESCATE_HIST');

  // Las cinco hojas de la gestion se filtran UNA vez, aca, y no en cada uno
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
  hjWa = sinCreditUp_(hjWa);
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

  // ---- ATRIBUCION POR WHATSAPP ---------------------------------------
  // El documento de traspaso daba esto por imposible: "habria que consumir
  // los webhooks de hilos (message.received, message.read) ... No esta
  // hecho". Pero rescate.eventos_hilos YA los tiene (51.266 message.received
  // INBOUND desde el 31-jul-2026), asi que si se puede medir.
  //
  // Es correlacion, no causa: quien responde estaba mas interesado de
  // entrada. Pero disuelve la paradoja del "7 de 10 firmas decian No
  // contesta" — de los marcados No contesta que SI respondieron por
  // WhatsApp, firma el 22,7%; de los que no, el 1,3%.
  var waAg = { respondio: { casos: 0, firmaron: 0, monto: 0 },
               no: { casos: 0, firmaron: 0, monto: 0 } };
  hjWa.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (fch < R.inicio || fch > R.fin) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    var k = String(r.grupo || '') === 'respondio' ? 'respondio' : 'no';
    waAg[k].casos += num_(r.casos);
    waAg[k].firmaron += num_(r.firmaron);
    waAg[k].monto += num_(r.monto_firmado);
  });
  function tasaWa_(b) {
    return b.casos ? Math.round((b.firmaron / b.casos) * 1000) / 10 : 0;
  }
  var waHay = (waAg.respondio.casos + waAg.no.casos) > 0;
  var MIN_FIRMAS_WA = 10;
  var waFirmas = waAg.respondio.firmaron + waAg.no.firmaron;
  var waLift = (tasaWa_(waAg.no) > 0)
    ? Math.round((tasaWa_(waAg.respondio) / tasaWa_(waAg.no)) * 10) / 10 : null;

  var dvAg = { firmo: 0, vivo: 0, vencido: 0, sin_cruce: 0, otro: 0 };
  var dvHay = false;
  hjDes.forEach(function (r) {
    var fch = String(r.fecha || '').substring(0, 10);
    if (fch < R.inicio || fch > R.fin) return;
    if (filtraGes && !U.nombres[normNombre_(r.sede)]) return;
    var k = String(r.desenlace || 'otro');
    if (dvAg[k] === undefined) k = 'otro';
    dvAg[k] += num_(r.casos);
    dvHay = true;
  });
  var desenlaceVivo_ = dvHay
    ? { firmaron: dvAg.firmo, vivos: dvAg.vivo, vencidos: dvAg.vencido,
        sinCruce: dvAg.sin_cruce + dvAg.otro }
    : null;

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
    b2.monto += num_(r.monto_trabajado);
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
  var cohortes = Object.keys(cohAg).sort().map(function (k) {
    var b3 = cohAg[k];
    // Los "sin cruce" no tienen credito contra el que medir: no entran ni al
    // numerador ni al denominador, y se declaran aparte para que la suma de
    // la fila cuadre con los casos trabajados.
    var conCredito = b3.firmo + b3.vivo + b3.vencido;
    var resuelto = b3.firmo + b3.vencido;
    b3.casos = conCredito + b3.sinCruce;
    b3.conCredito = conCredito;
    b3.resuelto = resuelto;
    b3.pctResuelto = conCredito
      ? Math.round((resuelto / conCredito) * 1000) / 10 : 0;
    b3.cierreTodos = conCredito
      ? Math.round((b3.firmo / conCredito) * 1000) / 10 : 0;
    b3.cierreResuelto = resuelto
      ? Math.round((b3.firmo / resuelto) * 1000) / 10 : null;
    b3.mFirmo = Math.round(b3.mFirmo);
    b3.mVivo = Math.round(b3.mVivo);
    b3.mVencido = Math.round(b3.mVencido);
    // Legible = ya se resolvio el 80% de la cosecha. Por debajo de eso el
    // cierre todavia se mueve y no se puede comparar contra otra semana.
    b3.legible = b3.pctResuelto >= 80;
    return b3;
  }).filter(function (x) { return x.casos >= MIN_SEMANA; });

  // ---- LOS 22 MESES ANTERIORES ----------------------------------------
  // gestion_historica, oct-2024 a jul-2026. Va como CONTEXTO y no como serie
  // continua: era otra operacion (el equipo comercial entero, 15-21 personas
  // por mes, sin lista priorizada) y otra taxonomia. Lo unico comparable es
  // volumen, firmas y tasa de cierre — el embudo de contacto NO.
  //
  // La historia NO se corta con el selector de fechas: es la linea base
  // contra la que se lee el periodo, y recortarla al mes elegido la
  // volveria una sola barra.
  var historia = hjHist.map(function (r) {
    var casos = num_(r.casos), firmas = num_(r.firmas);
    return {
      mes: String(r.mes || ''), casos: casos, firmas: firmas,
      personas: num_(r.personas),
      tasa: casos ? Math.round((firmas / casos) * 10000) / 100 : 0,
      wa: num_(r.por_whatsapp), llamada: num_(r.por_llamada),
      era: 'anterior'
    };
  }).filter(function (x) { return /^\d{4}-\d{2}$/.test(x.mes); });

  // La operacion nueva, con la MISMA medida, para que se lea en la misma
  // columna. Sale de RESCATE_GESTION, que ya trae la firma cruzada.
  var mesNuevo = {};
  hjGes.forEach(function (r) {
    var m = String(r.fecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    if (!mesNuevo[m]) mesNuevo[m] = { mes: m, casos: 0, firmas: 0 };
    mesNuevo[m].casos += num_(r.casos);
    mesNuevo[m].firmas += num_(r.firmo);
  });
  Object.keys(mesNuevo).sort().forEach(function (m) {
    var b3 = mesNuevo[m];
    // Julio es mes mixto: la operacion arranco el 31. Se omite para no
    // sumar dos regimenes en una barra.
    if (m <= '2026-07') return;
    historia.push({
      mes: m, casos: b3.casos, firmas: b3.firmas, personas: 1,
      tasa: b3.casos ? Math.round((b3.firmas / b3.casos) * 10000) / 100 : 0,
      wa: 0, llamada: 0, era: 'nueva'
    });
  });
  historia.sort(function (x, y) { return x.mes < y.mes ? -1 : 1; });

  f.gestion = {
    hay: bTot > 0,
    historia: historia,
    historiaNota: 'Los meses hasta julio de 2026 son de otra operación: los ' +
      'registraba el equipo comercial completo — 15 a 21 personas por mes, ' +
      'con picos de 560 casos por día — gestionando todo el pool, sin lista ' +
      'priorizada. La tasa de cierre es lo único comparable, y ni eso ' +
      'limpiamente: la lista priorizada escoge por construcción a los más ' +
      'recuperables, así que parte de la mejora es selección y no gestión. ' +
      'El embudo de contacto no se puede unir: la tabla vieja registra «No ' +
      'contesta» en el 19% de los casos y la nueva en el 45% — son 26 ' +
      'puntos de cambio de formulario, no de operación.',
    semanas: semanas,
    cohortes: cohortes,
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
    wa: waHay ? {
      grupos: [
        { grupo: 'Respondió por WhatsApp después de la gestión',
          casos: waAg.respondio.casos, firmaron: waAg.respondio.firmaron,
          tasa: tasaWa_(waAg.respondio), monto: waAg.respondio.monto },
        { grupo: 'No respondió',
          casos: waAg.no.casos, firmaron: waAg.no.firmaron,
          tasa: tasaWa_(waAg.no), monto: waAg.no.monto }
      ],
      lift: waLift,
      // Con pocas firmas la relacion se da vuelta por azar. Sin esta
      // bandera la tabla afirma lo contrario del hallazgo y no lo dice.
      suficiente: waFirmas >= MIN_FIRMAS_WA,
      firmas: waFirmas,
      minimo: MIN_FIRMAS_WA
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
    // Lo recuperado, que antes vivia en una tabla que repetia el embudo.
    recuperado: {
      firmas: num_(gA.firmo),
      monto: Math.round(num_(pA.monto_rescatado)),
      cierre: bTot ? Math.round((num_(gA.firmo) / bTot) * 1000) / 10 : 0,
      cierrePrev: (gP && num_(gP.casos) >= MIN_PREV_GES)
        ? Math.round((num_(gP.firmo) / num_(gP.casos)) * 1000) / 10 : null,
      // Cierre sobre los casos que YA se resolvieron, que es la unica tasa
      // comparable entre periodos de distinta antiguedad.
      resueltos: desenlaceVivo_
        ? desenlaceVivo_.firmaron + desenlaceVivo_.vencidos : null,
      cierreResuelto: (desenlaceVivo_ &&
                       (desenlaceVivo_.firmaron + desenlaceVivo_.vencidos))
        ? Math.round((desenlaceVivo_.firmaron /
            (desenlaceVivo_.firmaron + desenlaceVivo_.vencidos)) * 1000) / 10
        : null
    },
    // El desenlace de los casos trabajados. Sin esto la tasa de cierre se
    // lee como resultado final, y no lo es: la mayoria sigue viva dentro de
    // su ventana de 30 dias.
    arranque: GES_ARRANQUE,
    prevCorto: !!(gP && num_(gP.casos) < MIN_PREV_GES),
    desenlace: fuenteViva ? desenlaceVivo_ : {
      firmaron: FOTO_GESTION.firmo, vivos: FOTO_GESTION.vivos,
      vencidos: FOTO_GESTION.vencidos, sinCruce: FOTO_GESTION.sinCruce
    },
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
        'porque el paciente cerró después por WhatsApp. Por eso el cierre ' +
        'real se lee en el bloque de WhatsApp y no en las causales.',
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

  // Sedes con más plata sobre la mesa = la lista de trabajo comercial.
  // Se ordena por el crédito que SIGUE VIVO, no por el total: una sede con
  // mucho vencido y nada vivo no es cola de trabajo, es historia.



  // Piezas: distribución real de la última pieza long tail enviada.

  // WhatsApp de rescate (Hilos) — esto sí está fechado por campaña.
  var bcA = { camp: 0, env: 0, ent: 0, leidos: 0, resp: 0 };
  var bcP = { camp: 0, env: 0, ent: 0, leidos: 0, resp: 0 };
  var serieWA = {};
  var topCamp = [];
  leerHoja_('HILOS_BROADCAST').forEach(function (r) {
    if (String(r.tema || '') !== 'Rescate y activacion') return;
    var iso = fechaCelda_(r.fecha);
    if (!iso) return;
    var dentro = (iso >= R.inicio && iso <= R.fin);
    var antes = (iso >= R.prevInicio && iso <= R.prevFin);
    if (!dentro && !antes) return;
    var b = dentro ? bcA : bcP;
    b.camp++; b.env += num_(r.enviados); b.ent += num_(r.entregados);
    b.leidos += num_(r.leidos); b.resp += num_(r.respuestas);
    if (dentro) {
      var k = claveGrupo_(iso, gran);
      if (!serieWA[k]) serieWA[k] = { x: k, enviados: 0, leidos: 0, respuestas: 0 };
      serieWA[k].enviados += num_(r.enviados);
      serieWA[k].leidos += num_(r.leidos);
      serieWA[k].respuestas += num_(r.respuestas);
      topCamp.push({ campana: String(r.campana || ''), fecha: iso,
                     enviados: num_(r.enviados), leidos: num_(r.leidos),
                     respuestas: num_(r.respuestas),
                     tasaResp: num_(r.tasa_respuesta_pct) });
    }
  });
  topCamp.sort(function (a, b) { return b.respuestas - a.respuestas; });

  // Sin entregas en el período, las tasas son 0/0: indefinidas, no cero.
  // Mostrar "0%" haría creer que se enviaron piezas y nadie las leyó.
  var sinEnvios = !bcA.ent;
  var notaSinEnvios = 'No se enviaron piezas de rescate en el rango seleccionado, ' +
    'así que no hay tasa que calcular. El histórico del canal está arriba.';


  // ---- Histórico del canal de rescate, A PROPÓSITO fuera del filtro ----
  // El frente no es "sin empezar": operó y se apagó. Sin este bloque el
  // tablero mostraría ceros en 2026 y parecería que nunca existió.
  var hi = { camp: 0, env: 0, ent: 0, leidos: 0, resp: 0, primera: '', ultima: '' };
  var ventanas = {};
  leerHoja_('HILOS_BROADCAST').forEach(function (r) {
    if (String(r.tema || '') !== 'Rescate y activacion') return;
    var iso = fechaCelda_(r.fecha);
    var env = num_(r.enviados), ent = num_(r.entregados);
    var lei = num_(r.leidos), rsp = num_(r.respuestas);
    hi.camp++; hi.env += env; hi.ent += ent; hi.leidos += lei; hi.resp += rsp;
    if (iso && (!hi.primera || iso < hi.primera)) hi.primera = iso;
    if (iso && iso > hi.ultima) hi.ultima = iso;
    // El equipo nombra la pieza por la ventana: "3 días Rescate", "15 días rescate".
    var m = String(r.campana || '').match(/^\s*0?(\d+)\s*d/i);
    var k = m ? (m[1] + ' días antes de vencer') : 'Otras piezas de rescate';
    if (!ventanas[k]) ventanas[k] = { camp: 0, env: 0, ent: 0, resp: 0 };
    ventanas[k].camp++; ventanas[k].env += env;
    ventanas[k].ent += ent; ventanas[k].resp += rsp;
  });

  var diasApagado = 0;
  if (hi.ultima) {
    diasApagado = Math.max(0, Math.round(
      (new Date().getTime() - parseISO_(hi.ultima).getTime()) / 86400000));
  }


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
// FRENTE 5 — Welli Points: el incentivo como palanca de marketing
//
// Welli Points es fidelización, y en un tablero de marketing la pregunta
// no es cuántos puntos existen sino dos cosas concretas:
//   1. El incentivo que ofrecemos, ¿mueve a la sede? (ofrecido -> ganado)
//   2. Cuando la sede se lo gana, ¿le pagamos? Un programa de lealtad que
//      no paga no es una palanca, es un pasivo de marca.
// Fuente: welli-growth.wp_data, con el job creado en welli-data.
// =====================================================================

function armarF5_(R, ev, U) {
  var f = {};

  // WP_KPI2 ya no se usa: todos los numeros de este frente salen de las
  // tablas por sede, que si respetan el filtro de origen.

  function pctSedes_(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }

  // WP_SEDE_MES viene por sede x mes (con id_sede), asi que el filtro de
  // origen la corta y despues se agrega. Antes se leia WP_SERIE, ya
  // agregada por mes y sin llave de sede.
  var wpSede = filtrarPorId_(leerHoja_('WP_SEDE_MES'), 'id_sede', U);
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

  // hayBQ mide si la fuente esta conectada, NO si el filtro dejo filas: con
  // un origen elegido la serie viene vacia pero los canjes si se filtran.
  f.hayBQ = leerHoja_('WP_SEDE_MES').length > 0 || leerHoja_('WP_SERIE').length > 0;

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
        fuente: 'BigQuery wp_incentivos_diario', color: 'amarillo',
        nota: 'Acumulado del mes por sede, tomado del último snapshot diario. No se ' +
          'suman los días: cada día repite el acumulado.' }),
      kpi_('WP que se ganaron', ult ? ult.ganado : 0, { formato: 'num',
       
        sublabel: ult ? fNumSrv_(ult.ganaron) + ' sedes se lo ganaron' : '',
        delta: (pen && pen.ganado) ? delta_(ult.ganado, pen.ganado) : null,
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
    ],
    lectura: (function () {
      if (!ult || serie.length < 2) return '';
      var p = serie[0];
      return 'Ofrecimos ' + fNumSrv_(ult.ofrecido) + ' WP contra ' + fNumSrv_(p.ofrecido) +
        ' en ' + p.mes + ', y los ganados pasaron de ' + fNumSrv_(p.ganado) + ' a ' +
        fNumSrv_(ult.ganado) + ': ' + ult.ganaron + ' sedes de ' + fNumSrv_(ult.sedes) +
        ' ganan algo.';
    }())
  };

  var hoyIso = hoyISO_();
  var agInc = {};
  filtrarPorId_(leerHoja_('WP_SEDE_INC'), 'id_sede', U).forEach(function (r) {
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

  // ---- 2. ¿Le pagamos a la sede? ------------------------------------
  var canjHoja = leerHoja_('WP_CANJES2');
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
  // Ordenar por dias esperando ANTES de cortar: si se corta primero se
  // pierden justo los canjes mas viejos, que son los que hay que pagar.
  f.canjes = canjes.slice().sort(function (a, b) { return b.dias - a.dias; }).slice(0, 25);

  // Todo esto sale del arreglo YA filtrado por origen, no de WP_KPI2, que
  // esta pre-agregado sobre toda la base.
  var PAGADO = ['pagado', 'entregado', 'aprobado'];
  var nCanj = canjes.length, pagados = 0, descontados = 0;
  var ptsCanj = 0, copCanj = 0, diasMax = 0;
  canjes.forEach(function (c) {
    if (c.descontado) descontados++;
    if (PAGADO.indexOf(c.estado.toLowerCase()) >= 0) pagados++;
    ptsCanj += c.pts;
    copCanj += c.cop;
    if (c.dias > diasMax) diasMax = c.dias;
  });

  // Canjes agrupados por mes: la serie de la promesa acumulada.
  var porMes = {};
  canjes.forEach(function (c) {
    var k = String(c.fecha).substring(0, 7);
    if (!k) return;
    if (!porMes[k]) porMes[k] = { mes: k, n: 0, pts: 0, cop: 0, pagados: 0 };
    porMes[k].n++;
    porMes[k].pts += c.pts;
    porMes[k].cop += c.cop;
    if (['pagado', 'entregado', 'aprobado'].indexOf(c.estado.toLowerCase()) >= 0) {
      porMes[k].pagados++;
    }
  });
  f.canjesMes = Object.keys(porMes).sort().map(function (k) { return porMes[k]; });

  f.pago = {
    kpis: [
      kpi_('Canjes solicitados', nCanj, { formato: 'num',
        sublabel: 'sedes que pidieron su premio', delta: null,
        fuente: 'BigQuery wp_canjeos_solicitados', color: 'azul' }),
      kpi_('Plata comprometida', copCanj, { formato: 'copC',
        sublabel: fNumSrv_(ptsCanj) + ' puntos a ' + fNumSrv_(COP_POR_PUNTO) + ' COP',
        delta: null, fuente: 'BigQuery wp_canjeos_solicitados', color: 'amarillo' }),
      kpi_('Canjes pagados', pagados, { formato: 'num',
        sublabel: nCanj ? 'de ' + fNumSrv_(nCanj) + ' solicitados' : '', delta: null,
        fuente: 'BigQuery wp_canjeos_solicitados', color: pagados ? 'verde' : 'morado',
        nota: 'Cuentan como pagado los estados pagado / entregado / aprobado.' }),
      kpi_('El más viejo lleva', diasMax, { formato: 'num',
        sublabel: 'días desde que la sede lo pidió', delta: null,
        deltaInvertido: true, fuente: 'BigQuery wp_canjeos_solicitados',
        color: 'morado' }),
      // El pasivo completo, no solo lo ya pedido: son puntos ganados que la
      // sede puede reclamar en cualquier momento. Es la pregunta de un CFO.
      kpi_('Puntos ganados sin reclamar', ult ? ult.pendiente * COP_POR_PUNTO : 0, {
        formato: 'copC',
        sublabel: ult ? fNumSrv_(ult.pendiente) + ' WP a ' + fNumSrv_(COP_POR_PUNTO) +
          ' COP · exposición si todas reclaman' : '',
        delta: (pen && pen.pendiente) ? delta_(ult.pendiente, pen.pendiente) : null,
        deltaInvertido: true, fuente: 'BigQuery wp_incentivos_diario', color: 'amarillo',
        nota: 'Es un pasivo contingente, no un gasto: la sede ya se ganó estos puntos y ' +
          'puede pedirlos cuando quiera. Creció de ' +
          (serie.length ? fNumSrv_(serie[0].pendiente) + ' WP en ' + serie[0].mes : '') +
          ' a ' + (ult ? fNumSrv_(ult.pendiente) + ' WP en ' + ult.mes : '') +
          ', y los canjes ya pedidos son solo una parte.' })
    ],
    lectura: (function () {
      if (!nCanj) return '';
      if (pagados === 0) {
        return 'Ninguno de los ' + fNumSrv_(nCanj) + ' canjes aparece pagado y a ' +
          descontados + ' ya se les descontó el saldo: ' +
          fCopSrv_(copCanj) + ' pendientes, hasta ' + diasMax + ' días.';
      }
      return fNumSrv_(pagados) + ' de ' + fNumSrv_(nCanj) + ' canjes pagados.';
    }())
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
function armarF7_(R, cfg, U) {
  var f = {};
  var ACC = ['PERFILAMIENTO', 'REACTIVAR', 'DESEMBOLSO', 'RECONOCIMIENTO', 'ESTRENA'];
  var NOMBRE = {
    PERFILAMIENTO: 'Qué paciente sí pasa',
    REACTIVAR: 'Vuelve a aplicar',
    DESEMBOLSO: 'Tu trabajo sí sirve',
    RECONOCIMIENTO: 'Reconocimiento',
    ESTRENA: 'Estrena tu primer paciente'
  };

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

  // ---- Serie de solicitudes por dia, dentro del rango ------------------
  var ap = leerHoja_('LT_APPS_DIA');
  var dia = {}, audSet = {};
  ap.forEach(function (r) {
    var a = String(r.audiencia || '').trim().toUpperCase();
    if (ACC.indexOf(a) < 0) return;
    var fch = String(r.fecha || '');
    if (fch < R.inicio || fch > R.fin) return;
    if (!dia[fch]) dia[fch] = { x: fch, sol: 0, des: 0, sedes: 0, por: {} };
    var b = dia[fch];
    var sol = num_(r.solicitudes);
    b.sol += sol;
    b.des += num_(r.desembolsos);
    b.sedes += num_(r.sedes_activas);
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
    var b = dia[k] || { x: k, sol: 0, des: 0, sedes: 0, por: {} };
    serie.push({ x: k, y: b.sol, sol: b.sol, des: b.des, sedes: b.sedes, por: b.por });
}
f.serie = serie;

// ---- Impactos reales, del historial de lt_ultima_pieza ---------------
var tc = leerHoja_('LT_TOUCHES');
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
  return w;
}).filter(function (w) { return w.audiencia !== '(ENRUTADOR)'; })
  .sort(function (a, b) { return b.sedes - a.sedes; });

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
  return { audiencia: a, nombre: NOMBRE[a], sedes: porAud[a], solicitudes: sol };
});

// ---- KPIs -------------------------------------------------------------
var totSol = 0, totDes = 0;
serie.forEach(function (p) { totSol += p.sol; totDes += p.des; });
var totImp = 0, sedesToc = {};
f.impactos.forEach(function (i) { totImp += i.sedes; });
var dias = serie.length || 1;
f.kpis = [
  kpi_('Sedes en la cola larga', totalPob, { formato: 'num', color: 'azul',
    sublabel: 'población de los workflows · ' + U.etiqueta,
    fuente: 'HubSpot · audiencia_long_tail',
    nota: 'Las cinco audiencias con pieza asignada. No incluye "No contactar" ' +
      'ni "Sin pieza asignada".' }),
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
        'muchas sedes y pocas solicitudes es esfuerzo mal puesto.' })
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
