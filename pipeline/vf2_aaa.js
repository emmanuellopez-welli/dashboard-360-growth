  // --- 6. Las cuentas AAA -------------------------------------------
  /* Fuente: el archivo curado del equipo (sedes AAA.xlsx), no el cruce con
     HubSpot. Trae especialidad, monto del mes y propietario, que es lo que
     hace gestionable la cuenta. Por ahora solo clase AAA. */
  var aa = f.aaa || {};
  var cl = f.clases || [];
  h += '<h2 class="sec">6 · Las cuentas AAA</h2>' +
    '<p class="sec-sub">las de mayor valor de la base · fuente: archivo del equipo</p>';
  h += filaKPIs(aa.kpis || []);

  var COLVA = { 'C': 'var(--s1)', 'B': 'var(--s2)', 'A': 'var(--s3)' };
  h += '<div class="grid2" style="margin-top:14px">' +
    panel('Distribución por clasificación', 'en % de cada universo',
      leyenda(leySel), 'gF2Clases') +
    panel('AAA por ventana de decisión',
      'la ventana la define la especialidad · define el ritmo de gestión',
      tabla([
        { k: 'nombre', t: 'Ventana', f: 'txt', txt: true },
        { k: 'cuentas', t: 'Cuentas' },
        { k: 'monto', t: 'Plata', f: 'cop' },
        { k: 'pctMonto', t: '% del monto', f: 'pct' },
        { k: 'frias', t: 'Frías' }
      ], aa.porVentana || [])) +
    '</div>';
  pintar('gF2Clases', function (el) {
    var ser = [{ nombre: etSel, color: 'var(--s1)',
                 valores: cl.map(function (x) { return x.pctMkt; }) }];
    if (f.comparar) {
      ser.push({ nombre: 'Resto de la base', color: 'var(--s2)',
                 valores: cl.map(function (x) { return x.pctResto; }) });
    }
    chGrupos(el, cl.map(function (x) { return x.clase; }), ser,
      { formato: fPct, alto: 210 });
  });

  h += panel('Las cuentas AAA, por plata firmada',
    'mirar "días sin app": una AAA que se pasa de 30 días es la pérdida más cara',
    tabla([
      { k: 'sede', t: 'Cuenta', f: 'txt', txt: true },
      { k: 'especialidad', t: 'Especialidad', f: 'txt' },
      { k: 'ventana', t: 'Vent.', f: 'txt' },
      { k: 'departamento', t: 'Depto.', f: 'txt' },
      { k: 'origen', t: 'Origen', f: 'txt' },
      { k: 'monto', t: 'Histórico', f: 'cop' },
      { k: 'mtd', t: 'Este mes', f: 'cop' },
      { k: 'dias', t: 'Días sin app' },
      { k: 'propietario', t: 'Propietario', f: 'txt' }
    ], aa.filas || [], { vacio: 'Ninguna cuenta AAA con el origen elegido' }));
