const d = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const e = d.f1.embudo, dc = d.f1.dealsCohorte, a = d.f1.activacion, c = d.f1.composicion;
const P = (x, n) => String(x).padStart(n);
console.log('  ' + process.argv[3].padEnd(26) + ' universo=' + (d.meta.origenEtiqueta || '?'));
console.log('     seccion 5: sedes=' + P(e.sedes, 5) + '  sol=' + P(e.pasos[0].valor, 5) +
  '  apr=' + P(e.kpis[1].valor, 4) + '  des=' + P(e.kpis[2].valor, 4) +
  '  aprob=' + P(e.kpis[1].valor, 5) + '%  conv=' + P(e.kpis[2].valor, 5) +
  '%  plata=$' + (e.kpis[3].valor / 1e6).toFixed(1) + 'M   mes=' + e.mes);
const tot = dc.filas.reduce((s, r) => s + r.n, 0), gan = dc.filas.reduce((s, r) => s + r.ganados, 0);
console.log('     deals    : ' + P(tot, 5) + ' deals, ' + P(gan, 4) + ' ganados (' +
  (tot ? (100 * gan / tot).toFixed(1) : 0) + '%)   filas=' + dc.filas.length);
console.log('     origenes de la plata: ' + (e.canales || []).slice(0, 4)
  .map(x => x.canal + ' ' + x.pct + '%').join(' | '));
