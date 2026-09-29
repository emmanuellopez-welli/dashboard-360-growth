const A = require('./map_crm.json').f2, B = require('./map_vinc.json').f2;
const f = n => (n === null || n === undefined) ? null : n;
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);

console.log('COMPARACION DE LOS 7 MAPAS · reloj HubSpot contra reloj vinculacion\n');
const resumen = [];
A.mapas.forEach((ma, i) => {
  const mb = B.mapas.find(x => x.id === ma.id);
  if (!mb) return;
  // Indexar por cosecha
  const ia = {}, ib = {};
  (ma.filas || []).forEach(r => ia[r.cosecha] = r);
  (mb.filas || []).forEach(r => ib[r.cosecha] = r);
  const cos = [...new Set([...Object.keys(ia), ...Object.keys(ib)])].sort();
  let celdas = 0, sumaAbs = 0, maxDif = 0, maxDonde = '', difN = 0;
  cos.forEach(c => {
    const ra = ia[c], rb = ib[c];
    if (!ra || !rb) return;
    if (ra.n !== rb.n) difN++;
    const na = ra.celdas || [], nb = rb.celdas || [];
    for (let k = 0; k < Math.max(na.length, nb.length); k++) {
      const va = f(na[k]), vb = f(nb[k]);
      if (va === null || vb === null) continue;
      // % sobre la cosecha, que es como se lee el mapa
      const pa = ra.n ? (va / ra.n) * 100 : 0;
      const pb = rb.n ? (vb / rb.n) * 100 : 0;
      const dif = Math.abs(pa - pb);
      celdas++; sumaAbs += dif;
      if (dif > maxDif) { maxDif = dif; maxDonde = c + ' M' + k; }
    }
  });
  resumen.push({ orden: ma.orden, titulo: ma.titulo, celdas,
    prom: celdas ? sumaAbs / celdas : 0, maxDif, maxDonde,
    cosDifN: difN, nCos: cos.length });
});
console.log(pad('#', 3) + pad('mapa', 36) + rp('celdas', 8) +
            rp('discrep. prom', 15) + rp('maxima', 9) + rp('donde', 12));
resumen.sort((a, b) => b.prom - a.prom).forEach(r => {
  console.log(pad(r.orden, 3) + pad(r.titulo.slice(0, 35), 36) +
    rp(r.celdas, 8) + rp(r.prom.toFixed(1) + ' pp', 15) +
    rp(r.maxDif.toFixed(1) + ' pp', 9) + rp(r.maxDonde, 12));
});

// Detalle del mapa mas afectado y de sedes activas
console.log('\n\nDETALLE · sedes por cosecha bajo cada reloj');
console.log(pad('cosecha', 10) + rp('HubSpot', 9) + rp('vinculac.', 11) +
            rp('dif', 7) + rp('% dif', 9));
const ia = {}, ib = {};
(A.mapas[0].filas || []).forEach(r => ia[r.cosecha] = r);
(B.mapas[0].filas || []).forEach(r => ib[r.cosecha] = r);
[...new Set([...Object.keys(ia), ...Object.keys(ib)])].sort().forEach(c => {
  const na = ia[c] ? ia[c].n : 0, nb = ib[c] ? ib[c].n : 0;
  console.log(pad(c, 10) + rp(na, 9) + rp(nb, 11) + rp(nb - na, 7) +
    rp(na ? (((nb - na) / na) * 100).toFixed(1) + '%' : '-', 9));
});
