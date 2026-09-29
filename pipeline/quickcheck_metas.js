const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, url: 'https://x/exec' });
const win = dom.window;
setTimeout(() => {
  try {
    win.VISTA = 'f1'; win.render();
    setTimeout(() => {
      const mc = win.D.f1.metasCanal;
      console.log('leads (deberia coincidir con HubSpot crudo):', JSON.stringify(mc.leads.map(r => ({canal: r.canal, actual: r.actual}))));
      console.log('vinculacion (sigue usando deals limpio):', JSON.stringify(mc.vinculacion.map(r => ({canal: r.canal, llegaron: r.llegaron}))));
      const html2 = win.document.body.innerHTML;
      console.log('texto declara "coincide exacto con el conteo crudo":', html2.includes('coincide exacto con el conteo crudo'));
      console.log('texto de vinculacion sigue mencionando exclusion de causal:', html2.includes('"leads que llegaron" excluye los cerrados perdidos'));
      process.exit(0);
    }, 900);
  } catch (e) { console.error('ERROR', e); process.exit(1); }
}, 900);
