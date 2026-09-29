const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('artifact_tablero.html', 'utf8');

(async () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable',
    pretendToBeVisual: true,
    url: 'https://example.com/artifact.html' });
  const win = dom.window;

  win.onerror = function (msg, src, line, col, err) {
    console.log('WINDOW ERROR:', msg, 'line', line);
    if (err && err.stack) console.log(err.stack);
  };

  // Esperar a que cargue el primer render (MOTOR_LOCAL con setTimeout 20ms)
  await new Promise(r => setTimeout(r, 1500));

  console.log('CARGANDO tras primer render, D existe?', !!win.D);
  console.log('error div oculto?', win.document.getElementById('error') &&
    win.document.getElementById('error').classList.contains('oculto'));
  console.log('error div texto:', win.document.getElementById('error') &&
    win.document.getElementById('error').innerHTML.slice(0, 300));

  // getDashboardData es global (definida en Code.gs, cargado en el
  // contexto de window). La llamo directo, en el mismo window, con las
  // fechas y el D ya cargado, para sacar el stack real sin pasar por el
  // catch de cargar() que lo traga.
  var ini = win.document.getElementById('fDesde').value;
  var fin = win.document.getElementById('fHasta').value;
  var orig = win.ORIGENES_SEL.slice();
  console.log('probando con ini/fin:', ini, fin);

  ['hunter individual', 'equipo completo'].forEach(function (etq, i) {
    var roles = i === 0 ? { hunter: '83703393' } : { hunter: '__equipo__' };
    try {
      var d = win.getDashboardData(ini, fin, orig, roles, '');
      console.log(etq + ': OK, sin excepcion en getDashboardData');
      // Ahora probar el render con esos datos, que es donde de verdad
      // truena (el catch de cargar() envuelve ok() Y render()).
      win.D = d;
      win.ROLES_SEL = roles;
      try {
        win.render();
        console.log(etq + ': render() tambien OK');
      } catch (e2) {
        console.log(etq + ': CRASH EN render():', e2.message);
        console.log(e2.stack);
      }
    } catch (e) {
      console.log(etq + ': CRASH EN getDashboardData:', e.message);
      console.log(e.stack);
    }
  });

  process.exit(0);
})();
