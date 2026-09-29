const d = require('./out_deshab.json');
const f = n => (n||0).toLocaleString('es-CO');
console.log('deshabilitadas fuera :', d.meta.deshabilitadas);
console.log('sedes universo       :', d.meta.origenSedes, '/ base', d.meta.origenSedesBase);
const f1 = d.f1 || {};
console.log('claves f1:', Object.keys(f1).join(','));
console.log('sedes:', JSON.stringify(f1.sedes).slice(0,300));
if (f1.mapaDeals) console.log('deals cosechas:', (f1.mapaDeals.filas||[]).length);
(d.f2 && d.f2.mapas || []).forEach(m => {
  const p = m.promedio || {};
  console.log('F2', m.orden, m.clase, 'filas', (m.filas||[]).length,
    'prom M0..M2', (p.celdas||[]).slice(0,3).join('/'));
});
