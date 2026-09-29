/* Dona de parte-sobre-total. Es el unico caso en que una torta gana a unas
   barras: tres o cuatro categorias que suman un todo con significado, y el
   todo va al centro. Con mas categorias o sin un total que signifique algo,
   volver a chBarrasH. */
function chTorta(cont, datos, opt) {
  opt = opt || {};
  var vivos = (datos || []).filter(function (d) { return Number(d.y) > 0; });
  if (!vivos.length) {
    cont.innerHTML = '<div class="vacio-graf">' + esc(opt.vacio || 'Sin datos') + '</div>';
    return;
  }
  var H = opt.alto || 230;
  var total = vivos.reduce(function (a, d) { return a + Number(d.y); }, 0);
  var cx = H / 2 + 6, cy = H / 2, R = H / 2 - 16, r = R * 0.58;
  var fv = opt.formato || fNum;

  function punto(ang, rad) {
    var a = (ang - 90) * Math.PI / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  }

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    esc(opt.aria || 'dona de composición') + '">';
  var ang = 0;
  vivos.forEach(function (d, i) {
    var frac = Number(d.y) / total;
    var barrido = frac * 360;
    // Una sola categoria: el anillo completo no se puede dibujar con un arco,
    // se pinta como circulo.
    if (frac >= 0.9999) {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) +
        '" fill="none" stroke="' + d.color + '" stroke-width="' + (R - r) + '"/>';
    } else {
      var a0 = ang, a1 = ang + barrido;
      var p0 = punto(a0, R), p1 = punto(a1, R);
      var q1 = punto(a1, r), q0 = punto(a0, r);
      var grande = barrido > 180 ? 1 : 0;
      s += '<path d="M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
        ' A' + R + ' ' + R + ' 0 ' + grande + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) +
        ' L' + q1[0].toFixed(2) + ' ' + q1[1].toFixed(2) +
        ' A' + r + ' ' + r + ' 0 ' + grande + ' 0 ' + q0[0].toFixed(2) + ' ' + q0[1].toFixed(2) +
        ' Z" fill="' + d.color + '" stroke="var(--superficie)" stroke-width="2"' +
        ' data-i="' + i + '" class="hit"/>';
    }
    ang += barrido;
  });

  // El total al centro: es la razon de ser de la dona.
  s += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="24" ' +
    'font-weight="800" fill="var(--texto)">' + esc(fv(total)) + '</text>';
  if (opt.centroSub) {
    s += '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="10.5" ' +
      'fill="var(--texto-3)">' + esc(opt.centroSub) + '</text>';
  }

  // Etiquetas directas a la derecha, en orden: identidad sin depender del color.
  var lx = H + 24, ly = cy - (vivos.length - 1) * 13;
  vivos.forEach(function (d) {
    var pct = Math.round((Number(d.y) / total) * 1000) / 10;
    s += '<rect x="' + lx + '" y="' + (ly - 8) + '" width="10" height="10" rx="3" fill="' +
      d.color + '"/>';
    s += '<text x="' + (lx + 17) + '" y="' + ly + '" font-size="12" fill="var(--texto-2)">' +
      esc(d.etiqueta) + '</text>';
    s += '<text x="' + (lx + 17) + '" y="' + (ly + 15) + '" font-size="12" font-weight="700" ' +
      'fill="var(--texto)">' + esc(fv(d.y)) + '  <tspan fill="var(--texto-3)" ' +
      'font-weight="400">' + esc(fPct(pct)) + '</tspan></text>';
    ly += 38;
  });
  s += '</svg>';
  cont.innerHTML = s;

  if (opt.detalle) {
    var tt = montarTooltip(cont);
    var svg = cont.querySelector('svg');
    svg.querySelectorAll('.hit').forEach(function (hh) {
      hh.addEventListener('mouseenter', function () {
        var d = vivos[Number(hh.getAttribute('data-i'))];
        var rect = svg.getBoundingClientRect();
        tt.mostrar(rect.width / 2, H / 2, tooltipHTML(d.etiqueta, opt.detalle(d)));
      });
      hh.addEventListener('mouseleave', function () { tt.ocultar(); });
    });
  }
}
