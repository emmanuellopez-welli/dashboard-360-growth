  var ed = b.edad || [];
  h += '<div class="grid2" style="margin-top:14px">' +
    panel('% activa a igual antigüedad de sede',
      'la única comparación válida — el total crudo está inflado porque nuestras sedes son más nuevas',
      leyenda([{ nombre: 'Origen marketing', color: 'var(--s1)' },
               { nombre: 'Resto de la base', color: 'var(--s2)' }]), 'gF2Edad') +
    panel('En qué estado está nuestra base', 'sedes de origen marketing', tabla([
      { k: 'estado', t: 'Estado', f: 'txt', txt: true },
      { k: 'mkt', t: 'Sedes' },
      { k: 'pctMkt', t: '% de nuestra base', f: 'pct' }
    ], estados)) +
    '</div>';
  pintar('gF2Edad', function (el) {
    chGrupos(el, ed.map(function (x) { return x.tramo; }), [
      { nombre: 'Origen marketing', color: 'var(--s1)',
        valores: ed.map(function (x) { return x.pctMkt; }) },
      { nombre: 'Resto de la base', color: 'var(--s2)',
        valores: ed.map(function (x) { return x.pctResto; }) }
    ], { formato: fPct, alto: 210 });
  });
  if (b.veredicto) {
    var mal = (b.comparable || {}).brecha < 0;
    h += '<div class="lectura' + (mal ? ' alerta' : '') + '">' + esc(b.veredicto) + '</div>';
  }
  h += avisoBox(b.avisoEdad);
  h += avisoBox(b.aviso);
