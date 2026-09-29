# -*- coding: utf-8 -*-
import io

# ---------- 1. markup: dos selects, y las fechas pasan a ocultas ----------
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/dashboard.html'
s = io.open(p, encoding='utf8').read()
old = """    <div class="campo">
      <label for="fDesde">Desde</label>
      <input type="date" id="fDesde">
    </div>
    <div class="campo">
      <label for="fHasta">Hasta</label>
      <input type="date" id="fHasta">
    </div>
"""
new = """    <!-- Mes y semana en vez de dos calendarios libres. El de semanas se
         repuebla con las semanas DEL MES elegido, asi que no se puede armar
         un rango que no exista. Las fechas siguen viviendo en dos inputs
         ocultos porque son la entrada real de cargar(). -->
    <div class="campo">
      <label for="selMes">Mes</label>
      <select id="selMes"></select>
    </div>
    <div class="campo">
      <label for="selSemana">Semana</label>
      <select id="selSemana"></select>
    </div>
    <input type="hidden" id="fDesde">
    <input type="hidden" id="fHasta">
"""
assert old in s, 'no encontre los campos de fecha'
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('markup ok')

# ---------- 2. motor: la lista de meses con datos ----------
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
old = """    estado: estado,
    textos: cfg
  };"""
new = """    estado: estado,
    // Los meses que tienen dato, para poblar el selector. Se sacan del rango
    // real de las fuentes fechadas en vez de una lista fija, asi el selector
    // no ofrece meses vacios ni se queda corto cuando entren datos nuevos.
    mesesDatos: mesesConDatos_(),
    textos: cfg
  };"""
assert old in s, 'no encontre el bloque de meta'
s = s.replace(old, new, 1)

fn = """
/** Meses que tienen dato en alguna fuente fechada, del mas viejo a hoy.
    Pobla el selector de mes: una lista fija se desactualiza sola y un rango
    calculado sobre una sola hoja deja meses afuera. */
function mesesConDatos_() {
  var min = '9999-99';
  ['COSECHA_DIA', 'META_ADS', 'RESCATE_VENTANA'].forEach(function (nom) {
    var filas = leerHoja_(nom);
    filas.forEach(function (r) {
      var f = String(fechaCelda_(r.fecha) || r.fecha || '').substring(0, 7);
      if (/^\d{4}-\d{2}$/.test(f) && f < min) min = f;
    });
  });
  var hoy = hoyISO_().substring(0, 7);
  if (min === '9999-99') return [hoy];
  var out = [];
  var t = Number(min.substring(0, 4)) * 12 + (Number(min.substring(5, 7)) - 1);
  var th = Number(hoy.substring(0, 4)) * 12 + (Number(hoy.substring(5, 7)) - 1);
  for (; t <= th; t++) {
    out.push(('0000' + Math.floor(t / 12)).slice(-4) + '-' +
             ('0' + (t % 12 + 1)).slice(-2));
  }
  return out;
}
"""
anc = 'function armarF1_('
j = s.rindex('/*', 0, s.index(anc))
s = s[:j] + fn.lstrip('\n') + '\n' + s[j:]
io.open(p, 'w', encoding='utf8').write(s)
print('motor ok')
