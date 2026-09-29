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
  h += '<div class="grid2">' +
    panel('Composición del universo', 'por clasificación de aliado', '', 'gF1Torta') +
    panel('Sedes por cosecha', 'cuántas entraron cada mes y de qué calidad',
      leyenda([{ nombre: 'Sedes del universo', color: 'var(--s1)' },
               { nombre: 'AA', color: 'var(--s2)' },
               { nombre: 'AAA', color: 'var(--s3)' }]), 'gF1Cos') +
    '</div>';
  pintar('gF1Torta', function (el) {
    var COL = { 'AAA': 'var(--s3)', 'AA': 'var(--s2)', 'A': 'var(--s1)',
                'Sin clasificar': 'var(--borde-fuerte)' };
    chTorta(el, (comp.filas || []).map(function (r) {
      return { etiqueta: r.clase, y: r.n, color: COL[r.clase] || 'var(--s4)' };
    }), { alto: 230, formato: fNum, centroSub: 'sedes en el universo',
      detalle: function (d) {
        return [{ nombre: 'Sedes', valor: fNum(d.y) }];
      } });
  });
  pintar('gF1Cos', function (el) {
    chGrupos(el, cos.map(function (c) { return c.cosecha; }), [
      { nombre: 'Sedes del universo', color: 'var(--s1)',
        valores: cos.map(function (c) { return c.total; }) },
      { nombre: 'AA', color: 'var(--s2)', valores: cos.map(function (c) { return c.aa; }) },
      { nombre: 'AAA', color: 'var(--s3)', valores: cos.map(function (c) { return c.aaa; }) }
    ], { gran: 'mes', formato: fNum, vacio: 'Ninguna cosecha cae en el rango elegido' });
  });

  // --- Cohortes de deals de HubSpot ---------------------------------
  /* El equivalente de la tabla de cosechas pero un paso ANTES: en el
     pipeline comercial, cuando todavia es un negocio y no una sede. Dice
     cuantos deals entraron cada mes y cuantos se fueron cerrando ganados. */
  var dc = f.dealsCohorte || {};
  if (dc.hay && (dc.filas || []).length) {
    h += '<h2 class="sec">4 · Los deals que entraron, ¿se cierran?</h2>' +
      '<p class="sec-sub">negocios de HubSpot por mes de creación y cuántos llegaron a ' +
      'cierre ganado · solo orígenes de marketing</p>';
    h += tablaCohorte(dc.filas, dc.offsets, fNum,
      'Deals ganados · acumulado',
      'De los deals que entraron ese mes, cuántos ya están en cierre ganado al mes N. ' +
      'Solo sube.',
      'acum', '% del mes que ya cerró ganado');
    h += panel('Conversión final de cada mes', 'deals que entraron contra los que cerraron',
      tabla([
        { k: 'cosecha', t: 'Mes', f: 'txt' },
        { k: 'n', t: 'Deals' },
        { k: 'ganados', t: 'Cierre ganado' },
        { k: 'conv', t: 'Conversión', f: 'pct' }
      ], dc.filas));
  }
