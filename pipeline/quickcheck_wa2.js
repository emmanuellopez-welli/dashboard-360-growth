const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, url: 'https://x/exec' });
const win = dom.window;

function cargarRango(desde, hasta, cb) {
  win.document.getElementById('fDesde').value = desde;
  win.document.getElementById('fHasta').value = hasta;
  win.VISTA = 'f4';
  win.cargar();
  setTimeout(() => {
    const wa = win.D.f4.gestion.whatsapp;
    cb(wa);
  }, 1300);
}

setTimeout(() => {
  cargarRango('2026-08-01', '2026-08-31', (waAgo) => {
    console.log('AGOSTO:', JSON.stringify(waAgo));
    cargarRango('2026-09-01', '2026-09-25', (waSep) => {
      console.log('SEPTIEMBRE:', JSON.stringify(waSep));
      const pctAgo = waAgo.universo ? Math.round((waAgo.contactados/waAgo.universo)*1000)/10 : null;
      const pctSep = waSep.universo ? Math.round((waSep.contactados/waSep.universo)*1000)/10 : null;
      console.log('% agosto:', pctAgo, ' % septiembre:', pctSep);
      const cuerpo = win.document.body.textContent;
      console.log('texto incluye "confirmación de crédito aprobado":', cuerpo.includes('confirmación de crédito aprobado') || cuerpo.includes('CONFIRMACIÓN DE CRÉDITO APROBADO'));
      console.log('texto incluye "Recibieron confirmación":', cuerpo.includes('Recibieron confirmación'));
      process.exit(0);
    });
  });
}, 900);
