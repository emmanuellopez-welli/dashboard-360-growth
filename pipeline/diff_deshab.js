const f = n => (typeof n === 'number'
  ? n.toLocaleString('es-CO', {maximumFractionDigits: 1}) : String(n));
const pad = (s, n) => String(s).slice(0, n).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

function medidas(d) {
  const o = {};
  o['[universo] sedes en base'] = d.meta.origenSedesBase;
  (d.f1.kpis || []).forEach(k => { o['KPI · ' + k.label] = k.valor; });
  const a = d.f1.activacion || {};
  ['nuevas','activas','exitosas'].forEach(k => {
    if (a[k] !== undefined) o['activacion · ' + k] = a[k];
  });
  const co = d.f1.convOrigen || [];
  co.forEach(r => {
    o['origen ' + r.origen + ' · plata'] = r.monto || r.plata || 0;
    o['origen ' + r.origen + ' · sedes'] = r.sedes || 0;
  });
  (d.f2.mapas || []).forEach(m => {
    const p = (m.promedio || {}).celdas || [];
    o['F2 ' + m.clase + ' · prom M0'] = p[0];
    o['F2 ' + m.clase + ' · prom M1'] = p[1];
  });
  const md = d.f1.dealsCohorte || {};
  if (md.total !== undefined) o['deals · total'] = md.total;
  return o;
}

function cmp(tag, a, b) {
  const A = medidas(a), B = medidas(b);
  console.log('\n=== ' + tag + ' ===');
  console.log(pad('medida', 44) + rpad('antes', 15) + rpad('despues', 15) + rpad('delta', 10));
  Object.keys(A).forEach(k => {
    const x = A[k], y = B[k];
    if (x === y) return;
    let dl = '—';
    if (typeof x === 'number' && typeof y === 'number') {
      dl = x ? ((100 * (y - x) / x).toFixed(1) + '%') : 'nuevo';
    }
    console.log(pad(k, 44) + rpad(f(x), 15) + rpad(f(y), 15) + rpad(dl, 10));
  });
}
cmp('AGOSTO 2026', require('./out_antes.json'), require('./out_desp.json'));
cmp('ANO 2026 completo', require('./out_antes_ano.json'), require('./out_desp_ano.json'));
