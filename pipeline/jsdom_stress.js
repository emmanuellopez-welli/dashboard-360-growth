const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');

const FECHAS = [
  ['2026-09-01', '2026-09-09'],   // mes en curso
  ['2026-01-01', '2026-09-09'],   // todo el año
  ['2026-08-01', '2026-08-31'],   // mes cerrado
  ['2026-06-01', '2026-06-07'],   // semana vieja
  ['2026-07-01', '2026-07-31'],   // antes del arranque del software
  ['2026-07-20', '2026-08-10'],   // rango libre, a caballo entre dos meses
  ['2026-08-14', '2026-08-14'],   // un solo dia
];
const ROLES = [
  {},
  { hunter: '83703393' },
  { hunter: '__equipo__' },
  { farmer: '83703392' },
  { cs: '84380860' },
  { hunter: '__equipo__', farmer: '84380859' },
];
const ORIGENES = [
  [],
  ['HUNTER'],
  ['EVENTO'],
  ['DENTALINK'],
  ['EVENTO', 'REFERIDO', 'PAGINA WEB', 'SOCIAL MEDIA'],
];

(async () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable',
    pretendToBeVisual: true, url: 'https://example.com/a.html' });
  const win = dom.window;
  await new Promise(r => setTimeout(r, 1500));

  let total = 0, fallos = 0;
  for (const [ini, fin] of FECHAS) {
    for (const roles of ROLES) {
      for (const orig of ORIGENES) {
        total++;
        try {
          const d = win.getDashboardData(ini, fin, orig, roles, '');
          win.D = d;
          win.ROLES_SEL = roles;
          win.ORIGENES_SEL = orig.slice();
          // El render lee los dos calendarios (la tarjeta de metas elige la
          // fila del rango, y el aviso de "antes del software" compara
          // contra la fecha fin), asi que hay que dejarlos en el rango que
          // se esta probando o el test no ejercita el camino real.
          win.document.getElementById('fDesde').value = ini;
          win.document.getElementById('fHasta').value = fin;
          try {
            // Se renderizan las TRES pestañas que se van a presentar, más F7
            // (long tail, con su chip bar de cluster nueva) — un crash en F2
            // no aparece si solo se pinta F1.
            // F5 entro a esta lista el 18-sep-2026: estaba fuera, asi que su
            // render nunca se ejercitaba con la matriz de filtros.
            ['f1', 'f2', 'f4', 'f5', 'f7', 'f8'].forEach(function (v) {
              win.irA(v, true);
              win.render();
            });
          } catch (e2) {
            fallos++;
            console.log('CRASH render()', JSON.stringify({ ini, fin, roles, orig }), '->', e2.message);
            console.log(e2.stack.split('\n').slice(0, 3).join('\n'));
          }
        } catch (e) {
          fallos++;
          console.log('CRASH getDashboardData', JSON.stringify({ ini, fin, roles, orig }), '->', e.message);
        }
      }
    }
  }
  // F7: el chip bar de cluster es nuevo — se ejercita cada uno de los 5 más
  // "Todos", con el mismo win.D/win.render() real que usa la pagina.
  const CLUSTERS = ['', 'PERFILAMIENTO', 'REACTIVAR', 'DESEMBOLSO', 'RECONOCIMIENTO', 'ESTRENA'];
  CLUSTERS.forEach(function (cl) {
    total++;
    try {
      const d = win.getDashboardData('2026-08-01', '2026-09-09', [], {}, '', cl);
      win.D = d;
      win.F7_FILTRO_AUD = cl;
      win.document.getElementById('fDesde').value = '2026-08-01';
      win.document.getElementById('fHasta').value = '2026-09-09';
      win.irA('f7', true);
      win.render();
    } catch (e) {
      fallos++;
      console.log('CRASH F7 cluster', JSON.stringify(cl), '->', e.message);
      console.log(e.stack.split('\n').slice(0, 3).join('\n'));
    }
  });

  console.log('\nTotal combinaciones:', total, 'fallos:', fallos);
  process.exit(fallos ? 1 : 0);
})();
