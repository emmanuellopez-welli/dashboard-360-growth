# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# Al sincronizar tras la carga, "Todo el mes" gana si el rango ES el mes
# completo. Sin esto, un mes de dos dias coincide con su semana 1 y el
# selector arranca en "Semana 1" cuando lo que se pidio fue el mes.
rep("""      montarSelectores();
      var v = document.getElementById('fDesde').value + '|' +
              document.getElementById('fHasta').value;
      poblarSemanas(v);""",
    """      montarSelectores();
      var a0 = document.getElementById('fDesde').value;
      var b0 = document.getElementById('fHasta').value;
      poblarSemanas(esMesCompleto(MES_SEL, a0, b0) ? '' : a0 + '|' + b0);""")

# El arranque: el ultimo mes con dato, pero si el mes en curso lleva menos de
# una semana se abre el anterior. Un mes de dos dias se lee como una caida.
rep("""  // Arranca en el mes en curso. El catalogo de meses todavia no llego (viene
  // en el payload), asi que la primera carga se hace con el mes de hoy y los
  // selectores se pueblan cuando responde.
  var hoy0 = new Date();
  MES_SEL = iso(hoy0).substring(0, 7);
  document.getElementById('fDesde').value = MES_SEL + '-01';
  document.getElementById('fHasta').value = iso(hoy0);
  cargar();""",
    """  // Arranca en el ultimo mes con dato. Si el mes en curso lleva menos de una
  // semana se abre el anterior: un mes de dos dias se lee como una caida y no
  // es lo primero que alguien deberia ver. El catalogo de meses llega en el
  // payload, asi que los selectores se pueblan cuando responde.
  var hoy0 = new Date();
  var diaHoy = Number(iso(hoy0).substring(8, 10));
  MES_SEL = iso(hoy0).substring(0, 7);
  if (diaHoy < 7) {
    var yy = hoy0.getFullYear(), mm = hoy0.getMonth() - 1;
    MES_SEL = iso(new Date(yy, mm, 1)).substring(0, 7);
  }
  aplicarSeleccionMes(MES_SEL);
  cargar();""")
io.open(p, 'w', encoding='utf8').write(s)
print('arranque ok')
