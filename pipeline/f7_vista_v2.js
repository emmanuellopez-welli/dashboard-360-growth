/* Frente 7 · Long tail. La cadencia de los workflows contra las solicitudes
   que produce la poblacion que tocan. */
function vistaF7() {
  var f = D.f7;

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 7 · long tail</div>' +
    '<h1>Cuando tocamos la cola larga, ¿aplican más?</h1>' +
    '<p class="lead">Los workflows impactan por cadencia: una pieza, un delay, ' +
    'otra pieza. Acá se ve si eso mueve las solicitudes o solo gasta toques.</p>' +
    '</div>';
  h += cintaOrigen();

  if (!f.hay) {
    h += '<div class="vacio-graf">No hay sedes de la cola larga en este universo. ' +
      'Prueba con otro origen.</div>';
    return h;
  }
  h += filaKPIs(f.kpis);

  // --- la grafica con los impactos ---
  var imp = f.impactos || [];
  // El id permite repintar solo los chips al apagar un impacto, sin rehacer
  // la vista entera: con render() completo la pagina saltaba al inicio.
  var chips = imp.length
    ? '<div class="imp-chips" id="f7Chips">' + chipsImpactos(f) + '</div>' : '';

  h += '<div style="margin-top:14px">' +
    panel('Solicitudes por día y los impactos que mandamos',
      imp.length
        ? 'cada color es un workflow · línea continua WhatsApp, punteada email · ' +
          'apaga los que no quieras ver'
        : 'sin impactos registrados en este período',
      chips, 'gF7Serie') +
    '</div>';
  pintar('gF7Serie', function (el) {
    chSerieImpactos(el, f.serie || [], imp,
      { vacio: 'Sin solicitudes de la cola larga en el período' });
  });

  // --- esfuerzo contra resultado ---
  h += '<h2 class="sec">La cadencia de cada workflow</h2>' +
    '<p class="sec-sub">lo que está declarado en HubSpot, al lado de lo que ' +
    'produjo la audiencia en el período</p>';
  h += tabla([
    { t: 'Workflow', k: 'nombre', f: 'txt', txt: true },
    { t: 'Sedes', k: 'sedes' },
    { t: 'Impactos', k: 'impactos' },
    { t: 'Dura', k: 'dur', f: 'txt' },
    { t: 'Solicitudes', k: 'solicitudes' },
    { t: 'Sol/sede', k: 'solPorSede', f: 'txt' },
    { t: 'Estado', k: 'estado', f: 'txt' }
  ], (f.workflows || []).map(function (w) {
    return { nombre: w.nombre, sedes: w.sedes, impactos: w.impactos,
             dur: w.duracion ? w.duracion + ' días' : '--',
             solicitudes: w.solicitudes,
             solPorSede: fNum(w.solPorSede),
             estado: w.vacio ? 'vacío' : (w.activo ? 'activo' : 'apagado') };
  }));

  (f.workflows || []).forEach(function (w) {
    if (!w.pasos.length) return;
    h += '<div style="margin-top:12px">' +
      panel(w.nombre, fNum(w.sedes) + ' sedes · ' + w.impactos + ' impactos en ' +
        w.duracion + ' días',
        '<div class="cadencia">' + w.pasos.map(function (p) {
          return '<span class="cad-paso"><b>día ' + p.dia + '</b>' +
            '<i class="' + (p.canal === 'WhatsApp' ? 'wa' : 'mail') + '"></i>' +
            esc(p.pieza || p.canal) + '</span>';
        }).join('<span class="cad-flecha">→</span>') + '</div>') +
      '</div>';
  });

  if ((f.sinTocar || []).length) {
    h += '<h2 class="sec">Audiencias que nadie está tocando</h2>' +
      '<p class="sec-sub">tienen sedes y pieza asignada, pero su workflow está ' +
      'apagado o vacío</p>';
    h += tabla([
      { t: 'Audiencia', k: 'nombre', f: 'txt', txt: true },
      { t: 'Sedes', k: 'sedes' },
      { t: 'Solicitudes del período', k: 'solicitudes' }
    ], f.sinTocar);
  }

  h += cuali(f.textos);
  return h;
}
