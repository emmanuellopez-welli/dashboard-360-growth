  // ---- El embudo se acota a la COSECHA DEL MES -----------------------
  // Antes sumaba los creditos de TODAS las sedes que marketing ha traido
  // alguna vez, asi que la plata firmada del mes ($558,1 M en agosto) no era
  // atribuible a la adquisicion del mes: el 80,1% venia de cosechas
  // anteriores. Ahora las cuatro tarjetas miden lo mismo que la seccion 1 y
  // la seccion 6: las sedes que entraron ESE mes, con los creditos que
  // radicaron ESE mes. Es la cifra que sirve para juzgar la cosecha y para
  // calcular CAC contra el gasto del mes.
  var actEmb = leerHoja_('ACT_SEDE_MES');
  var actPorMes = {};
  actEmb.forEach(function (r) {
    var m = String(r.mes || '').substring(0, 7);
    if (!actPorMes[m]) actPorMes[m] = {};
    actPorMes[m][String(r.id_sede || '').trim()] = r;
  });
  function embudoCohorte_(ids, mes) {
    var t = { sol: 0, apr: 0, conv: 0, monto: 0, sedes: 0, aportaron: 0 };
    var idx = actPorMes[mes] || {};
    (ids || []).forEach(function (id) {
      t.sedes++;
      var r = idx[id];
      if (!r) return;
      t.sol += num_(r.solicitudes);
      t.apr += num_(r.aprobados);
      t.conv += num_(r.desembolsos);
      t.monto += num_(r.monto);
      if (num_(r.monto) > 0) t.aportaron++;
    });
    return t;
  }
  // El comparativo es la cosecha del mes ANTERIOR con sus propios creditos:
  // dos cohortes construidas igual, que es la unica comparacion honesta.
  var mesPrevEmb = mesComp ? mesFuturo_(mesComp, -1) : '';
  var bPrevEmb = mesPrevEmb ? agCos[mesPrevEmb] : null;
  var cohA = bComp ? embudoCohorte_(bComp.idsMkt, mesComp) : null;
  var cohP = bPrevEmb ? embudoCohorte_(bPrevEmb.idsMkt, mesPrevEmb) : null;
  var hayCoh = !!(cohA && cohA.sol);
  if (hayCoh) {
    cA = cohA;
    cP = cohP || { sol: 0, apr: 0, conv: 0, monto: 0 };
    // El universo ya no crece entre periodos: son dos cosechas mensuales
    // comparables por construccion, asi que la regla de cobertura no aplica.
    emComparable = !!(cohP && cohP.sol);
  }

