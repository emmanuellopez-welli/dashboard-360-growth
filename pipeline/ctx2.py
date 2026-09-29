# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# La exclusion de la carga inicial existe para no distorsionar comparaciones
# ENTRE cosechas. Para el denominador "todo el periodo" no aplica: esas 1.922
# sedes son reales y producen plata real, y sacarlas hace que la cosecha nueva
# parezca pesar 8% cuando pesa 1,2%.
rep("""  function cortarCd_(desde, hasta, mDesde, mHasta) {""",
    """  function cortarCd_(desde, hasta, mDesde, mHasta, conCargaInicial) {""")
rep("""      if (cos < mDesde || cos > mHasta) return;
      if (esCargaInicial_(cos)) return;""",
    """      if (cos < mDesde || cos > mHasta) return;
      if (!conCargaInicial && esCargaInicial_(cos)) return;""")
rep("""  var todoPer = cortarCd_(R.inicio, R.fin, '0000-00', '9999-99');""",
    """  var todoPer = cortarCd_(R.inicio, R.fin, '0000-00', '9999-99', true);""")
io.open(p, 'w', encoding='utf8').write(s)
print('denominador con toda la base')
