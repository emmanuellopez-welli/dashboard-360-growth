var LOG = [];
function log(m) {
  LOG.push(m);
  var d = document.getElementById('__t');
  if (!d) { d = document.createElement('pre'); d.id = '__t'; document.body.appendChild(d); }
  d.textContent = LOG.join('\n');
}
setTimeout(function () {
  try {
    document.getElementById('fDesde').value = '2026-08-01';
    document.getElementById('fHasta').value = '2026-08-31';
    // Marca solo EVENTO en el panel de origen, como lo haria una persona.
    document.getElementById('btnOrigen').click();
    setTimeout(function () {
      var chks = document.querySelectorAll('#poLista input[type=checkbox]');
      log('checkboxes en el panel: ' + chks.length);
      var marcado = null;
      chks.forEach(function (c) {
        c.checked = (c.value === 'EVENTO');
        if (c.checked) marcado = c.value;
      });
      log('marcado: ' + marcado);
      document.getElementById('poListo').click();
      setTimeout(function () {
        var txt = document.body.innerText;
        log('cinta dice: ' + (txt.match(/Origen[^\n]{0,60}/) || ['?'])[0]);
        log('meta.origenEtiqueta: ' + D.meta.origenEtiqueta);
        log('meta.origenSedes: ' + D.meta.origenSedes);
        log('F1 seccion5 sol: ' + D.f1.embudo.pasos[0].valor +
            '  plata: ' + D.f1.embudo.kpis[3].valor +
            '  sedes: ' + D.f1.embudo.sedes);
        log('F1 deals: ' + D.f1.dealsCohorte.filas.reduce(function (s, r) { return s + r.n; }, 0));
        log('secciones pintadas: ' + document.querySelectorAll('h2.sec').length);
        log('titulo 5: ' + (Array.prototype.map.call(document.querySelectorAll('h2.sec'),
              function (h) { return h.textContent; }).filter(function (t) {
                return t.indexOf('5 ·') === 0; })[0] || '?'));
        log('graficas con svg: ' + document.querySelectorAll('.panel svg').length);
      }, 2500);
    }, 600);
  } catch (e) { log('EXCEPCION: ' + e.message + ' | ' + e.stack); }
}, 2000);
