# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# BUG: si la cosecha del periodo esta vacia, cA se quedaba con el valor del
# calculo viejo (EMBUDO_CONV, marketing, SIN filtrar por equipo) y la seccion
# mostraba 1.198 solicitudes donde la verdad es cero. Un cero es un dato; un
# numero de otra poblacion es una mentira.
rep("""  if (hayCoh) {
    cA = cohA;
    cP = cohP;
    emComparable = cohP.sol > 0;
  }""",
    """  // Siempre se toma el corte de cohorte, incluso cuando da cero: si no hay
  // sedes nuevas de ese equipo en el periodo, la respuesta es cero, no el
  // resultado de otra poblacion.
  cA = cohA;
  cP = cohP;
  emComparable = cohP.sol > 0;""")

# El share tampoco debe caer fuera del rango: si el universo no tiene cosechas
// dentro del periodo, la tarjeta no existe en vez de mostrar otro mes.
rep("""  var shUlt = shDentro.length
    ? shDentro[shDentro.length - 1]
    : (f.share.length ? f.share[f.share.length - 1] : null);""",
    """  // Solo meses DENTRO del rango. Antes caia al ultimo mes del dataset: con
  // un equipo que no trajo sedes en el periodo, la tarjeta mostraba el conteo
  // de otro mes como si fuera del periodo filtrado.
  var shUlt = shDentro.length ? shDentro[shDentro.length - 1] : null;""")
io.open(p, 'w', encoding='utf8').write(s)
print('fallback eliminado')
