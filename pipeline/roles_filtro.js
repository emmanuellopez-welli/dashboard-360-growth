/* Los tres ROLES del objeto Sedes de HubSpot. No son un dueño con equipo
   inferido: son tres asignaciones que CONVIVEN — a una sede la trae un
   hunter, la cultiva un farmer y la retiene un CS, los tres a la vez. Por eso
   son tres filtros y no uno, y por eso se combinan con Y y no con O:
   "las sedes que trajo Johanna Y que hoy cultiva Viviana". */
var ROLES = [
  { id: 'hunter', campo: 'hunter', nombre: 'Hunter' },
  { id: 'farmer', campo: 'farmer', nombre: 'Farmer' },
  { id: 'cs', campo: 'cs', nombre: 'Customer Success' }
];

/** El universo de sedes, cortado por TODOS los filtros globales: el origen de
    la sede y los tres roles. Es el unico punto donde se filtra, asi que todo
    lo que consuma U los respeta sin tener que saberlo.

    roles llega como { hunter: '83703393', farmer: '', cs: '' }: el owner id
    elegido en cada rol, vacio = ese rol no filtra. */
function universoSedes_(origenes, roles) {
  var todas = leerHoja_('SEDES');
  var cruda = leerHoja_('SEDES');

  // ---- REGLA DEL UNIVERSO acordada con BI (1 sep 2026) --------------
  // Una sede entra al tablero SI Y SOLO SI existe en institucion_medica
  // con country_code = 'COL'. La fecha de cosecha sigue siendo la de
  // HubSpot (hs_createdate); la plataforma manda en la EXISTENCIA, porque
  // una sede sin cuenta no puede originar credito y no es cosecha de nada.
  var plataforma = leerHoja_('PLATAFORMA_SEDES');
  var paisDe = {}, espDe = {};
  plataforma.forEach(function (r) {
    var id = String(r.id_sede || '').trim();
    if (!id) return;
    paisDe[id] = String(r.pais || 'COL');
    espDe[id] = String(r.especialidad || '');
  });
  var hayPlataforma = plataforma.length > 0;
  var fueraSinId = 0, fueraNoPlat = 0, fueraPais = 0;
  if (hayPlataforma) {
    todas = todas.filter(function (s) {
      var id = String(s.id_internal || '').trim();
      if (!id) { fueraSinId++; return false; }
      var pais = paisDe[id];
      if (pais === undefined) { fueraNoPlat++; return false; }
      if (pais !== 'COL') { fueraPais++; return false; }
      return true;
    });
  }

  // ---- Filtro de los tres ROLES -------------------------------------
  // El mapa sede -> (hunter, farmer, cs) sale de SEDE_ROLES, que se arma con
  // las propiedades propias del objeto en HubSpot.
  var rl = leerHoja_('SEDE_ROLES');
  var rolDe = {}, catRol = {};
  ROLES.forEach(function (R2) { catRol[R2.id] = {}; });
  rl.forEach(function (r) {
    var k = String(r.id || '').trim();
    if (!k) return;
    var v = {};
    ROLES.forEach(function (R2) {
      var oid = String(r[R2.campo] || '').trim() || '0';
      v[R2.id] = oid;
      catRol[R2.id][oid] = (catRol[R2.id][oid] || 0) + 1;
    });
    rolDe[k] = v;
  });

  var selRol = {}, hayRol = false;
  ROLES.forEach(function (R2) {
    var v = String((roles || {})[R2.id] || '').trim();
    selRol[R2.id] = v;
    if (v) hayRol = true;
  });
  // Los tres se combinan con Y: cada filtro estrecha mas. Con O, elegir un
  // hunter y un farmer daria un universo MAS grande que elegir solo uno, que
  // es lo contrario de lo que espera quien filtra.
  function pasaRoles_(s) {
    if (!hayRol) return true;
    var v = rolDe[String(s.id || '').trim()];
    for (var i = 0; i < ROLES.length; i++) {
      var q = selRol[ROLES[i].id];
      if (!q) continue;
      if (!v || v[ROLES[i].id] !== q) return false;
    }
    return true;
  }
  var fueraRol = 0;
  if (hayRol && rl.length) {
    todas = todas.filter(function (s) {
      if (pasaRoles_(s)) return true;
      fueraRol++;
      return false;
    });
    cruda = cruda.filter(pasaRoles_);
  }

  var lista = (origenes || []).map(normOrigen_).filter(function (x) { return !!x; });
  var todos = lista.length === 0;
  var sel = {};
  lista.forEach(function (o) { sel[o] = true; });

  var filas = [], ids = {}, nombres = {}, idsHS = {};
  todas.forEach(function (s) {
    if (!todos && !sel[normOrigen_(s.origen)]) return;
    filas.push(s);
    var id = String(s.id_internal || '').trim();
    if (id) ids[id] = true;
    // La llave de HubSpot es la que usan las tablas de hechos.
    var hs = String(s.id || '').trim();
    if (hs) idsHS[hs] = true;
    var nm = normNombre_(s.nombre_sede);
    if (nm) nombres[nm] = true;
  });

  // Nombres de los owners, para las etiquetas. Salen de la misma hoja.
  var nomOwner = {};
  leerHoja_('OWNERS').forEach(function (r) {
    nomOwner[String(r.owner_id || '').trim()] = String(r.nombre || '');
  });

  return {
    filas: filas, ids: ids, nombres: nombres,
    // idsHS: el set de sedes permitidas con la llave de HubSpot. Es lo que
    // usan las tablas de hechos (CREDITO_DIA), asi que el filtro se evalua
    // UNA vez por sede y no una vez por fila de hechos.
    idsHS: idsHS,
    base: todas,
    baseCruda: cruda,
    total: filas.length, totalBase: todas.length, todos: todos,
    universo: { aplicada: hayPlataforma, sinId: fueraSinId,
                noPlataforma: fueraNoPlat, otroPais: fueraPais },
    especialidadDe: espDe,
    origenes: lista,
    etiqueta: etiquetaUniverso_(lista, todas.length, filas.length),
    catalogo: catalogoOrigenes_(todas),
    // sinFiltro = NINGUN filtro global esta puesto. Es el unico atajo valido
    // para "devolver la tabla entera".
    sinFiltro: todos && !hayRol,
    // Roles: lo elegido, el catalogo por rol y la etiqueta para la cinta.
    roles: selRol, rolesTodos: !hayRol,
    rolEtiqueta: !hayRol ? 'Todos los roles'
      : ROLES.filter(function (R2) { return selRol[R2.id]; })
          .map(function (R2) {
            return R2.nombre + ': ' + (nomOwner[selRol[R2.id]] || selRol[R2.id]);
          }).join(' · '),
    catalogoRoles: ROLES.map(function (R2) {
      var gente = [];
      Object.keys(catRol[R2.id]).forEach(function (oid) {
        if (oid === '0') return;
        gente.push({ id: oid, nombre: nomOwner[oid] || oid,
                     sedes: catRol[R2.id][oid] });
      });
      gente.sort(function (a, b) { return b.sedes - a.sedes; });
      var sinAsignar = catRol[R2.id]['0'] || 0;
      return { id: R2.id, nombre: R2.nombre, gente: gente,
               sinAsignar: sinAsignar };
    }),
    rolFuera: fueraRol
  };
}
