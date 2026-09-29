    var vt2 = f.ventanas || [];
    var COLV = { 'C': 'var(--s1)', 'B': 'var(--s2)', 'A': 'var(--s3)' };
    /* Tres series azul/ambar/morado: DeltaE 28,9 en claro y 26,2 en oscuro.
       El reparto va en % de CADA ventana, no del total, porque C tiene 16.081
       firmas y A tiene 400: en absolutos A no se veria. */
    var vtG = vt2.filter(function (v) { return COLV[v.id]; });
    h += '<div class="grid2" style="margin-top:14px">' +
      panel('Cómo firma cada ventana', 'en % de su propia ventana',
        leyenda(vtG.map(function (v) {
          return { nombre: v.ventana, color: COLV[v.id] };
        })), 'gF4Vent') +
      panel('Cuánto se ha firmado al día N', '% acumulado de los desembolsos del período',
        '', 'gF4Curva') +
      '</div>';
    pintar('gF4Vent', function (el) {
      var cats = (vtG[0] && vtG[0].tramos || []).map(function (t) { return t.etiqueta; });
      chGrupos(el, cats, vtG.map(function (v) {
        return { nombre: v.ventana, color: COLV[v.id],
                 valores: (v.tramos || []).map(function (t) { return t.pct; }) };
      }), { formato: fPct, alto: 210 });
    });
    pintar('gF4Curva', function (el) {
      chLinea(el, (f.curva || []).map(function (x) {
        return { x: String(x.dia), y: x.pctAcum, d: x };
      }), { color: 'var(--s4)', alto: 210, formatoEje: fPct,
        detalle: function (d) {
          return [{ nombre: 'Día', valor: String(d.d.dia) },
                  { nombre: 'Firmas ese día', valor: fNum(d.d.firmas) },
                  { nombre: 'Acumulado', valor: fPct(d.d.pctAcum) }];
        } });
    });

    h += panel('Las tres ventanas de decisión',
      'la ventana la define la especialidad de la sede, no el monto ni el canal',
      tabla([
        { k: 'ventana', t: 'Ventana', f: 'txt', txt: true },
        { k: 'especialidades', t: 'Especialidades', f: 'txt', txt: true },
        { k: 'firmas', t: 'Firmas' },
        { k: 'pct', t: '% del total', f: 'pct' },
        { k: 'dias', t: 'Días prom.' },
        { k: 'pctMismoDia', t: 'Mismo día', f: 'pct' },
        { k: 'pct16a30', t: 'Día 16 a 30', f: 'pct' },
        { k: 'monto', t: 'Plata', f: 'cop' }
      ], vt2));

    /* El comportamiento declarado de cada ventana al lado del medido: es lo
       que convierte la tabla en una guia de que pieza mandar a quien. */
    if (vtG.length) {
      h += '<div class="grid3" style="margin-top:4px">' + vtG.map(function (v) {
        return '<div class="panel" style="border-top:3px solid ' + COLV[v.id] + '">' +
          '<h3>' + esc(v.ventana) + '</h3>' +
          '<p class="sub">' + esc(v.especialidades) + '</p>' +
          '<p style="margin:0 0 10px;font-size:13.5px;color:var(--texto-2);line-height:1.5">' +
          esc(v.comportamiento) + '</p>' +
          '<div class="flujo">' +
          '<div class="paso"><div class="n">' + fPct(v.pctMismoDia) + '</div>' +
          '<div class="l">firma el mismo día</div></div>' +
          '<div class="paso"><div class="n">' + fNum(v.dias) + ' d</div>' +
          '<div class="l">promedio</div></div>' +
          '<div class="paso"><div class="n">' + fPct(v.pct16a30) + '</div>' +
          '<div class="l">del día 16 al 30</div></div>' +
          '</div></div>';
      }).join('') + '</div>';
    }
