
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
  // toFixed devuelve punto decimal: en Colombia el separador es la coma, y
  // quedaba "$2.6 mil M" al lado de un "16,4%" en la misma tarjeta.
  function un(x) { return x.toFixed(1).replace('.', ','); }
  if (n >= 1e12) return s + '$' + un(n / 1e12) + ' B';
  if (n >= 1e9) return s + '$' + un(n / 1e9) + ' mil M';
  if (n >= 1e6) return s + '$' + un(n / 1e6) + ' M';
  if (n >= 1e3) return s + '$' + fNum(Math.round(n / 1e3)) + 'k';
  return s + '$' + fNum(Math.round(n));
}
function fPct(v) {
  if (v === null || v === undefined || v === '') return '--';
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + '%';
}
function fCompacto(v) {
  var n = Number(v || 0);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + 'M';
  if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(Math.round(n));
}
function fmt(v, f) {
  if (f === 'cop') return fCop(v);
  if (f === 'copC') return fCopC(v);      // montos grandes: $208,2 mil M
  if (f === 'pct') return fPct(v);
  // multiplo: "49,5x". Un decimal, porque la parte entera sola pierde
  // demasiado cuando el numero es chico.
  if (f === 'x') return fNum(Math.round(Number(v) * 10) / 10) + 'x';
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
      esc(String(d.etiqueta).substring(0, opt.maxEtiqueta || 24)) + '</text>';
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

/* Version C-Level: la tarjeta no lleva parrafo adentro. La nota deja de
   ser un badge visible y pasa al title de la tarjeta, asi que el dato flojo
   sigue trazable al pasar el mouse pero no compite con el numero. */
function tarjetaKPI(k) {
  var ayuda = k.notaLarga || k.nota || '';
  var h = '<div class="kpi" data-color="' + esc(k.color) + '"' +
    (ayuda ? ' title="' + esc(ayuda) + '"' : '') + '>';
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
    h += '<span class="foto">sin dato todavía</span>';
  } else if (k.delta === null || k.delta === undefined) {
    h += '<span class="foto">foto de hoy · sin comparativo</span>';
  } else {
    // Para CPL menos es mejor: se invierte el color, no el signo.
    var bueno = k.deltaInvertido ? (k.delta < 0) : (k.delta > 0);
    var cls = k.delta === 0 ? 'plano' : (bueno ? 'sube' : 'baja');
    var flecha = k.delta === 0 ? '=' : (k.delta > 0 ? '▲' : '▼');
    // Si el KPI ya es un porcentaje, la variacion va en puntos: un "% de %"
    // es ilegible y se malinterpreta siempre.
    var unidad = k.deltaEnPuntos ? ' pp' : '%';
    var contra = k.deltaEtiqueta || 'vs per. anterior';
    h += '<div class="delta ' + cls + '">' + flecha + ' ' +
      (k.delta > 0 ? '+' : '') + fNum(k.delta) + unidad +
      ' <small>' + esc(contra) + '</small></div>';
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
  /* La fecha va visible a proposito: estos textos los escribe el equipo a
     mano y se desincronizan de los KPIs. El de F4 llego a decir 170 firmas
     donde la tarjeta decia 52. Si la fecha esta vieja, hay que releerlos. */
  return '<h2 class="sec">Lectura del frente</h2>' +
    (t.fecha ? '<p class="sec-sub">escrito el ' + esc(t.fecha) + '</p>' : '') +
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

/* Cosechas con menos sedes que esto no se pintan ni fijan la escala: con
   6 u 8 sedes, que una firme ya es 16% y se ve tan intenso como una
   cosecha de 80 con 13 firmas. Es ruido, no desempeno. */
var MIN_COSECHA = 20;

/* Tope de la escala: el maximo de valor-por-sede, ignorando las cosechas
   de muestra baja. Asi el color es comparable entre cosechas de verdad,
   que es justo lo que uno quiere mirar en una tabla de cohortes. */
function topePorSede(filas) {
  var max = 0;
  (filas || []).forEach(function (f) {
    if (!f.n || f.n < MIN_COSECHA) return;
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

function tablaCohorte(filas, offsets, formato, titulo, sub, clase, etiquetaEscala, colN, pctCelda) {
  if (!filas || !filas.length) return '';
  var tope = topePorSede(filas);
  var h = '<div class="panel"><h3>' + esc(titulo) + '</h3>' +
    '<p class="sub">' + esc(sub) + '</p><div class="tabla-wrap">' +
    '<table class="t"><thead><tr><th>Cosecha</th><th>' + esc(colN || 'Sedes') + '</th>';
  for (var m = 0; m <= offsets; m++) h += '<th>M' + m + '</th>';
  h += '</tr></thead><tbody>';
  var hayBajas = false;
  filas.forEach(function (f) {
    var baja = !f.n || f.n < MIN_COSECHA;
    if (baja) hayBajas = true;
    h += '<tr><td>' + esc(f.cosecha) +
      (baja ? ' <span class="cel-vacia" style="font-size:10px">muestra baja</span>' : '') +
      '</td><td>' + fNum(f.n) + '</td>';
    (f.celdas || []).forEach(function (c) {
      // null = mes que todavia no ocurrio. Se deja vacio, no en cero.
      if (c === null || c === undefined) {
        h += '<td class="cel-vacia">·</td>';
        return;
      }
      // Las cosechas de muestra baja van sin color: pintarlas sugiere una
      // intensidad que el tamano de la muestra no sostiene.
      // El % del total de la cosecha: es EXACTAMENTE lo que define la
      // intensidad del color, asi que escribirlo hace legible el mapa en vez
      // de obligar a estimar el tono.
      var pc = f.n ? Math.round((c / f.n) * 1000) / 10 : 0;
      var extra = pctCelda
        ? '<span class="cel-pct">' + esc(fPct(pc)) + '</span>' : '';
      if (baja) {
        h += '<td class="cel-vacia">' + esc(formato(c)) + extra + '</td>';
        return;
      }
      var paso = pasoCalor(c, f.n, tope);
      var porSede = c / f.n;
      var titulo2 = f.cosecha + ' · ' + formato(c) + ' de ' + fNum(f.n) +
        ' (' + fPct(pc) + ')';
      h += '<td class="hm hm-' + clase + '-' + paso + '" title="' + esc(titulo2) + '">' +
        esc(formato(c)) + extra + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>' +
    leyendaCalor(clase, etiquetaEscala || 'intensidad por sede de la cosecha') +
    (hayBajas
      ? '<p class="sub" style="margin:6px 0 0">Las cosechas con menos de ' +
        MIN_COSECHA + ' sedes van en gris y no entran en la escala: con esa ' +
        'muestra, una sola firma mueve el porcentaje demasiado.</p>'
      : '') +
    '</div>';
  return h;
}


/* Granularidad de la pauta: el usuario elige dia o mes sin recargar. Con un
   rango de un mes, "por mes" da una sola barra; con dos meses, dos. El
   estado vive aca porque no depende del servidor: la serie diaria ya viene
   y el mes se agrega en el cliente. */
var GRAN_PAUTA = 'dia';
function setGranPauta(g) {
  GRAN_PAUTA = g;
  if (D) render();
}

/** Agrupa una serie diaria por mes sumando, o la devuelve tal cual. */
function serieSegunGran(serie, campo) {
  var pts = (serie || []).map(function (p) {
    return { x: p.x, y: p[campo], leads: p.leads, gasto: p.gasto };
  });
  if (GRAN_PAUTA !== 'mes') return pts;
  var ag = {};
  (serie || []).forEach(function (p) {
    var m = String(p.x).substring(0, 7);
    if (!ag[m]) ag[m] = { x: m, leads: 0, gasto: 0 };
    ag[m].leads += Number(p.leads || 0);
    ag[m].gasto += Number(p.gasto || 0);
  });
  return Object.keys(ag).sort().map(function (m) {
    var b = ag[m];
    // El CPL de un mes es gasto/leads del mes, NO el promedio de los CPL
    // diarios: promediar razones da un numero que no existe.
    b.cpl = b.leads ? Math.round(b.gasto / b.leads) : 0;
    b.y = b[campo];
    return b;
  });
}

function botonesGran(id) {
  return '<div class="gran-sel" data-gran="' + id + '">' +
    '<button type="button" data-g="dia" aria-pressed="' +
      (GRAN_PAUTA === 'dia' ? 'true' : 'false') + '">Día</button>' +
    '<button type="button" data-g="mes" aria-pressed="' +
      (GRAN_PAUTA === 'mes' ? 'true' : 'false') + '">Mes</button>' +
    '</div>';
}

function panelGraf(titulo, sub, idGraf) {
  return '<div class="panel">' +
    '<div class="panel-head"><div>' +
    '<h3>' + esc(titulo) + '</h3>' +
    '<p class="sub" style="margin:0">' + esc(sub) + '</p>' +
    '</div></div>' +
    '<div class="grafica" id="' + idGraf + '"></div></div>';
}

function panelGran(titulo, sub, id, idGraf) {
  return '<div class="panel">' +
    '<div class="panel-head"><div>' +
    '<h3>' + esc(titulo) + '</h3>' +
    '<p class="sub" style="margin:0">' + esc(sub) + '</p>' +
    '</div>' + botonesGran(id) + '</div>' +
    '<div class="grafica" id="' + idGraf + '"></div></div>';
}

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
  h += cintaOrigen();

  /* El equivalente de la tabla de cosechas pero un paso ANTES: en el
     pipeline comercial, cuando todavia es un negocio y no una sede. Dice
     cuantos deals entraron cada mes y cuantos se fueron cerrando ganados. */
  var dc = f.dealsCohorte || {};
  if (dc.hay && (dc.filas || []).length) {
    h += '<h2 class="sec">1 · Los deals que entraron, ¿se cierran?</h2>' +
      '<p class="sec-sub">negocios de HubSpot por mes de creación y cuántos llegaron a ' +
      'cierre ganado · ' + esc(dc.universo || '') +
      (dc.excluidos ? ' · se excluyen los cerrados perdidos por ' +
        esc(dc.excluidos) : '') + '</p>';
    h += tablaCohorte(dc.filas, dc.offsets, fNum,
      'Deals ganados · acumulado',
      'De los deals que entraron ese mes, cuántos ya están en cierre ganado al mes N. ' +
      'Solo sube.',
      'acum', '% del mes que ya cerró ganado', 'Deals', true);
  }

  if ((em.kpis || []).length) {
    // El titulo no lleva el nombre del origen: la etiqueta viene en
    // mayusculas del catalogo de HubSpot ("que trajo EVENTO") y se lee mal.
    // El universo va en el subtitulo, que ya es explicito.
  // --- 1. Cuántas clínicas nuevas, y cuántas las trajo marketing ------
  if (f.shareKpi) {
    var sm = f.shareMkt || {};
    h += '<h2 class="sec">2 · ¿Cuántas sedes ganamos?</h2>' +
      '<p class="sec-sub">sedes creadas cada mes en todo el negocio, y cuántas trajo ' +
      'marketing</p>';
    /* La tarjeta lleva el total arriba y el aporte de marketing destacado
       debajo: el porcentaje es el titular del frente y tiene que leerse de
       un golpe, sin buscarlo en una tabla. */
    // Se inserta antes del ULTIMO </div>, que es el cierre de la tarjeta.
    // Con replace() normal caeria en el primer </div> — el del label — y el
    // bloque saldria arriba y heredando el estilo de la etiqueta.
    var htmlKpi = tarjetaKPI(f.shareKpi);
    var tarjeta = htmlKpi;
    // El desglose solo va cuando el motor lo manda: con el filtro en
    // marketing seria "100 de 100" y con el filtro en Farmer un cero.
    if (f.shareMkt) {
      var corte = htmlKpi.lastIndexOf('</div>');
      tarjeta = htmlKpi.substring(0, corte) +
        '<div class="kpi-parte">' +
        '<span class="n">' + fNum(sm.sedes || 0) + '</span>' +
        '<span class="pc">' + fPct(sm.pct || 0) + '</span>' +
        '<span class="l">' + esc(sm.etiqueta || '') + '</span>' +
        '</div>' + htmlKpi.substring(corte);
    }
    h += '<div class="grid2">' +
      '<div class="kpis">' + tarjeta + '</div>' +
      panel('Sedes nuevas por mes',
        'total del negocio contra las que trajo marketing',
        leyenda([{ nombre: 'Todos los orígenes', color: 'var(--s1)' },
                 { nombre: 'Marketing', color: 'var(--s2)' }]), 'gF1Share') +
      '</div>';
    pintar('gF1Share', function (el) {
      var sh = f.share || [];
      chGrupos(el, sh.map(function (x) { return x.mes; }), [
        { nombre: 'Todos los orígenes', color: 'var(--s1)',
          valores: sh.map(function (x) { return x.todas; }) },
        { nombre: 'Marketing', color: 'var(--s2)',
          valores: sh.map(function (x) { return x.mktReal; }) }
      ], { gran: 'mes', formato: fNum, alto: 200 });
    });
    if (f.shareLectura) h += '<div class="lectura">' + esc(f.shareLectura) + '</div>';
  }

  // --- 3. Las clínicas que entraron y de qué calidad ------------------
  var cos = f.cosechas || [];
  var comp = f.composicion || {};
  h += '<h2 class="sec">3 · Las clínicas que entraron y de qué calidad</h2>' +
    '<p class="sec-sub">la clasificación de aliado decide si la sede recibe gestión ' +
    'dedicada</p>';
  /* Dona en vez de barras: son cuatro clases que suman un todo con
     significado (el universo elegido), y el total va al centro. La clase A
     no viene como columna en HubSpot — es la resta del universo menos AA,
     AAA y las que no tienen clasificación. */
  /* Dos donas del MISMO mes que la tarjeta de arriba: las que entraron y,
     al lado, las que trajo marketing. Puestas juntas y con las mismas
     categorias, se lee de un golpe si marketing trae mejor o peor calidad
     que el resto — que es la pregunta del frente. */
  var COLCL = { 'AAA': 'var(--s3)', 'AA': 'var(--s2)', 'A': 'var(--s1)',
                'Sin clasificar': 'var(--borde-fuerte)' };
  function pintarTorta(id, datos, n, sub) {
    pintar(id, function (el) {
      chTorta(el, (datos || []).map(function (r) {
        return { etiqueta: r.clase, y: r.n, color: COLCL[r.clase] || 'var(--s4)' };
      }), { alto: 220, formato: fNum, centroSub: sub,
        detalle: function (d) {
          return [{ nombre: 'Sedes', valor: fNum(d.y) },
                  { nombre: 'del total del mes', valor: fPct(n ? Math.round((d.y / n) * 1000) / 10 : 0) }];
        } });
    });
  }
  if (comp) {
    h += '<div class="grid2">' +
      panel('Las ' + fNum(comp.todas.n) + ' que entraron en ' + esc(comp.mes),
        'todos los orígenes, por clasificación de aliado', '', 'gF1Torta') +
      // Sin el desglose por canal: el reparto por origen ya va completo en
      // la tabla de la seccion 4, y repetirlo aca solo lo desactualiza.
      panel('Las ' + fNum(comp.mkt.n) + ' que trajo marketing',
        fPct(comp.mkt.pct) + ' del mes · por clasificación de aliado',
        '', 'gF1TortaMkt') +
      '</div>';
    pintarTorta('gF1Torta', comp.todas.filas, comp.todas.n, 'sedes nuevas de ' + comp.mes);
    pintarTorta('gF1TortaMkt', comp.mkt.filas, comp.mkt.n, 'de marketing');
  }
  // --- Cohortes de deals de HubSpot ---------------------------------
    h += '<h2 class="sec">4 · ¿En qué termina la demanda que entró?</h2>' +
      '<p class="sec-sub">' + (em.cohorte
        ? 'doble corte: las ' + fNum(em.sedes) + ' sedes que entraron en el ' +
          'período (' + esc(em.mes) + ') y los créditos que radicaron en el ' +
          'período · ' + esc(em.universo || '')
        : 'de los créditos radicados en el período · ' + esc(em.universo || '')) +
      '</p>';
    h += filaKPIs(em.kpis);

    // Sin esta linea la seccion se lee como el total del mes. No lo es: es
    // solo la cosecha nueva, y pesa ~1%. Decirlo aqui evita el malentendido
    // y de paso es el mejor argumento para el frente 2.
    if (em.contexto) {
      h += '<div class="lectura">Es la cosecha nueva, no el mes completo: ' +
        'estas ' + fNum(em.sedes) + ' sedes pusieron ' + fPct(em.contexto.pctMonto) +
        ' de la plata del período (' + fCopC(em.contexto.monto) + ' en total, ' +
        fNum(em.contexto.sol) + ' solicitudes). Los otros ' +
        fCopC(em.contexto.montoResto) + ' los pusieron sedes que entraron en meses ' +
        'anteriores — por eso el negocio se sostiene en el stock, no en la ' +
        'adquisición del mes.</div>';
    }

    if (em.hay) {
      // El embudo y el monto diario no aportaban: el embudo repetia los tres
      // numeros que ya estan en las tarjetas, y el monto diario de una
      // cosecha nueva son 13 barras dispersas sobre 31 dias.
      // Share de la plata por origen. Los origenes van aunque pongan cero: un
      // origen que trajo sedes y no puso plata es informacion.
      if ((em.canales || []).length) {
        h += '<div style="margin-top:14px">' +
          panel('¿De qué origen salió esa plata?',
            fCopC(em.montoCanales) + ' de la cosecha del período, repartidos por ' +
            'el origen de la sede · sede lograda = sede que firmó al menos un ' +
            'crédito',
            tabla([
              { t: 'Origen', k: 'canal', f: 'txt', txt: true },
              { t: 'Solicitudes', k: 'sol' },
              { t: 'Aprobados', k: 'apr' },
              { t: 'Desembolsos', k: 'des' },
              { t: 'Conv', k: 'conv', f: 'pct' },
              { t: 'Sedes logradas', k: 'sedes' },
              { t: 'Plata', k: 'monto', f: 'cop' },
              { t: 'Plata/sede', k: 'porSede', f: 'cop' },
              { t: 'Ticket', k: 'ticket', f: 'cop' },
              { t: '% de la plata', k: 'pct', f: 'pct' }
            ], em.canales)) +
          '</div>';
      }
    }
  }

  // --- 2. La pauta ---------------------------------------------------
  h += '<h2 class="sec">5 · La pauta: ¿cuánto nos cuesta un lead?</h2>' +
    '<p class="sec-sub">Meta Ads · no depende del origen de la sede</p>';
  h += filaKPIs((f.kpis || []).slice(0, 3));

  h += '<div class="grid2" style="margin-top:14px">' +
    panelGran('Leads', 'formularios de pauta', 'leads', 'gF1Leads') +
    panelGran('Costo por lead', 'COP — menos es mejor', 'cpl', 'gF1Cpl') +
    '</div>';
  pintar('gF1Leads', function (el) {
    chBarras(el, serieSegunGran(f.serie, 'leads'),
      { color: 'var(--s2)', nombre: 'Leads', gran: GRAN_PAUTA === 'mes' ? 'mes' : 'dia',
        formato: fNum,
        vacio: 'Sin datos de Meta Ads en el período' });
  });
  pintar('gF1Cpl', function (el) {
    chLinea(el, serieSegunGran(f.serie, 'cpl'),
      { color: 'var(--s1)', nombre: 'CPL', gran: GRAN_PAUTA === 'mes' ? 'mes' : 'dia',
        formato: fCop,
        formatoEje: fCopC, vacio: 'Sin datos de Meta Ads en el período' });
  });
  var kImp = (f.kpis || [])[3], kCtr = (f.kpis || [])[4];
  if (kImp && kCtr && kImp.valor !== null) {
    h += '<p class="sec-sub" style="margin-top:8px">Alcance de la pauta en el período: ' +
      esc(fNum(kImp.valor)) + ' impresiones, CTR ' + esc(fPct(kCtr.valor)) + '.</p>';
  }

  // El CPL no dice si la pauta sirvio: dice que cuesta un formulario. Esto
  // cierra el ciclo hasta la plata que pusieron las sedes que ese gasto trajo.
  var rt = f.retorno;
  if (rt) {
    h += '<h3 class="sub-sec" style="margin-top:20px">¿Y qué devolvió esa pauta?</h3>' +
      '<p class="sec-sub">la campaña es a médicos, así que las sedes de origen ' +
      'social media son el resultado de ese gasto · cosecha de ' + esc(rt.mes) + '</p>';
    h += filaKPIs(rt.kpis);
  }

  var sinF = (f.canalesSinFuente || []).filter(function (c) {
    return c.detalle !== 'conectada' && c.canal.indexOf('Pauta') !== 0;
  });
  if (sinF.length) {
  }

  var ac = f.activacion;
  if (ac) {
    // GLOBAL, no el subconjunto de marketing: la pregunta es si las sedes
    // que entraron arrancan, sin importar quien las trajo.
    h += '<h2 class="sec">6 · De las sedes que entraron, ¿cuántas arrancaron?</h2>' +
      '<p class="sec-sub">cosecha de ' + esc(ac.mes) + ' · todos los orígenes · ' +
      'activa = radicó al menos una solicitud en el mes · exitosa = 3 o más ' +
      'solicitudes, o ya con desembolso</p>';
    h += filaKPIs(ac.kpisTodas || ac.kpis);
    h += '<div class="grid2" style="margin-top:14px">' +
      panel('De nuevas a exitosas',
        'las ' + fNum(ac.todas.total) + ' sedes que entraron en ' + esc(ac.mes) +
        (ac.todas.sinId
          ? ' · ' + fNum(ac.todas.sinId) + ' sin id_internal, no verificables'
          : ''),
        '', 'gF1Act') +
      '</div>';
    pintar('gF1Act', function (el) {
      chBarrasH(el, (ac.pasosTodas || ac.pasos || []).map(function (p) {
        return { etiqueta: p.etapa, y: p.valor, d: p };
      }), { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 110,
        detalle: function (d) {
          return [{ nombre: 'Sedes', valor: fNum(d.d.valor) },
                  { nombre: '% de las nuevas del mes', valor: fPct(d.d.pct) }];
        } });
    });
  }

  h += cuali(f.textos);
  return h;
}

/* Un mapa de cohorte de profundizacion. Recibe la especificacion que armo
   el motor (D.f2.mapas[n]) para no acabar con una firma de diez argumentos
   posicionales.

/* Grupo con el que se comparan los mapas de profundizacion. Vive aparte de
   los filtros globales a proposito: no cambia el universo del tablero, solo
   agrega un segundo grupo a estas seis tablas. Meterlo arriba con los otros
   haria pensar que filtra todo. */
var CMP_F2 = '';
function setComparar(v) {
  CMP_F2 = v || '';
  cargar();
}

/* Un mapa de cohorte. Si hay comparacion, cada cosecha trae dos filas — el
   grupo A y el grupo B — para poder leer la misma columna M hacia abajo. Al
   final va el promedio de cada grupo.

   Cada celda lleva el numero Y su porcentaje sobre la cosecha, porque el
   porcentaje es EXACTAMENTE lo que define la intensidad del color. En el mapa
   de plata el segundo dato es el monto, que es la unidad que importa ahi. */
function mapaCohorte(m) {
  var filas = m.filas || [];
  if (!filas.length) {
    return '<div class="panel"><h3>' + esc(m.orden + ' · ' + m.titulo) + '</h3>' +
      '<div class="vacio-graf">Sin cosechas en este universo</div></div>';
  }
  var cmp = (D.f2 && D.f2.comparar) || {};
  var hayB = !!(cmp.activo && (m.filasB || []).length);
  var offs = (m.offsets === undefined ? 7 : m.offsets);

  // La escala de color se calcula sobre los DOS grupos: con una escala por
  // grupo, un 40% de marketing y un 40% de comercial saldrian de distinto
  // tono y la comparacion visual mentiria.
  var tope = topePorSede(hayB ? filas.concat(m.filasB) : filas);

  var h = '<div class="panel"><h3>' + esc(m.orden + ' · ' + m.titulo) + '</h3>' +
    '<p class="sub"><b>' + esc(m.pregunta) + '</b> ' + esc(m.def) + '. ' +
    esc(m.sub) + '</p><div class="tabla-wrap">' +
    '<table class="t"><thead><tr><th>Cosecha</th>' +
    (hayB ? '<th>Grupo</th>' : '') +
    '<th>' + esc(m.colN || 'Sedes') + '</th>';
  for (var k = 0; k <= offs; k++) h += '<th>M' + k + '</th>';
  h += '</tr></thead><tbody>';

  var hayBajas = false;

  /** Una fila de la tabla. base = sedes contra las que se saca el %. */
  function fila(f, etiqueta, clase, esProm) {
    var baja = !esProm && (!f.n || f.n < MIN_COSECHA);
    if (baja) hayBajas = true;
    var h2 = '<tr' + (clase ? ' class="' + clase + '"' : '') + '>';
    h2 += '<td>' + esc(esProm ? 'Promedio' : f.cosecha) +
      (baja ? ' <span class="cel-vacia" style="font-size:10px">muestra baja</span>' : '') +
      '</td>';
    if (hayB) h2 += '<td class="txt cel-grupo">' + esc(etiqueta || '') + '</td>';
    h2 += '<td>' + fNum(f.n) + '</td>';
    (f.celdas || []).forEach(function (c, i) {
      if (c === null || c === undefined) { h2 += '<td class="cel-vacia">·</td>'; return; }
      // En el promedio el % sale de la base agrupada, no del n de una cosecha.
      var den = esProm && f.base ? f.base[i] : f.n;
      var pc = den ? Math.round((c / den) * 1000) / 10 : 0;
      var segundo = '';
      if (m.conMonto) {
        var mo = (f.extras || [])[i];
        segundo = '<span class="cel-pct">' + esc(mo ? fCopC(mo) : '$0') + '</span>';
      } else if (m.pctCelda) {
        segundo = '<span class="cel-pct">' + esc(fPct(pc)) + '</span>';
      }
      if (baja) {
        h2 += '<td class="cel-vacia">' + esc(fNum(c)) + segundo + '</td>';
        return;
      }
      var paso = pasoCalor(c, den, tope);
      var tt = (esProm ? 'Promedio' : f.cosecha) +
        (etiqueta ? ' · ' + etiqueta : '') + ' · M' + i + ' · ' +
        fNum(c) + ' de ' + fNum(den) + ' (' + fPct(pc) + ')' +
        (esProm && f.cuantas ? ' · ' + fNum(f.cuantas[i]) + ' cosechas' : '') +
        (m.conMonto && (f.extras || [])[i] ? ' · ' + fCop(f.extras[i]) : '');
      h2 += '<td class="hm hm-' + m.clase + '-' + paso + '" title="' + esc(tt) + '">' +
        esc(fNum(c)) + segundo + '</td>';
    });
    return h2 + '</tr>';
  }

  if (hayB) {
    // Intercaladas por cosecha: es la unica disposicion en la que se compara
    // sin mover los ojos por la pantalla.
    var porCos = {};
    filas.forEach(function (f) { (porCos[f.cosecha] = porCos[f.cosecha] || {}).a = f; });
    (m.filasB || []).forEach(function (f) {
      (porCos[f.cosecha] = porCos[f.cosecha] || {}).b = f;
    });
    Object.keys(porCos).sort().forEach(function (c) {
      var par = porCos[c];
      if (par.a) h += fila(par.a, cmp.etiquetaA, 'cmp-a');
      if (par.b) h += fila(par.b, cmp.etiquetaB, 'cmp-b');
    });
    if (m.promedio) h += fila(m.promedio, cmp.etiquetaA, 'fila-prom cmp-a', true);
    if (m.promedioB) h += fila(m.promedioB, cmp.etiquetaB, 'fila-prom cmp-b', true);
  } else {
    filas.forEach(function (f) { h += fila(f, '', ''); });
    if (m.promedio) h += fila(m.promedio, '', 'fila-prom', true);
  }

  h += '</tbody></table></div>' +
    leyendaCalor(m.clase, m.escala || 'intensidad por sede de la cosecha') +
    '<p class="sub" style="margin:6px 0 0">' +
    (m.conMonto
      ? 'El promedio es por cosecha: la suma dividida por cuántas llegaron a ese mes.'
      : 'El promedio es la tasa agrupada — el total sobre el total de sedes de las ' +
        'cosechas que llegaron a ese mes, no el promedio de los porcentajes.') +
    (hayBajas
      ? ' Las cosechas con menos de ' + MIN_COSECHA + ' sedes van en gris y no ' +
        'entran en la escala: con esa muestra, una sola sede mueve el porcentaje ' +
        'demasiado.'
      : '') +
    '</p></div>';
  return h;
}

/* Frente 2 reducido a lo que pregunta de verdad: la vida de una cosecha,
   contada en cinco mapas y en orden. Arrancan -> arrancan de verdad -> se
   enfrian -> cuanta plata dejan -> se pierden.

   Todo el frente responde al filtro global de origen: es de TODAS las
   sedes, y marketing es un filtro mas. */
function vistaF2() {
  var f = D.f2;

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 2 · profundización</div>' +
    '<h1>¿Qué le pasa a una cosecha después de entrar?</h1>' +
    '<p class="lead">Traer una sede no es el resultado. El resultado es que siga ' +
    'radicando seis meses después — y saber en qué mes se cae.</p>' +
    '</div>';
  h += cintaOrigen();

  if (!f.hay) {
    h += '<div class="vacio-graf">No hay cosechas en este universo. ' +
      'Prueba con otro origen.</div>';
    return h;
  }

  // El comparador va ACA, dentro del frente, y no en la barra de filtros: no
  // cambia el universo del tablero, solo agrega un segundo grupo a estas seis
  // tablas. Arriba se leeria como un filtro global mas.
  var cmp = f.comparar || {};
  if ((cmp.opciones || []).length) {
    h += '<div class="cmp-barra">' +
      '<span class="cmp-tit">Comparar contra</span>' +
      '<button class="cmp-chip' + (!cmp.activo ? ' on' : '') +
      '" onclick="setComparar(\'\')">sin comparar</button>' +
      cmp.opciones.map(function (o) {
        return '<button class="cmp-chip' + (cmp.clave === o.clave ? ' on' : '') +
          '" onclick="setComparar(\'' + esc(o.clave) + '\')">' +
          esc(o.nombre) + ' <small>' + fNum(o.sedes) + '</small></button>';
      }).join('') +
      (cmp.activo
        ? '<span class="cmp-leyenda"><i class="a"></i>' + esc(cmp.etiquetaA) +
          '<i class="b"></i>' + esc(cmp.etiquetaB) + '</span>'
        : '') +
      '</div>';
  }

  h += '<p class="sec-sub">M0 es el mes en que se creó la sede, M1 el siguiente. ' +
    'Un punto quiere decir que ese mes todavía no ha ocurrido. Universo: ' +
    esc(f.universo || '') + ' · ' + fNum(f.cosechas) + ' cosechas' +
    (f.sinId ? ' · ' + fNum(f.sinId) + ' sedes sin id_internal quedan fuera de los ' +
      'mapas porque no hay llave para cruzarlas contra la plataforma' : '') +
    '. ' + esc(f.notaCarga || '') + '</p>';

  (f.mapas || []).forEach(function (m) {
    m.offsets = f.offsets;
    h += '<div style="margin-top:14px">' + mapaCohorte(m) + '</div>';
  });

  h += cuali(f.textos);
  return h;
}

/* Frente 4 · Rescate. Dos preguntas y nada mas:
     1. de lo que el motor aprobo, cuanto cerramos — por ventana
     2. que hicimos y que logramos, contra el periodo anterior

   Se quito la seccion de "plata sobre la mesa": era un STOCK historico de
   15.845 aprobados sin firmar. No es meta de nadie, no se mueve con nada que
   se haga este mes, y su tamano ($190 mil M) hacia ver irrelevante a todo lo
   demas. */
function vistaF4() {
  var f = D.f4, g = D.meta.agrupacion;
  var op = f.oportunidad || {};
  var ac = f.acciones || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 4 · rescate</div>' +
    '<h1>De lo que el motor aprobó, ¿cuánto cerramos?</h1>' +
    '<p class="lead">El crédito aprobado vive 30 días. Rescatar es convencer al ' +
    'paciente de firmar antes de que se le venza — y cada especialidad decide en ' +
    'una ventana distinta.</p>' +
    '</div>';
  h += cintaOrigen();

  if (!op.hay) {
    h += '<div class="vacio-graf">No hay créditos aprobados en este período y ' +
      'universo.</div>';
    return h;
  }

  // --- 1. La oportunidad y el cierre, por ventana ---------------------
  h += '<h2 class="sec">1 · La oportunidad y lo que cerramos</h2>' +
    '<p class="sec-sub">de los créditos APROBADOS en el período, cuántos se ' +
    'firmaron · el mismo grupo de créditos arriba y abajo de la división · ' +
    esc(op.universo || '') + '</p>';
  h += filaKPIs(op.kpis || []);

  h += '<div style="margin-top:14px">' +
    panel('Cada ventana cierra distinto',
      'la ventana la define la especialidad de la sede · el cambio del cierre va ' +
      'en puntos contra el período anterior',
      tabla([
        { k: 'ventana', t: 'Ventana', f: 'txt', txt: true },
        { k: 'apr', t: 'Aprobados' },
        { k: 'firm', t: 'Firmados' },
        { k: 'pctT', t: 'Cierre', f: 'txt' },
        { k: 'dPctT', t: 'vs per. ant.', f: 'txt' },
        { k: 'mApr', t: 'Plata aprobada', f: 'cop' },
        { k: 'mFirm', t: 'Plata firmada', f: 'cop' },
        { k: 'mSinCerrar', t: 'Sin cerrar', f: 'cop' }
      ], (op.filas || []).map(function (r) {
        var y = {}; for (var k in r) y[k] = r[k];
        y.pctT = fPct(r.pct);
        y.dPctT = r.dPct === null ? '--'
          : (r.dPct > 0 ? '+' : '') + fNum(r.dPct) + ' pp';
        return y;
      }))) +
    '</div>';

  // El comportamiento declarado de cada ventana al lado de su cierre medido:
  // es lo que convierte la tabla en una guia de que pieza mandar a quien.
  var conV = (op.filas || []).filter(function (r) { return r.id !== '-'; });
  if (conV.length) {
    var COLV = { C: 'var(--s1)', B: 'var(--s2)', A: 'var(--s3)' };
    h += '<div class="grid3" style="margin-top:4px">' + conV.map(function (r) {
      return '<div class="panel" style="border-top:3px solid ' +
        (COLV[r.id] || 'var(--borde)') + '">' +
        '<h3>' + esc(r.id + ' · ' + r.nombre) + '</h3>' +
        '<p class="sub">' + esc(r.especialidades) + '</p>' +
        '<p style="margin:0 0 10px;font-size:13.5px;color:var(--texto-2);' +
        'line-height:1.5">' + esc(r.comportamiento) + '</p>' +
        '<div class="flujo">' +
        '<div class="paso"><div class="n">' + fPct(r.pct) + '</div>' +
        '<div class="l">cierra</div></div>' +
        '<div class="paso"><div class="n">' + fCopC(r.mSinCerrar) + '</div>' +
        '<div class="l">sin cerrar</div></div>' +
        '<div class="paso"><div class="n">' +
        (r.dPct === null ? '--' : (r.dPct > 0 ? '+' : '') + fNum(r.dPct) + ' pp') +
        '</div><div class="l">vs per. anterior</div></div>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  var vt = f.ventana || {};
  if (vt.lectura) h += '<div class="lectura">' + esc(vt.lectura) + '</div>';

  // --- 2. Que hicimos y que logramos ---------------------------------
  h += '<h2 class="sec">2 · Qué hicimos y qué logramos</h2>' +
    '<p class="sec-sub">' + esc(ac.etiquetaPeriodo || '') + ' contra ' +
    esc(ac.etiquetaPrev || '') + '</p>';

  if (ac.sinAccion) h += '<div class="lectura">' + esc(ac.notaSinAccion) + '</div>';

  h += '<div style="margin-top:10px">' +
    panel('Acción y resultado, lado a lado',
      'las acciones de rescate de 2026 son los workflows long tail · las campañas ' +
      'de Hilos se detuvieron en nov-2025',
      tablaAccion(ac.filas || [], ac)) +
    '</div>';

  if ((ac.piezas || []).length) {
    h += '<div style="margin-top:12px">' +
      panel('Las piezas que salieron en el período', 'del log de envíos de HubSpot',
        tabla([
          { k: 'pieza', t: 'Pieza', f: 'txt', txt: true },
          { k: 'canal', t: 'Canal', f: 'txt' },
          { k: 'audiencia', t: 'Audiencia', f: 'txt' },
          { k: 'sedes', t: 'Sedes impactadas' }
        ], ac.piezas)) +
      '</div>';
  }

  // --- 3. La gestion humana: que hizo el equipo y que se recupero -----
  var ge = f.gestion || {};
  if (ge.hay) {
    h += '<h2 class="sec">3 · La gestión: qué hicimos y qué se recuperó</h2>' +
      '<p class="sec-sub">la operación humana sobre pacientes con crédito ' +
      'aprobado sin firmar — la lista diaria que trabaja el equipo de rescate' +
      (ge.fuenteViva
        ? ' · ' + esc(ge.etiquetaPeriodo) + ' contra ' + esc(ge.etiquetaPrev)
        : '') +
      '</p>';

    // Si el filtro global esta puesto y la fuente no trae sede, se dice.
    if (ge.filtroImposible) {
      h += '<div class="aviso-foto">Esta sección <b>no responde al filtro ' +
        'global</b>: la fuente de rescate todavía no trae el nombre de la ' +
        'sede, así que no hay por dónde cruzarla. Los números son de toda la ' +
        'operación.</div>';
    }

    if (!ge.fuenteViva && ge.foto) {
      h += '<div class="aviso-foto"><b>Foto del ' + esc(ge.foto.fecha) +
        ', sin fuente viva todavía.</b> Las tablas de ' +
        'welli-growth.rescate aún no entran al refresh diario, así que estos ' +
        'números no se mueven con el selector de fechas y no hay comparativo ' +
        'contra el período anterior. El embudo es de ' +
        esc(ge.foto.ventanaEmbudo) + ' y el pool de los ' +
        esc(ge.foto.ventanaPool) + '.</div>';
    }

    h += '<div class="grid2" style="margin-top:10px">' +
      panel('El embudo de la gestión',
        'de la lista diaria a la firma',
        embudoGestion(ge.embudo || [])) +
      panel('Acción y recuperación, lado a lado',
        'lo que hizo el equipo, y lo que se recuperó del pool completo',
        tablaAccion(ge.filas || [], ge)) +
      '</div>';

    // El desenlace va inmediatamente despues de la tasa de cierre: sin esto
    // el 3% se lee como resultado final, y la mayoria de los casos sigue viva.
    var de = ge.desenlace;
    if (de) {
      h += '<div style="margin-top:12px">' +
        panel('En qué quedaron los casos trabajados',
          'el período todavía no se puede cerrar',
          '<div class="desenl">' +
          '<div class="des-cel des-ok"><span class="des-n">' +
          fNum(de.firmaron) + '</span><span class="des-e">firmaron</span></div>' +
          '<div class="des-cel des-vivo"><span class="des-n">' +
          fNum(de.vivos) + '</span><span class="des-e">siguen vivos, dentro ' +
          'de su ventana</span></div>' +
          '<div class="des-cel des-mal"><span class="des-n">' +
          fNum(de.vencidos) + '</span><span class="des-e">se vencieron</span></div>' +
          '<div class="des-cel"><span class="des-n">' + fNum(de.sinCruce) +
          '</span><span class="des-e">sin cruce contra ningún crédito</span></div>' +
          '</div>') +
        '</div>';
    }

    if ((ge.causales || []).length) {
      h += '<div style="margin-top:12px">' +
        panelGraf('Por qué no toman el crédito',
          'causales que registró el equipo · la causal describe cómo terminó ' +
          'la llamada, no cómo terminó el caso', 'gF4Causal') +
        '</div>';
      pintar('gF4Causal', function (el) {
        chBarrasH(el, (ge.causales || []).slice(0, 12).map(function (c) {
          return { etiqueta: c.causal, y: c.casos, d: c };
        }), { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 230,
          maxEtiqueta: 34,
          detalle: function (d) {
            return [{ nombre: 'Casos', valor: fNum(d.d.casos) },
                    { nombre: '% de las causales', valor: fPct(d.d.pct) }];
          } });
      });
    }

    h += limitesDato(ge.limites || [], 'Qué NO dicen estos números');
  }

  h += cuali(f.textos);
  return h;
}

/* Embudo de la gestion de rescate. Barras horizontales proporcionales a los
   casos TRABAJADOS, no al paso anterior: la pregunta del negocio es "de los
   que trabajamos, cuantos llegaron hasta aca", y encadenar porcentajes
   esconde el tamano real de cada fuga.

   Los pasos de fuga (colgo) van marcados aparte: no son un avance del
   embudo, son la salida. */
function embudoGestion(pasos) {
  if (!(pasos || []).length) return '<div class="vacio-graf">Sin gestión en el período</div>';
  var max = 0;
  pasos.forEach(function (p) { if (p.casos > max) max = p.casos; });
  var h = '<div class="emb-ges">';
  pasos.forEach(function (p) {
    var fuga = !!p.fuga;
    var w = max ? Math.max(1.5, (p.casos / max) * 100) : 0;
    h += '<div class="emb-fila' + (fuga ? ' emb-fuga' : '') + '">' +
      '<div class="emb-etq">' + esc(p.paso) +
      (p.sub ? ' <span class="emb-sub">' + esc(p.sub) + '</span>' : '') +
      '</div>' +
      '<div class="emb-pista"><div class="emb-barra" style="width:' + w + '%"></div></div>' +
      '<div class="emb-num"><b>' + fNum(p.casos) + '</b>' +
      '<span class="emb-pct">' + fPct(p.pct) + '</span></div>' +
      '</div>';
  });
  return h + '</div><p class="sub" style="margin:8px 0 0">Los porcentajes son ' +
    'sobre los casos trabajados, no sobre el paso anterior.</p>';
}

/* Los limites del dato, al lado de los numeros y no en un pie de pagina.
   Van aca porque cada uno cambia como se lee una cifra de arriba. */
function limitesDato(lista, titulo) {
  if (!(lista || []).length) return '';
  var h = '<div class="limites"><div class="limites-tit">' +
    esc(titulo || 'Qué NO dicen estos números') + '</div><ul>';
  lista.forEach(function (t) { h += '<li>' + esc(t) + '</li>'; });
  return h + '</ul></div>';
}

/* Tabla de accion y resultado. Va aparte de tabla() porque necesita dos cosas
   que esa no hace: filas de encabezado por bloque, y el cambio con signo y
   color propio en vez de un numero pelado. */
function tablaAccion(filas, ac) {
  if (!filas.length) return '<div class="vacio-graf">Sin datos en el período</div>';
  function fmtV(v, f) {
    if (v === null || v === undefined) return '<span class="cel-vacia">--</span>';
    return esc(f === 'cop' ? fCopC(v) : (f === 'pct' ? fPct(v) : fNum(v)));
  }
  var h = '<div class="tabla-wrap"><table class="t"><thead><tr>' +
    '<th>Métrica</th><th>Período</th><th>Anterior</th><th>Cambio</th>' +
    '</tr></thead><tbody>';
  var bl = '';
  filas.forEach(function (r) {
    if (r.bloque !== bl) {
      bl = r.bloque;
      h += '<tr class="fila-bloque"><td colspan="4">' + esc(bl) + '</td></tr>';
    }
    var cls = '', txt = '--';
    if (r.d !== null && r.d !== undefined) {
      var bueno = r.invertido ? (r.d < 0) : (r.d > 0);
      cls = r.d === 0 ? 'plano' : (bueno ? 'sube' : 'baja');
      txt = (r.d === 0 ? '=' : (r.d > 0 ? '▲ +' : '▼ ')) + fNum(r.d) +
        (r.puntos ? ' pp' : '%');
    }
    h += '<tr><td class="txt">' + esc(r.metrica) + '</td>' +
      '<td><b>' + fmtV(r.act, r.f) + '</b></td>' +
      '<td>' + fmtV(r.prev, r.f) + '</td>' +
      '<td><span class="delta-cel ' + cls + '">' + txt + '</span></td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

// ------------------------------------------------------------------ F5
/* Welli Points con datos reales de welli-growth.wp_data. El frente ya no
   pregunta "cuantas sedes entraron" (eso era adopcion de un programa) sino
   las dos preguntas de marketing: el incentivo convierte, y le pagamos. */
function vistaF5() {
  var f = D.f5;
  var cv = f.conversion || {};
  var pg = f.pago || {};

  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 5</div>' +
    '<h1>El incentivo, ¿mueve a la sede — y le estamos pagando?</h1>' +
    '<p class="lead">Welli Points es el único incentivo directo que marketing le pone ' +
    'en la mano a la sede: gana puntos por aplicar y por desembolsar, y los cambia por ' +
    'dinero. Sirve si convierte y si se paga.</p>' +
    '</div>';
  h += cintaOrigen();

  if (!f.hayBQ) {
    return h;
  }

  // --- 1. ¿Convierte el incentivo? ----------------------------------
  h += '<h2 class="sec">1 · ¿El incentivo convierte?</h2>' +
    '<p class="sec-sub">puntos prometidos contra puntos ganados, mismo grupo de sedes</p>';
  h += filaKPIs(cv.kpis || []);

  var serie = f.serie || [];
  /* La tabla "Detalle por mes" repetia exactamente los mismos numeros de la
     grafica de al lado. Se deja solo la grafica, que ademas cuenta la
     historia (la barra ambar crece, la azul no) sin leer una cifra. */
  h += panel('Prometido contra ganado, por mes',
    'los dos en puntos, mismo eje — la promesa crece y el resultado no',
    leyenda([{ nombre: 'WP ofrecidos', color: 'var(--s2)' },
             { nombre: 'WP ganados', color: 'var(--s1)' }]), 'gF5Conv');
  pintar('gF5Conv', function (el) {
    chGrupos(el, serie.map(function (x) { return x.mes; }), [
      { nombre: 'WP ofrecidos', color: 'var(--s2)',
        valores: serie.map(function (x) { return x.ofrecido; }) },
      { nombre: 'WP ganados', color: 'var(--s1)',
        valores: serie.map(function (x) { return x.ganado; }) }
    ], { formato: fNum, alto: 210 });
  });
  if (cv.lectura) h += '<div class="lectura alerta">' + esc(cv.lectura) + '</div>';

  /* Cual incentivo mueve: ordenado por sedes que ganaron, no por tamano.
     Se cortan los incentivos con menos de 10 sedes y sin ganadores: son
     media docena de filas en cero que solo alargan la tabla. Los ceros de
     los incentivos GRANDES si se quedan, porque esos si son el hallazgo. */
  var incTodos = (f.incentivos || []).slice().sort(function (a, b) {
    return b.ganaron - a.ganaron || b.sedes - a.sedes;
  });
  var inc = incTodos.filter(function (x) { return x.ganaron > 0 || x.sedes >= 10; });
  var fuera = incTodos.length - inc.length;
  h += panel('Qué incentivo mueve algo',
    'ordenado por sedes que efectivamente ganaron el punto' +
    (fuera ? ' · se omiten ' + fuera + ' incentivos con menos de 10 sedes y ningún ganador'
           : ''), tabla([
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
    '<p class="sec-sub">canjes solicitados y su estado</p>';
  h += filaKPIs(pg.kpis || []);

  var cm = f.canjesMes || [];
  if (cm.length) {
    h += panel('Canjes solicitados por mes',
      'plata comprometida — ninguna barra tiene un canje pagado', '', 'gF5Canj');
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
    ], f.canjes || [], { vacio: 'No hay canjes solicitados' }));


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


  /* Este frente se llena a mano y hoy esta vacio. Un panel con cinco "--"
     resta credibilidad al tablero, asi que el estado vacio dice exactamente
     que hay que escribir y donde, en vez de mostrar celdas en blanco. */
  var nov = (f.novedades || []).filter(function (n) {
    if (!n.producto) return false;
    var tiene = (n.metricas || []).some(function (m) {
      return m.valor !== '' && m.valor !== null && m.valor !== undefined;
    });
    return tiene || n.inversion || n.acciones;
  });
  if (!nov.length) {
    h += '<div class="lectura alerta">Este frente todavía no tiene datos y por eso no ' +
      'muestra tarjetas vacías. Es el único del tablero que se llena a mano: hay que ' +
      'escribir una fila por producto en la hoja <b>NOVEDADES</b> del Sheet con el ' +
      'nombre, el estado, la inversión y hasta cuatro métricas de adopción ' +
      '(por ejemplo: sedes que lo usaron, solicitudes con el producto, monto). ' +
      'Mientras esté vacío, el frente no puede responder si los lanzamientos se ' +
      'están adoptando.</div>';
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
   Filtro global de origen de sede
   Aplica a Profundizacion, Rescate y Welli Points. Adquisicion no se
   filtra: por definicion mide lo que trae marketing.
   La lista de origenes NO esta escrita a mano: sale del catalogo que
   devuelve el servidor, asi que si HubSpot gana un origen nuevo aparece
   solo en el selector.
   ===================================================================== */
var ORIGENES_SEL = [];      // vacio = todos
/* Lo elegido en cada uno de los tres roles: { hunter, farmer, cs }. Vacio en
   un rol = ese rol no filtra. Los tres se combinan con Y. */
var ROLES_SEL = {};
var CATALOGO_ORIG = [];
var PRESETS_ORIG = {};
var ETIQ_PRESET = {};

var ORDEN_GRUPO = ['marketing', 'comercial', 'alianzas', 'otros', 'sin_origen'];
var NOMBRE_GRUPO = {
  marketing: 'Marketing', comercial: 'Equipo comercial',
  alianzas: 'Alianzas y marcas', otros: 'Otros', sin_origen: 'Sin origen'
};

function mismosOrigenes(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) < 0) return false;
  return true;
}

function etiquetaOrigen() {
  if (!ORIGENES_SEL.length) return 'Todos los orígenes';
  var claves = Object.keys(PRESETS_ORIG);
  for (var i = 0; i < claves.length; i++) {
    var k = claves[i];
    if (k === 'todos') continue;
    if (mismosOrigenes(PRESETS_ORIG[k] || [], ORIGENES_SEL)) {
      return ETIQ_PRESET[k] || k;
    }
  }
  if (ORIGENES_SEL.length === 1) return ORIGENES_SEL[0];
  return ORIGENES_SEL.length + ' orígenes';
}


/** Pinta el panel. Se llama cada vez que llegan datos nuevos. */
function pintarPanelOrigen() {
  var pres = document.getElementById('poPresets');
  var lista = document.getElementById('poLista');
  if (!pres || !lista) return;

  pres.innerHTML = Object.keys(PRESETS_ORIG).map(function (k) {
    var sel = (k === 'todos')
      ? ORIGENES_SEL.length === 0
      : mismosOrigenes(PRESETS_ORIG[k] || [], ORIGENES_SEL);
    return '<button class="po-preset" type="button" data-preset="' + esc(k) + '"' +
      ' aria-pressed="' + (sel ? 'true' : 'false') + '">' +
      esc(ETIQ_PRESET[k] || k) + '</button>';
  }).join('');

  var porGrupo = {};
  CATALOGO_ORIG.forEach(function (o) {
    var g = o.grupo || 'otros';
    if (!porGrupo[g]) porGrupo[g] = [];
    porGrupo[g].push(o);
  });
  var h = '';
  ORDEN_GRUPO.forEach(function (g) {
    var arr = porGrupo[g];
    if (!arr || !arr.length) return;
    h += '<div class="po-grupo">' + esc(NOMBRE_GRUPO[g] || g) + '</div>';
    arr.forEach(function (o) {
      var marcado = ORIGENES_SEL.indexOf(o.origen) >= 0;
      h += '<label class="po-item"><input type="checkbox" value="' + esc(o.origen) + '"' +
        (marcado ? ' checked' : '') + '>' +
        '<span>' + esc(o.origen) + '</span>' +
        '<span class="po-n">' + fNum(o.sedes) + '</span></label>';
    });
  });
  lista.innerHTML = h;

  var txt = document.getElementById('btnOrigenTxt');
  if (txt) txt.textContent = etiquetaOrigen();
}

function leerChecksOrigen() {
  var ins = document.querySelectorAll('#poLista input[type=checkbox]');
  var out = [];
  for (var i = 0; i < ins.length; i++) if (ins[i].checked) out.push(ins[i].value);
  // Si estan todos marcados es lo mismo que "todos": se guarda vacio para
  // que el servidor no compare 24 cadenas en cada fila.
  if (out.length === CATALOGO_ORIG.length) return [];
  return out;
}

function abrirPanelOrigen(abrir) {
  var p = document.getElementById('panelOrigen');
  var b = document.getElementById('btnOrigen');
  if (!p || !b) return;
  var visible = !p.classList.contains('oculto');
  var q = (abrir === undefined) ? !visible : abrir;
  p.classList.toggle('oculto', !q);
  b.setAttribute('aria-expanded', q ? 'true' : 'false');
}

function montarFiltroOrigen() {
  var btn = document.getElementById('btnOrigen');
  var panel = document.getElementById('panelOrigen');
  if (!btn || !panel) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    abrirPanelOrigen();
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { abrirPanelOrigen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') abrirPanelOrigen(false);
  });

  document.getElementById('poPresets').addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== panel && !t.getAttribute('data-preset')) t = t.parentNode;
    if (!t || t === panel) return;
    var k = t.getAttribute('data-preset');
    ORIGENES_SEL = (k === 'todos') ? [] : (PRESETS_ORIG[k] || []).slice();
    pintarPanelOrigen();
  });
  document.getElementById('poLista').addEventListener('change', function () {
    ORIGENES_SEL = leerChecksOrigen();
    var txt = document.getElementById('btnOrigenTxt');
    if (txt) txt.textContent = etiquetaOrigen();
  });
  document.getElementById('poNada').addEventListener('click', function () {
    ORIGENES_SEL = [];
    pintarPanelOrigen();
  });
  document.getElementById('poListo').addEventListener('click', function () {
    ORIGENES_SEL = leerChecksOrigen();
    abrirPanelOrigen(false);
    cargar();
  });
}

/** Cinta que recuerda el universo activo. Solo en los frentes filtrables. */
function cintaOrigen() {
  var m = (D && D.meta) || {};
  var partes = [];
  partes.push(m.origenTodos ? 'Todos los orígenes' : esc(m.origenEtiqueta || ''));
  // El equipo va SIEMPRE que no sea "todos": sin decirlo, un conteo de sedes
  // recortado por equipo se lee como el total del origen.
  if (!m.rolesTodos) partes.push(esc(m.rolEtiqueta || ''));
  var col = '<b>' + fNum(m.origenSedes || 0) + '</b> sedes';
  if (!m.origenTodos || !m.rolesTodos) {
    col = '<b>' + fNum(m.origenSedes || 0) + '</b> de ' +
      fNum(m.origenSedesBase || 0) + ' sedes';
  }
  // El recorte de deshabilitadas se declara SIEMPRE. Es un corte del universo
  // que el usuario no puede apagar, asi que callarlo haria ver los conteos
  // bajos sin explicacion.
  if (m.deshabilitadas) {
    col += ' <span class="cinta-nota">· ' + fNum(m.deshabilitadas) +
      ' deshabilitadas fuera</span>';
  }
  return '<div class="cinta-origen">' + partes.join(' · ') + ' · ' + col + '</div>';
}

/* =====================================================================
   Render y navegación
   ===================================================================== */

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
          fNum(im.sedes) + ' sedes' + (im.tramo > 1
            ? ', repartidas en ' + im.tramo + ' días según fueron entrando al workflow: ' +
              (im.dias || []).map(function (x) {
                return etiquetaX(x.fecha, 'dia') + ' ' + fNum(x.sedes);
              }).join(', ')
            : '')) + '">' +
        '<i class="' + (im.canal === 'WhatsApp' ? 'wa' : 'mail') + '"></i>' +
        esc(etiquetaX(im.fecha, 'dia')) + ' · ' + esc(im.pieza) +
        ' <small>' + fNum(im.sedes) +
        (im.tramo > 1 ? ' · ' + im.tramo + 'd' : '') + '</small></button>';
    });
    h += '</div>';
  });
  return h;
}

/* Barras de solicitudes por dia con lineas verticales en los dias de impacto.
   No es un eje doble: los impactos no tienen escala propia, son marcas de
   evento sobre el eje de tiempo — la unica forma honesta de superponer un
   evento a una serie.

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
    var n = porDia[fch].length;
    porDia[fch].forEach(function (im, k) {
      // Varios impactos del mismo dia caen en el mismo x y la ultima linea
      // tapa a las anteriores. Se separan un par de pixeles para que las tres
      // se vean; el dia sigue siendo el mismo.
      var off = n > 1 ? (k - (n - 1) / 2) * 2.5 : 0;
      marcas.push({ im: im, cx: x(idx[fch]) + bw / 2 + off });
    });
  });
  marcas.sort(function (a, b) { return a.cx - b.cx; });
  var finCarril = [];
  marcas.forEach(function (m) {
    m.etq = m.im.pieza + ' ' + fNum(m.im.sedes) +
      (m.im.tramo > 1 ? ' ·' + m.im.tramo + 'd' : '');
    m.ancho = m.etq.length * 5.3 + 14;
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
      esc(fNum(im.sedes) + (im.tramo > 1 ? ' ·' + im.tramo + 'd' : '')) +
      '</tspan></text>';
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
        var hoy = (im.dias || []).filter(function (x) { return x.fecha === p.x; })[0];
        det.push({ nombre: im.nombre + ' · ' + im.canal,
                   valor: im.pieza + ' a ' + fNum(hoy ? hoy.sedes : im.sedes) +
                     ' sedes' + (im.tramo > 1
                       ? ' (de ' + fNum(im.sedes) + ' en ' + im.tramo + ' días)' : '') });
      });
      var r = hh.getBoundingClientRect(), cr = svg.getBoundingClientRect();
      tt.mostrar(r.left - cr.left + r.width / 2, r.top - cr.top + 30,
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
  // El id permite repintar solo los chips al apagar un impacto, sin rehacer
  // la vista entera: con render() completo la pagina saltaba al inicio.
  var chips = imp.length
    ? '<div class="imp-chips" id="f7Chips">' + chipsImpactos(f) + '</div>' : '';

  h += '<div style="margin-top:14px">' +
    panel('Solicitudes por día y los impactos que mandamos',
      imp.length
        ? 'cada color es un workflow · línea continua WhatsApp, punteada email · ' +
          'una marca es una pieza de la cadencia, aunque haya goteado varios ' +
          'días · apaga las que no quieras ver'
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

function render() {
  var cont = document.getElementById('vistas');
  var m = D.meta;

  // Solo lo indispensable: cuándo se actualizó el dato. Los rangos ya se
  // ven en el calendario, y el comparativo lo dice cada tarjeta.
  document.getElementById('periodoInfo').innerHTML =
    'Datos actualizados: <b>' + esc(m.ultimaActualizacion) + '</b>';

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
  else if (VISTA === 'f7') html = vistaF7();
  else html = vistaF1();

  html += '<div class="pie">' +
    'Tablero 360 Growth · WELLI. Los datos vienen del Google Sheet, que se actualiza con un ' +
    'trigger diario a las 6:00 AM hora Colombia. Toda métrica sin fuente conectada aparece ' +
    'como <b>--</b> con un badge que dice qué falta: en este tablero no se rellena nada con ' +
    'estimaciones. Las métricas marcadas "foto de hoy" son contadores de estado de HubSpot ' +
    'y no responden al filtro de fechas.' +
    '</div>';

  cont.innerHTML = html;
  cont.classList.remove('oculto');
  document.getElementById('cargando').classList.add('oculto');
  dibujarPendientes();
  // Los botones de dia/mes de la pauta se enganchan aqui porque el HTML se
  // reinyecta completo en cada render.
  document.querySelectorAll('.gran-sel button[data-g]').forEach(function (b) {
    b.addEventListener('click', function () {
      setGranPauta(b.getAttribute('data-g'));
    });
  });
  window.scrollTo(0, 0);
}

var VISTAS_VALIDAS = ['f1', 'f2', 'f4', 'f5', 'f6', 'f7'];

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

/* ------------------------------------------------- mes y semana */
/* Dos calendarios libres dejaban armar rangos que no significan nada (del 14
   de julio al 3 de septiembre) y hacian que casi todo el tablero cayera en
   comparaciones raras. Con mes + semana el rango siempre es un periodo real
   del negocio, y el comparativo "periodo anterior" siempre es el mes o la
   semana de antes.

   Las semanas arrancan lunes y van RECORTADAS al mes, asi que las semanas de
   agosto son solo de agosto y sumadas dan agosto exacto. */
var MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var MES_SEL = '';

function nombreMes(m) {
  var a = Number(m.substring(0, 4)), i = Number(m.substring(5, 7)) - 1;
  return MESES_TXT[i] + ' ' + a;
}

/** Las semanas de un mes, recortadas a sus bordes. */
function semanasDeMes(m) {
  var a = Number(m.substring(0, 4)), i = Number(m.substring(5, 7)) - 1;
  var ini = new Date(Date.UTC(a, i, 1));
  var fin = new Date(Date.UTC(a, i + 1, 0));
  var hoy = new Date(iso(new Date()) + 'T00:00:00Z');
  // No se ofrecen semanas que todavia no empezaron: un rango en el futuro
  // sale vacio y se lee como una caida.
  if (fin > hoy) fin = hoy;
  var out = [];
  var d = new Date(ini.getTime());
  while (d <= fin) {
    // retrocede al lunes de esa semana, sin salirse del mes
    var dow = (d.getUTCDay() + 6) % 7;          // 0 = lunes
    var l = new Date(d.getTime() - dow * 86400000);
    if (l < ini) l = new Date(ini.getTime());
    var v = new Date(l.getTime() + (6 - ((l.getUTCDay() + 6) % 7)) * 86400000);
    if (v > fin) v = new Date(fin.getTime());
    out.push({ desde: v0(l), hasta: v0(v) });
    d = new Date(v.getTime() + 86400000);
  }
  return out;
}
function v0(d) { return d.toISOString().substring(0, 10); }

function etiquetaSemana(s, i) {
  var d1 = Number(s.desde.substring(8, 10)), d2 = Number(s.hasta.substring(8, 10));
  return 'Semana ' + (i + 1) + ' · ' + d1 + ' al ' + d2;
}

/* Un selector por ROL, cada uno con su gente. Tres controles porque son tres
   asignaciones que CONVIVEN: a una sede la trae un hunter, la cultiva un
   farmer y la retiene un CS.

   Se combinan con Y: elegir hunter=Johanna y farmer=Viviana da las sedes que
   trajo Johanna Y que hoy cultiva Viviana. Con O, agregar un filtro daria un
   universo MAS grande, que es lo contrario de lo que espera quien filtra. */
function montarSelectorOwner() {
  var cat = (D && D.meta && D.meta.catalogoRoles) || [];
  var cont = document.getElementById('filtrosOwner');
  if (!cont || !cat.length) return;
  cont.innerHTML = cat.map(function (c) {
    var id = 'selRol_' + c.id;
    var sel = ROLES_SEL[c.id] || '';
    return '<div class="campo"><label for="' + id + '">' + esc(c.nombre) +
      '</label><select id="' + id + '" data-rol="' + esc(c.id) + '">' +
      '<option value="">— sin filtrar —</option>' +
      c.gente.map(function (g) {
        return '<option value="' + esc(g.id) + '"' +
          (sel === g.id ? ' selected' : '') + '>' + esc(g.nombre) +
          ' (' + fNum(g.sedes) + ')</option>';
      }).join('') + '</select></div>';
  }).join('');
  cont.querySelectorAll('select').forEach(function (sl) {
    sl.addEventListener('change', function () {
      ROLES_SEL = {};
      cont.querySelectorAll('select').forEach(function (s2) {
        if (s2.value) ROLES_SEL[s2.getAttribute('data-rol')] = s2.value;
      });
      cargar();
    });
  });
}

function montarSelectores() {
  var meses = (D && D.meta && D.meta.mesesDatos) ? D.meta.mesesDatos : [];
  if (!meses.length) return;
  var sm = document.getElementById('selMes');
  if (!MES_SEL || meses.indexOf(MES_SEL) < 0) MES_SEL = meses[meses.length - 1];
  // Del mas reciente al mas viejo: el mes que se consulta casi siempre es el
  // ultimo, y ponerlo primero ahorra un scroll cada vez.
  sm.innerHTML = meses.slice().reverse().map(function (m) {
    return '<option value="' + m + '"' + (m === MES_SEL ? ' selected' : '') + '>' +
      esc(nombreMes(m)) + '</option>';
  }).join('');
  poblarSemanas();
}

function poblarSemanas(sel) {
  var ss = document.getElementById('selSemana');
  var sem = semanasDeMes(MES_SEL);
  ss.innerHTML = '<option value="">Todo el mes</option>' +
    sem.map(function (s, i) {
      return '<option value="' + s.desde + '|' + s.hasta + '"' +
        (sel === s.desde + '|' + s.hasta ? ' selected' : '') + '>' +
        esc(etiquetaSemana(s, i)) + '</option>';
    }).join('');
  if (!sel) ss.value = '';
}

/** El rango de un mes, recortado a hoy si el mes no ha terminado. */
function rangoDeMes(m) {
  var y = Number(m.substring(0, 4)), i = Number(m.substring(5, 7)) - 1;
  var b = v0(new Date(Date.UTC(y, i + 1, 0)));
  var hoy = iso(new Date());
  if (b > hoy) b = hoy;
  return { desde: m + '-01', hasta: b };
}
function esMesCompleto(m, a, b) {
  if (!m) return false;
  var r = rangoDeMes(m);
  return a === r.desde && b === r.hasta;
}
/** Deja los inputs en el mes completo, sin recargar. */
function aplicarSeleccionMes(m) {
  var r = rangoDeMes(m);
  document.getElementById('fDesde').value = r.desde;
  document.getElementById('fHasta').value = r.hasta;
}

/** Escribe el rango en los inputs ocultos, que son la entrada de cargar(). */
function aplicarSeleccion(recargar) {
  var m = document.getElementById('selMes').value || MES_SEL;
  MES_SEL = m;
  var v = document.getElementById('selSemana').value;
  var a, b;
  if (v) {
    a = v.split('|')[0];
    b = v.split('|')[1];
  } else {
    var r = rangoDeMes(m);
    a = r.desde;
    b = r.hasta;
  }
  document.getElementById('fDesde').value = a;
  document.getElementById('fHasta').value = b;
  if (recargar !== false) cargar();
}

/* -------------------------------------------------------------- carga */
function cargar() {
  if (CARGANDO) return;
  CARGANDO = true;
  var ini = document.getElementById('fDesde').value;
  var fin = document.getElementById('fHasta').value;
  var orig = ORIGENES_SEL.slice();
  document.getElementById('vistas').classList.add('oculto');
  document.getElementById('error').classList.add('oculto');
  document.getElementById('cargando').classList.remove('oculto');

  function ok(datos) {
    CARGANDO = false;
    D = datos;
    // El catalogo llega siempre completo, sin importar el filtro activo.
    if (D.meta) {
      CATALOGO_ORIG = D.meta.catalogoOrigenes || CATALOGO_ORIG;
      PRESETS_ORIG = D.meta.presetsOrigen || PRESETS_ORIG;
      ETIQ_PRESET = D.meta.etiquetasPreset || ETIQ_PRESET;
      if (D.meta.origenes) ORIGENES_SEL = D.meta.origenes.slice();
      // El catalogo de meses viene en el payload, asi que los selectores se
      // pueblan con la primera carga y se mantienen sincronizados despues.
      // ROLES_SEL lo manda el frontend y el motor lo devuelve tal cual en
      // meta.roles, asi que se puede sincronizar sin perder nada.
      if (D.meta.roles) ROLES_SEL = D.meta.roles;
      montarSelectorOwner();
      montarSelectores();
      var a0 = document.getElementById('fDesde').value;
      var b0 = document.getElementById('fHasta').value;
      poblarSemanas(esMesCompleto(MES_SEL, a0, b0) ? '' : a0 + '|' + b0);
    }
    pintarPanelOrigen();
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

  // Vista previa: corre el MISMO getDashboardData() del servidor sobre las
  // tablas embebidas, con shims de las APIs de Google. Antes traia payloads
  // pre-calculados por rango de fecha, y como el tablero solo tiene
  // calendario (sin atajos), cualquier fecha elegida a mano no existia en el
  // diccionario, caia al payload de respaldo y el filtro de origen parecia
  // no hacer nada. Ahora cualquier combinacion se calcula en vivo.
  if (window.MOTOR_LOCAL) {
    setTimeout(function () {
      try {
        ok(getDashboardData(ini, fin, orig, ROLES_SEL, CMP_F2));
      } catch (e) {
        mal(e);
      }
    }, 20);
    return;
  }
  if (window.DATOS_PRECARGADOS) {
    setTimeout(function () { ok(window.DATOS_PRECARGADOS); }, 60);
    return;
  }
  google.script.run.withSuccessHandler(ok).withFailureHandler(mal)
    .getDashboardData(ini, fin, orig, ROLES_SEL, CMP_F2);
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
  montarFiltroOrigen();
  document.getElementById('btnAplicar').addEventListener('click', function () {
    aplicarSeleccion(true);
  });
  // Cambiar el mes repuebla las semanas y vuelve a "Todo el mes": las semanas
  // del mes viejo no existen en el nuevo.
  document.getElementById('selMes').addEventListener('change', function () {
    MES_SEL = document.getElementById('selMes').value;
    poblarSemanas();
    aplicarSeleccion(true);
  });
  document.getElementById('selSemana').addEventListener('change', function () {
    aplicarSeleccion(true);
  });
  document.querySelectorAll('.nav-item').forEach(function (b) {
    b.addEventListener('click', function () { irA(b.getAttribute('data-vista')); });
  });

  irA(vistaDelHash(), true);
  window.addEventListener('hashchange', function () { irA(vistaDelHash(), true); });

  // Arranca en el ultimo mes con dato. Si el mes en curso lleva menos de una
  // semana se abre el anterior: un mes de dos dias se lee como una caida y no
  // es lo primero que alguien deberia ver. El catalogo de meses llega en el
  // payload, asi que los selectores se pueblan cuando responde.
  var hoy0 = new Date();
  var diaHoy = Number(iso(hoy0).substring(8, 10));
  MES_SEL = iso(hoy0).substring(0, 7);
  if (diaHoy < 7) {
    var yy = hoy0.getFullYear(), mm = hoy0.getMonth() - 1;
    MES_SEL = iso(new Date(yy, mm, 1)).substring(0, 7);
  }
  aplicarSeleccionMes(MES_SEL);
  cargar();
});
