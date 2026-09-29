const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
const win = dom.window;

setTimeout(() => {
  const doc = win.document;
  const vistas = ['f1', 'f2', 'f4', 'f5', 'f6', 'f7'];
  let idx = 0;

  function siguiente() {
    if (idx >= vistas.length) { resumen(); return; }
    const v = vistas[idx++];
    win.VISTA = v;
    let err = null;
    try { win.render(); } catch (e) { err = e.message; }
    setTimeout(() => {
      const cont = doc.getElementById('vistas');
      const htmlLen = cont.innerHTML.length;
      const kpis = cont.querySelectorAll('.kpi-valor').length;
      const tablas = cont.querySelectorAll('table.t').length;
      const filasTabla = cont.querySelectorAll('table.t tbody tr').length;
      const svgs = cont.querySelectorAll('svg').length;
      const vacios = cont.querySelectorAll('.vacio-graf').length;
      console.log('=== ' + v.toUpperCase() + ' ===');
      console.log('  error render:', err || 'ninguno');
      console.log('  html len:', htmlLen, '| kpis:', kpis, '| tablas:', tablas,
                   '| filas totales:', filasTabla, '| svgs:', svgs, '| paneles vacios:', vacios);
      resultados.push({ v, err, htmlLen, kpis, tablas, filasTabla, svgs, vacios });
      siguiente();
    }, 700);
  }

  const resultados = [];
  function resumen() {
    console.log('\n=== RESUMEN ===');
    let mal = 0;
    resultados.forEach(r => {
      const sospechoso = r.err || r.htmlLen < 500;
      if (sospechoso) mal++;
      console.log((sospechoso ? 'SOSPECHOSO ' : 'OK ') + r.v);
    });
    console.log('total sospechosos:', mal);
    process.exit(mal > 0 ? 1 : 0);
  }
  siguiente();
}, 500);
