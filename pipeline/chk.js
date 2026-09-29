
/* =====================================================================
   Tablero 360 Growth — WELLI · frontend
   ---------------------------------------------------------------------
   Gráficas SVG propias en vez de una librería, por tres razones:
   respetan las especificaciones de marca (extremos redondeados de 4px
   anclados a la base, líneas de 2px, separación de 2px entre barras,
   rejilla recesiva), cambian de tema sin volver a instanciarse, y no
   dependen de un CDN — importa porque esto corre embebido en Apps Script.

   Regla que se respeta en todo el archivo: NUNCA dos escalas Y en la
   misma gráfica. Leads y CPL van en dos paneles apilados que comparten
   el eje X, que se lee igual y no distorsiona la comparación.
   ===================================================================== */

var D = null;            // payload del backend
var VISTA = 'f1';
var CARGANDO = false;
var AVISO_PREVIA = '';   // solo se llena en la vista previa estática

/* Si algo revienta en el frontend, se ve en pantalla en vez de dejar el
   spinner girando para siempre. Sin esto, un error de render se manifiesta
   como "cargando..." eterno y es imposible de diagnosticar en vivo. */
window.addEventListener('error', function (ev) {
  var caja = document.getElementById('error');
  var carga = document.getElementById('cargando');
  if (carga) carga.classList.add('oculto');
  if (!caja) return;
  caja.innerHTML = '<b>Error en el tablero.</b><br>' +
    esc(ev.message || 'error desconocido') +
    (ev.filename ? '<br><small>' + esc(ev.filename) + ':' + ev.lineno + '</small>' : '');
  caja.classList.remove('oculto');
});

/* ------------------------------------------------------- formateadores */
function fNum(v) {
  if (v === null || v === undefined || v === '') return '--';
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('es-CO', { maximumFractionDigits: n < 10 ? 1 : 0 });
}
function fCop(v) {
  if (v === null || v === undefined || v === '') return '--';
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return '$' + Math.round(n).toLocaleString('es-CO');
}
/** COP compacto para ejes y celdas apretadas. */
function fCopC(v) {
  var n = Number(v || 0);
  var s = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e12) return s + '$' + (n / 1e12).toFixed(1) + ' B';
  if (n >= 1e9) return s + '$' + (n / 1e9).toFixed(1) + ' mil M';
  if (n >= 1e6) return s + '$' + (n / 1e6).toFixed(1) + ' M';
  if (n >= 1e3) return s + '$' + Math.round(n / 1e3) + 'k';
  return s + '$' + Math.round(n);
}
function fPct(v) {
  if (v === null || v === undefined || v === '') return '--';
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + '%';
}
function fCompacto(v) {
  var n = Number(v || 0);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(Math.round(n));
}
function fmt(v, f) {
  if (f === 'cop') return fCop(v);
  if (f === 'copC') return fCopC(v);      // montos grandes: $208,2 mil M
  if (f === 'pct') return fPct(v);
  return fNum(v);
}
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
/** Etiqueta legible del eje X según la granularidad del rango. */
function etiquetaX(x, gran) {
  if (!x) return '';
  if (gran === 'mes' || /^\d{4}-\d{2}$/.test(x)) {
    var mm = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var p = x.split('-');
    return mm[Number(p[1]) - 1] + (p[0] ? " '" + p[0].substring(2) : '');
  }
  var q = String(x).split('-');
  if (q.length === 3) return Number(q[2]) + '/' + Number(q[1]);
  return x;
}
function serieColor(i) {
  var v = ['--s1', '--s2', '--s3', '--s4'];
  return 'var(' + v[i % 4] + ')';
}

/* =====================================================================
   Primitivas de gráfica
   ===================================================================== */

var W = 680;                                   // ancho interno del viewBox

function ejeMax(max) {                         // techo redondo y legible
  if (max <= 0) return 1;
  var mag = Math.pow(10, Math.floor(Math.log10(max)));
  var n = max / mag;
  var paso = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return paso * mag;
}

function tooltipHTML(titulo, filas) {
  var h = '<b>' + esc(titulo) + '</b>';
  filas.forEach(function (f) {
    h += '<div class="fila">' +
      (f.color ? '<span class="pt" style="background:' + f.color + '"></span>' : '') +
      esc(f.nombre) + ': <b>' + f.valor + '</b></div>';
  });
  return h;
}

/** Conecta el tooltip flotante de un contenedor .grafica. */
function montarTooltip(cont) {
  var tt = document.createElement('div');
  tt.className = 'tooltip';
  cont.appendChild(tt);
  return {
    mostrar: function (px, py, html) {
      tt.innerHTML = html;
      tt.style.left = px + 'px';
      tt.style.top = (py - 8) + 'px';
      tt.style.opacity = '1';
    },
    ocultar: function () { tt.style.opacity = '0'; }
  };
}

/**
 * Barras verticales, una serie.
 * @param {Array} datos [{x, y}]
 */
function chBarras(cont, datos, opt) {
  opt = opt || {};
  if (!datos || !datos.length) {
    cont.innerHTML = '<div class="vacio-graf">' +
      esc(opt.vacio || 'Sin datos en el período seleccionado') + '</div>';
    return;
  }
  var H = opt.alto || 190;
  var mI = 46, mD = 10, mS = 12, mB = 26;
  var aw = W - mI - mD, ah = H - mS - mB;
  var max = ejeMax(Math.max.apply(null, datos.map(function (d) { return d.y; })));
  var n = datos.length;
  var paso = aw / n;
  var bw = Math.max(3, Math.min(opt.anchoMax || 34, paso - 2));   // 2px de aire
  var color = opt.color || 'var(--s1)';
  var fEje = opt.formatoEje || fCompacto;

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    esc(opt.aria || 'gráfica de barras') + '">';

  // rejilla recesiva + eje Y
  for (var g = 0; g <= 3; g++) {
    var vy = max * g / 3;
    var y = mS + ah - (vy / max) * ah;
    s += '<line x1="' + mI + '" y1="' + y + '" x2="' + (W - mD) + '" y2="' + y +
      '" stroke="var(--borde)" stroke-width="1"/>';
    s += '<text x="' + (mI - 7) + '" y="' + (y + 3.5) +
      '" text-anchor="end" font-size="9.5" fill="var(--texto-3)">' + fEje(vy) + '</text>';
  }

  // barras con extremo superior redondeado, ancladas a la base
  datos.forEach(function (d, i) {
    var bh = max ? (d.y / max) * ah : 0;
    var x = mI + i * paso + (paso - bw) / 2;
    var y = mS + ah - bh;
    var r = Math.min(4, bw / 2, bh);
    if (bh <= 0.5) {
      s += '<rect x="' + x + '" y="' + (mS + ah - 1) + '" width="' + bw +
        '" height="1" fill="' + color + '" opacity=".35"/>';
    } else {
      s += '<path d="M' + x + ' ' + (mS + ah) +
        ' L' + x + ' ' + (y + r) +
        ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
        ' L' + (x + bw - r) + ' ' + y +
        ' Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + r) +
        ' L' + (x + bw) + ' ' + (mS + ah) + ' Z" fill="' + color + '"/>';
    }
    // zona de hover más grande que la barra
    s += '<rect class="hit" data-i="' + i + '" x="' + (mI + i * paso) + '" y="' + mS +
      '" width="' + paso + '" height="' + ah + '" fill="transparent"/>';
  });

  // línea base
  s += '<line x1="' + mI + '" y1="' + (mS + ah) + '" x2="' + (W - mD) + '" y2="' + (mS + ah) +
    '" stroke="var(--borde-fuerte)" stroke-width="1"/>';

  // etiquetas X espaciadas para que no colisionen
  var cada = Math.ceil(n / 12);
  datos.forEach(function (d, i) {
    if (i % cada !== 0 && i !== n - 1) return;
    var cx = mI + i * paso + paso / 2;
    s += '<text x="' + cx + '" y="' + (H - 8) +
      '" text-anchor="middle" font-size="9.5" fill="var(--texto-3)">' +
      esc(etiquetaX(d.x, opt.gran)) + '</text>';
  });

  s += '</svg>';
  cont.innerHTML = s;

  var tt = montarTooltip(cont);
  var svg = cont.querySelector('svg');
  svg.querySelectorAll('.hit').forEach(function (h) {
    h.addEventListener('mouseenter', function () {
      var i = Number(h.getAttribute('data-i'));
      var d = datos[i];
      var rect = svg.getBoundingClientRect();
      var esc2 = rect.width / W;
      var cx = (mI + i * paso + paso / 2) * esc2;
      var bh = max ? (d.y / max) * ah : 0;
      var cy = (mS + ah - bh) * esc2;
      tt.mostrar(cx, cy, tooltipHTML(etiquetaX(d.x, opt.gran),
        [{ nombre: opt.nombre || 'Valor', valor: (opt.formato || fNum)(d.y), color: color }]));
    });
    h.addEventListener('mouseleave', tt.ocultar);
  });
}

/** Línea con marcadores y crosshair. */
function chLinea(cont, datos, opt) {
  opt = opt || {};
  if (!datos || !datos.length) {
    cont.innerHTML = '<div class="vacio-graf">' +
      esc(opt.vacio || 'Sin datos en el período seleccionado') + '</div>';
    return;
  }
  var H = opt.alto || 170;
  var mI = 52, mD = 12, mS = 12, mB = 26;
  var aw = W - mI - mD, ah = H - mS - mB;
  var max = ejeMax(Math.max.apply(null, datos.map(function (d) { return d.y; })));
  var n = datos.length;
  var paso = n > 1 ? aw / (n - 1) : 0;
  var color = opt.color || 'var(--s1)';
  var fEje = opt.formatoEje || fCompacto;

  function px(i) { return n > 1 ? mI + i * paso : mI + aw / 2; }
  function py(v) { return mS + ah - (max ? (v / max) * ah : 0); }

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    esc(opt.aria || 'gráfica de línea') + '">';
  for (var g = 0; g <= 3; g++) {
    var vy = max * g / 3, y = py(vy);
    s += '<line x1="' + mI + '" y1="' + y + '" x2="' + (W - mD) + '" y2="' + y +
      '" stroke="var(--borde)" stroke-width="1"/>';
    s += '<text x="' + (mI - 7) + '" y="' + (y + 3.5) +
      '" text-anchor="end" font-size="9.5" fill="var(--texto-3)">' + fEje(vy) + '</text>';
  }

  var pts = datos.map(function (d, i) { return px(i) + ' ' + py(d.y); }).join(' L');
  s += '<path d="M' + pts + '" fill="none" stroke="' + color +
    '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';

  // marcadores con anillo de superficie de 2px
  datos.forEach(function (d, i) {
    s += '<circle cx="' + px(i) + '" cy="' + py(d.y) + '" r="4" fill="' + color +
      '" stroke="var(--superficie)" stroke-width="2"/>';
  });

  s += '<line id="cross" x1="0" y1="' + mS + '" x2="0" y2="' + (mS + ah) +
    '" stroke="var(--borde-fuerte)" stroke-width="1" opacity="0"/>';
  s += '<line x1="' + mI + '" y1="' + (mS + ah) + '" x2="' + (W - mD) + '" y2="' + (mS + ah) +
    '" stroke="var(--borde-fuerte)" stroke-width="1"/>';

  var cada = Math.ceil(n / 12);
  datos.forEach(function (d, i) {
    if (i % cada !== 0 && i !== n - 1) return;
    s += '<text x="' + px(i) + '" y="' + (H - 8) +
      '" text-anchor="middle" font-size="9.5" fill="var(--texto-3)">' +
      esc(etiquetaX(d.x, opt.gran)) + '</text>';
  });

  s += '<rect id="capa" x="' + mI + '" y="' + mS + '" width="' + aw + '" height="' + ah +
    '" fill="transparent"/>';
  s += '</svg>';
  cont.innerHTML = s;

  var tt = montarTooltip(cont);
  var svg = cont.querySelector('svg');
  var capa = svg.querySelector('#capa');
  var cross = svg.querySelector('#cross');

  capa.addEventListener('mousemove', function (e) {
    var rect = svg.getBoundingClientRect();
    var escala = rect.width / W;
    var xi = (e.clientX - rect.left) / escala;
    var i = n > 1 ? Math.round((xi - mI) / paso) : 0;
    i = Math.max(0, Math.min(n - 1, i));
    var d = datos[i];
    cross.setAttribute('x1', px(i));
    cross.setAttribute('x2', px(i));
    cross.setAttribute('opacity', '.7');
    tt.mostrar(px(i) * escala, py(d.y) * escala, tooltipHTML(etiquetaX(d.x, opt.gran),
      [{ nombre: opt.nombre || 'Valor', valor: (opt.formato || fNum)(d.y), color: color }]));
  });
  capa.addEventListener('mouseleave', function () {
    cross.setAttribute('opacity', '0');
    tt.ocultar();
  });
}

/** Barras horizontales con etiqueta directa. Una medida, ordenadas. */
function chBarrasH(cont, datos, opt) {
  opt = opt || {};
  if (!datos || !datos.length) {
    cont.innerHTML = '<div class="vacio-graf">' +
      esc(opt.vacio || 'Sin datos') + '</div>';
    return;
  }
  var filaH = 26, mS = 6, mB = 4;
  var mI = opt.anchoEtiqueta || 128, mD = 62;
  var H = mS + datos.length * filaH + mB;
  var aw = W - mI - mD;
  var max = Math.max.apply(null, datos.map(function (d) { return Math.abs(d.y); })) || 1;
  var color = opt.color || 'var(--s1)';
  var fv = opt.formato || fNum;

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    esc(opt.aria || 'gráfica de barras horizontales') + '">';
  datos.forEach(function (d, i) {
    var y = mS + i * filaH;
    var bh = 13;
    var bw = Math.max(1, (Math.abs(d.y) / max) * aw);
    var by = y + (filaH - bh) / 2;
    var r = Math.min(4, bh / 2, bw);
    s += '<text x="' + (mI - 9) + '" y="' + (by + bh / 2 + 3.5) +
      '" text-anchor="end" font-size="11" fill="var(--texto-2)">' +
      esc(String(d.etiqueta).substring(0, 24)) + '</text>';
    s += '<path d="M' + mI + ' ' + by +
      ' L' + (mI + bw - r) + ' ' + by +
      ' Q' + (mI + bw) + ' ' + by + ' ' + (mI + bw) + ' ' + (by + r) +
      ' L' + (mI + bw) + ' ' + (by + bh - r) +
      ' Q' + (mI + bw) + ' ' + (by + bh) + ' ' + (mI + bw - r) + ' ' + (by + bh) +
      ' L' + mI + ' ' + (by + bh) + ' Z" fill="' + color + '"/>';
    // etiqueta directa: aquí sí, porque son pocas filas
    s += '<text x="' + (mI + bw + 7) + '" y="' + (by + bh / 2 + 3.5) +
      '" font-size="11" font-weight="700" fill="var(--texto-2)">' + esc(fv(d.y)) + '</text>';
    s += '<rect class="hit" data-i="' + i + '" x="' + mI + '" y="' + y + '" width="' + aw +
      '" height="' + filaH + '" fill="transparent"/>';
  });
  s += '</svg>';
  cont.innerHTML = s;

  if (opt.detalle) {
    var tt = montarTooltip(cont);
    var svg = cont.querySelector('svg');
    svg.querySelectorAll('.hit').forEach(function (h) {
      h.addEventListener('mouseenter', function () {
        var d = datos[Number(h.getAttribute('data-i'))];
        var rect = svg.getBoundingClientRect();
        var e2 = rect.width / W;
        tt.mostrar(rect.width / 2,
          (mS + Number(h.getAttribute('data-i')) * filaH) * e2,
          tooltipHTML(d.etiqueta, opt.detalle(d)));
      });
      h.addEventListener('mouseleave', tt.ocultar);
    });
  }
}

/** Barras agrupadas, hasta 4 series. Leyenda obligatoria. */
function chGrupos(cont, cats, series, opt) {
  opt = opt || {};
  if (!cats || !cats.length) {
    cont.innerHTML = '<div class="vacio-graf">' + esc(opt.vacio || 'Sin datos') + '</div>';
    return;
  }
  var H = opt.alto || 200;
  var mI = 46, mD = 10, mS = 12, mB = 26;
  var aw = W - mI - mD, ah = H - mS - mB;
  var max = 0;
  series.forEach(function (se) {
    se.valores.forEach(function (v) { if (v > max) max = v; });
  });
  max = ejeMax(max);
  var nc = cats.length, ns = series.length;
  var paso = aw / nc;
  var grupo = Math.min(paso - 6, 40);
  var bw = Math.max(2.5, (grupo - (ns - 1) * 2) / ns);      // 2px entre barras
  var fEje = opt.formatoEje || fCompacto;

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    esc(opt.aria || 'barras agrupadas') + '">';
  for (var g = 0; g <= 3; g++) {
    var vy = max * g / 3;
    var y = mS + ah - (vy / max) * ah;
    s += '<line x1="' + mI + '" y1="' + y + '" x2="' + (W - mD) + '" y2="' + y +
      '" stroke="var(--borde)" stroke-width="1"/>';
    s += '<text x="' + (mI - 7) + '" y="' + (y + 3.5) +
      '" text-anchor="end" font-size="9.5" fill="var(--texto-3)">' + fEje(vy) + '</text>';
  }

  cats.forEach(function (c, i) {
    var x0 = mI + i * paso + (paso - grupo) / 2;
    series.forEach(function (se, j) {
      var v = se.valores[i] || 0;
      var bh = max ? (v / max) * ah : 0;
      var x = x0 + j * (bw + 2);
      var y = mS + ah - bh;
      var r = Math.min(4, bw / 2, bh);
      if (bh > 0.5) {
        s += '<path d="M' + x + ' ' + (mS + ah) +
          ' L' + x + ' ' + (y + r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
          ' L' + (x + bw - r) + ' ' + y +
          ' Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + r) +
          ' L' + (x + bw) + ' ' + (mS + ah) + ' Z" fill="' + se.color + '"/>';
      }
    });
    s += '<rect class="hit" data-i="' + i + '" x="' + (mI + i * paso) + '" y="' + mS +
      '" width="' + paso + '" height="' + ah + '" fill="transparent"/>';
  });

  s += '<line x1="' + mI + '" y1="' + (mS + ah) + '" x2="' + (W - mD) + '" y2="' + (mS + ah) +
    '" stroke="var(--borde-fuerte)" stroke-width="1"/>';
  var cada = Math.ceil(nc / 12);
  cats.forEach(function (c, i) {
    if (i % cada !== 0 && i !== nc - 1) return;
    s += '<text x="' + (mI + i * paso + paso / 2) + '" y="' + (H - 8) +
      '" text-anchor="middle" font-size="9.5" fill="var(--texto-3)">' +
      esc(etiquetaX(c, opt.gran)) + '</text>';
  });
  s += '</svg>';
  cont.innerHTML = s;

  var tt = montarTooltip(cont);
  var svg = cont.querySelector('svg');
  svg.querySelectorAll('.hit').forEach(function (h) {
    h.addEventListener('mouseenter', function () {
      var i = Number(h.getAttribute('data-i'));
      var rect = svg.getBoundingClientRect();
      var e2 = rect.width / W;
      tt.mostrar((mI + i * paso + paso / 2) * e2, mS * e2,
        tooltipHTML(etiquetaX(cats[i], opt.gran), series.map(function (se) {
          return { nombre: se.nombre, color: se.color,
                   valor: (opt.formato || fNum)(se.valores[i] || 0) };
        })));
    });
    h.addEventListener('mouseleave', tt.ocultar);
  });
}

function leyenda(series) {
  return '<div class="leyenda">' + series.map(function (se) {
    return '<span><i style="background:' + se.color + '"></i>' + esc(se.nombre) + '</span>';
  }).join('') + '</div>';
}

/* =====================================================================
   Componentes de UI
   ===================================================================== */

/** Badge informativo de una tarjeta. El texto completo va en title:
    si no, una nota larga descuadra la altura de toda la fila de KPIs. */
function badgeNota(k) {
  if (!k.nota) return '';
  var completo = k.notaLarga || k.nota;
  return '<div class="badge info" title="' + esc(completo) + '">' +
    '<span class="ico-i">i</span><span class="txt-badge">' + esc(k.nota) + '</span></div>';
}

function tarjetaKPI(k) {
  var h = '<div class="kpi" data-color="' + esc(k.color) + '">';
  h += '<div class="kpi-label">' + esc(k.label) + '</div>';
  if (k.pendiente || k.valor === null || k.valor === undefined) {
    h += '<div class="kpi-valor vacio">--</div>';
  } else {
    var exacto = (k.formato === 'copC') ? fCop(k.valor)
      : (k.formato === 'cop' ? fCop(k.valor) : fNum(k.valor));
    h += '<div class="kpi-valor" title="' + esc(exacto) + '">' +
      esc(fmt(k.valor, k.formato)) + '</div>';
  }
  if (k.sublabel) h += '<div class="kpi-sub">' + esc(k.sublabel) + '</div>';

  if (k.pendiente) {
    h += '<div class="badge falta" title="' + esc(k.nota || '') + '">' +
      '<span class="ico-i">!</span><span class="txt-badge">' +
      esc(k.nota || ('Falta conexión con ' + k.fuente)) + '</span></div>';
  } else if (k.delta === null || k.delta === undefined) {
    h += '<span class="foto">foto de hoy · sin comparativo</span>';
    if (k.nota) h += badgeNota(k);
  } else {
    // Para CPL menos es mejor: se invierte el color, no el signo.
    var bueno = k.deltaInvertido ? (k.delta < 0) : (k.delta > 0);
    var cls = k.delta === 0 ? 'plano' : (bueno ? 'sube' : 'baja');
    var flecha = k.delta === 0 ? '=' : (k.delta > 0 ? '▲' : '▼');
    h += '<div class="delta ' + cls + '">' + flecha + ' ' +
      (k.delta > 0 ? '+' : '') + fNum(k.delta) + '% <small>vs per. anterior</small></div>';
    if (k.nota) h += badgeNota(k);
  }
  h += '</div>';
  return h;
}

function filaKPIs(lista) {
  if (!lista || !lista.length) return '';
  return '<div class="kpis">' + lista.map(tarjetaKPI).join('') + '</div>';
}

function panel(titulo, sub, cuerpo, id) {
  return '<div class="panel">' +
    '<h3>' + esc(titulo) + '</h3>' +
    (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') +
    (id ? '<div class="grafica" id="' + id + '"></div>' : '') +
    (cuerpo || '') + '</div>';
}

function avisoBox(txt, obra) {
  if (!txt) return '';
  return '<div class="aviso' + (obra ? ' obra' : '') + '">' +
    '<span class="ico">' + (obra ? '🚧' : '⚠️') + '</span><div>' + esc(txt) + '</div></div>';
}

function cuali(t, fuente) {
  if (!t) return '';
  return '<h2 class="sec">Lectura del frente</h2>' +
    '<p class="sec-sub">Texto editable en la hoja CONFIG del Sheet — no se calcula, lo escribe el equipo.</p>' +
    '<div class="cuali">' +
    '<div class="caja bien"><h4>✅ Lo que está funcionando</h4><p>' +
      esc(t.funcionando || '(por escribir)') + '</p></div>' +
    '<div class="caja cuello"><h4>⚠️ Cuello de botella</h4><p>' +
      esc(t.cuello || '(por escribir)') + '</p></div>' +
    '<div class="caja ojo"><h4>🔔 Atención esta semana</h4><p>' +
      esc(t.atencion || '(por escribir)') + '</p></div>' +
    '</div>';
}

/** Tabla genérica. cols: [{k, t, f, txt, pill}] */
function tabla(cols, filas, opt) {
  opt = opt || {};
  if (!filas || !filas.length) {
    return '<div class="vacio-graf">' + esc(opt.vacio || 'Sin filas en el período') + '</div>';
  }
  var h = '<div class="tabla-wrap"><table class="t"><thead><tr>';
  cols.forEach(function (c) { h += '<th>' + esc(c.t) + '</th>'; });
  h += '</tr></thead><tbody>';
  filas.forEach(function (r) {
    h += '<tr>';
    cols.forEach(function (c) {
      var v = r[c.k];
      var cls = c.txt ? ' class="txt"' : '';
      var txt;
      if (v === '' || v === null || v === undefined) {
        txt = '<span class="cel-vacia">--</span>';
      } else if (c.pill) {
        var p = String(v).toLowerCase();
        txt = '<span class="pill ' + esc(p) + '">' + esc(v) + '</span>';
      } else if (c.f === 'cop') {
        txt = esc(fCopC(v));
      } else if (c.f === 'pct') {
        txt = esc(fPct(v));
      } else if (c.f === 'txt') {
        txt = esc(v);
      } else {
        txt = esc(fNum(v));
      }
      h += '<td' + cls + '>' + txt + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

/* =====================================================================
   Vistas
   ===================================================================== */

var graficas = [];        // se dibujan después de inyectar el HTML
function pintar(id, fn) { graficas.push({ id: id, fn: fn }); }
function dibujarPendientes() {
  graficas.forEach(function (g) {
    var el = document.getElementById(g.id);
    if (el) g.fn(el);
  });
  graficas = [];
}

/* El tablero mide MARKETING. Hay dos alcances distintos y conviene que
   se lean en pantalla, porque un frente que cubre toda la base no es un
   error sino una intervencion de marketing sobre sedes que trajo otro. */
function alcance(texto) {
  return '<div class="badge info" style="margin:0 0 14px">' +
    '<span class="ico-i">i</span><span>' + esc(texto) + '</span></div>';
}

/* Las tres tablas de cosecha, en formato matriz M0..M7.
   Se separan a proposito: acumulada y viva contestan preguntas distintas
   y divergen desde M2, asi que ponerlas juntas confunde mas que aclara. */
/* La intensidad del color se calcula sobre el valor RELATIVO al tamano de
   la cosecha, no sobre el valor absoluto. Si fuera absoluto, la cosecha de
   octubre (1.922 sedes) tenriria todo de oscuro y las demas se verian
   vacias, cuando proporcionalmente son mucho mas activas.
   Devuelve 0..4, el paso de la rampa. */
function pasoCalor(valor, n, tope) {
  if (!n || !tope || valor === null || valor === undefined) return 0;
  var r = (valor / n) / tope;              // 0..1
  if (r <= 0) return 0;
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.75) return 3;
  return 4;
}

/* Tope de la escala: el maximo de valor-por-sede de toda la matriz. Asi el
   color es comparable entre cosechas, que es justo lo que uno quiere
   mirar en una tabla de cohortes. */
function topePorSede(filas) {
  var max = 0;
  (filas || []).forEach(function (f) {
    if (!f.n) return;
    (f.celdas || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      var v = c / f.n;
      if (v > max) max = v;
    });
  });
  return max;
}

function leyendaCalor(clase, etiqueta) {
  var pasos = '';
  for (var i = 0; i <= 4; i++) {
    pasos += '<i class="hm-' + clase + '-' + i + '"></i>';
  }
  return '<div class="hm-leyenda"><span>menos</span>' +
    '<span class="pasos">' + pasos + '</span><span>más</span>' +
    '<span style="margin-left:6px">' + esc(etiqueta) + '</span></div>';
}

function tablaCohorte(filas, offsets, formato, titulo, sub, clase, etiquetaEscala) {
  if (!filas || !filas.length) return '';
  var tope = topePorSede(filas);
  var h = '<div class="panel"><h3>' + esc(titulo) + '</h3>' +
    '<p class="sub">' + esc(sub) + '</p><div class="tabla-wrap">' +
    '<table class="t"><thead><tr><th>Cosecha</th><th>Sedes</th>';
  for (var m = 0; m <= offsets; m++) h += '<th>M' + m + '</th>';
  h += '</tr></thead><tbody>';
  filas.forEach(function (f) {
    h += '<tr><td>' + esc(f.cosecha) + '</td><td>' + fNum(f.n) + '</td>';
    (f.celdas || []).forEach(function (c) {
      // null = mes que todavia no ocurrio. Se deja vacio, no en cero.
      if (c === null || c === undefined) {
        h += '<td class="cel-vacia">·</td>';
        return;
      }
      var paso = pasoCalor(c, f.n, tope);
      var porSede = f.n ? (c / f.n) : 0;
      var titulo2 = f.cosecha + ' · ' + formato(c) +
        (f.n ? '  (' + formato(Math.round(porSede)) + ' por sede)' : '');
      h += '<td class="hm hm-' + clase + '-' + paso + '" title="' + esc(titulo2) + '">' +
        esc(formato(c)) + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>' +
    leyendaCalor(clase, etiquetaEscala || 'intensidad por sede de la cosecha') +
    '</div>';
  return h;
}

/* Universo de las cosechas: 'mkt' (solo los origenes que marketing
   genera) o 'todas'. Arranca en mkt porque es lo que mide el frente: si
   se ven todas, las 1.922 sedes de la carga inicial de octubre — de las
   que 8 son de marketing — se comen el 100% de la plata. */
var UNIVERSO_COH = 'mkt';

function setUniverso(u) {
  UNIVERSO_COH = u;
  if (D) render();
}

function vistaCohortes(co) {
  var h = '<h2 class="sec">Cómo se comporta cada cosecha mes a mes</h2>' +
    '<p class="sec-sub">M0 es el mes en que se creó la sede, M1 el siguiente. ' +
    'Cada celda mide lo de ESE mes, no acumulado — salvo la primera tabla. ' +
    'Un punto quiere decir que ese mes todavía no ha ocurrido.</p>';

  if (!co.hay) {
    h += avisoBox(co.nota || 'Falta la plata firmada por sede y mes.', true);
    return h;
  }

  var r = co.resumen || {};
  var esMkt = UNIVERSO_COH === 'mkt';
  h += '<div class="presets" style="margin-bottom:12px" id="selUniverso">' +
    '<button class="preset" type="button" data-u="mkt" aria-pressed="' +
      (esMkt ? 'true' : 'false') + '">Solo origen marketing</button>' +
    '<button class="preset" type="button" data-u="todas" aria-pressed="' +
      (esMkt ? 'false' : 'true') + '">Todas las sedes</button>' +
    '</div>';

  h += avisoBox(esMkt
    ? 'Viendo solo las sedes que trajo marketing: ' + (co.origenesMkt || []).join(', ') +
      '. Son ' + fNum(r.sedesMkt) + ' de ' + fNum(r.sedesTodas) + ' sedes (' +
      fPct(r.pctMkt) + '). El resto entró por canales comerciales o de alianzas ' +
      '(FARMER, HUNTER, DENTALINK, DT DENTAL) o no tiene origen registrado.'
    : 'Viendo TODAS las sedes, incluyendo las que no trajo marketing. La cosecha ' +
      '2025-10 son 1.922 sedes de la carga inicial del objeto en HubSpot y solo 8 son ' +
      'de origen marketing, así que domina la plata y no representa adquisición.');

  var u = esMkt ? (co.mkt || {}) : (co.todas || {});

  h += tablaCohorte(u.acumulada, co.offsets, fNum,
    'Acumulada · ¿desembolsó alguna vez?',
    'Sedes de la cosecha que ya desembolsaron al menos una vez. Solo sube: una ' +
    'sede que desembolsó en enero y nunca volvió sigue contando en julio.',
    'acum', '% de la cosecha que ya desembolsó');
  h += tablaCohorte(u.viva, co.offsets, fNum,
    'Viva · ¿desembolsó ese mes?',
    'Sedes que desembolsaron en ese mes concreto. Sube y baja, y es la que explica ' +
    'la plata.',
    'viva', '% de la cosecha activa ese mes');
  h += tablaCohorte(u.plata, co.offsets, fCopC,
    'Plata firmada',
    'La misma tabla viva, en pesos. El mes es la fecha de firma del contrato, no la ' +
    'de radicación, y el monto es el aprobado.',
    'plata', 'plata firmada por sede de la cosecha');

  h += avisoBox('La acumulada y la viva divergen desde M2, y por eso el ' +
    '"% de desembolso real" puede subir mientras el aporte en pesos de esa misma ' +
    'cosecha baja. No es una contradicción: la primera pregunta si alguna vez ' +
    'desembolsó y la segunda si lo hizo este mes.');
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
  h += alcance('Todo este frente cuenta SOLO las sedes que trajo marketing: eventos, ' +
    'referidos, página web y social media. Son 596 de 3.603 sedes. Las que entraron por ' +
    'FARMER, HUNTER, DENTALINK o sin origen registrado no se cuentan acá.');

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
    panel('Sedes de marketing por cosecha y calidad',
      'cuántas trajo marketing ese mes y de qué calidad',
      (cos.length ? leyenda([
        { nombre: 'Sedes de marketing', color: 'var(--s1)' },
        { nombre: 'AA', color: 'var(--s2)' },
        { nombre: 'AAA', color: 'var(--s3)' }]) : ''), 'gF1Cos') +
    panel('Conversión por origen de marketing',
      'desembolsos sobre aplicaciones, solo los canales que marketing genera',
      '', 'gF1Conv') +
    '</div>';
  pintar('gF1Cos', function (el) {
    chGrupos(el, cos.map(function (c) { return c.cosecha; }), [
      { nombre: 'Sedes de marketing', color: 'var(--s1)',
        valores: cos.map(function (c) { return c.total; }) },
      { nombre: 'AA', color: 'var(--s2)', valores: cos.map(function (c) { return c.aa; }) },
      { nombre: 'AAA', color: 'var(--s3)', valores: cos.map(function (c) { return c.aaa; }) }
    ], { gran: 'mes', formato: fNum, vacio: 'Ninguna cosecha cae en el rango elegido' });
  });
  pintar('gF1Conv', function (el) {
    // Solo los origenes que marketing genera. "Otros origenes" mezcla
    // FARMER, HUNTER y DENTALINK, que no son adquisicion de marketing.
    var MKT = ['Eventos', 'Referidos', 'Pagina web', 'Social media'];
    var co = (f.convOrigen || []).filter(function (o) { return MKT.indexOf(o.origen) >= 0; })
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

  h += panel('Cosechas de marketing por canal y calidad',
    'la cosecha es el mes en que la sede se creó en HubSpot, y no cambia nunca',
    tabla([
      { k: 'cosecha', t: 'Cosecha', f: 'txt' },
      { k: 'total', t: 'Sedes de mkt' },
      { k: 'eventos', t: 'Eventos' },
      { k: 'referidos', t: 'Referidos' },
      { k: 'web', t: 'Página web' },
      { k: 'social', t: 'Social media' },
      { k: 'a', t: 'A' },
      { k: 'aa', t: 'AA' },
      { k: 'aaa', t: 'AAA' },
      { k: 'todas', t: 'Total de la base' }
    ], cos, { vacio: 'Ninguna cosecha cae en el rango elegido' }));

  // --- Las tres tablas de cosecha ------------------------------------
  h += vistaCohortes(f.cohortes || {});

  // --- 3. La demanda de crédito -------------------------------------
  if ((em.kpis || []).length) {
    h += '<h2 class="sec">3 · ¿En qué termina la demanda que trajo marketing?</h2>' +
      '<p class="sec-sub">El embudo de crédito de los pacientes que atendieron las sedes ' +
      'de origen marketing. No es el embudo del negocio: es la parte que marketing puede ' +
      'reclamar como propia.</p>';
    h += filaKPIs(em.kpis);

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
  h += alcance('Este frente cubre TODA la base de sedes, no solo las de origen marketing. ' +
    'Es a propósito: la campaña de reactivación la hace marketing aunque la sede la haya ' +
    'traído un hunter. Acá se mide la intervención, no el origen.');

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
  if (sa.desfase) {
    h += avisoBox(sa.desfase.aviso);
    if (sa.desfase.avisoAuto) h += avisoBox(sa.desfase.avisoAuto);
  }

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
    'mesa, pero con fecha de vencimiento: en WELLI el crédito vive 30 días. ' +
    'Rescatarlo es convencerlo de firmar antes de que se le venza — pasado ese plazo ' +
    'ya no hay nada que recuperar.</p>' +
    '</div>';
  h += alcance('Este frente cubre a TODOS los pacientes con crédito aprobado, no solo los ' +
    'de sedes de marketing. Las piezas de rescate las manda marketing sobre toda la base: ' +
    'acá se mide la intervención, no el origen de la sede.');

  // --- 1. La plata ---------------------------------------------------
  h += '<h2 class="sec">1 · Lo que todavía se puede tomar</h2>' +
    '<p class="sec-sub">El crédito de WELLI vive 30 días. Solo cuenta como oportunidad ' +
    'lo aprobado dentro de ese plazo; lo demás ya se venció.</p>';
  h += filaKPIs(pl.kpis || []);

  if (pl.hay) {
    h += '<div class="grid2" style="margin-top:14px">' +
      panel('La ventana abierta', 'días desde la aprobación — quedan ' +
        'hasta el día 30 para convertir', '', 'gF4Vivo') +
      panel('Lo que ya se venció', 'crédito que pasó de 30 días y no se puede recuperar',
        '', 'gF4Vencido') +
      '</div>';
    pintar('gF4Vivo', function (el) {
      chBarrasH(el, (pl.filasVivo || []).map(function (x) {
        return { etiqueta: x.antiguedad, y: x.monto, d: x };
      }), { color: 'var(--s4)', formato: fCopC, anchoEtiqueta: 110,
        detalle: function (d) {
          return [{ nombre: 'Monto', valor: fCop(d.d.monto) },
                  { nombre: 'Créditos', valor: fNum(d.d.creditos) },
                  { nombre: 'Sedes', valor: fNum(d.d.sedes) }];
        } });
    });
    pintar('gF4Vencido', function (el) {
      chBarrasH(el, (pl.filasVencido || []).map(function (x) {
        return { etiqueta: x.antiguedad, y: x.monto, d: x };
      }), { color: 'var(--s3)', formato: fCopC, anchoEtiqueta: 110,
        detalle: function (d) {
          return [{ nombre: 'Monto', valor: fCop(d.d.monto) },
                  { nombre: 'Créditos', valor: fNum(d.d.creditos) },
                  { nombre: 'Sedes', valor: fNum(d.d.sedes) }];
        } });
    });
    h += avisoBox('Los ' + fCopC(pl.vencidoMonto) + ' vencidos son el costo acumulado de ' +
      'no operar el frente: crédito que se aprobó, nadie tomó dentro de los 30 días, y ' +
      'ya no se puede recuperar. Se muestra para dimensionar, no como meta.');
  }

  // --- 2. Cómo se comporta la ventana --------------------------------
  var vt = f.ventana || {};
  if ((vt.filas || []).length && vt.total) {
    h += '<h2 class="sec">2 · ¿En qué momento de la ventana firman?</h2>' +
      '<p class="sec-sub">Sobre los ' + fNum(vt.total) + ' desembolsos del período. Los ' +
      'que firman en la segunda mitad son los que iban camino a vencerse.</p>';
    h += filaKPIs((f.kpis || []).slice(0, 3));

    h += '<div class="grid2" style="margin-top:14px">' +
      panel('Firmas por momento de la ventana', 'días entre la aprobación y el desembolso',
        '', 'gF4Vent2') +
      panel('Detalle', '', tabla([
        { k: 'balde', t: 'Momento', f: 'txt' },
        { k: 'creditos', t: 'Créditos' },
        { k: 'pct', t: '% del total', f: 'pct' }
      ], vt.filas)) +
      '</div>';
    pintar('gF4Vent2', function (el) {
      chBarrasH(el, vt.filas.map(function (x) {
        return { etiqueta: x.balde, y: x.creditos, d: x };
      }), { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 105,
        detalle: function (d) {
          return [{ nombre: 'Créditos', valor: fNum(d.d.creditos) },
                  { nombre: '% del total', valor: fPct(d.d.pct) }];
        } });
    });
    if (vt.avisoFuera) h += avisoBox(vt.avisoFuera);
  }

  if (f.pendienteBQ) h += avisoBox(f.notaBQ, true);

  // --- 2. El canal que funcionaba y se apagó ------------------------
  if (hi.campanas) {
    h += '<h2 class="sec">3 · El canal de rescate ya existió, y se apagó</h2>' +
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
    h += '<h2 class="sec">4 · Dónde está la plata que todavía se puede tomar</h2>' +
      '<p class="sec-sub">La cola de trabajo de hoy, ordenada por el crédito que sigue ' +
      'dentro de la ventana de 30 días.</p>' +
      panel('Top 10 sedes por crédito vivo',
        'ordenado por lo que todavía está dentro de la ventana', tabla([
        { k: 'sede', t: 'Sede', f: 'txt', txt: true },
        { k: 'creditosVivos', t: 'Créditos vivos' },
        { k: 'montoVivo', t: 'Monto vivo', f: 'cop' },
        { k: 'montoTotal', t: 'Vencido + vivo', f: 'cop' }
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
  h += alcance('Welli Points es un programa de marketing que aplica a TODA la base de ' +
    'sedes, no solo a las de origen marketing.');

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

/* =====================================================================
   Render y navegación
   ===================================================================== */

function render() {
  var cont = document.getElementById('vistas');
  var m = D.meta;

  // Solo lo indispensable: cuándo se actualizó el dato. Los rangos ya se
  // ven en el calendario, y el comparativo lo dice cada tarjeta.
  document.getElementById('periodoInfo').innerHTML =
    'Datos actualizados: <b>' + esc(m.ultimaActualizacion) + '</b>';

  // estado de fuentes en el sidebar
  var est = D.estado || {};
  var lineas = [];
  // Se listan las fuentes que realmente aparecen en la bitacora, no una
  // lista fija: asi el panel refleja lo que el ultimo refresh intento.
  Object.keys(est).sort().forEach(function (k) {
    if (k === 'refreshAll') return;
    var e = est[k];
    var ico = e.estado === 'OK' ? '🟢' : '🔴';
    lineas.push('<span title="' + esc(e.detalle || '') + ' (' + esc(e.cuando) + ')">' +
      ico + ' ' + esc(k) + '</span>');
  });
  document.getElementById('navEstado').innerHTML = lineas.join('<br>') ||
    'Sin bitácora todavía. Corre refreshAll() en el editor de Apps Script.';

  // marcas de "falta" en la navegación
  var pend = { f1: D.f1.pendienteMeta, f4: D.f4.pendienteBQ, f5: D.f5.pendienteBQ };
  Object.keys(pend).forEach(function (k) {
    var el = document.querySelector('[data-pend="' + k + '"]');
    if (el) el.classList.toggle('oculto', !pend[k]);
  });

  graficas = [];
  var html;
  if (VISTA === 'f1') html = vistaF1();
  else if (VISTA === 'f2') html = vistaF2();
  else if (VISTA === 'f4') html = vistaF4();
  else if (VISTA === 'f5') html = vistaF5();
  else if (VISTA === 'f6') html = vistaF6();
  else html = vistaF1();

  html += '<div class="pie">' +
    'Tablero 360 Growth · WELLI. Los datos vienen del Google Sheet, que se actualiza con un ' +
    'trigger diario a las 6:00 AM hora Colombia. Toda métrica sin fuente conectada aparece ' +
    'como <b>--</b> con un badge que dice qué falta: en este tablero no se rellena nada con ' +
    'estimaciones. Las métricas marcadas "foto de hoy" son contadores de estado de HubSpot ' +
    'y no responden al filtro de fechas.' +
    '</div>';

  if (AVISO_PREVIA) html = avisoBox(AVISO_PREVIA) + html;
  cont.innerHTML = html;
  cont.classList.remove('oculto');
  document.getElementById('cargando').classList.add('oculto');
  dibujarPendientes();
  // El selector de universo de cosechas se engancha aqui porque el HTML
  // se reinyecta en cada render.
  var sel = document.getElementById('selUniverso');
  if (sel) {
    sel.querySelectorAll('button[data-u]').forEach(function (b) {
      b.addEventListener('click', function () { setUniverso(b.getAttribute('data-u')); });
    });
  }
  window.scrollTo(0, 0);
}

var VISTAS_VALIDAS = ['f1', 'f2', 'f4', 'f5', 'f6'];

function irA(v, sinHash) {
  if (VISTAS_VALIDAS.indexOf(v) < 0) v = 'f1';
  VISTA = v;
  document.querySelectorAll('.nav-item').forEach(function (b) {
    b.setAttribute('aria-current', b.getAttribute('data-vista') === v ? 'true' : 'false');
  });
  // El hash permite mandarle a alguien el link de un frente concreto.
  if (!sinHash) {
    try { history.replaceState(null, '', '#' + v); } catch (e) { location.hash = v; }
  }
  if (D) render();
}

function vistaDelHash() {
  var h = String(location.hash || '').replace('#', '');
  return VISTAS_VALIDAS.indexOf(h) >= 0 ? h : 'f1';
}

/* ------------------------------------------------------------- fechas */
function iso(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
function lunes(d) {
  var x = new Date(d.getTime());
  var w = x.getDay();
  x.setDate(x.getDate() + (w === 0 ? -6 : 1 - w));
  return x;
}

function aplicarPreset(p) {
  var hoy = new Date();
  var a, b;
  if (p === 'semana') { a = lunes(hoy); b = hoy; }
  else if (p === '4sem') { a = lunes(hoy); a.setDate(a.getDate() - 21); b = hoy; }
  else if (p === 'mes') { a = new Date(hoy.getFullYear(), hoy.getMonth(), 1); b = hoy; }
  else if (p === 'mesant') {
    a = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    b = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  } else if (p === '3m') {
    a = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1); b = hoy;
  } else { a = new Date(hoy.getFullYear(), 0, 1); b = hoy; }

  document.getElementById('fDesde').value = iso(a);
  document.getElementById('fHasta').value = iso(b);
  cargar();
}

/* -------------------------------------------------------------- carga */
function cargar() {
  if (CARGANDO) return;
  CARGANDO = true;
  var ini = document.getElementById('fDesde').value;
  var fin = document.getElementById('fHasta').value;
  document.getElementById('vistas').classList.add('oculto');
  document.getElementById('error').classList.add('oculto');
  document.getElementById('cargando').classList.remove('oculto');

  function ok(datos) {
    CARGANDO = false;
    D = datos;
    render();
  }
  function mal(err) {
    CARGANDO = false;
    document.getElementById('cargando').classList.add('oculto');
    var e = document.getElementById('error');
    e.innerHTML = '<b>No se pudo leer el Sheet.</b><br>' + esc(err && err.message ? err.message : err) +
      '<br><br>Revisa que SHEET_ID en Config.gs sea correcto y que el dueño del script tenga ' +
      'acceso al Google Sheet.';
    e.classList.remove('oculto');
  }

  // Vista previa estática: el mismo código, con los payloads ya calculados
  // por getDashboardData() para cada atajo. Sirve para aprobar el diseño
  // antes de desplegar; desplegado en Apps Script esta rama no se usa.
  if (window.PAYLOADS_PREVIA) {
    var p = window.PAYLOADS_PREVIA[ini + '|' + fin];
    AVISO_PREVIA = p ? '' :
      'Vista previa estática: solo los seis atajos de arriba traen datos ' +
      'pre-calculados. Se está mostrando "últimos 3 meses". Desplegado como web app, ' +
      'cualquier rango de fechas se calcula en vivo.';
    if (!p) p = window.PAYLOADS_PREVIA[window.CLAVE_FALLBACK];
    setTimeout(function () { ok(p); }, 50);
    return;
  }
  if (window.DATOS_PRECARGADOS) {
    setTimeout(function () { ok(window.DATOS_PRECARGADOS); }, 60);
    return;
  }
  google.script.run.withSuccessHandler(ok).withFailureHandler(mal)
    .getDashboardData(ini, fin);
}

/* --------------------------------------------------------------- tema */
function aplicarTema(t) {
  document.documentElement.setAttribute('data-tema', t);
  try { localStorage.setItem('welli-tema', t); } catch (e) {}
  if (D) render();     // las gráficas leen los colores por variable CSS
}

/* --------------------------------------------------------------- init */
document.addEventListener('DOMContentLoaded', function () {
  // Prioridad del tema: lo que el usuario eligió aquí > el tema que el
  // contenedor ya impuso (data-theme, cuando el tablero va embebido) >
  // la preferencia del sistema.
  var raiz = document.documentElement;
  var host = raiz.getAttribute('data-theme');
  var t = (host === 'dark') ? 'oscuro' : (host === 'light' ? 'claro' : null);
  try {
    t = localStorage.getItem('welli-tema') || t;
  } catch (e) {}
  if (!t) {
    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'oscuro' : 'claro';
  }
  raiz.setAttribute('data-tema', t);

  document.getElementById('btnTema').addEventListener('click', function () {
    aplicarTema(document.documentElement.getAttribute('data-tema') === 'oscuro'
      ? 'claro' : 'oscuro');
  });
  document.getElementById('btnAplicar').addEventListener('click', cargar);
  // Aplicar también al cambiar cualquiera de las dos fechas.
  ['fDesde', 'fHasta'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', cargar);
  });
  document.querySelectorAll('.nav-item').forEach(function (b) {
    b.addEventListener('click', function () { irA(b.getAttribute('data-vista')); });
  });

  irA(vistaDelHash(), true);
  window.addEventListener('hashchange', function () { irA(vistaDelHash(), true); });

  aplicarPreset('3m');     // arranca en los últimos 3 meses
});
