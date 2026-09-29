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
