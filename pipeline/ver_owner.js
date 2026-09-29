const d = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const P = (x, n) => String(x).padStart(n);
const kv = (arr, lbl) => { const k = (arr || []).find(x => x.label === lbl); return k ? k.valor : '-'; };
const co = d.f2.mapas || [];
const act = co.find(m => m.id === 'activas');
console.log('  ' + process.argv[3].padEnd(20) +
  ' sedes=' + P(d.meta.origenSedes, 5) +
  ' | F1 nuevas=' + P(d.f1.shareKpi ? d.f1.shareKpi.valor : '-', 4) +
  ' sol=' + P(d.f1.embudo.kpis[0].valor, 5) +
  ' deals=' + P(d.f1.dealsCohorte.filas.reduce((s, r) => s + r.n, 0), 5) +
  ' | F2 cosech=' + P(d.f2.cosechas, 3) +
  ' | F4 apr=' + P(kv(d.f4.oportunidad.kpis, 'La oportunidad del período') ? d.f4.oportunidad.filas.reduce((s, r) => s + r.apr, 0) : 0, 5) +
  ' | F5 jun=' + P((d.f5.serie[0] || {}).sedes || 0, 5) +
  ' | F7 pob=' + P(d.f7.poblacion, 4));
