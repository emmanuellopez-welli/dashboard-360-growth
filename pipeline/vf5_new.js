// ------------------------------------------------------------------ F5
/* Welli Points con datos reales de welli-growth.wp_data. El frente ya no
   pregunta "cuantas sedes entraron" (eso era adopcion de un programa) sino
   las dos preguntas de marketing: el incentivo convierte, y le pagamos. */
function vistaF5() {
  var f = D.f5;
  var cv = f.conversion || {};
  var pg = f.pago || {};
  var vg = f.vigencia || {};
  var rf = f.referidos || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 5</div>' +
    '<h1>El incentivo, ¿mueve a la sede — y le estamos pagando?</h1>' +
    '<p class="lead">Welli Points es el único incentivo directo que marketing le pone ' +
    'en la mano a la sede: gana puntos por aplicar y por desembolsar, y los cambia por ' +
    'dinero. Sirve si convierte y si se paga. Si falla lo segundo, lo primero no importa.</p>' +
    '</div>';
  h += alcance('Welli Points aplica a TODA la base de sedes, no solo a las de origen ' +
    'marketing: es una palanca nuestra sobre la base instalada, igual que las piezas del ' +
    'frente 2.');

  if (!f.hayBQ) {
    h += avisoBox('No hay datos de welli-growth.wp_data en el Sheet. Corre ' +
      'refreshWelliPoints() y revisa la hoja _LOG.', true);
    return h;
  }

  // --- 1. ¿Convierte el incentivo? ----------------------------------
  h += '<h2 class="sec">1 · ¿El incentivo convierte?</h2>' +
    '<p class="sec-sub">Puntos prometidos contra puntos ganados, en el mismo grupo de ' +
    'sedes. No compara sedes distintas, así que no tiene el sesgo de selección que sí ' +
    'tienen las piezas del frente 2.</p>';
  h += filaKPIs(cv.kpis || []);

  var serie = f.serie || [];
  h += '<div class="grid2" style="margin-top:14px">' +
    panel('Prometido contra ganado, por mes', 'los dos en puntos, mismo eje',
      leyenda([{ nombre: 'WP ofrecidos', color: 'var(--s2)' },
               { nombre: 'WP ganados', color: 'var(--s4)' }]), 'gF5Conv') +
    panel('Detalle por mes', '', tabla([
      { k: 'mes', t: 'Mes', f: 'txt' },
      { k: 'sedes', t: 'Sedes' },
      { k: 'ofrecido', t: 'WP ofrec.' },
      { k: 'ganado', t: 'WP ganados' },
      { k: 'ganaron', t: 'Sedes que ganaron' },
      { k: 'conversion', t: 'Conversión', f: 'pct' }
    ], serie)) +
    '</div>';
  pintar('gF5Conv', function (el) {
    chGrupos(el, serie.map(function (x) { return x.mes; }), [
      { nombre: 'WP ofrecidos', color: 'var(--s2)',
        valores: serie.map(function (x) { return x.ofrecido; }) },
      { nombre: 'WP ganados', color: 'var(--s4)',
        valores: serie.map(function (x) { return x.ganado; }) }
    ], { formato: fNum, alto: 210 });
  });
  if (cv.lectura) h += '<div class="lectura alerta">' + esc(cv.lectura) + '</div>';

  // Cual incentivo mueve: ordenado por sedes que ganaron, no por tamano.
  var inc = (f.incentivos || []).slice().sort(function (a, b) {
    return b.ganaron - a.ganaron || b.sedes - a.sedes;
  });
  h += panel('Qué incentivo mueve algo',
    'ordenado por sedes que efectivamente ganaron el punto', tabla([
      { k: 'incentivo', t: 'Incentivo', f: 'txt', txt: true },
      { k: 'sedes', t: 'Sedes' },
      { k: 'ganaron', t: 'Ganaron' },
      { k: 'pctGanaron', t: '% que ganó', f: 'pct' },
      { k: 'ofrecido', t: 'WP ofrec.' },
      { k: 'ganado', t: 'WP ganados' },
      { k: 'vigentes', t: 'Vigentes' },
      { k: 'vencidos', t: 'Vencidos' }
    ], inc));

  // --- 2. ¿Le pagamos a la sede? ------------------------------------
  h += '<h2 class="sec">2 · Cuando se lo gana, ¿le pagamos?</h2>' +
    '<p class="sec-sub">Los canjes solicitados y su estado. Es la parte del programa que ' +
    'la sede realmente ve.</p>';
  h += filaKPIs(pg.kpis || []);

  var cm = f.canjesMes || [];
  if (cm.length) {
    h += '<div class="grid2" style="margin-top:14px">' +
      panel('Canjes solicitados por mes', 'plata comprometida', '', 'gF5Canj') +
      panel('Detalle por mes', '', tabla([
        { k: 'mes', t: 'Mes', f: 'txt' },
        { k: 'n', t: 'Canjes' },
        { k: 'pts', t: 'Puntos' },
        { k: 'cop', t: 'Plata', f: 'cop' },
        { k: 'pagados', t: 'Pagados' }
      ], cm)) +
      '</div>';
    pintar('gF5Canj', function (el) {
      chBarras(el, cm.map(function (x) {
        return { x: x.mes, y: x.cop, d: x };
      }), { color: 'var(--s2)', formato: fCopC, alto: 200,
        detalle: function (d) {
          return [{ nombre: 'Canjes', valor: fNum(d.d.n) },
                  { nombre: 'Puntos', valor: fNum(d.d.pts) },
                  { nombre: 'Pagados', valor: fNum(d.d.pagados) }];
        } });
    });
  }
  if (pg.lectura) h += '<div class="lectura alerta">' + esc(pg.lectura) + '</div>';

  h += panel('Canjes pendientes, del más viejo al más nuevo',
    'esta es la lista que hay que pagar', tabla([
      { k: 'fecha', t: 'Fecha', f: 'txt' },
      { k: 'sede', t: 'Sede', f: 'txt', txt: true },
      { k: 'pts', t: 'Puntos' },
      { k: 'cop', t: 'Plata', f: 'cop' },
      { k: 'formato', t: 'Formato', f: 'txt' },
      { k: 'estado', t: 'Estado', f: 'txt' },
      { k: 'dias', t: 'Días esperando' }
    ], (f.canjes || []).slice().sort(function (a, b) { return b.dias - a.dias; }),
      { vacio: 'No hay canjes solicitados' }));

  // --- 3. ¿Hay campaña viva? ----------------------------------------
  h += '<h2 class="sec">3 · ¿Hay oferta viva?</h2>' +
    '<p class="sec-sub">Un incentivo vencido que la sede sigue viendo es peor que no ' +
    'tener incentivo.</p>' +
    '<div class="flujo">' +
    '<div class="paso"><div class="n">' + fNum(vg.conFecha) + '</div>' +
    '<div class="l">incentivos con fecha de vencimiento</div></div>' +
    '<div class="paso"><div class="n">' + fNum(vg.vigentes) + '</div>' +
    '<div class="l">siguen vigentes</div></div>' +
    '<div class="paso"><div class="n">' + fNum(vg.vencidos) + '</div>' +
    '<div class="l">ya vencieron</div></div>' +
    '</div>';
  h += avisoBox(vg.aviso);

  // --- 4. Referidos dentro del programa -----------------------------
  if (rf.aviso) {
    h += '<h2 class="sec">4 · Referidos dentro del programa</h2>' +
      '<p class="sec-sub">Referidos es uno de los cuatro canales de marketing. El ' +
      'programa tiene el mecanismo montado para premiarlos.</p>';
    h += avisoBox(rf.aviso, true);
  }

  if ((f.campanas || []).length) {
    h += panel('Campañas de WhatsApp sobre Welli Points',
      'lo que marketing comunicó del programa', tabla([
        { k: 'fecha', t: 'Fecha', f: 'txt' },
        { k: 'campana', t: 'Campaña', f: 'txt', txt: true },
        { k: 'enviados', t: 'Enviados' },
        { k: 'leidos', t: 'Leídos' },
        { k: 'respuestas', t: 'Respuestas' },
        { k: 'tasaResp', t: '% respuesta', f: 'pct' }
      ], f.campanas));
  }

  return h;
}
