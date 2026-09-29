var LOG = [];
function log(m) {
  LOG.push(m);
  var d = document.getElementById('__t');
  if (!d) { d = document.createElement('pre'); d.id = '__t'; document.body.appendChild(d); }
  d.textContent = LOG.join('\n');
}
function marcas() { return document.querySelectorAll('#gF7Serie svg line[stroke-dasharray]').length; }
setTimeout(function () {
  try {
    document.getElementById('fDesde').value = '2026-08-04';
    document.getElementById('fHasta').value = '2026-09-02';
    irA('f7');
    cargar();
    setTimeout(function () {
      log('chips: ' + document.querySelectorAll('.imp-chip').length +
          '  encendidos: ' + document.querySelectorAll('.imp-chip.on').length);
      log('marcas dibujadas: ' + marcas());
      log('barras: ' + document.querySelectorAll('#gF7Serie svg path[fill]').length);
      // apaga uno
      var c = document.querySelectorAll('.imp-chip')[0];
      var etq = c.textContent.trim().substring(0, 22);
      c.click();
      setTimeout(function () {
        log('tras apagar "' + etq + '": encendidos=' +
            document.querySelectorAll('.imp-chip.on').length +
            '  marcas=' + marcas());
        document.querySelector('.imp-todo:nth-child(2)').click();
        setTimeout(function () {
          log('tras "ninguno": encendidos=' +
              document.querySelectorAll('.imp-chip.on').length +
              '  marcas=' + marcas());
          document.querySelector('.imp-todo').click();
          setTimeout(function () {
            log('tras "todos": encendidos=' +
                document.querySelectorAll('.imp-chip.on').length +
                '  marcas=' + marcas());
            log('tablas: ' + document.querySelectorAll('table.t').length +
                '  cadencias: ' + document.querySelectorAll('.cadencia').length);
          }, 900);
        }, 900);
      }, 900);
    }, 2600);
  } catch (e) { log('EXCEPCION: ' + e.message); }
}, 2000);
