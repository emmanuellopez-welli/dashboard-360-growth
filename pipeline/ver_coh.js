const d = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const e = d.f1.embudo, a = d.f1.activacion, c = d.f1.composicion, k = d.f1.shareKpi;
const ok = (k.valor === c.todas.n && c.mkt.n === e.sedes && e.sedes === a.mkt.total);
console.log([
  process.argv[3].padEnd(24),
  'mes=' + e.mes,
  ' nuevas=' + k.valor + '/' + c.mkt.n + ' mkt',
  ' sol=' + String(e.pasos[0].valor).padStart(4),
  'apr=' + String(e.kpis[1].valor).padStart(3),
  'des=' + String(e.kpis[2].valor).padStart(3),
  ' aprob=' + String(e.kpis[1].valor).padStart(4) + '%',
  'conv=' + String(e.kpis[2].valor).padStart(4) + '%',
  'plata=$' + (e.kpis[3].valor / 1e6).toFixed(1) + 'M',
  ' activas=' + a.mkt.activas,
  ' cuadra=' + (ok ? 'SI' : 'NO')
].join(''));
