const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, url: 'https://x/exec' });
const win = dom.window;
setTimeout(() => {
  try {
    win.document.getElementById('fDesde').value = '2026-08-01';
    win.document.getElementById('fHasta').value = '2026-08-31';
    win.VISTA = 'f4';
    win.cargar();
    setTimeout(() => {
      const wa = win.D.f4.gestion.whatsapp;
      console.log('wa:', JSON.stringify(wa));
      const cuerpo = win.document.body.textContent;
      const iRecibieron = cuerpo.indexOf('Recibieron mensaje');
      console.log('texto incluye "Recibieron mensaje":', iRecibieron >= 0);
      console.log('texto incluye "no se corta con el filtro" (NO deberia):', cuerpo.includes('no se corta con el filtro'));
      const pct = wa.universo ? Math.round((wa.contactados/wa.universo)*1000)/10 : null;
      console.log('% recibio mensaje (debe ser <=100):', pct);
      process.exit(0);
    }, 1200);
  } catch (e) { console.error('ERROR', e); process.exit(1); }
}, 900);
