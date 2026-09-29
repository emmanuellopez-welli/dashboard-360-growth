# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

# ---- punto 2: lo que devolvio la pauta ----
old = """  var kImp = (f.kpis || [])[3], kCtr = (f.kpis || [])[4];
  if (kImp && kCtr && kImp.valor !== null) {
    h += '<p class="sec-sub" style="margin-top:8px">Alcance de la pauta en el período: ' +
      esc(fNum(kImp.valor)) + ' impresiones, CTR ' + esc(fPct(kCtr.valor)) + '.</p>';
  }"""
new = """  var kImp = (f.kpis || [])[3], kCtr = (f.kpis || [])[4];
  if (kImp && kCtr && kImp.valor !== null) {
    h += '<p class="sec-sub" style="margin-top:8px">Alcance de la pauta en el período: ' +
      esc(fNum(kImp.valor)) + ' impresiones, CTR ' + esc(fPct(kCtr.valor)) + '.</p>';
  }

  // El CPL no dice si la pauta sirvio: dice que cuesta un formulario. Esto
  // cierra el ciclo hasta la plata que pusieron las sedes que ese gasto trajo.
  var rt = f.retorno;
  if (rt) {
    h += '<h3 class="sub-sec" style="margin-top:20px">¿Y qué devolvió esa pauta?</h3>' +
      '<p class="sec-sub">la campaña es a médicos, así que las sedes de origen ' +
      'social media son el resultado de ese gasto · cosecha de ' + esc(rt.mes) + '</p>';
    h += filaKPIs(rt.kpis);
    h += '<div style="margin-top:14px">' +
      panel('Del gasto a la plata, mes a mes',
        'cada mes con su propio gasto y su propia cosecha de social media',
        tabla([
          { t: 'Mes', k: 'mes', f: 'txt', txt: true },
          { t: 'Gasto Meta', k: 'gasto', f: 'cop' },
          { t: 'Leads', k: 'leads' },
          { t: 'CPL', k: 'cpl', f: 'cop' },
          { t: 'Sedes', k: 'sedes' },
          { t: 'Lead→sede', k: 'leadASede', f: 'pct' },
          { t: '$/sede', k: 'costoSede', f: 'cop' },
          { t: 'Plata de la cosecha', k: 'plata', f: 'cop' },
          { t: 'Originación/$', k: 'multiplo', f: 'txt' }
        ], (rt.serie || []).map(function (x) {
          var y = {}; for (var kk in x) y[kk] = x[kk];
          y.multiplo = fNum(x.multiplo) + 'x';
          return y;
        }))) +
      '</div>';
  }"""
assert old in s
s = s.replace(old, new)

# ---- punto 5: share de la plata por canal ----
old = """        panel('Monto desembolsado por día',
          em.cohorte
            ? 'todas las sedes de marketing, no solo la cosecha de ' + esc(em.mes) +
              ' · fecha de firma'
            : 'COP por ' + g + ' · fecha de firma del contrato',
          '', 'gF1Rev') +
        '</div>';"""
new = """        panel('Monto desembolsado por día',
          em.serieCohorte
            ? 'la misma plata de la tarjeta, día por día · cosecha de ' + esc(em.mes)
            : 'COP por ' + g + ' · fecha de firma del contrato',
          '', 'gF1Rev') +
        '</div>';

      // Share de esa misma plata por canal. Los cuatro canales van aunque
      // pongan cero: un canal que trajo sedes y no puso plata es informacion.
      if ((em.canales || []).length) {
        h += '<div style="margin-top:14px">' +
          panel('¿De qué canal salió esa plata?',
            fCopC(em.montoCanales) + ' de la cosecha de ' + esc(em.mes) +
            ', repartidos por el origen de la sede',
            tabla([
              { t: 'Canal', k: 'canal', f: 'txt', txt: true },
              { t: 'Sedes', k: 'sedes' },
              { t: 'Solicitudes', k: 'sol' },
              { t: 'Aprobados', k: 'apr' },
              { t: 'Desembolsos', k: 'des' },
              { t: 'Conv', k: 'conv', f: 'pct' },
              { t: 'Ticket', k: 'ticket', f: 'cop' },
              { t: 'Plata', k: 'monto', f: 'cop' },
              { t: '% de la plata', k: 'pct', f: 'pct' }
            ], em.canales)) +
          '</div>';
      }"""
assert old in s
s = s.replace(old, new)
io.open(p, 'w', encoding='utf8').write(s)
print('frontend ok')
