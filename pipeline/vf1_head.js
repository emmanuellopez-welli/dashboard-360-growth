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
  // El universo sale del payload, no escrito a mano: estaba hardcodeado en
  // "596 de 3.603" y cualquier cambio de la base lo dejaba mintiendo.
  h += alcance('Todo este frente cuenta SOLO las sedes que trajo marketing: eventos, ' +
    'referidos, página web y social media. Son ' + fNum(f.cohortes && f.cohortes.resumen ?
      f.cohortes.resumen.sedesMkt : 0) + ' de ' +
    fNum(f.cohortes && f.cohortes.resumen ? f.cohortes.resumen.sedesTodas : 0) +
    ' sedes. Las que entraron por FARMER, HUNTER, DENTALINK o sin origen registrado no ' +
    'se cuentan acá.');

  // --- 0. El titular: cuánta base nueva trae marketing ---------------
  /* Esto estaba enterrado como dos columnas sin dividir en la tabla de
     cosechas. Es el argumento mas fuerte que tiene el area, asi que abre
     el frente. */
  if (f.shareKpi) {
    h += '<h2 class="sec">1 · Marketing ya trae la mitad de la base nueva</h2>' +
      '<p class="sec-sub">De todas las sedes que entran al negocio cada mes, qué ' +
      'porcentaje llegó por un canal de marketing.</p>';
    h += '<div class="grid2">' +
      '<div>' + filaKPIs([f.shareKpi]) + '</div>' +
      panel('Participación de marketing en las sedes nuevas',
        '% de las sedes creadas cada mes', '', 'gF1Share') +
      '</div>';
    pintar('gF1Share', function (el) {
      chLinea(el, (f.share || []).map(function (x) {
        return { x: x.mes, y: x.pct, d: x };
      }), { color: 'var(--s1)', gran: 'mes', alto: 190, formatoEje: fPct,
        detalle: function (d) {
          return [{ nombre: 'Sedes de marketing', valor: fNum(d.d.mkt) },
                  { nombre: 'Sedes nuevas del mes', valor: fNum(d.d.todas) },
                  { nombre: 'Participación', valor: fPct(d.d.pct) }];
        } });
    });
    if (f.shareLectura) h += '<div class="lectura">' + esc(f.shareLectura) + '</div>';
  }

  // --- 1. La pauta ---------------------------------------------------
  h += '<h2 class="sec">2 · La pauta: ¿cuánto nos cuesta un lead?</h2>' +
    '<p class="sec-sub">Inversión en Meta y lo que trae.</p>';
  h += filaKPIs((f.kpis || []).slice(0, 3));
  if (f.pendienteMeta) h += avisoBox(f.notaMeta);

  h += '<div class="grid2" style="margin-top:14px">' +
    panel('Leads', 'formularios de pauta por ' + g, '', 'gF1Leads') +
    panel('Costo por lead', 'COP por ' + g + ' — menos es mejor', '', 'gF1Cpl') +
    '</div>';
  pintar('gF1Leads', function (el) {
    chBarras(el, (f.serie || []).map(function (p) { return { x: p.x, y: p.leads }; }),
      { color: 'var(--s2)', nombre: 'Leads', gran: g, formato: fNum,
        vacio: 'Sin datos de Meta Ads en el período' });
  });
  pintar('gF1Cpl', function (el) {
    chLinea(el, (f.serie || []).map(function (p) { return { x: p.x, y: p.cpl }; }),
      { color: 'var(--s1)', nombre: 'CPL', gran: g, formato: fCop, formatoEje: fCopC,
        vacio: 'Sin datos de Meta Ads en el período' });
  });
  // Impresiones y CTR se calculaban y se botaban con un slice(0,3). No
  // merecen tarjeta (en B2B2C no deciden nada) pero si una linea.
  var kImp = (f.kpis || [])[3], kCtr = (f.kpis || [])[4];
  if (kImp && kCtr && kImp.valor !== null) {
    h += '<p class="sec-sub" style="margin-top:8px">Alcance de la pauta en el período: ' +
      esc(fNum(kImp.valor)) + ' impresiones, CTR ' + esc(fPct(kCtr.valor)) +
      '. Van como referencia y no como tarjeta: en B2B2C ninguna de las dos decide nada.</p>';
  }
