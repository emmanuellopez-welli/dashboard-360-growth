  // ---- Serie diaria y share por canal, de la COSECHA ------------------
  // El grafico de monto diario venia del universo entero de marketing
  // ($558,1 M en agosto) al lado de una tarjeta que decia $110,9 M. Ahora
  // sale de COSECHA_DIA, que es la misma plata de la tarjeta repartida por
  // dia y por canal.
  var cdF1 = leerHoja_('COSECHA_DIA');
  var cdMes = cdF1.filter(function (r) {
    return String(r.cosecha || '').substring(0, 7) === mesComp;
  });
  var serieCoh = {}, canCoh = {};
  cdMes.forEach(function (r) {
    var f = String(r.fecha || '');
    if (!f) return;
    serieCoh[f] = (serieCoh[f] || 0) + num_(r.monto);
    var c = String(r.canal || 'Sin canal');
    if (!canCoh[c]) canCoh[c] = { canal: c, sol: 0, apr: 0, des: 0, monto: 0 };
    var b = canCoh[c];
    b.sol += num_(r.solicitudes);
    b.apr += num_(r.aprobados);
    b.des += num_(r.desembolsos);
    b.monto += num_(r.monto);
  });
  var hayCd = cdMes.length > 0;
  var totCoh = 0;
  Object.keys(canCoh).forEach(function (k) { totCoh += canCoh[k].monto; });
  // Los cuatro canales van siempre, aunque pongan cero: un canal que trajo
  // sedes y no puso plata es informacion, no una fila que sobra.
  var ordenCan = ['Pagina web', 'Referidos', 'Eventos', 'Social media'];
  var canalesCoh = ordenCan.map(function (c) {
    var b = canCoh[c] || { canal: c, sol: 0, apr: 0, des: 0, monto: 0 };
    return { canal: c === 'Pagina web' ? 'Página web' : c,
             sedes: (bComp && bComp.canMkt[c] !== undefined) ? bComp.canMkt[c] : 0,
             sol: b.sol, apr: b.apr, des: b.des, monto: b.monto,
             pct: totCoh ? Math.round((b.monto / totCoh) * 1000) / 10 : 0,
             ticket: b.des ? Math.round(b.monto / b.des) : 0,
             conv: b.apr ? Math.round((b.des / b.apr) * 1000) / 10 : 0 };
  }).filter(function (r) { return r.sedes > 0 || r.sol > 0; });

