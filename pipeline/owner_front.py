# -*- coding: utf-8 -*-
import io

# ---------- markup ----------
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/dashboard.html'
s = io.open(p, encoding='utf8').read()
old = """    <!-- Filtro global de origen. Aplica a Profundizacion, Rescate y Welli
         Points; Adquisicion no se filtra porque por definicion mide lo que
         trae marketing. -->"""
new = """    <!-- Filtro global de EQUIPO del owner. Corta el universo de sedes igual
         que el de origen, asi que aplica a los seis frentes. -->
    <div class="campo">
      <label for="selOwner">Equipo (owner)</label>
      <select id="selOwner"></select>
    </div>

    <!-- Filtro global de origen de la sede. Corta el mismo universo. -->"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('markup ok')

# ---------- scripts ----------
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

rep("""var ORIGENES_SEL = [];      // vacio = todos""",
    """var ORIGENES_SEL = [];      // vacio = todos
var EQUIPOS_SEL = [];       // vacio = todos los equipos""")

# el select se pobla con el catalogo que manda el motor
rep("""function montarSelectores() {""",
    """/* El selector de equipo. Un solo select y no un panel de checks como el de
   origen: son tres equipos, no veinticuatro, y la pregunta del negocio es
   "que hace Hunter contra Farmer contra CS", que se responde de uno en uno. */
function montarSelectorOwner() {
  var cat = (D && D.meta && D.meta.catalogoEquipos) || [];
  var so = document.getElementById('selOwner');
  if (!so || !cat.length) return;
  var sel = EQUIPOS_SEL.length ? EQUIPOS_SEL[0] : '';
  var tot = 0;
  cat.forEach(function (c) { tot += c.sedes; });
  so.innerHTML = '<option value="">Todos los equipos (' + fNum(tot) + ')</option>' +
    cat.map(function (c) {
      return '<option value="' + esc(c.equipo) + '"' +
        (c.equipo === sel ? ' selected' : '') + '>' +
        esc(c.equipo) + ' (' + fNum(c.sedes) + ')</option>';
    }).join('');
}

function montarSelectores() {""")

# tras cada carga, sincronizar el select de equipo
rep("""      montarSelectores();
      var a0 = document.getElementById('fDesde').value;""",
    """      if (D.meta.equipos) EQUIPOS_SEL = D.meta.equipos.slice();
      montarSelectorOwner();
      montarSelectores();
      var a0 = document.getElementById('fDesde').value;""")

# el equipo viaja al motor
rep("""        ok(getDashboardData(ini, fin, orig));""",
    """        ok(getDashboardData(ini, fin, orig, EQUIPOS_SEL.slice()));""")
rep("""  google.script.run.withSuccessHandler(ok).withFailureHandler(mal)
    .getDashboardData(ini, fin, orig);""",
    """  google.script.run.withSuccessHandler(ok).withFailureHandler(mal)
    .getDashboardData(ini, fin, orig, EQUIPOS_SEL.slice());""")

# listener
rep("""  document.getElementById('selSemana').addEventListener('change', function () {
    aplicarSeleccion(true);
  });""",
    """  document.getElementById('selSemana').addEventListener('change', function () {
    aplicarSeleccion(true);
  });
  document.getElementById('selOwner').addEventListener('change', function () {
    var v = document.getElementById('selOwner').value;
    EQUIPOS_SEL = v ? [v] : [];
    cargar();
  });""")

# la cinta muestra los DOS filtros: si solo dice el origen, se puede leer un
# numero de sedes recortado por equipo creyendo que es el total del origen
rep("""function cintaOrigen() {
  var m = (D && D.meta) || {};
  if (m.origenTodos) {
    return '<div class="cinta-origen">Todos los orígenes · <b>' +
      fNum(m.origenSedes || 0) + '</b> sedes</div>';
  }
  return '<div class="cinta-origen">' + esc(m.origenEtiqueta || '') + ' · <b>' +
    fNum(m.origenSedes || 0) + '</b> de ' + fNum(m.origenSedesBase || 0) + ' sedes</div>';
}""",
    """function cintaOrigen() {
  var m = (D && D.meta) || {};
  var partes = [];
  partes.push(m.origenTodos ? 'Todos los orígenes' : esc(m.origenEtiqueta || ''));
  // El equipo va SIEMPRE que no sea "todos": sin decirlo, un conteo de sedes
  // recortado por equipo se lee como el total del origen.
  if (!m.equiposTodos) partes.push('equipo ' + esc(m.equipoEtiqueta || ''));
  var col = '<b>' + fNum(m.origenSedes || 0) + '</b> sedes';
  if (!m.origenTodos || !m.equiposTodos) {
    col = '<b>' + fNum(m.origenSedes || 0) + '</b> de ' +
      fNum(m.origenSedesBase || 0) + ' sedes';
  }
  return '<div class="cinta-origen">' + partes.join(' · ') + ' · ' + col + '</div>';
}""")
io.open(p, 'w', encoding='utf8').write(s)
print('scripts ok')
