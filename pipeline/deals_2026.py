# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# Piso de cosecha para los deals, por la misma razon que en profundizacion:
# las de 2025 son de un pipeline que ya no existe.
rep("""  var dcO = leerHoja_('DEALS_ORIGEN');""",
    """  // Desde 2026 igual que profundizacion: las cosechas de 2025 son de un
  // pipeline que ya no existe y ensucian la comparacion entre meses.
  var COSECHA_PISO_DEALS = '2026-01';
  var dcO = leerHoja_('DEALS_ORIGEN');""")
rep("""    var cos = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(cos)) return;
    var o = normOrigen_(r.origen);""",
    """    var cos = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(cos) || cos < COSECHA_PISO_DEALS) return;
    var o = normOrigen_(r.origen);""")

# las cinco causales, dichas en el subtitulo
rep("""    excluidos: 'Duplicado/Existente · No pasó SARLAFT · Medicina Alternativa',""",
    """    excluidos: 'Duplicado/Existente · No pasó SARLAFT · Medicina Alternativa · ' +
      'Le faltan Documentos · Pruebas',""")
io.open(p, 'w', encoding='utf8').write(s)
print('deals: piso 2026 y cinco exclusiones')
