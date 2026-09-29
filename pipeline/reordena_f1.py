# -*- coding: utf-8 -*-
"""Reordena el storytelling de F1 y aplica los cambios pedidos:
   1 deals · 2 sedes ganadas · 3 torta de clase (sin desglose de canal) ·
   4 tabla de origen de la plata · 5 leads de Meta · 6 activacion GLOBAL"""
import io, re

def leer(k):
    return io.open('f1_%s.txt' % k, encoding='utf8').read()

s1, s2, s3, s4, s5, s6 = (leer(k) for k in ['s1', 's2', 's3', 's4', 's5', 's6'])

# ---------- renumerar los titulos ----------
def renum(txt, viejo, nuevo, titulo=None):
    pat = "'<h2 class=\"sec\">%d · " % viejo
    assert pat in txt, 'no encontre el titulo %d' % viejo
    if titulo:
        # reemplaza numero Y texto hasta el cierre del h2
        txt = re.sub(r"'<h2 class=\"sec\">%d · [^<]*</h2>'" % viejo,
                     "'<h2 class=\"sec\">%d · %s</h2>'" % (nuevo, titulo), txt, 1)
    else:
        txt = txt.replace(pat, "'<h2 class=\"sec\">%d · " % nuevo, 1)
    return txt

s4 = renum(s4, 4, 1)
s1 = renum(s1, 1, 2, '¿Cuántas sedes ganamos?')
s3 = renum(s3, 3, 3)
s5 = renum(s5, 5, 4)
s2 = renum(s2, 2, 5)
s6 = renum(s6, 6, 6)

# ---------- 3: fuera el desglose por canal ----------
old_can = """    /* La dona de marketing usa la mitad izquierda del SVG, asi que el
       desglose por canal va en la mitad derecha del mismo panel: es la
       pregunta que sigue naturalmente a "¿cuantas trajo marketing?". */
    var canales = (comp.mkt.canales || []).length
      ? '<table class="t" style="margin-top:4px"><thead><tr>' +
        '<th style="text-align:left">Canal</th><th>Sedes</th><th>%</th>' +
        '</tr></thead><tbody>' +
        comp.mkt.canales.map(function (r) {
          return '<tr><td class="txt">' + esc(r.canal) + '</td><td>' + fNum(r.n) +
            '</td><td>' + fPct(r.pct) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '';
"""
assert old_can in s3
s3 = s3.replace(old_can, "", 1)
old_panel = """      '<div class="panel">' +
        '<h3>Las ' + fNum(comp.mkt.n) + ' que trajo marketing</h3>' +
        '<p class="sub">' + fPct(comp.mkt.pct) + ' del mes · por clasificación y por canal</p>' +
        '<div class="torta-fila">' +
          '<div class="grafica" id="gF1TortaMkt"></div>' +
          '<div class="torta-tabla">' + canales + '</div>' +
        '</div>' +
      '</div>' +"""
new_panel = """      // Sin el desglose por canal: el reparto por origen ya va completo en
      // la tabla de la seccion 4, y repetirlo aca solo lo desactualiza.
      panel('Las ' + fNum(comp.mkt.n) + ' que trajo marketing',
        fPct(comp.mkt.pct) + ' del mes · por clasificación de aliado',
        '', 'gF1TortaMkt') +"""
assert old_panel in s3
s3 = s3.replace(old_panel, new_panel, 1)

# ---------- 6: global, no marketing ----------
s6 = s6.replace("""    h += '<h2 class="sec">6 · De las sedes que trajimos, ¿cuántas arrancaron?</h2>' +
      '<p class="sec-sub">cosecha de ' + esc(ac.mes) + ' · activa = radicó al menos una ' +
      'solicitud en el mes · exitosa = 3 o más solicitudes, o ya con desembolso</p>';
    h += filaKPIs(ac.kpis);""",
"""    // GLOBAL, no el subconjunto de marketing: la pregunta es si las sedes
    // que entraron arrancan, sin importar quien las trajo.
    h += '<h2 class="sec">6 · De las sedes que entraron, ¿cuántas arrancaron?</h2>' +
      '<p class="sec-sub">cosecha de ' + esc(ac.mes) + ' · todos los orígenes · ' +
      'activa = radicó al menos una solicitud en el mes · exitosa = 3 o más ' +
      'solicitudes, o ya con desembolso</p>';
    h += filaKPIs(ac.kpisTodas || ac.kpis);""")

# el embudo y la comparacion pasan a ser de TODAS
s6 = re.sub(r"      panel\('De nuevas a exitosas',.*?'', 'gF1Act'\) \+\n"
            r"      panel\('¿Marketing trae sedes que arrancan mejor\?',.*?\], ac\.comparar\)\) \+\n"
            r"      '</div>';",
"""      panel('De nuevas a exitosas',
        'las ' + fNum(ac.todas.total) + ' sedes que entraron en ' + esc(ac.mes) +
        (ac.todas.sinId
          ? ' · ' + fNum(ac.todas.sinId) + ' sin id_internal, no verificables'
          : ''),
        '', 'gF1Act') +
      '</div>';""", s6, flags=re.S)
s6 = s6.replace("chBarrasH(el, (ac.pasos || []).map(function (p) {",
                "chBarrasH(el, (ac.pasosTodas || ac.pasos || []).map(function (p) {")

nuevo = '\n'.join([s4, s1, s3, s5, s2, s6])
io.open('f1_nuevo.txt', 'w', encoding='utf8').write(nuevo)
print('bloques reordenados: 4,1,3,5,2,6')
for n, t in [('1 deals', s4), ('2 sedes', s1), ('3 torta', s3),
             ('4 tabla origen', s5), ('5 leads', s2), ('6 activacion', s6)]:
    m = re.search(r'<h2 class="sec">([^<]*)</h2>', t)
    print('   %-16s %s' % (n, m.group(1) if m else '(sin titulo)'))
