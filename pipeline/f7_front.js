/* Impactos encendidos. Arrancan todos en on; el usuario apaga los que no
   quiere ver para aislar una comunicacion. Vive fuera de la vista para que
   sobreviva a un repintado. */
var IMP_OFF = {};
function toggleImpacto(id) {
  if (IMP_OFF[id]) delete IMP_OFF[id]; else IMP_OFF[id] = true;
  render();
}
function impactosTodos(on) {
  IMP_OFF = {};
  if (!on) (D.f7.impactos || []).forEach(function (i) { IMP_OFF[i.id] = true; });
  render();
}

/* Barras de solicitudes por dia con lineas verticales en los dias de impacto.
   No es un eje doble: los impactos no tienen escala propia, son marcas de
   evento sobre el eje de tiempo. Es la unica forma honesta de superponer un
   evento a una serie. */
function chSerieImpactos(cont, serie, impactos, opt) {
  opt = opt || {};
  var H = opt.alto || 260;
  var pl = 52, pr = 10, pt = 22, pb = 34;
  var an = W - pl - pr, al = H - pt - pb;
  if (!serie || !serie.length) {
    cont.innerHTML = '<div class="vacio-graf">' + esc(opt.vacio || 'Sin datos') + '</div>';
    return;
  }
  var top = ejeMax(Math.max.apply(null, serie.map(function (p) { return p.y; }))) || 1;
  var bw = an / serie.length;
  var x = function (i) { return pl + i * bw; };
  var y = function (v) { return pt + al - (v / top) * al; };

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    esc(opt.aria || 'solicitudes por día con impactos marcados') + '">';
  // grilla recesiva, cuatro pasos como el resto del tablero
  for (var g = 0; g <= 3; g++) {
    var vy = top * g / 3;
    s += '<line x1="' + pl + '" y1="' + y(vy).toFixed(1) + '" x2="' + (W - pr) +
      '" y2="' + y(vy).toFixed(1) + '" stroke="var(--borde)" stroke-width="1"/>';
    s += '<text x="' + (pl - 8) + '" y="' + (y(vy) + 4).toFixed(1) +
      '" text-anchor="end" font-size="9.5" fill="var(--texto-3)">' +
      esc(fNum(Math.round(vy))) + '</text>';
  }

  // Las marcas van DEBAJO de las barras para no taparlas.
  var idx = {};
  serie.forEach(function (p, i) { idx[p.x] = i; });
  var vivos = (impactos || []).filter(function (im) { return !IMP_OFF[im.id]; });
  var porDia = {};
  vivos.forEach(function (im) {
    if (idx[im.fecha] === undefined) return;
    if (!porDia[im.fecha]) porDia[im.fecha] = [];
    porDia[im.fecha].push(im);
  });
  Object.keys(porDia).forEach(function (fch) {
    var i = idx[fch];
    var cx = x(i) + bw / 2;
    var col = porDia[fch][0].canal === 'WhatsApp' ? 'var(--s3)' : 'var(--s2)';
    s += '<line x1="' + cx.toFixed(1) + '" y1="' + pt + '" x2="' + cx.toFixed(1) +
      '" y2="' + (pt + al) + '" stroke="' + col +
      '" stroke-width="2" stroke-dasharray="4 3" opacity=".85"/>';
    s += '<circle cx="' + cx.toFixed(1) + '" cy="' + (pt - 8) + '" r="5" fill="' +
      col + '"/>';
    s += '<text x="' + cx.toFixed(1) + '" y="' + (pt - 5) +
      '" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">' +
      porDia[fch].length + '</text>';
  });

  // barras
  serie.forEach(function (p, i) {
    var bwd = Math.max(2, bw * 0.64);
    var bx = x(i) + (bw - bwd) / 2;
    if (p.y) {
      var yy = y(p.y), hh = pt + al - yy;
      var r = Math.min(3, bwd / 2, hh);
      s += '<path d="M' + bx + ' ' + (pt + al) + ' L' + bx + ' ' + (yy + r) +
        ' Q' + bx + ' ' + yy + ' ' + (bx + r) + ' ' + yy +
        ' L' + (bx + bwd - r) + ' ' + yy +
        ' Q' + (bx + bwd) + ' ' + yy + ' ' + (bx + bwd) + ' ' + (yy + r) +
        ' L' + (bx + bwd) + ' ' + (pt + al) + ' Z" fill="var(--s1)"/>';
    }
    // zona de hover mas grande que la barra, para dias en cero tambien
    s += '<rect class="hit" data-i="' + i + '" x="' + x(i) + '" y="' + pt +
      '" width="' + bw + '" height="' + al + '" fill="transparent"/>';
  });

  // eje x
  var cada = Math.max(1, Math.ceil(serie.length / 12));
  serie.forEach(function (p, i) {
    if (i % cada) return;
    s += '<text x="' + (x(i) + bw / 2).toFixed(1) + '" y="' + (H - 12) +
      '" text-anchor="middle" font-size="10" fill="var(--texto-3)">' +
      esc(etiquetaX(p.x, 'dia')) + '</text>';
  });
  s += '</svg>';
  cont.innerHTML = s;

  var tt = montarTooltip(cont);
  var svg = cont.querySelector('svg');
  svg.querySelectorAll('.hit').forEach(function (hh) {
    hh.addEventListener('mouseenter', function () {
      var p = serie[Number(hh.getAttribute('data-i'))];
      var det = [{ nombre: 'Solicitudes', valor: fNum(p.sol) },
                 { nombre: 'Desembolsos', valor: fNum(p.des) },
                 { nombre: 'Sedes que aplicaron', valor: fNum(p.sedes) }];
      (porDia[p.x] || []).forEach(function (im) {
        det.push({ nombre: 'Impacto · ' + im.canal,
                   valor: im.pieza + ' a ' + fNum(im.sedes) + ' sedes' });
      });
      var r = hh.getBoundingClientRect();
      var cr = svg.getBoundingClientRect();
      tt.mostrar(r.left - cr.left + r.width / 2, r.top - cr.top,
        tooltipHTML(etiquetaX(p.x, 'dia'), det));
    });
    hh.addEventListener('mouseleave', function () { tt.ocultar(); });
  });
}

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
  var chips = '';
  if (imp.length) {
    chips = '<div class="imp-chips">' +
      '<button class="imp-todo" onclick="impactosTodos(true)">todos</button>' +
      '<button class="imp-todo" onclick="impactosTodos(false)">ninguno</button>';
    imp.forEach(function (im) {
      var on = !IMP_OFF[im.id];
      chips += '<button class="imp-chip' + (on ? ' on' : '') +
        '" onclick="toggleImpacto(\'' + im.id + '\')" ' +
        'title="' + esc(im.nombre + ' · ' + im.pieza + ' · ' + fNum(im.sedes) +
          ' sedes' + (im.delta !== null
            ? ' · 3 días antes ' + fNum(im.antes3) + '/día, 3 días después ' +
              fNum(im.despues3) + '/día'
            : '')) + '">' +
        '<i class="' + (im.canal === 'WhatsApp' ? 'wa' : 'mail') + '"></i>' +
        esc(etiquetaX(im.fecha, 'dia')) + ' · ' + esc(im.pieza) +
        ' <small>' + fNum(im.sedes) + '</small></button>';
    });
    chips += '</div>';
  }

  h += '<div style="margin-top:14px">' +
    panel('Solicitudes por día y los impactos que mandamos',
      imp.length
        ? 'las líneas punteadas son envíos · apaga los que no quieras ver'
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
