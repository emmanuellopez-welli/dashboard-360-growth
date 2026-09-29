/* Impactos apagados. Arrancan todos encendidos; se apagan para aislar una
   comunicacion. Vive fuera de la vista para sobrevivir a un repintado. */
var IMP_OFF = {};

/* Repinta SOLO la grafica y los chips, no la vista entera.
   Con render() completo el navegador rehace el DOM desde arriba y la pagina
   salta al inicio: hacer clic en un chip te sacaba de donde estabas. */
function refrescarImpactos() {
  var f = D.f7;
  if (!f) return;
  var cont = document.getElementById('gF7Serie');
  if (cont) chSerieImpactos(cont, f.serie || [], f.impactos || [],
    { vacio: 'Sin solicitudes de la cola larga en el período' });
  var chips = document.getElementById('f7Chips');
  if (chips) chips.innerHTML = chipsImpactos(f);
}
function toggleImpacto(id) {
  if (IMP_OFF[id]) delete IMP_OFF[id]; else IMP_OFF[id] = true;
  refrescarImpactos();
}
function impactosTodos(on) {
  IMP_OFF = {};
  if (!on) (D.f7.impactos || []).forEach(function (i) { IMP_OFF[i.id] = true; });
  refrescarImpactos();
}
function impactosSoloWf(aud) {
  IMP_OFF = {};
  (D.f7.impactos || []).forEach(function (i) {
    if (i.audiencia !== aud) IMP_OFF[i.id] = true;
  });
  refrescarImpactos();
}

/* El color dice el WORKFLOW, no el canal: es la pregunta del frente. El canal
   pasa a codificacion secundaria — linea continua WhatsApp, punteada email —
   que ademas es lo que hace legal el par verde/rosa en vision deutan. */
var F7_COLOR = {
  ESTRENA: 'var(--w1)', PERFILAMIENTO: 'var(--w2)', DESEMBOLSO: 'var(--w3)',
  REACTIVAR: 'var(--w4)', RECONOCIMIENTO: 'var(--w5)'
};
function colorWf(aud) { return F7_COLOR[aud] || 'var(--texto-3)'; }

function chipsImpactos(f) {
  var imp = f.impactos || [];
  if (!imp.length) return '';
  // Los chips se agrupan por workflow para que el color tenga con que
  // contrastar y para poder aislar un workflow de un clic.
  var porAud = {}, orden = [];
  imp.forEach(function (im) {
    if (!porAud[im.audiencia]) { porAud[im.audiencia] = []; orden.push(im.audiencia); }
    porAud[im.audiencia].push(im);
  });
  var h = '<div class="imp-barra">' +
    '<button class="imp-todo" onclick="impactosTodos(true)">todos</button>' +
    '<button class="imp-todo" onclick="impactosTodos(false)">ninguno</button></div>';
  orden.forEach(function (aud) {
    var lista = porAud[aud];
    var enc = lista.filter(function (im) { return !IMP_OFF[im.id]; }).length;
    h += '<div class="imp-grupo">' +
      '<button class="imp-wf" onclick="impactosSoloWf(\'' + aud + '\')" ' +
      'title="ver solo este workflow" style="--c:' + colorWf(aud) + '">' +
      '<i></i>' + esc(lista[0].nombre) +
      ' <small>' + enc + '/' + lista.length + '</small></button>';
    lista.forEach(function (im) {
      var on = !IMP_OFF[im.id];
      h += '<button class="imp-chip' + (on ? ' on' : '') + '" ' +
        'style="--c:' + colorWf(im.audiencia) + '" ' +
        'onclick="toggleImpacto(\'' + im.id + '\')" ' +
        'title="' + esc(im.nombre + ' · ' + im.pieza + ' · ' + im.canal + ' a ' +
          fNum(im.sedes) + ' sedes') + '">' +
        '<i class="' + (im.canal === 'WhatsApp' ? 'wa' : 'mail') + '"></i>' +
        esc(etiquetaX(im.fecha, 'dia')) + ' · ' + esc(im.pieza) +
        ' <small>' + fNum(im.sedes) + '</small></button>';
    });
    h += '</div>';
  });
  return h;
}

/* Barras de solicitudes por dia con lineas verticales en los dias de impacto.
   No es un eje doble: los impactos no tienen escala propia, son marcas de
   evento sobre el eje de tiempo — la unica forma honesta de superponer un
   evento a una serie.

   Cada marca lleva su etiqueta escrita (pieza + sedes) en vez de un numero
   suelto: una marca que no dice que es obliga a pasar el mouse por encima
   para entender la grafica. */
function chSerieImpactos(cont, serie, impactos, opt) {
  opt = opt || {};
  if (!serie || !serie.length) {
    cont.innerHTML = '<div class="vacio-graf">' + esc(opt.vacio || 'Sin datos') + '</div>';
    return;
  }
  var vivos = (impactos || []).filter(function (im) { return !IMP_OFF[im.id]; });
  var idx = {};
  serie.forEach(function (p, i) { idx[p.x] = i; });
  var porDia = {};
  vivos.forEach(function (im) {
    if (idx[im.fecha] === undefined) return;
    (porDia[im.fecha] = porDia[im.fecha] || []).push(im);
  });
  var dias = Object.keys(porDia).sort();
  // El alto de la banda de etiquetas depende de cuantos impactos coincidan en
  // el mismo dia: se apilan, y si no se reserva el espacio se salen del SVG.
  var maxApilado = 0;
  dias.forEach(function (d) {
    if (porDia[d].length > maxApilado) maxApilado = porDia[d].length;
  });
  var banda = maxApilado ? 14 + maxApilado * 15 : 10;
  var H = (opt.alto || 250) + banda;
  var pl = 46, pr = 12, pt = banda, pb = 30;
  var an = W - pl - pr, al = H - pt - pb;
  var top = ejeMax(Math.max.apply(null, serie.map(function (p) { return p.y; }))) || 1;
  var bw = an / serie.length;
  var x = function (i) { return pl + i * bw; };
  var y = function (v) { return pt + al - (v / top) * al; };

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    esc(opt.aria || 'solicitudes por día con los impactos marcados') + '">';
  for (var g = 0; g <= 3; g++) {
    var vy = top * g / 3;
    s += '<line x1="' + pl + '" y1="' + y(vy).toFixed(1) + '" x2="' + (W - pr) +
      '" y2="' + y(vy).toFixed(1) + '" stroke="var(--borde)" stroke-width="1"/>';
    s += '<text x="' + (pl - 7) + '" y="' + (y(vy) + 3.5).toFixed(1) +
      '" text-anchor="end" font-size="9.5" fill="var(--texto-3)">' +
      esc(fNum(Math.round(vy))) + '</text>';
  }

  // Marcas primero: van DEBAJO de las barras para no taparlas.
  dias.forEach(function (fch) {
    var i = idx[fch];
    var cx = x(i) + bw / 2;
    porDia[fch].forEach(function (im, k) {
      var col = colorWf(im.audiencia);
      // WhatsApp continua, email punteada: el canal sin depender del color.
      var dash = im.canal === 'WhatsApp' ? '' : ' stroke-dasharray="3 3"';
      var yTop = banda - 8 - k * 15;
      s += '<line x1="' + cx.toFixed(1) + '" y1="' + yTop + '" x2="' + cx.toFixed(1) +
        '" y2="' + (pt + al) + '" stroke="' + col + '" stroke-width="1.5"' +
        dash + ' opacity=".8"/>';
      // Etiqueta directa. Se ancla al lado con mas espacio para no salirse.
      var alaIzq = cx > W * 0.62;
      var tx = alaIzq ? cx - 7 : cx + 7;
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + yTop + '" r="3.5" fill="' +
        col + '"/>';
      s += '<text x="' + tx.toFixed(1) + '" y="' + (yTop + 3.5) +
        '" text-anchor="' + (alaIzq ? 'end' : 'start') +
        '" font-size="9.5" font-weight="700" fill="' + col + '">' +
        esc(im.pieza) + '<tspan font-weight="400" fill="var(--texto-3)"> ' +
        esc(fNum(im.sedes)) + '</tspan></text>';
    });
  });

  serie.forEach(function (p, i) {
    var bwd = Math.max(2, bw * 0.62);
    var bx = x(i) + (bw - bwd) / 2;
    if (p.y) {
      var yy = y(p.y), hh = pt + al - yy;
      var r = Math.min(3, bwd / 2, hh);
      s += '<path d="M' + bx + ' ' + (pt + al) + ' L' + bx + ' ' + (yy + r) +
        ' Q' + bx + ' ' + yy + ' ' + (bx + r) + ' ' + yy +
        ' L' + (bx + bwd - r) + ' ' + yy +
        ' Q' + (bx + bwd) + ' ' + yy + ' ' + (bx + bwd) + ' ' + (yy + r) +
        ' L' + (bx + bwd) + ' ' + (pt + al) + ' Z" fill="var(--s1)" opacity=".9"/>';
    }
    s += '<rect class="hit" data-i="' + i + '" x="' + x(i) + '" y="' + pt +
      '" width="' + bw + '" height="' + al + '" fill="transparent"/>';
  });

  s += '<line x1="' + pl + '" y1="' + (pt + al) + '" x2="' + (W - pr) + '" y2="' +
    (pt + al) + '" stroke="var(--borde-fuerte)" stroke-width="1"/>';
  var cada = Math.max(1, Math.ceil(serie.length / 11));
  serie.forEach(function (p, i) {
    if (i % cada && i !== serie.length - 1) return;
    s += '<text x="' + (x(i) + bw / 2).toFixed(1) + '" y="' + (H - 10) +
      '" text-anchor="middle" font-size="9.5" fill="var(--texto-3)">' +
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
        det.push({ nombre: im.nombre + ' · ' + im.canal,
                   valor: im.pieza + ' a ' + fNum(im.sedes) + ' sedes' });
      });
      var r = hh.getBoundingClientRect(), cr = svg.getBoundingClientRect();
      tt.mostrar(r.left - cr.left + r.width / 2, r.top - cr.top + 30,
        tooltipHTML(etiquetaX(p.x, 'dia'), det));
    });
    hh.addEventListener('mouseleave', function () { tt.ocultar(); });
  });
}
