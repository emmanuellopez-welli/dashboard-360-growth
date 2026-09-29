// ------------------------------------------------------------- RESUMEN
// Un frente = una pregunta, tres secciones como máximo. Todo lo que no
// ayude a decidir en comité se queda en el Sheet, no en pantalla.

function vistaResumen() {
  var r = D.resumen;
  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Resumen ejecutivo</div>' +
    '<h1>¿Qué logró Growth en este período?</h1>' +
    '<p class="lead">Seis números: cuatro son gestión directa del equipo sobre la base de ' +
    'clínicas, uno es el alcance de la comunicación, y el último es la oportunidad que ' +
    'todavía está sobre la mesa.</p>' +
    '</div>';

  h += filaKPIs(r.kpis);

  h += '<h2 class="sec">¿Qué no podemos medir todavía?</h2>' +
    '<p class="sec-sub">Se lista explícito para que nadie lea un cero como un resultado. ' +
    'Nada de esto se rellenó con estimaciones.</p>' +
    '<div class="pend-lista">' +
    r.pendientes.map(function (p) {
      return '<div class="pend"><div class="top">' +
        '<span class="fr">' + esc(p.frente) + '</span>' +
        '<span class="qu">' + esc(p.que) + '</span></div>' +
        '<div class="de">' + esc(p.detalle) + '</div></div>';
    }).join('') + '</div>';

  return h;
}

// ------------------------------------------------------------------ F1
function vistaF1() {
  var f = D.f1, g = D.meta.agrupacion;
  var em = f.embudo || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 1</div>' +
    '<h1>¿Estamos generando suficiente demanda, y a qué costo?</h1>' +
    '<p class="lead">La cadena completa: metemos plata en pauta, entran clínicas al ' +
    'pipeline, y esas clínicas generan solicitudes de crédito que terminan en desembolsos. ' +
    'Tres eslabones, en ese orden.</p>' +
    '</div>';

  // --- 1. La pauta ---------------------------------------------------
  h += '<h2 class="sec">1 · La pauta: ¿cuánto nos cuesta un lead?</h2>' +
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

  var sinF = (f.canalesSinFuente || []).filter(function (c) {
    return c.detalle !== 'conectada' && c.canal.indexOf('Pauta') !== 0;
  });
  if (sinF.length) {
    h += avisoBox('De los cinco canales de generación de demanda, ' +
      sinF.map(function (c) { return c.canal.split('—')[0].trim(); }).join(' y ') +
      ' no tienen fuente conectada: SEO necesita la propiedad de Search Console y para ' +
      'AEO todavía hay que definir qué se mide. Eventos y referidos sí se ven abajo.');
  }

  // --- 2. Las clínicas que entraron ---------------------------------
  var cos = f.cosechas || [];
  h += '<h2 class="sec">2 · Las clínicas que entraron y de qué calidad</h2>' +
    '<p class="sec-sub">Una cosecha es el grupo de sedes que entró al pipeline ese mes. ' +
    'Lo que importa no es cuántas, sino cuántas son AA y AAA.</p>' +
    '<div class="grid2">' +
    panel('Sedes por cosecha y calidad', 'total del mes contra cuántas son AA y AAA',
      (cos.length ? leyenda([
        { nombre: 'Total sedes', color: 'var(--s1)' },
        { nombre: 'AA', color: 'var(--s2)' },
        { nombre: 'AAA', color: 'var(--s3)' }]) : ''), 'gF1Cos') +
    panel('Conversión por origen', 'desembolsos sobre aplicaciones, por canal de captación',
      '', 'gF1Conv') +
    '</div>';
  pintar('gF1Cos', function (el) {
    chGrupos(el, cos.map(function (c) { return c.cosecha; }), [
      { nombre: 'Total sedes', color: 'var(--s1)', valores: cos.map(function (c) { return c.total; }) },
      { nombre: 'AA', color: 'var(--s2)', valores: cos.map(function (c) { return c.aa; }) },
      { nombre: 'AAA', color: 'var(--s3)', valores: cos.map(function (c) { return c.aaa; }) }
    ], { gran: 'mes', formato: fNum, vacio: 'Ninguna cosecha cae en el rango elegido' });
  });
  pintar('gF1Conv', function (el) {
    var co = (f.convOrigen || []).filter(function (o) { return o.origen !== 'Sin origen'; })
      .sort(function (a, b) { return b.tasaConv - a.tasaConv; });
    chBarrasH(el, co.map(function (o) {
      return { etiqueta: o.origen === 'Pagina web' ? 'Página web' : o.origen, y: o.tasaConv, d: o };
    }), { color: 'var(--s4)', formato: fPct, anchoEtiqueta: 120,
      detalle: function (d) {
        return [{ nombre: 'Sedes', valor: fNum(d.d.sedes) },
                { nombre: 'Apps', valor: fNum(d.d.apps) },
                { nombre: 'Desembolsos', valor: fNum(d.d.desembolsos) },
                { nombre: 'Monto', valor: fCopC(d.d.monto) }];
      } });
  });
  h += avisoBox(f.coberturaOrigen.aviso);

  h += panel('Cosechas por origen y calidad',
    'apps y monto son el acumulado histórico de esas sedes, no lo del mes de la cosecha',
    tabla([
      { k: 'cosecha', t: 'Cosecha', f: 'txt' },
      { k: 'total', t: 'Total sedes' },
      { k: 'aa', t: 'AA' },
      { k: 'aaa', t: 'AAA' },
      { k: 'eventos', t: 'Eventos' },
      { k: 'referidos', t: 'Referidos' },
      { k: 'web', t: 'Página web' },
      { k: 'social', t: 'Social media' },
      { k: 'monto', t: 'Monto acum.', f: 'cop' }
    ], cos, { vacio: 'Ninguna cosecha cae en el rango elegido' }));

  // --- 3. La demanda de crédito -------------------------------------
  if ((em.kpis || []).length) {
    h += '<h2 class="sec">3 · ¿En qué termina esa demanda?</h2>' +
      '<p class="sec-sub">El embudo de crédito de pacientes: de la solicitud al desembolso.</p>';
    h += filaKPIs([em.kpis[0], em.kpis[2], em.kpis[3]]);

    if (em.hay) {
      h += '<div class="grid2" style="margin-top:14px">' +
        panel('Embudo del período', 'solicitudes, aprobados y desembolsados', '', 'gF1Emb') +
        panel('Monto desembolsado', 'COP por ' + g + ', según la fecha de firma del OTP',
          '', 'gF1Rev') +
        '</div>';
      pintar('gF1Emb', function (el) {
        chBarrasH(el, (em.pasos || []).map(function (p) {
          return { etiqueta: p.etapa, y: p.valor, d: p };
        }), { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 110,
          detalle: function (d) {
            return [{ nombre: 'Créditos', valor: fNum(d.d.valor) },
                    { nombre: '% de solicitudes', valor: fPct(d.d.pct) }];
          } });
      });
      pintar('gF1Rev', function (el) {
        chBarras(el, em.serieRevenue || [], { color: 'var(--s4)', nombre: 'Desembolsado',
          gran: g, formato: fCop, formatoEje: fCopC });
      });
    }
  }

  h += cuali(f.textos);
  return h;
}

// ------------------------------------------------------------------ F2
function vistaF2() {
  var f = D.f2;
  var sa = f.salud || {};
  var a = f.aaaResumen || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 2 · incluye el Mundo AAA</div>' +
    '<h1>¿Cuántas clínicas están vivas, y qué hicimos para mantenerlas?</h1>' +
    '<p class="lead">Una clínica muerta es la que lleva más de 90 días sin una aplicación. ' +
    'El long tail se mueve con comunicaciones masivas; las key accounts, con estrategia ' +
    'personalizada. Son dos juegos distintos.</p>' +
    '</div>';

  // --- 1. Salud de la base ------------------------------------------
  h += '<h2 class="sec">1 · La foto de la base hoy</h2>' +
    '<p class="sec-sub">Calculada con la actividad real de cada sede, no con el pipeline ' +
    'donde esté archivada.</p>';
  h += filaKPIs(sa.kpis || []);

  h += '<div class="grid2" style="margin-top:14px">' +
    panel('Long tail contra key accounts',
      'key accounts son las AA y AAA',
      leyenda([{ nombre: 'Long tail', color: 'var(--s1)' },
               { nombre: 'Key accounts', color: 'var(--s2)' }]), 'gF2Salud') +
    panel('Detalle', '', tabla([
      { k: 'estado', t: 'Estado', f: 'txt', txt: true },
      { k: 'lt', t: 'Long tail' },
      { k: 'key', t: 'Key accounts' },
      { k: 'total', t: 'Total' }
    ], sa.filas || [])) +
    '</div>';
  pintar('gF2Salud', function (el) {
    var cats = (sa.filas || []).map(function (x) { return x.estado; });
    chGrupos(el, cats, [
      { nombre: 'Long tail', color: 'var(--s1)',
        valores: (sa.filas || []).map(function (x) { return x.lt; }) },
      { nombre: 'Key accounts', color: 'var(--s2)',
        valores: (sa.filas || []).map(function (x) { return x.key; }) }
    ], { formato: fNum, alto: 210 });
  });
  if (sa.desfase) h += avisoBox(sa.desfase.aviso);

  // --- 2. Qué movió Growth ------------------------------------------
  h += '<h2 class="sec">2 · Qué movió Growth en el período</h2>' +
    '<p class="sec-sub">Transiciones fechadas: responden al filtro y se comparan contra ' +
    'el período anterior.</p>';
  h += filaKPIs([f.kpis[3], f.kpisSecundarios[1], f.kpisSecundarios[2], f.kpis[0]]);

  // --- 3. ¿Sirve la comunicación? -----------------------------------
  var aud = (f.audiencia || []).filter(function (x) {
    return x.audiencia !== 'Sin audiencia' && x.audiencia !== 'SIN_CAMPANA';
  });
  h += '<h2 class="sec">3 · ¿La comunicación mueve la aguja?</h2>' +
    '<p class="sec-sub">Sedes agrupadas por la audiencia de marketing a la que pertenecen, ' +
    'contra el resultado que dieron.</p>' +
    '<div class="grid2">' +
    panel('Sedes activas por audiencia', '% de la audiencia que hizo al menos una app este mes',
      '', 'gF2Aud') +
    panel('Detalle por audiencia', '', tabla([
      { k: 'audiencia', t: 'Audiencia', f: 'txt' },
      { k: 'sedes', t: 'Sedes' },
      { k: 'conPieza', t: 'Con pieza' },
      { k: 'activasMes', t: 'Activas' },
      { k: 'pctActivas', t: '% activas', f: 'pct' }
    ], aud)) +
    '</div>';
  pintar('gF2Aud', function (el) {
    chBarrasH(el, aud.slice().sort(function (x, y) { return y.pctActivas - x.pctActivas; })
      .map(function (x) { return { etiqueta: x.audiencia, y: x.pctActivas, d: x }; }),
      { color: 'var(--s4)', formato: fPct, anchoEtiqueta: 130,
        detalle: function (d) {
          return [{ nombre: 'Sedes', valor: fNum(d.d.sedes) },
                  { nombre: 'Con pieza enviada', valor: fNum(d.d.conPieza) },
                  { nombre: 'Activas este mes', valor: fNum(d.d.activasMes) },
                  { nombre: 'Desembolsos hist.', valor: fNum(d.d.desembolsos) }];
        } });
  });
  h += avisoBox(f.audienciaAviso);

  // --- 4. Mundo AAA --------------------------------------------------
  h += '<h2 class="sec">4 · Mundo AAA: las cuentas que se atienden a mano</h2>' +
    '<p class="sec-sub">Aquí importa la cobertura de gestión, no el volumen.</p>' +
    '<div class="flujo">' +
    '<div class="paso"><div class="n">' + fNum(a.sedes) + '</div><div class="l">sedes AAA</div></div>' +
    '<div class="paso"><div class="n">' + fNum(a.conVisita) + '</div><div class="l">con visita registrada</div></div>' +
    '<div class="paso"><div class="n">' + fCopC(a.monto) + '</div><div class="l">monto acumulado</div></div>' +
    '<div class="paso"><div class="n">' + fNum(a.invRescate) + '</div><div class="l">créditos aprobados sin firmar</div></div>' +
    '</div>';
  h += avisoBox('Solo 23 sedes de 3.601 tienen fecha de visita registrada y 289 tienen la ' +
    'marca de "visita recibida". La cobertura real de visitas no es medible hasta que el ' +
    'equipo comercial registre la fecha.');

  h += panel('Top 10 cuentas AAA por monto desembolsado',
    'de ' + fNum(a.sedes) + ' sedes AAA en total', tabla([
      { k: 'sede', t: 'Sede', f: 'txt', txt: true },
      { k: 'ciudad', t: 'Ciudad', f: 'txt' },
      { k: 'apps', t: 'Apps' },
      { k: 'desembolsos', t: 'Desemb.' },
      { k: 'monto', t: 'Monto', f: 'cop' },
      { k: 'invRescate', t: 'Sin firmar' },
      { k: 'farmer', t: 'Farmer', f: 'txt' }
    ], (f.aaa || []).slice(0, 10)));

  h += cuali(f.textos);
  return h;
}

// ------------------------------------------------------------------ F4
function vistaF4() {
  var f = D.f4, g = D.meta.agrupacion;
  var pl = f.plata || {};
  var hi = f.historico || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 4</div>' +
    '<h1>¿Cuánta plata dejamos sobre la mesa, y cuánta recuperamos?</h1>' +
    '<p class="lead">Un paciente con crédito aprobado que no lo toma es plata sobre la ' +
    'mesa. Rescatarlo es convencerlo de firmar después de que dejó vencer su ventana.</p>' +
    '</div>';

  // --- 1. La plata ---------------------------------------------------
  h += '<h2 class="sec">1 · El tamaño de la oportunidad</h2>' +
    '<p class="sec-sub">Crédito aprobado y nunca desembolsado, vivo hoy.</p>';
  h += filaKPIs([(pl.kpis || [])[0], (pl.kpis || [])[2],
                 (f.kpis || [])[1], (f.kpis || [])[2]].filter(Boolean));

  if (pl.hay) {
    h += '<div class="grid2" style="margin-top:14px">' +
      panel('Por antigüedad de la aprobación',
        'lo fresco se rescata; pasados los 180 días casi no', '', 'gF4Plata') +
      panel('Detalle del inventario', '', tabla([
        { k: 'antiguedad', t: 'Antigüedad', f: 'txt' },
        { k: 'creditos', t: 'Créditos' },
        { k: 'monto', t: 'Monto', f: 'cop' },
        { k: 'sedes', t: 'Sedes' }
      ], pl.filas || [])) +
      '</div>';
    pintar('gF4Plata', function (el) {
      chBarrasH(el, (pl.filas || []).map(function (x) {
        return { etiqueta: x.antiguedad, y: x.monto, d: x };
      }), { color: 'var(--s2)', formato: fCopC, anchoEtiqueta: 125,
        detalle: function (d) {
          return [{ nombre: 'Monto', valor: fCop(d.d.monto) },
                  { nombre: 'Créditos', valor: fNum(d.d.creditos) },
                  { nombre: 'Sedes', valor: fNum(d.d.sedes) }];
        } });
    });
  }

  if (f.pendienteBQ) h += avisoBox(f.notaBQ, true);

  // --- 2. El canal que funcionaba y se apagó ------------------------
  if (hi.campanas) {
    h += '<h2 class="sec">2 · El canal de rescate ya existió, y se apagó</h2>' +
      '<p class="sec-sub">Histórico completo en Hilos, a propósito fuera del filtro de ' +
      'fechas: es la respuesta a si el frente funciona.</p>' +
      '<div class="flujo">' +
      '<div class="paso"><div class="n">' + fNum(hi.campanas) + '</div>' +
        '<div class="l">campañas enviadas en total</div></div>' +
      '<div class="paso"><div class="n">' + fNum(hi.enviados) + '</div>' +
        '<div class="l">piezas de rescate</div></div>' +
      '<div class="paso"><div class="n">' + fPct(hi.respuesta) + '</div>' +
        '<div class="l">tasa de respuesta del canal</div></div>' +
      '<div class="paso"><div class="n">' + fNum(hi.diasApagado) + '</div>' +
        '<div class="l">días desde la última pieza (' + esc(hi.ultima) + ')</div></div>' +
      '</div>';

    if ((hi.ventanas || []).length) {
      h += '<div class="grid2" style="margin-top:14px">' +
        panel('Respuesta por pieza de ventana',
          'la pieza se identifica por el nombre de la campaña', '', 'gF4Vent') +
        panel('Detalle del histórico', '', tabla([
          { k: 'pieza', t: 'Pieza', f: 'txt', txt: true },
          { k: 'campanas', t: 'Campañas' },
          { k: 'enviados', t: 'Enviados' },
          { k: 'tasaResp', t: 'Tasa resp.', f: 'pct' }
        ], hi.ventanas)) +
        '</div>';
      pintar('gF4Vent', function (el) {
        chBarrasH(el, hi.ventanas.slice().sort(function (x, y) {
          return y.tasaResp - x.tasaResp;
        }).map(function (v) { return { etiqueta: v.pieza, y: v.tasaResp, d: v }; }),
          { color: 'var(--s4)', formato: fPct, anchoEtiqueta: 160,
            detalle: function (d) {
              return [{ nombre: 'Campañas', valor: fNum(d.d.campanas) },
                      { nombre: 'Enviados', valor: fNum(d.d.enviados) },
                      { nombre: 'Respuestas', valor: fNum(d.d.respuestas) }];
            } });
      });
      h += avisoBox('Los recordatorios de ventana son las piezas con mejor respuesta de ' +
        'toda la operación de WhatsApp, muy por encima del 6,7% de cobranza que mueve 45 ' +
        'veces más volumen. Llevan ' + fNum(hi.diasApagado) + ' días sin enviarse mientras ' +
        'la plata sobre la mesa sigue creciendo.');
    }
  }

  // --- 3. Dónde está la plata ---------------------------------------
  if ((f.plataSedes || []).length) {
    h += '<h2 class="sec">3 · Dónde está esa plata</h2>' +
      '<p class="sec-sub">La cola de trabajo: las sedes con más crédito aprobado sin firmar.</p>' +
      panel('Top 10 sedes con más plata sobre la mesa', '', tabla([
        { k: 'sede', t: 'Sede', f: 'txt', txt: true },
        { k: 'creditos', t: 'Créditos' },
        { k: 'monto', t: 'Monto', f: 'cop' },
        { k: 'creditos30d', t: 'Frescos (30 d)' },
        { k: 'monto30d', t: 'Monto fresco', f: 'cop' }
      ], f.plataSedes.slice(0, 10)));
  }

  h += cuali(f.textos);
  return h;
}

// ------------------------------------------------------------------ F5
function vistaF5() {
  var f = D.f5;
  var c = f.comparativo || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 5</div>' +
    '<h1>¿El programa de fidelización está funcionando?</h1>' +
    '<p class="lead">Las sedes ganan Welli Points por cada aplicación, cada desembolso y ' +
    'por retos del mes, y los redimen por tarjetas débito. La pregunta es si las que ' +
    'entran se quedan activas.</p>' +
    '</div>';

  if (f.pendienteBQ) h += avisoBox(f.notaBQ, true);

  // --- 1. Adopción ---------------------------------------------------
  h += '<h2 class="sec">1 · ¿Cuántas entraron?</h2>' +
    '<p class="sec-sub">De las sedes habilitadas, cuántas usaron el programa al menos una vez.</p>';
  h += filaKPIs(f.kpis || []);

  // --- 2. ¿Producen más? ---------------------------------------------
  var leyWP = leyenda([{ nombre: 'Activas con WP', color: 'var(--s4)' },
                       { nombre: 'Sin entrar', color: 'var(--s1)' }]);
  h += '<h2 class="sec">2 · ¿Producen más las que entraron?</h2>' +
    '<p class="sec-sub">Promedio por sede. Apps y desembolsos van aparte porque están en ' +
    'órdenes de magnitud distintos.</p>' +
    '<div class="grid2">' +
    panel('Aplicaciones promedio por sede', 'acumulado histórico', leyWP, 'gF5Apps') +
    panel('Desembolsos promedio por sede', 'acumulado histórico', leyWP, 'gF5Des') +
    '</div>';
  pintar('gF5Apps', function (el) {
    chGrupos(el, ['Apps promedio'], [
      { nombre: 'Activas con WP', color: 'var(--s4)', valores: [c.appsConWP] },
      { nombre: 'Sin entrar', color: 'var(--s1)', valores: [c.appsSinWP] }
    ], { formato: fNum, alto: 190 });
  });
  pintar('gF5Des', function (el) {
    chGrupos(el, ['Desembolsos promedio'], [
      { nombre: 'Activas con WP', color: 'var(--s4)', valores: [c.desembConWP] },
      { nombre: 'Sin entrar', color: 'var(--s1)', valores: [c.desembSinWP] }
    ], { formato: fNum, alto: 190 });
  });
  h += avisoBox(c.aviso);

  // --- 3. Puntos en circulación -------------------------------------
  h += '<h2 class="sec">3 · Puntos en circulación</h2>' +
    '<p class="sec-sub">Lo que se entregó y lo que está pendiente de redimir.</p>';
  h += filaKPIs(f.kpisSecundarios || []);

  return h;
}

// ------------------------------------------------------------------ F6
function vistaF6() {
  var f = D.f6;
  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 6</div>' +
    '<h1>¿Se están adoptando los productos nuevos?</h1>' +
    '<p class="lead">Marketing acompaña cada lanzamiento con comunicación y piezas ' +
    'tácticas. Lo que se mide es la adopción del producto, no cuántas piezas se hicieron.</p>' +
    '</div>';

  h += avisoBox(f.aviso, true);

  var nov = (f.novedades || []).filter(function (n) { return n.producto; });
  if (!nov.length) {
    h += '<div class="vacio-graf">La hoja NOVEDADES del Sheet está vacía. Agrega una fila ' +
      'por producto y recarga.</div>';
    return h;
  }

  h += '<div class="grid2">' + nov.map(function (n) {
    var cuerpo = '<p style="margin:0 0 10px;font-size:13px;color:var(--texto-2)">' +
      esc(n.descripcion || '') + '</p>';
    cuerpo += '<div class="flujo">';
    (n.metricas || []).forEach(function (m) {
      var v = (m.valor === '' || m.valor === null || m.valor === undefined)
        ? '--' : esc(fNum(m.valor));
      cuerpo += '<div class="paso"><div class="n">' + v +
        '</div><div class="l">' + esc(m.nombre) + '</div></div>';
    });
    cuerpo += '<div class="paso"><div class="n">' +
      (n.inversion ? esc(fCopC(n.inversion)) : '--') +
      '</div><div class="l">inversión</div></div>';
    cuerpo += '</div>';
    if (n.acciones) {
      cuerpo += '<p style="margin:10px 0 0;font-size:12px;color:var(--texto-3)">' +
        '<b>Acciones:</b> ' + esc(n.acciones) + '</p>';
    }
    return panel(n.producto + (n.estado ? '  ·  ' + n.estado : ''), '', cuerpo);
  }).join('') + '</div>';

  return h;
}
