# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

viejo_com = """  // ---------- Cohortes de DEALS de HubSpot ----------------------------
  // Cuantos negocios entraron cada mes y cuantos se fueron convirtiendo en
  // cierre ganado, mes a mes. Es el equivalente de la tabla de cosechas pero
  // en el pipeline comercial, antes de que la sede exista.
  //
  // Alcance: SOLO origenes de marketing (los cuatro), igual que la vista de
  // HubSpot de la que sale. No responde al filtro global de origen porque la
  // fuente esta pre-agregada por cosecha.
  var dc = leerHoja_('DEALS_COHORTE');
  f.dealsCohorte = {
    hay: dc.length > 0,
    offsets: 7,
    filas: dc.map(function (r) {
      var n = num_(r.deals), acum = 0, celdas = [];
      for (var m = 0; m <= 7; m++) {
        var v = num_(r['m' + m]);
        acum += v;
        // Acumulado: "cuantos de esta cosecha YA ganaron al mes N". Solo sube,
        // igual que la tabla Acumulada de cosechas de sedes.
        celdas.push(mesFuturo_(r.cosecha, m) ? null : acum);
      }
      return { cosecha: String(r.cosecha || ''), n: n, celdas: celdas,
               ganados: acum,
               conv: n ? Math.round((acum / n) * 1000) / 10 : 0 };
    }).filter(function (r) { return r.n > 0; })
  };"""

nuevo = """  // ---------- Cohortes de DEALS de HubSpot ----------------------------
  // Cuantos negocios entraron cada mes y cuantos se fueron convirtiendo en
  // cierre ganado, mes a mes. Es el equivalente de la tabla de cosechas pero
  // en el pipeline comercial, antes de que la sede exista.
  //
  // RESPONDE AL FILTRO GLOBAL: la fuente es DEALS_ORIGEN, agregada por
  // cosecha x origen, asi que si el filtro dice "Evento" la tabla muestra los
  // deals de evento. Con el filtro en "Todos" muestra el pipeline completo.
  //
  // EXCLUSIONES aplicadas en el origen (Fuentes_BigQuery / HubSpot): se sacan
  // los deals cuya causal de cierre perdido es Duplicado/Existente, No paso
  // SARLAFT o Medicina Alternativa. No son oportunidades perdidas, son
  // registros que no debieron existir, y dejarlos en el denominador hunde la
  // tasa de cierre sin que signifique nada.
  var dcO = leerHoja_('DEALS_ORIGEN');
  var selDc = {};
  (U.origenes || []).forEach(function (o) { selDc[o] = true; });
  var agDc = {};
  dcO.forEach(function (r) {
    var cos = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(cos)) return;
    var o = normOrigen_(r.origen);
    if (!U.todos && !selDc[o]) return;
    if (!agDc[cos]) agDc[cos] = { cosecha: cos, deals: 0, m: [0, 0, 0, 0, 0, 0, 0, 0] };
    var b = agDc[cos];
    b.deals += num_(r.deals);
    for (var i = 0; i <= 7; i++) b.m[i] += num_(r['m' + i]);
  });
  f.dealsCohorte = {
    hay: dcO.length > 0,
    offsets: 7,
    universo: U.etiqueta,
    excluidos: 'Duplicado/Existente · No pasó SARLAFT · Medicina Alternativa',
    filas: Object.keys(agDc).sort().map(function (cos) {
      var b = agDc[cos], acum = 0, celdas = [];
      for (var m = 0; m <= 7; m++) {
        acum += b.m[m];
        // Acumulado: "cuantos de esta cosecha YA ganaron al mes N". Solo sube,
        // igual que la tabla Acumulada de cosechas de sedes.
        celdas.push(mesFuturo_(cos, m) ? null : acum);
      }
      return { cosecha: cos, n: b.deals, celdas: celdas, ganados: acum,
               conv: b.deals ? Math.round((acum / b.deals) * 1000) / 10 : 0 };
    }).filter(function (r) { return r.n > 0; })
  };"""

assert viejo_com in s
s = s.replace(viejo_com, nuevo, 1)
io.open(p, 'w', encoding='utf8').write(s)
print('deals con filtro de origen ok')
