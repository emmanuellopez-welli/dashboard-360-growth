const d = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const P = (x, n) => String(x).padStart(n);
const kv = (arr, lbl) => { const k = (arr || []).find(x => x.label === lbl); return k ? k.valor : '-'; };
const co = d.f2.cohortes || {};
console.log('  ' + process.argv[3].padEnd(22) +
  ' sedes=' + P(d.meta.origenSedes, 5) +
  ' | F1 sol=' + P(d.f1.embudo.pasos[0].valor, 5) +
  ' deals=' + P(d.f1.dealsCohorte.filas.reduce((s, r) => s + r.n, 0), 5) +
  ' | F2 base=' + P(kv(d.f2.base.kpis, 'Sedes en la base'), 5) +
  ' viv=' + P(kv(d.f2.base.kpis, 'Siguen activas'), 5) +
  ' aaa=' + P((d.f2.aaa && d.f2.aaa.filas ? d.f2.aaa.filas.length : 0), 3) +
  ' cosech=' + P((co.cosechas || []).length, 3) +
  ' | F4 terr=' + P(kv(d.f4.kpis, 'Territorio del rescate'), 5) +
  ' | F5 conv=' + P((d.f5.conversion && d.f5.conversion.kpis ? d.f5.conversion.kpis.length : 0), 2) +
  ' serie=' + P((d.f5.serie || []).length, 2));
