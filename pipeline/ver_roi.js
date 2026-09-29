const d = JSON.parse(require('fs').readFileSync('pt.json', 'utf8'));
const r = d.f1.retorno;
const P = (x, n) => String(x).padStart(n);
console.log('  mes       gasto   leads    CPL  sedes   L->S    $/sede      1er mes       hasta hoy  orig/$');
let g = 0, m0 = 0, pa = 0;
r.serie.forEach(x => {
  g += x.gasto; m0 += x.plataM0; pa += x.plata;
  console.log('  ' + x.mes + P(x.gasto, 9) + P(x.leads, 7) + P(x.cpl, 7) + P(x.sedes, 6) +
    P(x.leadASede, 6) + '%' + P(x.costoSede, 9) + P(x.plataM0, 13) + P(x.plata, 16) +
    P(x.multiplo, 7) + 'x');
});
console.log('  TOTAL   ' + P(g, 9) + '                              ' + P(m0, 13) + P(pa, 16) +
  P((pa / g).toFixed(1), 7) + 'x');
