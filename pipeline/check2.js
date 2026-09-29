
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
var VISTA = 'resumen';
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

function tarjetaKPI(k) {
  var h = '<div class="kpi" data-color="' + esc(k.color) + '">';
  h += '<div class="kpi-label">' + esc(k.label) + '</div>';
  if (k.pendiente || k.valor === null || k.valor === undefined) {
    h += '<div class="kpi-valor vacio">--</div>';
  } else {
    h += '<div class="kpi-valor">' + esc(fmt(k.valor, k.formato)) + '</div>';
  }
  if (k.sublabel) h += '<div class="kpi-sub">' + esc(k.sublabel) + '</div>';

  if (k.pendiente) {
    h += '<div class="badge falta">⚠️ <span>' + esc(k.nota || ('Falta conexión con ' + k.fuente)) +
      '</span></div>';
  } else if (k.delta === null || k.delta === undefined) {
    h += '<span class="foto">foto de hoy · sin comparativo</span>';
    if (k.nota) h += '<div class="badge info">ℓ <span>' + esc(k.nota) + '</span></div>';
  } else {
    // Para CPL menos es mejor: se invierte el color, no el signo.
    var bueno = k.deltaInvertido ? (k.delta < 0) : (k.delta > 0);
    var cls = k.delta === 0 ? 'plano' : (bueno ? 'sube' : 'baja');
    var flecha = k.delta === 0 ? '=' : (k.delta > 0 ? '▲' : '▼');
    h += '<div class="delta ' + cls + '">' + flecha + ' ' +
      (k.delta > 0 ? '+' : '') + fNum(k.delta) + '% <small>vs per. anterior</small></div>';
    if (k.nota) h += '<div class="badge info">ℓ <span>' + esc(k.nota) + '</span></div>';
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

// ------------------------------------------------------------- RESUMEN
function vistaResumen() {
  var r = D.resumen;
  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Resumen ejecutivo</div>' +
    '<h1>Qué logró Growth en el período</h1>' +
    '<p class="lead">Los cuatro primeros números son labor directa del equipo: sedes que ' +
    'entraron, sedes que desembolsaron, clínicas muertas que volvieron a la vida y ' +
    'capacitaciones que llegaron a resultado. Todos están fechados en HubSpot, así que ' +
    'responden al filtro de arriba y se comparan contra el período inmediatamente anterior.</p>' +
    '</div>';

  h += filaKPIs(r.kpis);

  h += '<h2 class="sec">Lo que falta por conectar</h2>' +
    '<p class="sec-sub">Se lista explícito para que en comité nadie lea un cero como un ' +
    'resultado. Ninguna de estas cifras se rellenó con estimaciones.</p>' +
    '<div class="pend-lista">' +
    r.pendientes.map(function (p) {
      return '<div class="pend"><div class="top">' +
        '<span class="fr">' + esc(p.frente) + '</span>' +
        '<span class="qu">' + esc(p.que) + '</span></div>' +
        '<div class="de"><b>Fuente:</b> ' + esc(p.fuente) + ' — ' + esc(p.detalle) + '</div></div>';
    }).join('') + '</div>';

  return h;
}

// ------------------------------------------------------------------ F1
function vistaF1() {
  var f = D.f1, g = D.meta.agrupacion;
  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 1</div>' +
    '<h1>Adquisición &amp; Inbound/Outbound</h1>' +
    '<p class="lead">Dos cosas distintas viven en este frente: la pauta pagada, que se mide ' +
    'en leads y costo por lead, y las cosechas de sedes, que son cohortes de aliados que ' +
    'entraron al pipeline cada mes. No se suman ni se mezclan: son embudos separados.</p>' +
    '</div>';

  h += filaKPIs(f.kpis);
  if (f.pendienteMeta) h += avisoBox(f.notaMeta);

  // Leads y CPL: dos paneles apilados que comparten el eje X.
  // Un solo gráfico con dos escalas Y haría parecer que las curvas se
  // cruzan cuando eso solo depende de dónde se pongan los topes.
  h += '<h2 class="sec">Leads y costo por lead</h2>' +
    '<p class="sec-sub">Mismo eje de tiempo, dos escalas separadas: así el cruce entre ' +
    'volumen y costo es real y no un artefacto de la escala.</p>' +
    '<div class="grid2">' +
    panel('Leads', 'formularios de pauta por ' + g, '', 'gF1Leads') +
    panel('CPL', 'costo por lead en COP por ' + g, '', 'gF1Cpl') +
    '</div>';

  pintar('gF1Leads', function (el) {
    chBarras(el, (f.serie || []).map(function (p) { return { x: p.x, y: p.leads }; }),
      { color: 'var(--s2)', nombre: 'Leads', gran: g, formato: fNum,
        vacio: 'Sin datos de Meta Ads: falta reconectar el token' });
  });
  pintar('gF1Cpl', function (el) {
    chLinea(el, (f.serie || []).map(function (p) { return { x: p.x, y: p.cpl }; }),
      { color: 'var(--s1)', nombre: 'CPL', gran: g, formato: fCop, formatoEje: fCopC,
        vacio: 'Sin datos de Meta Ads: falta reconectar el token' });
  });

  h += '<div class="grid2" style="margin-top:14px">' +
    panel('Inversión en pauta', 'gasto en COP por ' + g, '', 'gF1Gasto') +
    panel('Mix de orígenes de marketing', 'sedes por canal de captación (histórico)', '', 'gF1Origen') +
    '</div>';

  pintar('gF1Gasto', function (el) {
    chBarras(el, f.serieGasto || [], { color: 'var(--s1)', nombre: 'Gasto', gran: g,
      formato: fCop, formatoEje: fCopC,
      vacio: 'Sin datos de Meta Ads: falta reconectar el token' });
  });
  pintar('gF1Origen', function (el) {
    var canales = (f.convOrigen || []).filter(function (o) {
      return ['Eventos', 'Referidos', 'Pagina web', 'Social media'].indexOf(o.origen) >= 0;
    }).sort(function (a, b) { return b.sedes - a.sedes; });
    chBarrasH(el, canales.map(function (o) {
      return { etiqueta: o.origen === 'Pagina web' ? 'Página web' : o.origen, y: o.sedes, d: o };
    }), { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 110,
      detalle: function (d) {
        return [{ nombre: 'Sedes', valor: fNum(d.d.sedes) },
                { nombre: 'Apps', valor: fNum(d.d.apps) },
                { nombre: 'Desembolsos', valor: fNum(d.d.desembolsos) },
                { nombre: 'Tasa conversión', valor: fPct(d.d.tasaConv) }];
      } });
  });

  // Cosechas
  h += '<h2 class="sec">Cosechas de sedes</h2>' +
    '<p class="sec-sub">Una cosecha es el conjunto de sedes que entraron al pipeline en ese ' +
    'mes, desglosado por origen y por calidad de aliado.</p>';
  h += avisoBox(f.cosechasCaveat);

  var cos = f.cosechas || [];
  h += '<div class="grid2">' +
    panel('Sedes por cosecha y calidad', 'total del mes vs. cuántas son AA y AAA',
      (cos.length >= 2 ? leyenda([
        { nombre: 'Total sedes', color: 'var(--s1)' },
        { nombre: 'AA', color: 'var(--s2)' },
        { nombre: 'AAA', color: 'var(--s3)' }]) : ''), 'gF1Cos') +
    panel('Conversión por origen', 'desembolsos / aplicaciones, solo donde hay origen registrado',
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
        return [{ nombre: 'Apps', valor: fNum(d.d.apps) },
                { nombre: 'Aprobados', valor: fNum(d.d.aprobados) },
                { nombre: 'Desembolsos', valor: fNum(d.d.desembolsos) },
                { nombre: 'Monto', valor: fCopC(d.d.monto) }];
      } });
  });

  h += avisoBox(f.coberturaOrigen.aviso);

  h += '<h2 class="sec">Tabla de cosechas</h2>' +
    '<p class="sec-sub">Cada fila es un mes de entrada al pipeline.</p>' +
    panel('Cosechas por origen y calidad', '', tabla([
      { k: 'cosecha', t: 'Cosecha', f: 'txt' },
      { k: 'total', t: 'Total sedes' },
      { k: 'eventos', t: 'Eventos' },
      { k: 'referidos', t: 'Referidos' },
      { k: 'web', t: 'Página web' },
      { k: 'social', t: 'Social media' },
      { k: 'otros', t: 'Otros' },
      { k: 'sinOrigen', t: 'Sin origen' },
      { k: 'aa', t: 'AA' },
      { k: 'aaa', t: 'AAA' },
      { k: 'monto', t: 'Monto acum. de esas sedes', f: 'cop' }
    ], cos, { vacio: 'Ninguna cosecha cae en el rango elegido' }));

  h += cuali(f.textos);
  return h;
}

// ------------------------------------------------------------------ F2
function vistaF2() {
  var f = D.f2;
  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 2 · incluye Frente 3 (Mundo AAA)</div>' +
    '<h1>Profundización &amp; Cuentas VIP</h1>' +
    '<p class="lead">La labor de Growth es mover sedes por el ciclo: entran con Hunters, ' +
    'Customer Success las capacita, y de ahí graduan a Farmer o a Autogestionados. Una sede ' +
    'con 90 días sin aplicación se muere, va a re-capacitación y puede revivir. Los números ' +
    'de abajo son transiciones fechadas, no fotos.</p>' +
    '</div>';

  h += filaKPIs(f.kpis);

  h += '<h2 class="sec">Movimientos del ciclo de vida</h2>' +
    '<p class="sec-sub">Todo lo de esta fila está fechado en HubSpot y sí responde al filtro.</p>';
  h += filaKPIs(f.kpisSecundarios);

  // Atribución de marketing
  h += '<h2 class="sec">Atribución de marketing</h2>' +
    '<p class="sec-sub">Sedes agrupadas por la audiencia de marketing a la que pertenecen, ' +
    'contra el resultado que dieron. Esta es la respuesta a "¿la comunicación sirvió?".</p>';
  h += avisoBox(f.audienciaAviso);

  var aud = (f.audiencia || []).filter(function (a) {
    return a.audiencia !== 'Sin audiencia' && a.audiencia !== 'SIN_CAMPANA';
  });
  h += '<div class="grid2">' +
    panel('Sedes activas por audiencia', '% de la audiencia que hizo al menos una app este mes',
      '', 'gF2Aud') +
    panel('Estado de comunicaciones', 'sedes por estado, y cuántas están activas', '', 'gF2Com') +
    '</div>';

  pintar('gF2Aud', function (el) {
    chBarrasH(el, aud.slice().sort(function (a, b) { return b.pctActivas - a.pctActivas; })
      .map(function (a) { return { etiqueta: a.audiencia, y: a.pctActivas, d: a }; }),
      { color: 'var(--s4)', formato: fPct, anchoEtiqueta: 130,
        detalle: function (d) {
          return [{ nombre: 'Sedes', valor: fNum(d.d.sedes) },
                  { nombre: 'Con pieza enviada', valor: fNum(d.d.conPieza) },
                  { nombre: 'Activas este mes', valor: fNum(d.d.activasMes) },
                  { nombre: 'Desembolsos hist.', valor: fNum(d.d.desembolsos) }];
        } });
  });
  pintar('gF2Com', function (el) {
    chBarrasH(el, (f.comunicaciones || []).slice(0, 8)
      .map(function (c) { return { etiqueta: c.estado, y: c.sedes, d: c }; }),
      { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 130,
        detalle: function (d) {
          return [{ nombre: 'Sedes', valor: fNum(d.d.sedes) },
                  { nombre: 'Activas este mes', valor: fNum(d.d.activasMes) },
                  { nombre: 'Apps hist.', valor: fNum(d.d.apps) },
                  { nombre: 'Desembolsos hist.', valor: fNum(d.d.desembolsos) }];
        } });
  });

  h += panel('Audiencias de marketing vs resultado', '', tabla([
    { k: 'audiencia', t: 'Audiencia', f: 'txt' },
    { k: 'sedes', t: 'Sedes' },
    { k: 'conPieza', t: 'Con pieza enviada' },
    { k: 'activasMes', t: 'Activas este mes' },
    { k: 'pctActivas', t: '% activas', f: 'pct' },
    { k: 'apps', t: 'Apps hist.' },
    { k: 'desembolsos', t: 'Desemb. hist.' },
    { k: 'monto', t: 'Monto', f: 'cop' }
  ], f.audiencia || []));

  // Mundo AAA
  var a = f.aaaResumen || {};
  h += '<h2 class="sec">Mundo AAA — cuentas VIP</h2>' +
    '<p class="sec-sub">Las sedes clasificadas AAA son las de mayor valor. Aquí importa la ' +
    'cobertura de gestión, no el volumen.</p>' +
    '<div class="flujo">' +
    '<div class="paso"><div class="n">' + fNum(a.sedes) + '</div><div class="l">sedes AAA</div></div>' +
    '<div class="paso"><div class="n">' + fNum(a.conVisita) + '</div><div class="l">con visita registrada</div></div>' +
    '<div class="paso"><div class="n">' + fCopC(a.monto) + '</div><div class="l">monto acumulado</div></div>' +
    '<div class="paso"><div class="n">' + fNum(a.invRescate) + '</div><div class="l">aprobados sin firmar (inventario de rescate)</div></div>' +
    '</div>';
  h += avisoBox('Solo 23 sedes de 3.601 tienen fecha de visita registrada y 289 tienen la ' +
    'marca de "visita recibida". La cobertura real de visitas no es medible hasta que el ' +
    'equipo comercial registre la fecha: no se estimó nada.');

  h += panel('Top 60 cuentas AAA por monto desembolsado', '', tabla([
    { k: 'sede', t: 'Sede', f: 'txt', txt: true },
    { k: 'pipeline', t: 'Pipeline', f: 'txt' },
    { k: 'ranking', t: 'Ranking', f: 'txt' },
    { k: 'ciudad', t: 'Ciudad', f: 'txt' },
    { k: 'apps', t: 'Apps' },
    { k: 'appsMes', t: 'Apps mes' },
    { k: 'desembolsos', t: 'Desemb.' },
    { k: 'monto', t: 'Monto', f: 'cop' },
    { k: 'invRescate', t: 'Sin firmar' },
    { k: 'farmer', t: 'Farmer', f: 'txt' }
  ], f.aaa || []));

  // Pipelines
  h += '<h2 class="sec">Dónde están las 3.601 sedes hoy</h2>' +
    '<p class="sec-sub">Foto actual de la cartera. No responde al filtro de fechas: es el ' +
    'estado presente, no un flujo.</p>' +
    panel('Sedes por pipeline', 'totales por pipeline', '', 'gF2Pipe');
  pintar('gF2Pipe', function (el) {
    var tot = (f.pipelines || []).filter(function (p) { return p.etapa === '(TOTAL)'; });
    chBarrasH(el, tot.map(function (p) { return { etiqueta: p.pipeline, y: p.sedes }; }),
      { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 190 });
  });

  // Reactivadas del período
  if ((f.reactivadasDet || []).length) {
    h += panel('Sedes reactivadas en el período', 'clínicas muertas que volvieron a un pipeline vivo',
      tabla([
        { k: 'fecha', t: 'Fecha', f: 'txt' },
        { k: 'sede', t: 'Sede', f: 'txt', txt: true },
        { k: 'pipeline', t: 'Pipeline destino', f: 'txt' },
        { k: 'clas', t: 'Calidad', f: 'txt' },
        { k: 'farmer', t: 'Farmer', f: 'txt' }
      ], f.reactivadasDet));
  }

  h += cuali(f.textos);
  return h;
}

// ------------------------------------------------------------------ F4
function vistaF4() {
  var f = D.f4, g = D.meta.agrupacion;
  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 4</div>' +
    '<h1>Rescate de créditos estancados</h1>' +
    '<p class="lead">Un paciente rescatado es alguien a quien le aprobaron el crédito, ' +
    'dejó pasar la ventana de firma, lo contactamos, y finalmente desembolsó. El resultado ' +
    'de ese ciclo vive en BigQuery; el inventario que hay que atacar y las piezas que se ' +
    'mandan están en HubSpot y en Hilos, y esos sí se ven completos abajo.</p>' +
    '</div>';

  if (f.pendienteBQ) {
    h += avisoBox('Frente parcialmente en construcción — el resultado del rescate ' +
      '(quién desembolsó tras el contacto, en qué ventana y por cuánto) necesita la conexión ' +
      'a BigQuery. La query ya está escrita en Fuentes_BigQuery.gs: cuando la credencial ' +
      'vuelva, estas cuatro tarjetas se llenan solas.', true);
  }
  h += filaKPIs(f.kpis);

  if (!f.pendienteBQ) {
    h += '<div style="margin-top:14px">' +
      panel('Rescatados por ' + g, 'pacientes que desembolsaron fuera de la ventana', '', 'gF4Bq') +
      '</div>';
    pintar('gF4Bq', function (el) {
      chBarras(el, f.serieBQ || [], { color: 'var(--s4)', nombre: 'Rescatados', gran: g });
    });
  }

  h += '<h2 class="sec">El inventario que el rescate tiene que atacar</h2>' +
    '<p class="sec-sub">Esto sí es real hoy: créditos aprobados que el paciente no firmó. ' +
    'Es la materia prima del frente.</p>';
  h += filaKPIs(f.inventario);

  // El canal existió y se apagó: mostrarlo evita leer los ceros de 2026
  // como "nunca se intentó".
  var hi = f.historico || {};
  if (hi.campanas) {
    h += '<h2 class="sec">El canal de rescate ya existió — y se apagó</h2>' +
      '<p class="sec-sub">Histórico completo del canal en Hilos, a propósito fuera del filtro ' +
      'de fechas. Es la respuesta a si el frente funciona.</p>' +
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
          { k: 'respuestas', t: 'Respuestas' },
          { k: 'tasaResp', t: 'Tasa resp.', f: 'pct' }
        ], hi.ventanas)) +
        '</div>';
      pintar('gF4Vent', function (el) {
        chBarrasH(el, hi.ventanas.slice().sort(function (a, b) {
          return b.tasaResp - a.tasaResp;
        }).map(function (v) { return { etiqueta: v.pieza, y: v.tasaResp, d: v }; }),
          { color: 'var(--s4)', formato: fPct, anchoEtiqueta: 165,
            detalle: function (d) {
              return [{ nombre: 'Campañas', valor: fNum(d.d.campanas) },
                      { nombre: 'Enviados', valor: fNum(d.d.enviados) },
                      { nombre: 'Respuestas', valor: fNum(d.d.respuestas) }];
            } });
      });
      h += avisoBox('Los recordatorios de ventana ("15 días", "3 días") son las piezas con ' +
        'mejor respuesta de toda la operación de WhatsApp — muy por encima del 6,7% de ' +
        'cobranza, que mueve 45 veces más volumen. Llevan ' + fNum(hi.diasApagado) +
        ' días sin enviarse mientras el inventario de aprobados sin firmar sigue creciendo.');
    }
  }

  h += '<h2 class="sec">WhatsApp de rescate en el período seleccionado</h2>' +
    '<p class="sec-sub">Campañas de Hilos con tema de rescate o activación dentro del filtro. ' +
    'Si sale en cero, es que no se enviaron piezas en esas fechas.</p>';
  h += filaKPIs(f.whatsapp.kpis);

  var swa = f.whatsapp.serie || [];
  h += '<div class="grid2" style="margin-top:14px">' +
    panel('Alcance de las piezas de rescate', 'enviados, leídos y respuestas por ' + g,
      (swa.length ? leyenda([
        { nombre: 'Enviados', color: 'var(--s1)' },
        { nombre: 'Leídos', color: 'var(--s2)' },
        { nombre: 'Respuestas', color: 'var(--s4)' }]) : ''), 'gF4Wa') +
    panel('Piezas long tail enviadas', 'cuántas sedes recibieron cada pieza', '', 'gF4Pz') +
    '</div>';

  pintar('gF4Wa', function (el) {
    chGrupos(el, swa.map(function (p) { return p.x; }), [
      { nombre: 'Enviados', color: 'var(--s1)', valores: swa.map(function (p) { return p.enviados; }) },
      { nombre: 'Leídos', color: 'var(--s2)', valores: swa.map(function (p) { return p.leidos; }) },
      { nombre: 'Respuestas', color: 'var(--s4)', valores: swa.map(function (p) { return p.respuestas; }) }
    ], { gran: g, formato: fNum, vacio: 'Sin campañas de rescate en el período' });
  });
  pintar('gF4Pz', function (el) {
    chBarrasH(el, (f.piezas || []).map(function (p) {
      return { etiqueta: p.pieza + ' · ' + p.canal, y: p.sedes, d: p };
    }), { color: 'var(--s3)', formato: fNum, anchoEtiqueta: 150,
      detalle: function (d) {
        return [{ nombre: 'Sedes', valor: fNum(d.d.sedes) },
                { nombre: 'Apps hist.', valor: fNum(d.d.apps) },
                { nombre: 'Desembolsos', valor: fNum(d.d.desembolsos) },
                { nombre: 'Aprob. sin firmar', valor: fNum(d.d.invRescate) }];
      } });
  });
  h += avisoBox(f.piezasAviso);

  if ((f.whatsapp.top || []).length) {
    h += panel('Campañas de rescate del período por respuestas', '', tabla([
      { k: 'campana', t: 'Campaña', f: 'txt', txt: true },
      { k: 'fecha', t: 'Fecha', f: 'txt' },
      { k: 'enviados', t: 'Enviados' },
      { k: 'leidos', t: 'Leídos' },
      { k: 'respuestas', t: 'Respuestas' },
      { k: 'tasaResp', t: 'Tasa resp.', f: 'pct' }
    ], f.whatsapp.top));
  }

  if ((f.flows || []).length) {
    h += panel('Flows de rescate en Hilos', 'acumulado desde que se creó cada flow',
      tabla([
        { k: 'flow', t: 'Flow', f: 'txt', txt: true },
        { k: 'contactos', t: 'Contactos' },
        { k: 'completados', t: 'Completados' },
        { k: 'tasa', t: '% completado', f: 'pct' }
      ], f.flows));
    h += avisoBox(f.flowsAviso);
  }

  h += cuali(f.textos);
  return h;
}

// ------------------------------------------------------------------ F5
function vistaF5() {
  var f = D.f5;
  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 5</div>' +
    '<h1>Adopción de Welli Points</h1>' +
    '<p class="lead">Welli Points es el programa de incentivos para las sedes. La pregunta ' +
    'del frente es sencilla: de las sedes que pueden usarlo, cuántas entraron, y las que ' +
    'entraron producen más que las que no.</p>' +
    '</div>';

  if (f.pendienteBQ) h += avisoBox(f.notaBQ, true);

  h += filaKPIs(f.kpis);
  h += '<h2 class="sec">Puntos en circulación</h2>';
  h += filaKPIs(f.kpisSecundarios);

  var c = f.comparativo || {};
  h += '<h2 class="sec">¿Producen más las sedes que entraron?</h2>' +
    '<p class="sec-sub">Promedio de aplicaciones y desembolsos por sede.</p>' +
    '<div class="grid2">' +
    panel('Aplicaciones y desembolsos promedio por sede',
      'sedes activas en WP vs. sedes que no han entrado',
      leyenda([{ nombre: 'Activas con WP', color: 'var(--s4)' },
               { nombre: 'Sin entrar', color: 'var(--s1)' }]), 'gF5Comp') +
    panel('Sedes que ganaron su primer Welli Point', 'por mes, según la última fecha registrada',
      '', 'gF5Mes') +
    '</div>';

  pintar('gF5Comp', function (el) {
    chGrupos(el, ['Apps promedio', 'Desembolsos promedio'], [
      { nombre: 'Activas con WP', color: 'var(--s4)', valores: [c.appsConWP, c.desembConWP] },
      { nombre: 'Sin entrar', color: 'var(--s1)', valores: [c.appsSinWP, c.desembSinWP] }
    ], { formato: fNum, alto: 200 });
  });
  pintar('gF5Mes', function (el) {
    chBarras(el, (f.serieMes || []).map(function (m) { return { x: m.mes, y: m.sedes }; }),
      { color: 'var(--s2)', nombre: 'Sedes', gran: 'mes',
        vacio: 'Solo 83 sedes tienen fecha de último WP registrada' });
  });

  h += avisoBox(c.aviso);

  if ((f.campanas || []).length) {
    h += panel('Campañas de Welli Points en WhatsApp', 'mensajes del programa enviados por Hilos',
      tabla([
        { k: 'campana', t: 'Campaña', f: 'txt', txt: true },
        { k: 'fecha', t: 'Fecha', f: 'txt' },
        { k: 'enviados', t: 'Enviados' },
        { k: 'leidos', t: 'Leídos' },
        { k: 'respuestas', t: 'Respuestas' },
        { k: 'tasaResp', t: 'Tasa resp.', f: 'pct' }
      ], f.campanas));
  } else {
    h += panel('Campañas de Welli Points en WhatsApp', '',
      '<div class="vacio-graf">No hay campañas de Welli Points en el histórico de Hilos ' +
      'con nombre reconocible. El tema se deduce del nombre de la campaña.</div>');
  }

  return h;
}

// ------------------------------------------------------------------ F6
function vistaF6() {
  var f = D.f6;
  var h = '<div class="frente-head">' +
    '<div class="eyebrow">Frente 6</div>' +
    '<h1>Novedades de producto</h1>' +
    '<p class="lead">Cada lanzamiento con sus acciones, sus piezas y su inversión. La ' +
    'estructura está lista; los datos se escriben a mano porque la plataforma de cupones no ' +
    'expone una API.</p>' +
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
    cuerpo += '<div class="paso"><div class="n">' +
      (n.m1v === '' || n.m1v === null ? '--' : esc(fNum(n.m1v))) +
      '</div><div class="l">' + esc(n.m1n || 'métrica 1') + '</div></div>';
    cuerpo += '<div class="paso"><div class="n">' +
      (n.m2v === '' || n.m2v === null ? '--' : esc(fNum(n.m2v))) +
      '</div><div class="l">' + esc(n.m2n || 'métrica 2') + '</div></div>';
    cuerpo += '<div class="paso"><div class="n">' +
      (n.inversion ? esc(fCopC(n.inversion)) : '--') +
      '</div><div class="l">inversión</div></div>';
    cuerpo += '</div>';
    if (n.acciones) {
      cuerpo += '<p style="margin:10px 0 0;font-size:12px;color:var(--texto-3)"><b>Acciones:</b> ' +
        esc(n.acciones) + '</p>';
    }
    if (n.inicio || n.fin) {
      cuerpo += '<p style="margin:4px 0 0;font-size:12px;color:var(--texto-3)"><b>Período:</b> ' +
        esc(n.inicio || '?') + ' → ' + esc(n.fin || '?') + '</p>';
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

  document.getElementById('periodoInfo').innerHTML =
    'Período: <b>' + esc(m.inicio) + '</b> → <b>' + esc(m.fin) + '</b> (' + m.dias + ' días) · ' +
    'Compara contra <b>' + esc(m.prevInicio) + '</b> → <b>' + esc(m.prevFin) + '</b> · ' +
    'Agrupado por <b>' + esc(m.agrupacion) + '</b> · ' +
    'Última actualización de datos: <b>' + esc(m.ultimaActualizacion) + '</b>';

  // estado de fuentes en el sidebar
  var est = D.estado || {};
  var lineas = [];
  ['HubSpot Sedes', 'Hilos', 'Meta Ads', 'BigQuery Conversion', 'BigQuery Revenue',
   'BigQuery Rescate', 'BigQuery WelliPoints'].forEach(function (k) {
    var e = est[k];
    if (!e) return;
    var ico = e.estado === 'OK' ? '🟢' : '🔴';
    lineas.push(ico + ' ' + k);
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
  else html = vistaResumen();

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
  window.scrollTo(0, 0);
}

var VISTAS_VALIDAS = ['resumen', 'f1', 'f2', 'f4', 'f5', 'f6'];

function irA(v, sinHash) {
  if (VISTAS_VALIDAS.indexOf(v) < 0) v = 'resumen';
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
  return VISTAS_VALIDAS.indexOf(h) >= 0 ? h : 'resumen';
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
  document.querySelectorAll('.preset').forEach(function (x) {
    x.setAttribute('aria-pressed', x.getAttribute('data-p') === p ? 'true' : 'false');
  });
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
  var t = 'claro';
  try {
    t = localStorage.getItem('welli-tema') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'oscuro' : 'claro');
  } catch (e) {}
  document.documentElement.setAttribute('data-tema', t);

  document.getElementById('btnTema').addEventListener('click', function () {
    aplicarTema(document.documentElement.getAttribute('data-tema') === 'oscuro'
      ? 'claro' : 'oscuro');
  });
  document.getElementById('btnAplicar').addEventListener('click', function () {
    document.querySelectorAll('.preset').forEach(function (x) {
      x.setAttribute('aria-pressed', 'false');
    });
    cargar();
  });
  document.querySelectorAll('.preset').forEach(function (b) {
    b.addEventListener('click', function () { aplicarPreset(b.getAttribute('data-p')); });
  });
  document.querySelectorAll('.nav-item').forEach(function (b) {
    b.addEventListener('click', function () { irA(b.getAttribute('data-vista')); });
  });

  irA(vistaDelHash(), true);
  window.addEventListener('hashchange', function () { irA(vistaDelHash(), true); });

  aplicarPreset('3m');     // arranca en los últimos 3 meses
});
