/* Barras de solicitudes por dia con lineas verticales en los dias de impacto.
   No es un eje doble: los impactos no tienen escala propia, son marcas de
   evento sobre el eje de tiempo — la unica forma honesta de superponer un
   evento a una serie.

   El COLOR dice el workflow y el trazo dice el canal (continuo WhatsApp,
   punteado email). Cada marca lleva su etiqueta escrita: una marca que no
   dice que es obliga a pasar el mouse para entender la grafica.

   Los rotulos se reparten en CARRILES. Apilar por dia no basta: si dos
   impactos caen en dias vecinos de un rango largo, sus etiquetas quedan a
   pocos pixeles y se pisan hasta ser ilegibles. Se recorren de izquierda a
   derecha y cada uno baja al primer carril libre, que es la colocacion
   estandar para etiquetas de evento. */
function chSerieImpactos(cont, serie, impactos, opt) {
  opt = opt || {};
  if (!serie || !serie.length) {
    cont.innerHTML = '<div class="vacio-graf">' + esc(opt.vacio || 'Sin datos') + '</div>';
    return;
  }
  // Geometria horizontal primero: los carriles necesitan x() para saber donde
  // cae cada marca, y la banda de etiquetas necesita los carriles para saber
  // cuanto alto reservar.
  var pl = 46, pr = 12, pb = 30;
  var an = W - pl - pr;
  var top = ejeMax(Math.max.apply(null, serie.map(function (p) { return p.y; }))) || 1;
  var bw = an / serie.length;
  var x = function (i) { return pl + i * bw; };

  var idx = {};
  serie.forEach(function (p, i) { idx[p.x] = i; });
  var porDia = {};
  (impactos || []).forEach(function (im) {
    if (IMP_OFF[im.id] || idx[im.fecha] === undefined) return;
    (porDia[im.fecha] = porDia[im.fecha] || []).push(im);
  });

  var marcas = [];
  Object.keys(porDia).sort().forEach(function (fch) {
    porDia[fch].forEach(function (im) {
      marcas.push({ im: im, cx: x(idx[fch]) + bw / 2 });
    });
  });
  marcas.sort(function (a, b) { return a.cx - b.cx; });
  var finCarril = [];
  marcas.forEach(function (m) {
    m.ancho = (m.im.pieza + ' ' + fNum(m.im.sedes)).length * 5.3 + 14;
    m.izq = (m.cx + m.ancho) > (W - 12);
    var x0 = m.izq ? m.cx - m.ancho : m.cx;
    var c = 0;
    while (finCarril[c] !== undefined && finCarril[c] > x0 - 6) c++;
    m.carril = c;
    finCarril[c] = x0 + m.ancho;
  });
  var banda = marcas.length ? 12 + finCarril.length * 14 : 10;
  var H = (opt.alto || 250) + banda;
  var pt = banda, al = H - pt - pb;
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

  // Marcas antes que las barras, para no taparlas.
  marcas.forEach(function (m) {
    var im = m.im, col = colorWf(im.audiencia);
    var dash = im.canal === 'WhatsApp' ? '' : ' stroke-dasharray="3 3"';
    var yl = 8 + m.carril * 14;
    s += '<line x1="' + m.cx.toFixed(1) + '" y1="' + yl + '" x2="' + m.cx.toFixed(1) +
      '" y2="' + (pt + al) + '" stroke="' + col + '" stroke-width="1.5"' +
      dash + ' opacity=".75"/>';
    s += '<circle cx="' + m.cx.toFixed(1) + '" cy="' + yl + '" r="3.2" fill="' +
      col + '"/>';
    s += '<text x="' + (m.izq ? m.cx - 6 : m.cx + 6).toFixed(1) + '" y="' + (yl + 3.4) +
      '" text-anchor="' + (m.izq ? 'end' : 'start') +
      '" font-size="9.5" font-weight="700" fill="' + col + '">' +
      esc(im.pieza) + '<tspan font-weight="400" fill="var(--texto-3)"> ' +
      esc(fNum(im.sedes)) + '</tspan></text>';
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
