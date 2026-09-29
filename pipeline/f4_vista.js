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

  h += cuali(f.textos);
  return h;
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
