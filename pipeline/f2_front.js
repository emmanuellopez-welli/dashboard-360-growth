/* Un mapa de cohorte de profundizacion. Recibe la especificacion que armo
   el motor (D.f2.mapas[n]) para no acabar con una firma de diez argumentos
   posicionales.

   Cada celda lleva el numero Y su porcentaje sobre la cosecha, porque el
   porcentaje es EXACTAMENTE lo que define la intensidad del color: si no
   esta escrito, hay que estimar el tono. En el mapa de desembolsos el
   segundo dato es la plata, que es la unidad que importa ahi. */
function mapaCohorte(m) {
  var filas = m.filas || [];
  if (!filas.length) {
    return '<div class="panel"><h3>' + esc(m.titulo) + '</h3>' +
      '<div class="vacio-graf">Sin cosechas en este universo</div></div>';
  }
  var tope = topePorSede(filas);
  var h = '<div class="panel"><h3>' + esc(m.orden + ' · ' + m.titulo) + '</h3>' +
    '<p class="sub"><b>' + esc(m.pregunta) + '</b> ' + esc(m.def) + '. ' +
    esc(m.sub) + '</p><div class="tabla-wrap">' +
    '<table class="t"><thead><tr><th>Cosecha</th><th>' + esc(m.colN || 'Sedes') + '</th>';
  for (var k = 0; k <= (m.offsets === undefined ? 7 : m.offsets); k++) {
    h += '<th>M' + k + '</th>';
  }
  h += '</tr></thead><tbody>';
  var hayBajas = false;
  filas.forEach(function (f) {
    var baja = !f.n || f.n < MIN_COSECHA;
    if (baja) hayBajas = true;
    h += '<tr><td>' + esc(f.cosecha) +
      (baja ? ' <span class="cel-vacia" style="font-size:10px">muestra baja</span>' : '') +
      '</td><td>' + fNum(f.n) + '</td>';
    (f.celdas || []).forEach(function (c, i) {
      // null = mes que todavia no ocurrio. Vacio, no cero.
      if (c === null || c === undefined) { h += '<td class="cel-vacia">·</td>'; return; }
      var pc = f.n ? Math.round((c / f.n) * 1000) / 10 : 0;
      var segundo = '';
      if (m.conMonto) {
        var mo = (f.extras || [])[i];
        segundo = '<span class="cel-pct">' + esc(mo ? fCopC(mo) : '$0') + '</span>';
      } else if (m.pctCelda) {
        segundo = '<span class="cel-pct">' + esc(fPct(pc)) + '</span>';
      }
      if (baja) {
        h += '<td class="cel-vacia">' + esc(fNum(c)) + segundo + '</td>';
        return;
      }
      var paso = pasoCalor(c, f.n, tope);
      var tt = f.cosecha + ' · M' + i + ' · ' + fNum(c) + ' de ' + fNum(f.n) +
        ' (' + fPct(pc) + ')' +
        (m.conMonto && (f.extras || [])[i] ? ' · ' + fCop(f.extras[i]) : '');
      h += '<td class="hm hm-' + m.clase + '-' + paso + '" title="' + esc(tt) + '">' +
        esc(fNum(c)) + segundo + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>' +
    leyendaCalor(m.clase, m.escala || 'intensidad por sede de la cosecha') +
    (hayBajas
      ? '<p class="sub" style="margin:6px 0 0">Las cosechas con menos de ' +
        MIN_COSECHA + ' sedes van en gris y no entran en la escala: con esa ' +
        'muestra, una sola sede mueve el porcentaje demasiado.</p>'
      : '') +
    '</div>';
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
