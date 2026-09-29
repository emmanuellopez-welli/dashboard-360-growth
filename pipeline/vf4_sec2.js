  // --- 2. Cuando se firma: la verdad de la ventana -------------------
  /* Antes esta seccion celebraba las firmas del dia 16 al 30 como "el
     comportamiento que el rescate busca provocar". El reparto real dice lo
     contrario: la masa esta en las primeras 72 horas. El titulo ahora
     afirma la conclusion en vez de preguntar, y la curva acumulada la
     hace evidente sin leer un numero. */
  var vt = f.ventana || {};
  if ((vt.filas || []).length && vt.total) {
    h += '<h2 class="sec">2 · La firma se decide en 72 horas, no en 30 días</h2>' +
      '<p class="sec-sub">Sobre los ' + fNum(vt.total) + ' desembolsos del período, ' +
      'contando los días entre la aprobación y la firma. Esto reordena para qué sirve ' +
      'el frente.</p>';
    h += filaKPIs((f.kpis || []).slice(0, 3));

    h += '<div class="grid2" style="margin-top:14px">' +
      panel('Cuánto se ha firmado al día N', '% acumulado de los desembolsos del período',
        '', 'gF4Curva') +
      panel('Reparto por tramo', 'y la plata de cada tramo', tabla([
        { k: 'balde', t: 'Tramo', f: 'txt' },
        { k: 'creditos', t: 'Firmas' },
        { k: 'pct', t: '% del total', f: 'pct' },
        { k: 'monto', t: 'Plata', f: 'cop' }
      ], vt.filas)) +
      '</div>';
    pintar('gF4Curva', function (el) {
      chLinea(el, (f.curva || []).map(function (x) {
        return { x: String(x.dia), y: x.pctAcum, d: x };
      }), { color: 'var(--s1)', alto: 210, formatoEje: fPct,
        detalle: function (d) {
          return [{ nombre: 'Día', valor: String(d.d.dia) },
                  { nombre: 'Firmas ese día', valor: fNum(d.d.firmas) },
                  { nombre: 'Acumulado', valor: fPct(d.d.pctAcum) }];
        } });
    });
    if (vt.lectura) h += '<div class="lectura alerta">' + esc(vt.lectura) + '</div>';
    if (vt.avisoFuera) h += avisoBox(vt.avisoFuera);
    // El KPI pendiente sale de la fila principal: un numero que sabemos
    // vacio al lado de tres que si sirven le quita autoridad a los tres.
    var kPend = (f.kpis || [])[3];
    if (kPend) {
      h += avisoBox(kPend.label + ' — ' + (kPend.notaLarga || kPend.nota || ''), true);
    }
  }
