# -*- coding: utf-8 -*-
import io

# ---------- Filtro_Origen.gs: el corte pasa a ser por PERSONA ----------
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Filtro_Origen.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

rep("""var EQUIPOS_ORDEN = ['Hunter', 'Farmer', 'Customer Success',
                     '(OTRO EQUIPO)', '(SIN OWNER)'];""",
    """var EQUIPOS_ORDEN = ['Hunter', 'Farmer', 'Customer Success',
                     '(OTRO EQUIPO)', '(SIN OWNER)'];

/* Los tres equipos comerciales de HubSpot con sus personas. El filtro es por
   PERSONA agrupada por equipo: son tres selectores, uno por equipo, y cada
   uno lista a su gente. Cada equipo tiene su opcion "todo el equipo".

   Los ids salen de get_organization_details. Si alguien entra o sale de un
   equipo hay que actualizar este mapa Y volver a correr pull_owner.py. Se
   deja explicito a proposito: un mapa que se puede revisar es mejor que una
   inferencia que se rompe en silencio. */
var EQUIPOS_HS = {
  'Hunter': ['83917986', '83703393', '83703394', '89418948'],
  'Farmer': ['84380856', '83703389', '84418150', '84380858', '84380859',
             '83748986', '83748988', '83748989', '83703392', '83703390'],
  'Customer Success': ['84380860', '88454157']
};
var EQUIPO_DE_OWNER = (function () {
  var m = {};
  Object.keys(EQUIPOS_HS).forEach(function (eq) {
    EQUIPOS_HS[eq].forEach(function (id) { m[id] = eq; });
  });
  return m;
}());
function equipoDeOwner_(id) {
  id = String(id || '').trim();
  if (!id || id === '0') return '(SIN OWNER)';
  return EQUIPO_DE_OWNER[id] || '(OTRO EQUIPO)';
}""")

rep("""  var listaEq = (equipos || []).map(function (x) { return String(x || '').trim(); })
    .filter(function (x) { return !!x; });
  var todosEq = listaEq.length === 0;
  var selEq = {};
  listaEq.forEach(function (e) { selEq[e] = true; });""",
    """  // El filtro llega como lista de OWNER IDs. Un equipo entero se manda como
  // '@Hunter' y se expande aca, para que el frontend no tenga que conocer la
  // composicion de los equipos.
  var listaEq = [];
  (equipos || []).forEach(function (x) {
    var v = String(x || '').trim();
    if (!v) return;
    if (v.charAt(0) === '@') {
      (EQUIPOS_HS[v.substring(1)] || []).forEach(function (id) { listaEq.push(id); });
    } else {
      listaEq.push(v);
    }
  });
  var todosEq = listaEq.length === 0;
  var selEq = {};
  listaEq.forEach(function (e) { selEq[e] = true; });""")

rep("""  var ow = leerHoja_('SEDE_OWNER');
  var eqDe = {}, catEq = {};
  ow.forEach(function (r) {
    var k = String(r.id || '').trim();
    if (!k) return;
    var eq = String(r.equipo || '(SIN OWNER)');
    eqDe[k] = eq;
    catEq[eq] = (catEq[eq] || 0) + 1;
  });""",
    """  var ow = leerHoja_('SEDE_OWNER');
  var eqDe = {}, catPer = {}, nomDe = {};
  ow.forEach(function (r) {
    var k = String(r.id || '').trim();
    if (!k) return;
    var oid = String(r.owner_id || '').trim() || '0';
    eqDe[k] = oid;
    nomDe[oid] = String(r.owner || '') || 'Sin owner';
    catPer[oid] = (catPer[oid] || 0) + 1;
  });""")

rep("""  function esDelEquipo_(s) {
    return !!selEq[eqDe[String(s.id || '').trim()] || '(SIN OWNER)'];
  }""",
    """  function esDelEquipo_(s) {
    return !!selEq[eqDe[String(s.id || '').trim()] || '0'];
  }""")

rep("""    // Equipo: lo elegido, el catalogo con conteos y la etiqueta para la cinta.
    equipos: listaEq, equiposTodos: todosEq,
    equipoEtiqueta: todosEq ? 'Todos los equipos' : listaEq.join(' + '),
    catalogoEquipos: EQUIPOS_ORDEN.filter(function (e) { return catEq[e]; })
      .map(function (e) { return { equipo: e, sedes: catEq[e] }; }),
    equipoFuera: fueraEq""",
    """    // Owner: los ids elegidos, el catalogo por equipo y la etiqueta legible.
    equipos: listaEq, equiposTodos: todosEq,
    equipoEtiqueta: todosEq ? 'Todos los owners'
      : listaEq.map(function (id) { return nomDe[id] || id; }).join(' + '),
    // Catalogo agrupado por equipo, en el orden del embudo comercial. Solo
    // aparece quien tiene sedes: un owner con cero no es una opcion util.
    catalogoEquipos: EQUIPOS_ORDEN.map(function (eq) {
      var gente = [];
      Object.keys(catPer).forEach(function (oid) {
        if (equipoDeOwner_(oid) !== eq) return;
        gente.push({ id: oid, nombre: nomDe[oid] || oid, sedes: catPer[oid] });
      });
      gente.sort(function (a, b) { return b.sedes - a.sedes; });
      var tot = 0;
      gente.forEach(function (g) { tot += g.sedes; });
      return { equipo: eq, sedes: tot, gente: gente };
    }).filter(function (e) { return e.sedes > 0; }),
    equipoFuera: fueraEq""")
io.open(p, 'w', encoding='utf8').write(s)
print('Filtro_Origen.gs: filtro por persona')

# ---------- Code.gs: pasaFiltros_ compara owner ----------
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
rep("""  if (!U.equiposTodos) {
    var eq = String(r.equipo || '(SIN OWNER)');
    if (U.equipos.indexOf(eq) < 0) return false;
  }
  return true;""",
    """  if (!U.equiposTodos) {
    var oid = String(r.owner || '').trim() || '0';
    if (U.equipos.indexOf(oid) < 0) return false;
  }
  return true;""")
rep("""    if (!U.equiposTodos &&
        U.equipos.indexOf(String(r.equipo || '(SIN OWNER)')) < 0) return;""",
    """    if (!U.equiposTodos &&
        U.equipos.indexOf(String(r.owner || '').trim() || '0') < 0) return;""")
io.open(p, 'w', encoding='utf8').write(s)
print('Code.gs: pasaFiltros_ por owner')
