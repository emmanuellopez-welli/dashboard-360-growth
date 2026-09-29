// Prueba los clics REALES sobre el filtro, no el payload.
var LOG = [];
function log(m) {
  LOG.push('TEST ' + m);
  var d = document.getElementById('__t');
  if (!d) { d = document.createElement('pre'); d.id = '__t'; document.body.appendChild(d); }
  d.textContent = LOG.join(' ;; ');
}
setTimeout(function () {
  try {
    log('catalogo: ' + CATALOGO_ORIG.length + ' origenes');
    log('presets: ' + Object.keys(PRESETS_ORIG).join('/'));
    log('SEL inicial: [' + ORIGENES_SEL.join(',') + ']');

    document.getElementById('fDesde').value = '2026-05-15';
    document.getElementById('fHasta').value = '2026-08-20';
    log('FECHAS A MANO: 2026-05-15..2026-08-20');
    document.getElementById('btnOrigen').click();
    log('panel abierto: ' + !document.getElementById('panelOrigen').classList.contains('oculto'));

    var chips = document.querySelectorAll('#poPresets [data-preset]');
    var nombres = [];
    for (var i = 0; i < chips.length; i++) nombres.push(chips[i].getAttribute('data-preset'));
    log('chips: ' + chips.length + ' -> ' + nombres.join(','));

    var mkt = null;
    for (var j = 0; j < chips.length; j++) {
      if (chips[j].getAttribute('data-preset') === 'marketing') mkt = chips[j];
    }
    if (!mkt) { log('NO HAY CHIP marketing'); return; }
    mkt.click();
    log('tras chip: SEL=[' + ORIGENES_SEL.join(',') + ']');
    log('checks marcados: ' + document.querySelectorAll('#poLista input:checked').length);
    var leido = leerChecksOrigen();
    log('leerChecks: [' + leido.join(',') + ']');

    var ini = document.getElementById('fDesde').value;
    var fin = document.getElementById('fHasta').value;
    log('fechas: ' + ini + '..' + fin);
    log('motor local: ' + !!window.MOTOR_LOCAL);

    document.getElementById('poListo').click();
    setTimeout(function () {
      var c = document.querySelector('.cinta-origen');
      log('cinta: ' + (c ? c.textContent.replace(/\s+/g, ' ').trim() : '(no hay)'));
      log('meta: ' + D.meta.origenEtiqueta + ' / ' + D.meta.origenSedes + ' sedes');
      log('rango del payload: ' + D.meta.inicio + '..' + D.meta.fin + '  (' + D.meta.ms + 'ms)');
      log('F2 activas: ' + D.f2.base.kpis[1].valor + '%   F4 ventana: ' +
        D.f4.ventana.total + '   F5 canjes: ' + D.f5.pago.kpis[0].valor);
    }, 1000);
  } catch (e) {
    log('EXCEPCION: ' + e.message);
  }
}, 1500);
