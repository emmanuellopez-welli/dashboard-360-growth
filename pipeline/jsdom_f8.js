/* Verificacion de CONTENIDO de F8 — Segundos creditos (regla 16 de CLAUDE.md).
   qa_tablero.js prueba el motor y jsdom_stress.js prueba que no truene el
   render; ninguno de los dos comprueba que el panel nuevo REALMENTE pinte
   algo. El bug de la v62 (leer D.f6 donde iba D.f7) paso las tres pruebas y
   aun asi la tabla se veia vacia. Aca se cuenta contenido de verdad.

   Ojo con QUE se cuenta en el Sankey: las bandas son <path class="sk-banda">
   y los nodos son <rect>. Contar rects daria "OK" aunque no se hubiera
   pintado una sola banda — que es justo el falso OK que la regla 16 quiere
   evitar (mismo aprendizaje que chGrupos en la seccion 25). Hay que contar
   los paths de banda. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');

let checks = 0, fallos = 0;
function ok(nombre, cond, detalle) {
  checks++;
  if (cond) { console.log('  OK  ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable',
  pretendToBeVisual: true, url: 'https://x/exec'
});
const win = dom.window;

/* Se navega con el CLIC REAL del boton del nav, no con win.VISTA='f8'.
   Forzar la variable salta irA(), que es justo donde estaba el bug del
   28-sep-2026: f8 no estaba en VISTAS_VALIDAS, asi que el clic rebotaba a
   f1 y el boton se veia muerto — con VISTA forzado la verificacion daba
   15/15 igual. Si se prueba la vista sin pasar por el camino que usa el
   usuario, no se esta probando lo que el usuario hace. */
function cargarRango(desde, hasta, cb) {
  win.document.getElementById('fDesde').value = desde;
  win.document.getElementById('fHasta').value = hasta;
  win.document.querySelector('.nav-item[data-vista="f8"]').click();
  win.cargar();
  setTimeout(cb, 4000);
}

setTimeout(() => {
  cargarRango('2026-09-01', '2026-09-28', () => {
    const doc = win.document;
    const f = win.D.f8;

    console.log('--- payload f8 ---');
    console.log(JSON.stringify({
      aptos: f.aptos, solicitudes: f.solicitudes, desembolsos: f.desembolsos,
      monto: f.monto, rutas: (f.rutas || []).length, cruzaron: f.cruzaron,
      serie: (f.serie || []).length
    }));

    console.log('--- contenido en el DOM ---');
    const txt = doc.body.textContent;

    // Lo primero: que el clic del nav de verdad haya LLEGADO a f8. Sin este
    // check, un rebote silencioso a f1 (bug del 28-sep-2026) deja pasar todo
    // lo demas siempre que f1 tambien tenga KPIs y graficas.
    ok('el clic del nav deja la vista en f8 (no rebota a f1)', win.VISTA === 'f8',
      'VISTA=' + win.VISTA);
    ok('f8 esta en VISTAS_VALIDAS', win.VISTAS_VALIDAS.indexOf('f8') >= 0);
    ok('el boton del nav queda marcado como actual',
      doc.querySelector('.nav-item[data-vista="f8"]').getAttribute('aria-current') === 'true');

    ok('el frente se titula Segundos creditos', txt.indexOf('segundos créditos') >= 0);
    ok('hay 4 tarjetas de KPI', doc.querySelectorAll('.kpis .kpi').length >= 4,
      doc.querySelectorAll('.kpis .kpi').length + ' tarjetas');
    ok('la tarjeta de aptos declara que es foto de hoy', txt.indexOf('foto de hoy') >= 0);
    ok('declara cuantos ya salieron del pool',
      txt.indexOf('ya aplicaron y salieron del pool') >= 0);

    // --- serie diaria: barras agrupadas reales, no un contenedor vacio ---
    const gSerie = doc.getElementById('gF8Serie');
    ok('existe el contenedor de la serie', !!gSerie);
    const barras = gSerie ? gSerie.querySelectorAll('svg path') : [];
    ok('la serie pinta barras de verdad', barras.length > 0, barras.length + ' paths');
    // Dos series distintas: tiene que haber al menos un color de cada una.
    const colores = new Set();
    barras.forEach(b => colores.add(b.getAttribute('fill')));
    ok('la serie pinta las DOS series (solicitudes y desembolsos)',
      colores.size >= 2, 'colores distintos: ' + colores.size);

    // --- Sankey: contar BANDAS (paths), no nodos (rects) ---
    const gRutas = doc.getElementById('gF8Rutas');
    ok('existe el contenedor del Sankey', !!gRutas);
    const bandas = gRutas ? gRutas.querySelectorAll('svg path.sk-banda') : [];
    ok('el Sankey pinta bandas de verdad', bandas.length > 0, bandas.length + ' bandas');
    ok('el Sankey pinta tantas bandas como rutas trae el payload',
      bandas.length === (f.rutas || []).length,
      bandas.length + ' vs ' + (f.rutas || []).length);
    const nodos = gRutas ? gRutas.querySelectorAll('svg rect') : [];
    ok('el Sankey pinta los nodos de las dos columnas', nodos.length > 0,
      nodos.length + ' nodos');
    ok('el Sankey rotula las dos columnas',
      txt.indexOf('1er crédito') >= 0 && txt.indexOf('2º crédito') >= 0);
    ok('declara cuantos cruzaron de especialidad',
      txt.indexOf('cambiaron de especialidad') >= 0);

    // --- el filtro de fecha SI mueve las solicitudes (seccion 20) ---
    const solSep = f.solicitudes;
    cargarRango('2026-08-01', '2026-08-20', () => {
      const f2 = win.D.f8;
      console.log('--- con un rango ANTES de que arrancara el programa ---');
      console.log('  solicitudes sep=' + solSep + '  ago(1-20)=' + f2.solicitudes);
      ok('las solicitudes se cortan por fecha (sec. 20)',
        f2.solicitudes < solSep, solSep + ' -> ' + f2.solicitudes);
      ok('el pool de aptos NO se corta por fecha (es foto de hoy)',
        f2.aptos === f.aptos, f.aptos + ' -> ' + f2.aptos);

      console.log('');
      console.log('checks: ' + checks + '  fallos: ' + fallos);
      process.exit(fallos ? 1 : 0);
    });
  });
}, 3000);
