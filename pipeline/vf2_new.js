// ------------------------------------------------------------------ F2
/* Frente 2 reencuadrado a marketing. Dos preguntas, en este orden:
   1. Las sedes que trajimos, ¿se quedan vivas? (base mkt contra el resto)
   2. Lo que les mandamos, ¿las mueve? (palanca sobre toda la base)
   Y al final: ¿escalan de categoria? Nada mas entra al frente. */
function vistaF2() {
  var f = D.f2;
  var b = f.base || {};
  var p = f.palanca || {};
  var kr = f.keyResumen || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 2 · profundización</div>' +
    '<h1>Las sedes que trae marketing, ¿se quedan vivas — y sirve lo que les mandamos?</h1>' +
    '<p class="lead">Traer una sede no es el resultado. El resultado es que siga aplicando ' +
    'seis meses después. Este frente compara nuestra base contra la que trajo el equipo ' +
    'comercial, y mide si la comunicación que manda marketing mueve la aguja.</p>' +
    '</div>';
  h += alcance('Dos alcances a propósito: la parte 1 y la 4 miran SOLO las sedes de origen ' +
    'marketing (eventos, referidos, página web, social media). La parte 2 mira toda la base, ' +
    'porque la comunicación la manda marketing aunque la sede la haya traído un hunter.');

  // --- 1. Nuestra base contra la del equipo comercial ----------------
  h += '<h2 class="sec">1 · Nuestra base contra la del equipo comercial</h2>' +
    '<p class="sec-sub">Calculado con la actividad real de cada sede (días desde la última ' +
    'aplicación), no con el pipeline donde esté archivada.</p>';
  h += filaKPIs(b.kpis || []);

  var estados = b.filas || [];
  h += '<div class="grid2" style="margin-top:14px">' +
    panel('Qué tan viva está cada base',
      'en % de su propio universo — en absolutos la base comercial tapa la nuestra',
      leyenda([{ nombre: 'Origen marketing', color: 'var(--s1)' },
               { nombre: 'Resto de la base', color: 'var(--s3)' }]), 'gF2Base') +
    panel('Detalle', 'sedes, no porcentajes', tabla([
      { k: 'estado', t: 'Estado', f: 'txt', txt: true },
      { k: 'mkt', t: 'Marketing' },
      { k: 'pctMkt', t: '% mkt', f: 'pct' },
      { k: 'resto', t: 'Resto' },
      { k: 'pctResto', t: '% resto', f: 'pct' }
    ], estados)) +
    '</div>';
  pintar('gF2Base', function (el) {
    chGrupos(el, estados.map(function (x) { return x.estado; }), [
      { nombre: 'Origen marketing', color: 'var(--s1)',
        valores: estados.map(function (x) { return x.pctMkt; }) },
      { nombre: 'Resto de la base', color: 'var(--s3)',
        valores: estados.map(function (x) { return x.pctResto; }) }
    ], { formato: fPct, alto: 210 });
  });
  if (b.veredicto) {
    var mal = b.veredicto.indexOf('se apagan') >= 0;
    h += '<div class="lectura' + (mal ? ' alerta' : '') + '">' + esc(b.veredicto) + '</div>';
  }
  h += avisoBox(b.aviso);

  // --- 2. La palanca: ¿sirve lo que mandamos? -----------------------
  h += '<h2 class="sec">2 · La palanca de marketing: ¿sirve lo que mandamos?</h2>' +
    '<p class="sec-sub">Sedes que recibieron al menos una pieza contra las que no ' +
    'recibieron nada, medidas por el mismo resultado: aplicar este mes.</p>';
  h += filaKPIs(p.kpis || []);

  var pf = p.filas || [];
  h += '<div class="grid2" style="margin-top:14px">' +
    panel('Alcanzadas contra el grupo de control',
      '% de cada grupo que aplicó este mes', '', 'gF2Palanca') +
    panel('Detalle', '', tabla([
      { k: 'grupo', t: 'Grupo', f: 'txt', txt: true },
      { k: 'sedes', t: 'Sedes' },
      { k: 'activas', t: 'Activas este mes' },
      { k: 'pct', t: '% activas', f: 'pct' }
    ], pf)) +
    '</div>';
  pintar('gF2Palanca', function (el) {
    chBarrasH(el, pf.map(function (x) {
      return { etiqueta: x.grupo, y: x.pct, d: x };
    }), { color: 'var(--s4)', formato: fPct, anchoEtiqueta: 150,
      detalle: function (d) {
        return [{ nombre: 'Sedes en el grupo', valor: fNum(d.d.sedes) },
                { nombre: 'Aplicaron este mes', valor: fNum(d.d.activas) }];
      } });
  });
  h += avisoBox(p.aviso);

  // Las audiencias son la segmentacion propia de marketing: cual funciona.
  var aud = (f.audiencia || []).filter(function (x) {
    return x.audiencia !== 'Sin audiencia' && x.audiencia !== 'SIN_CAMPANA';
  }).slice().sort(function (x, y) { return y.pctActivas - x.pctActivas; });
  h += '<h2 class="sec">3 · Qué audiencia responde</h2>' +
    '<p class="sec-sub">La segmentación long tail es nuestra. Ordenada por el % de la ' +
    'audiencia que aplicó este mes: arriba está a la que vale la pena volver a escribirle.</p>' +
    '<div class="grid2">' +
    panel('Respuesta por audiencia', '% de la audiencia que aplicó este mes', '', 'gF2Aud') +
    panel('Detalle por audiencia', '', tabla([
      { k: 'audiencia', t: 'Audiencia', f: 'txt' },
      { k: 'sedes', t: 'Sedes' },
      { k: 'conPieza', t: 'Con pieza' },
      { k: 'activasMes', t: 'Activas' },
      { k: 'pctActivas', t: '% activas', f: 'pct' }
    ], aud)) +
    '</div>';
  pintar('gF2Aud', function (el) {
    chBarrasH(el, aud.map(function (x) {
      return { etiqueta: x.audiencia, y: x.pctActivas, d: x };
    }), { color: 'var(--s4)', formato: fPct, anchoEtiqueta: 130,
      detalle: function (d) {
        return [{ nombre: 'Sedes', valor: fNum(d.d.sedes) },
                { nombre: 'Con pieza enviada', valor: fNum(d.d.conPieza) },
                { nombre: 'Activas este mes', valor: fNum(d.d.activasMes) },
                { nombre: 'Desembolsos hist.', valor: fNum(d.d.desembolsos) }];
      } });
  });
  h += avisoBox(f.audienciaAviso);

  // --- 4. Qué se movió en NUESTRAS sedes en el período ---------------
  h += '<h2 class="sec">4 · Qué se movió en nuestras sedes en el período</h2>' +
    '<p class="sec-sub">Transiciones fechadas contadas solo en sedes de origen marketing: ' +
    'responden al filtro y se comparan contra el período anterior.</p>';
  h += filaKPIs(f.kpis || []);
  h += '<div style="margin-top:12px">' + filaKPIs(f.kpisSecundarios || []) + '</div>';

  if ((f.reactivadasMkt || []).length) {
    h += panel('Sedes de marketing reactivadas en el período',
      'la lista con la que se trabaja, no un agregado', tabla([
        { k: 'fecha', t: 'Fecha', f: 'txt' },
        { k: 'sede', t: 'Sede', f: 'txt', txt: true },
        { k: 'origen', t: 'Origen', f: 'txt' },
        { k: 'clas', t: 'Clase', f: 'txt' },
        { k: 'pipeline', t: 'Pipeline', f: 'txt' },
        { k: 'farmer', t: 'Farmer', f: 'txt' }
      ], f.reactivadasMkt, { vacio: 'Ninguna sede de marketing se reactivó en el período' }));
  }

  // --- 5. ¿Escalan de categoría? ------------------------------------
  var cl = f.clases || [];
  h += '<h2 class="sec">5 · ¿Nuestras sedes escalan de categoría?</h2>' +
    '<p class="sec-sub">La clasificación de aliado es la que decide si la sede recibe ' +
    'gestión dedicada. Si marketing trae sedes que suben a AA y AAA, trae activos; ' +
    'si se quedan en la cola, trae volumen.</p>' +
    '<div class="grid2">' +
    panel('Distribución por clasificación',
      'en % de cada universo',
      leyenda([{ nombre: 'Origen marketing', color: 'var(--s1)' },
               { nombre: 'Resto de la base', color: 'var(--s3)' }]), 'gF2Clases') +
    panel('Key accounts que salieron de marketing',
      fNum(kr.mkt) + ' de ' + fNum((kr.mkt || 0) + (kr.resto || 0)) + ' key accounts de la base',
      '<div class="flujo">' +
      '<div class="paso"><div class="n">' + fPct(kr.pctDeTodas) + '</div>' +
      '<div class="l">de las key accounts del negocio las trajo marketing</div></div>' +
      '<div class="paso"><div class="n">' + fPct(kr.pctDeMkt) + '</div>' +
      '<div class="l">de nuestra base es key account</div></div>' +
      '<div class="paso"><div class="n">' + fPct(kr.pctDeResto) + '</div>' +
      '<div class="l">de la base comercial es key account</div></div>' +
      '</div>') +
    '</div>';
  pintar('gF2Clases', function (el) {
    chGrupos(el, cl.map(function (x) { return x.clase; }), [
      { nombre: 'Origen marketing', color: 'var(--s1)',
        valores: cl.map(function (x) { return x.pctMkt; }) },
      { nombre: 'Resto de la base', color: 'var(--s3)',
        valores: cl.map(function (x) { return x.pctResto; }) }
    ], { formato: fPct, alto: 210 });
  });

  h += panel('Nuestras key accounts, por plata firmada',
    'sedes AA y AAA de origen marketing', tabla([
      { k: 'sede', t: 'Sede', f: 'txt', txt: true },
      { k: 'clase', t: 'Clase', f: 'txt', pill: true },
      { k: 'origen', t: 'Origen', f: 'txt' },
      { k: 'ciudad', t: 'Ciudad', f: 'txt' },
      { k: 'apps', t: 'Apps' },
      { k: 'desembolsos', t: 'Desemb.' },
      { k: 'monto', t: 'Monto', f: 'cop' },
      { k: 'sinFirmar', t: 'Sin firmar' },
      { k: 'farmer', t: 'Farmer', f: 'txt' }
    ], f.keyMkt || [], { vacio: 'Ninguna sede de origen marketing está clasificada AA o AAA' }));

  h += cuali(f.textos);
  return h;
}
