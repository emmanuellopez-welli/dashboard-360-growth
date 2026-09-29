/* Granularidad de la pauta: el usuario elige dia o mes sin recargar. Con un
   rango de un mes, "por mes" da una sola barra; con dos meses, dos. El
   estado vive aca porque no depende del servidor: la serie diaria ya viene
   y el mes se agrega en el cliente. */
var GRAN_PAUTA = 'dia';
function setGranPauta(g) {
  GRAN_PAUTA = g;
  if (D) render();
}

/** Agrupa una serie diaria por mes sumando, o la devuelve tal cual. */
function serieSegunGran(serie, campo) {
  var pts = (serie || []).map(function (p) {
    return { x: p.x, y: p[campo], leads: p.leads, gasto: p.gasto };
  });
  if (GRAN_PAUTA !== 'mes') return pts;
  var ag = {};
  (serie || []).forEach(function (p) {
    var m = String(p.x).substring(0, 7);
    if (!ag[m]) ag[m] = { x: m, leads: 0, gasto: 0 };
    ag[m].leads += Number(p.leads || 0);
    ag[m].gasto += Number(p.gasto || 0);
  });
  return Object.keys(ag).sort().map(function (m) {
    var b = ag[m];
    // El CPL de un mes es gasto/leads del mes, NO el promedio de los CPL
    // diarios: promediar razones da un numero que no existe.
    b.cpl = b.leads ? Math.round(b.gasto / b.leads) : 0;
    b.y = b[campo];
    return b;
  });
}

function botonesGran(id) {
  return '<div class="gran-sel" data-gran="' + id + '">' +
    '<button type="button" data-g="dia" aria-pressed="' +
      (GRAN_PAUTA === 'dia' ? 'true' : 'false') + '">Día</button>' +
    '<button type="button" data-g="mes" aria-pressed="' +
      (GRAN_PAUTA === 'mes' ? 'true' : 'false') + '">Mes</button>' +
    '</div>';
}

function panelGran(titulo, sub, id, idGraf) {
  return '<div class="panel">' +
    '<div class="panel-head"><div>' +
    '<h3>' + esc(titulo) + '</h3>' +
    '<p class="sub" style="margin:0">' + esc(sub) + '</p>' +
    '</div>' + botonesGran(id) + '</div>' +
    '<div class="grafica" id="' + idGraf + '"></div></div>';
}

function vistaF1() {
  var f = D.f1, g = D.meta.agrupacion;
  var em = f.embudo || {};
  var co = f.coberturaOrigen || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 1</div>' +
    '<h1>¿Estamos generando suficiente demanda, y a qué costo?</h1>' +
    '<p class="lead">La cadena completa: metemos plata en pauta, entran clínicas al ' +
    'pipeline, y esas clínicas generan solicitudes de crédito que terminan en desembolsos. ' +
    'Tres eslabones, en ese orden.</p>' +
    '</div>';
  h += cintaOrigen();

  // --- 1. Cuántas clínicas nuevas, y cuántas las trajo marketing ------
  if (f.shareKpi) {
    var sm = f.shareMkt || {};
    h += '<h2 class="sec">1 · Cuántas clínicas nuevas entran cada mes</h2>' +
      '<p class="sec-sub">sedes creadas cada mes en todo el negocio, y cuántas trajo ' +
      'marketing</p>';
    /* La tarjeta lleva el total arriba y el aporte de marketing destacado
       debajo: el porcentaje es el titular del frente y tiene que leerse de
       un golpe, sin buscarlo en una tabla. */
    var tarjeta = tarjetaKPI(f.shareKpi).replace('</div>',
      '<div class="kpi-parte">' +
      '<span class="n">' + fNum(sm.sedes || 0) + '</span>' +
      '<span class="pc">' + fPct(sm.pct || 0) + '</span>' +
      '<span class="l">' + esc(sm.etiqueta || '') + '</span>' +
      '</div></div>');
    h += '<div class="grid2">' +
      '<div class="kpis">' + tarjeta + '</div>' +
      panel('Sedes nuevas por mes',
        'total del negocio contra las que trajo marketing',
        leyenda([{ nombre: 'Todos los orígenes', color: 'var(--s1)' },
                 { nombre: 'Marketing', color: 'var(--s2)' }]), 'gF1Share') +
      '</div>';
    pintar('gF1Share', function (el) {
      var sh = f.share || [];
      chGrupos(el, sh.map(function (x) { return x.mes; }), [
        { nombre: 'Todos los orígenes', color: 'var(--s1)',
          valores: sh.map(function (x) { return x.todas; }) },
        { nombre: 'Marketing', color: 'var(--s2)',
          valores: sh.map(function (x) { return x.mktReal; }) }
      ], { gran: 'mes', formato: fNum, alto: 200 });
    });
    if (f.shareLectura) h += '<div class="lectura">' + esc(f.shareLectura) + '</div>';
  }

  // --- 2. La pauta ---------------------------------------------------
  h += '<h2 class="sec">2 · La pauta: ¿cuánto nos cuesta un lead?</h2>' +
    '<p class="sec-sub">Meta Ads · no depende del origen de la sede</p>';
  h += filaKPIs((f.kpis || []).slice(0, 3));

  h += '<div class="grid2" style="margin-top:14px">' +
    panelGran('Leads', 'formularios de pauta', 'leads', 'gF1Leads') +
    panelGran('Costo por lead', 'COP — menos es mejor', 'cpl', 'gF1Cpl') +
    '</div>';
  pintar('gF1Leads', function (el) {
    chBarras(el, serieSegunGran(f.serie, 'leads'),
      { color: 'var(--s2)', nombre: 'Leads', gran: GRAN_PAUTA, formato: fNum,
        vacio: 'Sin datos de Meta Ads en el período' });
  });
  pintar('gF1Cpl', function (el) {
    chLinea(el, serieSegunGran(f.serie, 'cpl'),
      { color: 'var(--s1)', nombre: 'CPL', gran: GRAN_PAUTA, formato: fCop,
        formatoEje: fCopC, vacio: 'Sin datos de Meta Ads en el período' });
  });
  var kImp = (f.kpis || [])[3], kCtr = (f.kpis || [])[4];
  if (kImp && kCtr && kImp.valor !== null) {
    h += '<p class="sec-sub" style="margin-top:8px">Alcance de la pauta en el período: ' +
      esc(fNum(kImp.valor)) + ' impresiones, CTR ' + esc(fPct(kCtr.valor)) + '.</p>';
  }
