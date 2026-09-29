# -*- coding: utf-8 -*-
import io, re
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

# ---------------------------------------------------------------- 1
# El bloque de cohorte pasa a leer COSECHA_DIA con filtro de origen y de
# fechas, en vez de ACT_SEDE_MES cruzado contra los ids de la cosecha.
ini = s.index('  // ---- El embudo se acota a la COSECHA DEL MES -----------------------')
fin = s.index('  // ---- Serie diaria y share por canal, de la COSECHA ------------------')
fin2 = s.index('  f.embudo = {\n    hay: hayEm,')
nuevo = """  // ---- La seccion 5 se acota a la COSECHA y respeta filtro y rango ----
  // Dos cortes, los dos obligatorios:
  //   1. la sede entro en un mes que toca el rango   (cosecha)
  //   2. el credito se radico dentro del rango       (fecha)
  // Y el ORIGEN sale del filtro global, no esta fijo en marketing: si el
  // usuario filtra "Evento", esta seccion mide los creditos de las sedes de
  // evento. Con el filtro en "Todos" mide toda la base nueva del periodo.
  var cdF1 = leerHoja_('COSECHA_DIA');
  var selCd = {};
  (U.origenes || []).forEach(function (o) { selCd[o] = true; });
  function mesMas_(c, k) {
    if (!/^\d{4}-\d{2}$/.test(String(c || ''))) return '';
    var t = Number(c.substring(0, 4)) * 12 + (Number(c.substring(5, 7)) - 1) + k;
    return ('0000' + Math.floor(t / 12)).slice(-4) + '-' + ('0' + (t % 12 + 1)).slice(-2);
  }
  var mesIni = R.inicio.substring(0, 7), mesFin = R.fin.substring(0, 7);
  var mesPrevIni = mesMas_(mesIni, -1), mesPrevFin = mesMas_(mesFin, -1);

  // Cuantas sedes entraron en el periodo, con el filtro puesto. Es el
  // denominador que la seccion declara, y tiene que cuadrar con la seccion 1.
  var sedesPer = 0, sedesPerPrev = 0;
  Object.keys(agCos).forEach(function (m) {
    if (esCargaInicial_(m)) return;
    var b = agCos[m];
    if (m >= mesIni && m <= mesFin) sedesPer += b.total;
    if (m >= mesPrevIni && m <= mesPrevFin) sedesPerPrev += b.total;
  });

  function cortarCd_(desde, hasta, mDesde, mHasta) {
    var t = { sol: 0, apr: 0, conv: 0, monto: 0 };
    var dia = {}, org = {};
    cdF1.forEach(function (r) {
      var cos = String(r.cosecha || '').substring(0, 7);
      if (cos < mDesde || cos > mHasta) return;
      if (esCargaInicial_(cos)) return;
      var o = normOrigen_(r.origen);
      if (!U.todos && !selCd[o]) return;
      var fch = String(r.fecha || '');
      if (fch < desde || fch > hasta) return;
      var sol = num_(r.solicitudes), apr = num_(r.aprobados);
      var des = num_(r.desembolsos), mon = num_(r.monto);
      t.sol += sol; t.apr += apr; t.conv += des; t.monto += mon;
      dia[fch] = (dia[fch] || 0) + mon;
      if (!org[o]) org[o] = { origen: o, sol: 0, apr: 0, des: 0, monto: 0 };
      var b = org[o];
      b.sol += sol; b.apr += apr; b.des += des; b.monto += mon;
    });
    t.dia = dia;
    t.org = org;
    return t;
  }
  var cohA = cortarCd_(R.inicio, R.fin, mesIni, mesFin);
  var cohP = cortarCd_(R.prevInicio, R.prevFin, mesPrevIni, mesPrevFin);
  var hayCoh = cohA.sol > 0;
  var mesEti = mesIni === mesFin ? mesIni : mesIni + ' a ' + mesFin;
  var mesPrevEti = mesPrevIni === mesPrevFin
    ? mesPrevIni : mesPrevIni + ' a ' + mesPrevFin;
  if (hayCoh) {
    cA = cohA;
    cP = cohP;
    emComparable = cohP.sol > 0;
  }
  // Share por origen de esa misma plata, ordenado por monto.
  var totCoh = cohA.monto;
  var canalesCoh = Object.keys(cohA.org).map(function (k) {
    var b = cohA.org[k];
    return { canal: k === '(SIN ORIGEN)' ? 'Sin origen' : k,
             sol: b.sol, apr: b.apr, des: b.des, monto: b.monto,
             pct: totCoh ? Math.round((b.monto / totCoh) * 1000) / 10 : 0,
             ticket: b.des ? Math.round(b.monto / b.des) : 0,
             conv: b.apr ? Math.round((b.des / b.apr) * 1000) / 10 : 0 };
  }).sort(function (a, b) { return b.monto - a.monto || b.sol - a.sol; });

"""
s = s[:ini] + nuevo + s[fin2:]
io.open(p, 'w', encoding='utf8').write(s)
print('bloque de seccion 5 reemplazado')
