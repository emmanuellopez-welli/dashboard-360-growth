# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

old = """    if (em.hay) {
      h += '<div class="grid2" style="margin-top:14px">' +
        panel(em.cohorte ? 'Embudo de la cosecha del período' : 'Embudo del período',
          'pasar el mouse da el % de cada salto', '', 'gF1Emb') +
        // Este panel NO esta acotado a la cosecha: es el monto diario de
        // todas las sedes de marketing. Se dice en el subtitulo para que no
        // se lea como el desglose de la tarjeta de plata firmada.
        panel('Monto desembolsado por día',
          em.serieCohorte
            ? 'la misma plata de la tarjeta, día por día'
            : 'COP por ' + g + ' · fecha de firma del contrato',
          '', 'gF1Rev') +
        '</div>';

      // Share de esa misma plata por canal. Los cuatro canales van aunque
      // pongan cero: un canal que trajo sedes y no puso plata es informacion.
      if ((em.canales || []).length) {"""
new = """    if (em.hay) {
      // El embudo y el monto diario no aportaban: el embudo repetia los tres
      // numeros que ya estan en las tarjetas, y el monto diario de una
      // cosecha nueva son 13 barras dispersas sobre 31 dias.
      // Share de la plata por origen. Los origenes van aunque pongan cero: un
      // origen que trajo sedes y no puso plata es informacion.
      if ((em.canales || []).length) {"""
assert old in s
s = s.replace(old, new, 1)

old2 = """      pintar('gF1Emb', function (el) {
        chBarrasH(el, (em.pasos || []).map(function (p) {
          return { etiqueta: p.etapa, y: p.valor, d: p };
        }), { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 110,
          detalle: function (d) {
            return [{ nombre: 'Créditos', valor: fNum(d.d.valor) },
                    { nombre: '% de solicitudes', valor: fPct(d.d.pct) },
                    { nombre: '% del paso anterior', valor: fPct(d.d.pctPrev) }];
          } });
      });
      pintar('gF1Rev', function (el) {
        chBarras(el, em.serieRevenue || [], { color: 'var(--s4)', nombre: 'Desembolsado',
          gran: g, formato: fCop, formatoEje: fCopC });
      });
    }
"""
new2 = """    }
"""
assert old2 in s
io.open(p, 'w', encoding='utf8').write(s.replace(old2, new2, 1))
print('paneles borrados')
