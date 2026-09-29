# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()


def rep(a, b):
    global s
    assert a in s, a[:100]
    s = s.replace(a, b, 1)


# BUG: el corte por origen estaba DESPUES de acumular todas/ids/mktReal, asi
# que la tarjeta de sedes nuevas, las dos donas y la activacion mostraban
# todos los origenes con el filtro puesto en marketing. Solo b.total cortaba.
#
# Ahora el filtro va arriba: TODO el frente respeta el filtro global, y el
// desglose de marketing pasa a ser "marketing DENTRO del filtro".
rep("""  var agCos = {};
  sedesF1.forEach(function (x) {
    var m = String(x.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;""",
    """  var agCos = {};
  // Todo el frente respeta el filtro global de origen: antes el corte estaba
  // DESPUES de acumular, y la tarjeta de sedes nuevas, las donas y la
  // activacion seguian mostrando todos los origenes con marketing filtrado.
  var sinFiltrarCos = 0;
  sedesF1.forEach(function (x) {
    var m = String(x.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    if (!selF1_(x)) { sinFiltrarCos++; return; }""")

rep("""    if (!selF1_(x)) return;
    b.total++;
    var ob = String(x.origen_bucket || '');""",
    """    b.total++;
    var ob = String(x.origen_bucket || '');""")
io.open(p, 'w', encoding='utf8').write(s)
print('agCos filtra desde arriba')
