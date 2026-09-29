# -*- coding: utf-8 -*-
import io

# ---------- Filtro_Origen.gs: el universo pasa a cortar tambien por equipo ----
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Filtro_Origen.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b, f=p):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

rep("""function universoSedes_(origenes) {
  var todas = leerHoja_('SEDES');""",
    """/* Los tres equipos comerciales de HubSpot, mas los dos residuales. El orden
   es el del embudo: Hunter trae, Farmer cultiva, CS retiene.
   OJO: los equipos viven en HubSpot (get_organization_details) y el mapa
   owner -> equipo se congela en la hoja SEDE_OWNER cuando corre el refresh.
   Si alguien cambia de equipo hay que volver a correr pull_owner. */
var EQUIPOS_ORDEN = ['Hunter', 'Farmer', 'Customer Success',
                     '(OTRO EQUIPO)', '(SIN OWNER)'];

/** El universo de sedes, cortado por los DOS filtros globales: el origen de
    la sede y el equipo de su owner. Es el unico punto donde se filtra, asi
    que todo lo que consuma U respeta los dos sin tener que saberlo. */
function universoSedes_(origenes, equipos) {
  var todas = leerHoja_('SEDES');""")

rep("""  var lista = (origenes || []).map(normOrigen_).filter(function (x) { return !!x; });
  var todos = lista.length === 0;
  var sel = {};
  lista.forEach(function (o) { sel[o] = true; });""",
    """  // ---- Filtro de EQUIPO del owner ----------------------------------
  // El mapa id de HubSpot -> equipo sale de SEDE_OWNER, que se arma con los
  // equipos reales de HubSpot. Se corta antes del origen para que el conteo
  // de "sedes del universo" ya venga con los dos filtros aplicados.
  var ow = leerHoja_('SEDE_OWNER');
  var eqDe = {}, catEq = {};
  ow.forEach(function (r) {
    var k = String(r.id || '').trim();
    if (!k) return;
    var eq = String(r.equipo || '(SIN OWNER)');
    eqDe[k] = eq;
    catEq[eq] = (catEq[eq] || 0) + 1;
  });
  var listaEq = (equipos || []).map(function (x) { return String(x || '').trim(); })
    .filter(function (x) { return !!x; });
  var todosEq = listaEq.length === 0;
  var selEq = {};
  listaEq.forEach(function (e) { selEq[e] = true; });
  var fueraEq = 0;
  if (!todosEq && ow.length) {
    todas = todas.filter(function (s) {
      var eq = eqDe[String(s.id || '').trim()] || '(SIN OWNER)';
      if (selEq[eq]) return true;
      fueraEq++;
      return false;
    });
  }

  var lista = (origenes || []).map(normOrigen_).filter(function (x) { return !!x; });
  var todos = lista.length === 0;
  var sel = {};
  lista.forEach(function (o) { sel[o] = true; });""")

rep("""    origenes: lista,
    etiqueta: etiquetaUniverso_(lista, todas.length, filas.length),
    catalogo: catalogoOrigenes_(todas)
  };
}""",
    """    origenes: lista,
    etiqueta: etiquetaUniverso_(lista, todas.length, filas.length),
    catalogo: catalogoOrigenes_(todas),
    // Equipo: lo elegido, el catalogo con conteos y la etiqueta para la cinta.
    equipos: listaEq, equiposTodos: todosEq,
    equipoEtiqueta: todosEq ? 'Todos los equipos' : listaEq.join(' + '),
    catalogoEquipos: EQUIPOS_ORDEN.filter(function (e) { return catEq[e]; })
      .map(function (e) { return { equipo: e, sedes: catEq[e] }; }),
    equipoFuera: fueraEq
  };
}""")
io.open(p, 'w', encoding='utf8').write(s)
print('Filtro_Origen.gs ok')

# ---------- Code.gs: la firma y el meta ----------
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
rep("""function getDashboardData(inicio, fin, origenes) {""",
    """function getDashboardData(inicio, fin, origenes, equipos) {""")
rep("""  var U = universoSedes_(origenes);""",
    """  var U = universoSedes_(origenes, equipos);""")
rep("""      origenSedes: U.total, origenSedesBase: U.totalBase,""",
    """      origenSedes: U.total, origenSedesBase: U.totalBase,
      equipos: U.equipos, equiposTodos: U.equiposTodos,
      equipoEtiqueta: U.equipoEtiqueta, catalogoEquipos: U.catalogoEquipos,""")
io.open(p, 'w', encoding='utf8').write(s)
print('Code.gs ok')
