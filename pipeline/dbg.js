const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable',
  pretendToBeVisual: true, url: 'https://x/exec' });
const win = dom.window;
win.addEventListener('error', e => console.log('ERROR PAGINA:', e.message));
setTimeout(() => {
  console.log('D al inicio:', win.D === null ? 'null' : typeof win.D);
  const err = win.document.getElementById('error');
  console.log('caja error visible:', err && !err.classList.contains('oculto'));
  if (err) console.log('texto error:', (err.textContent||'').slice(0,300));
  console.log('tiene cargar():', typeof win.cargar);
  win.document.getElementById('fDesde').value = '2026-09-20';
  win.document.getElementById('fHasta').value = '2026-09-28';
  try { win.cargar(); } catch(e) { console.log('EXCEPCION en cargar():', e.message); }
  setTimeout(() => {
    console.log('D despues:', win.D === null ? 'null' : typeof win.D);
    const e2 = win.document.getElementById('error');
    console.log('error visible despues:', e2 && !e2.classList.contains('oculto'));
    if (e2) console.log('texto:', (e2.textContent||'').slice(0,400));
    process.exit(0);
  }, 5000);
}, 3000);
