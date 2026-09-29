var LOG = [];
function log(m) {
  LOG.push(m);
  var d = document.getElementById('__t');
  if (!d) { d = document.createElement('pre'); d.id = '__t'; document.body.appendChild(d); }
  d.textContent = LOG.join(' ;; ');
}
setTimeout(function () {
  try {
    document.getElementById('fDesde').value = '2026-07-01';
    document.getElementById('fHasta').value = '2026-08-31';
    GRAN_PAUTA = 'mes';
    cargar();
    setTimeout(function () {
      log('serie cruda: ' + (D.f1.serie || []).length + ' puntos');
      var sl = serieSegunGran(D.f1.serie, 'leads');
      var sc = serieSegunGran(D.f1.serie, 'cpl');
      log('por mes leads: ' + sl.length + ' -> ' + sl.map(function (p) {
        return p.x + '=' + p.y;
      }).join(' , '));
      log('por mes cpl: ' + sc.length + ' -> ' + sc.map(function (p) {
        return p.x + '=' + p.y;
      }).join(' , '));
      log('gasto por mes: ' + sc.map(function (p) { return p.x + '=' + p.gasto; }).join(' , '));
      var g1 = document.getElementById('gF1Leads');
      var g2 = document.getElementById('gF1Cpl');
      log('barras dibujadas: ' + (g1 ? g1.querySelectorAll('path[fill]').length : '?'));
      log('puntos de linea: ' + (g2 ? g2.querySelectorAll('circle').length : '?'));
      log('GRAN_PAUTA: ' + GRAN_PAUTA);
    }, 1200);
  } catch (e) { log('EXCEPCION: ' + e.message); }
}, 1500);
