const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, url: 'https://x/exec' });
const win = dom.window;
setTimeout(() => {
  try {
    win.document.getElementById('fDesde').value = '2026-08-24';
    win.document.getElementById('fHasta').value = '2026-09-24';
    win.VISTA = 'f4';
    win.cargar();
    setTimeout(() => {
      const ge = win.D.f4.gestion;
      console.log('--- gestion de Kevin, mes (calendario que toca el fin del rango) ---');
      console.log('metasMes:', JSON.stringify(ge.metasMes, null, 0));
      console.log('--- rescate total, mes ---');
      console.log('metasMesRescateTotal:', JSON.stringify(ge.metasMesRescateTotal, null, 0));
      console.log('--- rescate total, semana ---');
      console.log('metasRescateTotal (semanas):', JSON.stringify(ge.metasRescateTotal, null, 0));
      process.exit(0);
    }, 1500);
  } catch (e) { console.error('ERROR', e); process.exit(1); }
}, 900);
