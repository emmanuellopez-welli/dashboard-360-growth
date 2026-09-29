# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

rep("""var EQUIPOS_SEL = [];       // ids de owner elegidos; vacio = todos
var OWNER_SEL = {};         // equipo -> lo elegido en su selector""",
    """/* Lo elegido en cada uno de los tres roles: { hunter, farmer, cs }. Vacio en
   un rol = ese rol no filtra. Los tres se combinan con Y. */
var ROLES_SEL = {};""")

rep("""/* Un selector por equipo, cada uno con su gente. Tres controles y no uno
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
}""",
    """/* Un selector por ROL, cada uno con su gente. Tres controles porque son tres
   asignaciones que CONVIVEN: a una sede la trae un hunter, la cultiva un
   farmer y la retiene un CS.

   Se combinan con Y: elegir hunter=Johanna y farmer=Viviana da las sedes que
   trajo Johanna Y que hoy cultiva Viviana. Con O, agregar un filtro daria un
   universo MAS grande, que es lo contrario de lo que espera quien filtra. */
function montarSelectorOwner() {
  var cat = (D && D.meta && D.meta.catalogoRoles) || [];
  var cont = document.getElementById('filtrosOwner');
  if (!cont || !cat.length) return;
  cont.innerHTML = cat.map(function (c) {
    var id = 'selRol_' + c.id;
    var sel = ROLES_SEL[c.id] || '';
    return '<div class="campo"><label for="' + id + '">' + esc(c.nombre) +
      '</label><select id="' + id + '" data-rol="' + esc(c.id) + '">' +
      '<option value="">— sin filtrar —</option>' +
      c.gente.map(function (g) {
        return '<option value="' + esc(g.id) + '"' +
          (sel === g.id ? ' selected' : '') + '>' + esc(g.nombre) +
          ' (' + fNum(g.sedes) + ')</option>';
      }).join('') + '</select></div>';
  }).join('');
  cont.querySelectorAll('select').forEach(function (sl) {
    sl.addEventListener('change', function () {
      ROLES_SEL = {};
      cont.querySelectorAll('select').forEach(function (s2) {
        if (s2.value) ROLES_SEL[s2.getAttribute('data-rol')] = s2.value;
      });
      cargar();
    });
  });
}""")

rep("""        ok(getDashboardData(ini, fin, orig, EQUIPOS_SEL.slice()));""",
    """        ok(getDashboardData(ini, fin, orig, ROLES_SEL));""")
rep("""  google.script.run.withSuccessHandler(ok).withFailureHandler(mal)
    .getDashboardData(ini, fin, orig, EQUIPOS_SEL.slice());""",
    """  google.script.run.withSuccessHandler(ok).withFailureHandler(mal)
    .getDashboardData(ini, fin, orig, ROLES_SEL);""")

rep("""  if (!m.equiposTodos) partes.push('owner ' + esc(m.equipoEtiqueta || ''));
  var col = '<b>' + fNum(m.origenSedes || 0) + '</b> sedes';
  if (!m.origenTodos || !m.equiposTodos) {""",
    """  if (!m.rolesTodos) partes.push(esc(m.rolEtiqueta || ''));
  var col = '<b>' + fNum(m.origenSedes || 0) + '</b> sedes';
  if (!m.origenTodos || !m.rolesTodos) {""")
io.open(p, 'w', encoding='utf8').write(s)
print('UI de tres roles')
