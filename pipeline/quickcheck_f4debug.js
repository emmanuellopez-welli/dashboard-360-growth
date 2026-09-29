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
      console.log('D.meta:', JSON.stringify(win.D.meta));
      console.log('hoy real (node):', new Date().toString());
      process.exit(0);
    }, 1500);
  } catch (e) { console.error('ERROR', e); process.exit(1); }
}, 900);
