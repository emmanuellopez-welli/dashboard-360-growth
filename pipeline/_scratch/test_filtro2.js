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
    log('FECHAS CAMBIADAS A MANO: 2026-05-15..2026-08-20');
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
    log('clavePreset: ' + clavePreset(leido));

    var ini = document.getElementById('fDesde').value;
    var fin = document.getElementById('fHasta').value;
    var clave = ini + '|' + fin + '|' + clavePreset(leido);
    log('fechas: ' + ini + '..' + fin);
    log('clave: ' + clave);
    log('payload existe: ' + !!window.PAYLOADS_PREVIA[clave]);
    log('claves disponibles con esas fechas: ' +
      Object.keys(window.PAYLOADS_PREVIA).filter(function (k) {
        return k.indexOf(ini + '|' + fin) === 0;
      }).join(' , '));

    document.getElementById('poListo').click();
    setTimeout(function () {
      var c = document.querySelector('.cinta-origen');
      log('cinta: ' + (c ? c.textContent.replace(/\s+/g, ' ').trim() : '(no hay)'));
      log('meta: ' + D.meta.origenEtiqueta + ' / ' + D.meta.origenSedes + ' sedes');
    }, 1000);
  } catch (e) {
    log('EXCEPCION: ' + e.message);
  }
}, 1500);
