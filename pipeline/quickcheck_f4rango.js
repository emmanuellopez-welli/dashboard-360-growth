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
      console.log('metaRango (Kevin, vara mensual):', JSON.stringify(ge.metaRango));
      console.log('metaRangoSemanal (Kevin, vara semanal):', JSON.stringify(ge.metaRangoSemanal));
      console.log('metaRangoRescateTotalMensual:', JSON.stringify(ge.metaRangoRescateTotalMensual));
      console.log('metaRangoRescateTotalSemanal:', JSON.stringify(ge.metaRangoRescateTotalSemanal));
      const cuerpo = win.document.getElementById('metaCuerpo').innerHTML;
      console.log('--- texto de la tarjeta (Kevin, este mes) ---');
      console.log(cuerpo.replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim().slice(0, 400));
      win.f4MetaSetPoblacion('rescateTotal');
      const cuerpo2 = win.document.getElementById('metaCuerpo').innerHTML;
      console.log('--- texto de la tarjeta (rescate total, este mes) ---');
      console.log(cuerpo2.replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim().slice(0, 400));
      process.exit(0);
    }, 1500);
  } catch (e) { console.error('ERROR', e); process.exit(1); }
}, 900);
