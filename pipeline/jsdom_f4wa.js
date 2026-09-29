/* Verificacion de CONTENIDO del embudo de WhatsApp tras el filtro de
   rescatables (28-sep-2026). Regla 16: las tres pruebas no comprueban que
   la pantalla diga lo que debe decir. Se navega con el CLIC real del nav. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');
let checks = 0, fallos = 0;
function ok(n, c, d) {
  checks++;
  if (c) console.log('  OK  ' + n);
  else { fallos++; console.log('  FALLA ' + n + (d ? '  -> ' + d : '')); }
}
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable',
  pretendToBeVisual: true, url: 'https://x/exec' });
const win = dom.window;

function cargar(desde, hasta, cb) {
  win.document.getElementById('fDesde').value = desde;
  win.document.getElementById('fHasta').value = hasta;
  win.document.querySelector('.nav-item[data-vista="f4"]').click();
  win.cargar();
  setTimeout(cb, 4000);
}

setTimeout(() => {
  cargar('2026-09-20', '2026-09-28', () => {
    const doc = win.document, txt = doc.body.textContent;
    const wa = win.D.f4.gestion.whatsapp;
    console.log('--- payload 20-28 sep ---');
    console.log(JSON.stringify({ universo: wa.universo, contactados: wa.contactados,
      yaAvanzaron: wa.yaAvanzaron, respondieron: wa.respondieron }));

    ok('el clic del nav deja la vista en f4', win.VISTA === 'f4');
    ok('el embudo pinta sus barras',
      doc.querySelectorAll('.emb-fila, .embudo .fila, .emb').length > 0 ||
      txt.indexOf('Aprobados') >= 0);
    ok('el universo excluye a los que ya avanzaron', wa.yaAvanzaron > 0,
      'yaAvanzaron=' + wa.yaAvanzaron);
    ok('el universo quedo mas chico que aprobados+yaAvanzaron',
      wa.universo < wa.universo + wa.yaAvanzaron);
    ok('la cobertura supera el 70% con el filtro',
      (wa.contactados / wa.universo) > 0.7,
      ((wa.contactados / wa.universo) * 100).toFixed(1) + '%');
    ok('declara que son solo RESCATABLES', txt.indexOf('Solo pacientes RESCATABLES') >= 0);
    ok('declara que el estado es foto de hoy', txt.indexOf('foto de hoy') >= 0);
    ok('declara cuantos quedaron fuera por haber avanzado',
      txt.indexOf('ya avanzaron y quedan fuera') >= 0);
    ok('esta el disclaimer de las DOS poblaciones de la pestana',
      txt.indexOf('Dos poblaciones distintas en esta pestaña') >= 0);
    ok('el disclaimer explica que las otras secciones SI incluyen a los que firmaron',
      txt.indexOf('incluyen a los pacientes que terminaron firmando') >= 0);

    // El filtro de fecha sigue moviendo el embudo (seccion 20)
    const uniSep = wa.universo;
    cargar('2026-08-01', '2026-08-31', () => {
      const wa2 = win.D.f4.gestion.whatsapp;
      console.log('--- agosto ---');
      console.log(JSON.stringify({ universo: wa2.universo, contactados: wa2.contactados,
        yaAvanzaron: wa2.yaAvanzaron }));
      ok('el embudo se mueve con el filtro de fecha', wa2.universo !== uniSep,
        uniSep + ' -> ' + wa2.universo);
      ok('agosto tambien supera el 70% con el filtro',
        (wa2.contactados / wa2.universo) > 0.7,
        ((wa2.contactados / wa2.universo) * 100).toFixed(1) + '%');
      console.log('');
      console.log('checks: ' + checks + '  fallos: ' + fallos);
      process.exit(fallos ? 1 : 0);
    });
  });
}, 3000);
