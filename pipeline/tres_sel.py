# -*- coding: utf-8 -*-
import io

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/dashboard.html'
s = io.open(p, encoding='utf8').read()
old = """    <!-- Filtro global de EQUIPO del owner. Corta el universo de sedes igual
         que el de origen, asi que aplica a los seis frentes. -->
    <div class="campo">
      <label for="selOwner">Equipo (owner)</label>
      <select id="selOwner"></select>
    </div>
"""
new = """    <!-- Tres filtros globales de owner, uno por equipo, cada uno con su
         gente. Cortan el universo de sedes igual que el de origen, asi que
         aplican a los seis frentes. Se combinan entre si y con el de origen:
         lo elegido en los tres se suma. -->
    <div id="filtrosOwner" class="owner-wrap"></div>
"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('markup ok')

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

rep("""/* El selector de equipo. Un solo select y no un panel de checks como el de
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
}""",
    """/* Un selector por equipo, cada uno con su gente. Tres controles y no uno
   solo porque la pregunta del negocio se hace por equipo: "que hizo Farmer",
   "que hizo tal farmer". Cada uno tiene su opcion de equipo completo.

   Semantica de la combinacion: lo elegido en los tres se SUMA. Un selector en
   su valor por defecto no aporta nada, asi que dejar los tres sin tocar es
   "todos". Elegir a alguien en dos equipos muestra a esos dos. */
function montarSelectorOwner() {
  var cat = (D && D.meta && D.meta.catalogoEquipos) || [];
  var cont = document.getElementById('filtrosOwner');
  if (!cont || !cat.length) return;
  cont.innerHTML = cat.map(function (c, i) {
    var id = 'selOw' + i;
    var sel = valorSelOwner(c);
    return '<div class="campo"><label for="' + id + '">' + esc(c.equipo) +
      '</label><select id="' + id + '" data-equipo="' + esc(c.equipo) + '">' +
      '<option value="">— sin filtrar —</option>' +
      '<option value="@' + esc(c.equipo) + '"' +
      (sel === '@' + c.equipo ? ' selected' : '') + '>Todo ' + esc(c.equipo) +
      ' (' + fNum(c.sedes) + ')</option>' +
      c.gente.map(function (g) {
        return '<option value="' + esc(g.id) + '"' +
          (sel === g.id ? ' selected' : '') + '>' + esc(g.nombre) +
          ' (' + fNum(g.sedes) + ')</option>';
      }).join('') + '</select></div>';
  }).join('');
  cont.querySelectorAll('select').forEach(function (sl) {
    sl.addEventListener('change', function () {
      OWNER_SEL = {};
      cont.querySelectorAll('select').forEach(function (s2) {
        if (s2.value) OWNER_SEL[s2.getAttribute('data-equipo')] = s2.value;
      });
      EQUIPOS_SEL = Object.keys(OWNER_SEL).map(function (k) { return OWNER_SEL[k]; });
      cargar();
    });
  });
}
/** Que tiene elegido el selector de este equipo, si algo. */
function valorSelOwner(c) {
  return OWNER_SEL[c.equipo] || '';
}""")

rep("""var EQUIPOS_SEL = [];       // vacio = todos los equipos""",
    """var EQUIPOS_SEL = [];       // ids de owner elegidos; vacio = todos
var OWNER_SEL = {};         // equipo -> lo elegido en su selector""")

# el motor devuelve ids expandidos, asi que NO se puede sobrescribir la
# seleccion del frontend con lo que llega (perderia el '@equipo')
rep("""      if (D.meta.equipos) EQUIPOS_SEL = D.meta.equipos.slice();
      montarSelectorOwner();""",
    """      // OJO: no se sincroniza EQUIPOS_SEL desde el payload. El motor
      // devuelve los ids ya EXPANDIDOS, asi que sobrescribir aca perderia el
      // '@equipo' y el selector se saldria de "Todo Farmer" al primer refresh.
      montarSelectorOwner();""")

# la cinta habla de owners, no de equipos
rep("""  if (!m.equiposTodos) partes.push('equipo ' + esc(m.equipoEtiqueta || ''));""",
    """  if (!m.equiposTodos) partes.push('owner ' + esc(m.equipoEtiqueta || ''));""")
io.open(p, 'w', encoding='utf8').write(s)
print('scripts ok')

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/styles.html'
s = io.open(p, encoding='utf8').read()
add = """
/* Los tres selectores de owner van juntos en la barra de filtros, y se
   envuelven en pantallas angostas en vez de empujar al de origen. */
.owner-wrap { display: flex; flex-wrap: wrap; gap: 12px; }
.owner-wrap select { max-width: 190px; }
"""
i = s.index('</style>')
assert '.owner-wrap' not in s
io.open(p, 'w', encoding='utf8').write(s[:i] + add + s[i:])
print('css ok')
