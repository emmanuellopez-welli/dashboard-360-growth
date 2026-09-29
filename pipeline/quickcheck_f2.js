const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, url: 'https://x/exec' });
const win = dom.window;
setTimeout(() => {
  try {
    win.VISTA = 'f2'; win.render();
    setTimeout(() => {
      const html2 = win.document.body.innerHTML;
      console.log('titulo nuevo presente:', html2.includes('Sedes que desembolsan'));
      const celdas = [...win.document.querySelectorAll('.hm')];
      const conPctYMonto = celdas.filter(td => /\$[\d.]+/.test(td.textContent) && /%/.test(td.textContent));
      console.log('celdas .hm con % Y $ a la vez:', conPctYMonto.length, 'de', celdas.length);
      if (conPctYMonto[0]) console.log('ejemplo:', conPctYMonto[0].textContent.trim());
      process.exit(0);
    }, 900);
  } catch (e) { console.error('ERROR', e); process.exit(1); }
}, 900);
