# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

anc = """  var cohA = cortarCd_(R.inicio, R.fin, mesIni, mesFin);"""
nuevo = """  // El TODO del periodo: los mismos creditos pero sin cortar por cosecha, o
  // sea todas las sedes del negocio. Sin este contexto la seccion se lee como
  // si fuera el total del mes, y no lo es: la cosecha nueva pone ~1% de la
  // plata. El 99% restante lo ponen las sedes que entraron antes, que es
  // exactamente el argumento de por que profundizacion importa.
  var todoPer = cortarCd_(R.inicio, R.fin, '0000-00', '9999-99');
  var cohA = cortarCd_(R.inicio, R.fin, mesIni, mesFin);"""
assert anc in s
s = s.replace(anc, nuevo, 1)

anc2 = """    sedes: sedesPer,
    universo: U.etiqueta,
    origenTodos: U.todos,"""
nuevo2 = """    sedes: sedesPer,
    universo: U.etiqueta,
    origenTodos: U.todos,
    // Cuanto pesa la cosecha nueva dentro del total del periodo.
    contexto: (hayCoh && todoPer.sol) ? {
      sol: todoPer.sol, apr: todoPer.apr, conv: todoPer.conv,
      monto: Math.round(todoPer.monto),
      pctSol: Math.round((cohA.sol / todoPer.sol) * 1000) / 10,
      pctMonto: todoPer.monto
        ? Math.round((cohA.monto / todoPer.monto) * 1000) / 10 : 0,
      montoResto: Math.round(todoPer.monto - cohA.monto)
    } : null,"""
assert anc2 in s
s = s.replace(anc2, nuevo2, 1)
io.open(p, 'w', encoding='utf8').write(s)
print('contexto agregado al motor')
