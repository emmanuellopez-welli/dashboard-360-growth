# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()
nuevo = io.open('sel_front.js', encoding='utf8').read().rstrip('\n')

# aplicarPreset ya no tiene UI: lo reemplaza el par mes/semana
ini = s.index('function aplicarPreset(p) {')
j = s.rindex('\n', 0, ini)
fin = s.index('/* -------------------------------------------------------------- carga */')
s = s[:j + 1] + nuevo + '\n\n' + s[fin:]

# tras cada carga hay que repoblar los selectores: el catalogo de meses llega
# en el payload, asi que la primera carga es la que los llena
old = """      if (D.meta.origenes) ORIGENES_SEL = D.meta.origenes.slice();
    }"""
new = """      if (D.meta.origenes) ORIGENES_SEL = D.meta.origenes.slice();
      // El catalogo de meses viene en el payload, asi que los selectores se
      // pueblan con la primera carga y se mantienen sincronizados despues.
      montarSelectores();
      var v = document.getElementById('fDesde').value + '|' +
              document.getElementById('fHasta').value;
      poblarSemanas(v);
    }"""
assert old in s
s = s.replace(old, new, 1)

# los listeners
old2 = """  document.getElementById('btnAplicar').addEventListener('click', cargar);
  // Aplicar también al cambiar cualquiera de las dos fechas.
  ['fDesde', 'fHasta'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', cargar);
  });"""
new2 = """  document.getElementById('btnAplicar').addEventListener('click', function () {
    aplicarSeleccion(true);
  });
  // Cambiar el mes repuebla las semanas y vuelve a "Todo el mes": las semanas
  // del mes viejo no existen en el nuevo.
  document.getElementById('selMes').addEventListener('change', function () {
    MES_SEL = document.getElementById('selMes').value;
    poblarSemanas();
    aplicarSeleccion(true);
  });
  document.getElementById('selSemana').addEventListener('change', function () {
    aplicarSeleccion(true);
  });"""
assert old2 in s
s = s.replace(old2, new2, 1)

# arranque: el ultimo mes con dato, no los ultimos 3 meses
old3 = """  aplicarPreset('3m');     // arranca en los últimos 3 meses"""
new3 = """  // Arranca en el mes en curso. El catalogo de meses todavia no llego (viene
  // en el payload), asi que la primera carga se hace con el mes de hoy y los
  // selectores se pueblan cuando responde.
  var hoy0 = new Date();
  MES_SEL = iso(hoy0).substring(0, 7);
  document.getElementById('fDesde').value = MES_SEL + '-01';
  document.getElementById('fHasta').value = iso(hoy0);
  cargar();"""
assert old3 in s
s = s.replace(old3, new3, 1)
io.open(p, 'w', encoding='utf8').write(s)
print('cableado ok')
