# -*- coding: utf-8 -*-
import io

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Filtro_Origen.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# La lista cruda de SEDES cortada SOLO por equipo. La necesita el conteo de
# cosechas de F1, que a proposito NO aplica la regla de plataforma (la tarjeta
# de "sedes nuevas" cuenta todo lo que se creo en HubSpot) pero si tiene que
# responder al filtro de equipo.
rep("""  var ow = leerHoja_('SEDE_OWNER');""",
    """  var cruda = leerHoja_('SEDES');
  var ow = leerHoja_('SEDE_OWNER');""")
rep("""  var fueraEq = 0;
  if (!todosEq && ow.length) {
    todas = todas.filter(function (s) {
      var eq = eqDe[String(s.id || '').trim()] || '(SIN OWNER)';
      if (selEq[eq]) return true;
      fueraEq++;
      return false;
    });
  }""",
    """  var fueraEq = 0;
  function esDelEquipo_(s) {
    return !!selEq[eqDe[String(s.id || '').trim()] || '(SIN OWNER)'];
  }
  if (!todosEq && ow.length) {
    todas = todas.filter(function (s) {
      if (esDelEquipo_(s)) return true;
      fueraEq++;
      return false;
    });
    cruda = cruda.filter(esDelEquipo_);
  }""")
rep("""    base: todas,""",
    """    base: todas,
    // baseCruda = SEDES cortada solo por equipo, sin la regla de plataforma.
    // La usa el conteo de cosechas de F1, que cuenta todo lo creado en
    // HubSpot pero igual tiene que responder al filtro de equipo.
    baseCruda: cruda,""")
io.open(p, 'w', encoding='utf8').write(s)
print('baseCruda ok')

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
rep("""  var sedesF1 = leerHoja_('SEDES');""",
    """  var sedesF1 = U.baseCruda || leerHoja_('SEDES');""")
io.open(p, 'w', encoding='utf8').write(s)
print('armarF1_ usa baseCruda')
