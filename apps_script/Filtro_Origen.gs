// =====================================================================
// FILTRO GLOBAL DE ORIGEN
//
// El tablero dejó de ser solo de marketing: F2, F4 y F5 se filtran por
// CUALQUIER combinación de los 24 orígenes que trae HubSpot. Para
// presentar marketing se elige el preset "Marketing"; para ver el 360 se
// deja "Todos".
//
// F1 Adquisición NO se filtra: por definición mide lo que trae marketing
// (pauta, cosechas de mkt, embudo de sedes de mkt) y un filtro ahí no
// tendría sentido.
//
// El preset "Marketing" es EXACTAMENTE los cuatro orígenes que usa F1
// (ORIGENES_MKT vía origen_bucket). Si se le agregara INFLUENCER, F1 y F2
// dejarían de cuadrar entre sí, así que INFLUENCER va en "Otros".
// =====================================================================

var SIN_ORIGEN = '(SIN ORIGEN)';

/**
 * Mes en que se cargo la base historica a HubSpot.
 *
 * HubSpot no existia antes de octubre de 2025, asi que la migracion metio
 * 1.918 sedes con anos de operacion en un solo mes. Esa fila NO es una
 * cosecha: tiene $71,4 mil M firmados ANTES de su propio M0, lo que en una
 * tabla de cohortes es imposible, y en el mapa de calor se pinta como la
 * fila mas fuerte cuando en realidad es la suma del negocio entero.
 *
 * Se excluye de todo analisis de cosecha. Sacandola, la plata imposible
 * pasa del 39,2% al 5,69% (la cola de la migracion en ene, feb y abr 2026).
 */
var COSECHA_CARGA_INICIAL = '2025-10';

/** ¿Esta cosecha es la carga inicial de HubSpot y no una cosecha real? */
function esCargaInicial_(cos) {
  return String(cos || '').substring(0, 7) === COSECHA_CARGA_INICIAL;
}

/** Normaliza el origen crudo de HubSpot: mayúsculas, sin tildes, sin dobles espacios. */
function normOrigen_(o) {
  var s = String(o === null || o === undefined ? '' : o).trim();
  if (!s) return SIN_ORIGEN;
  s = s.toUpperCase()
       .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E').replace(/[ÍÌÏÎ]/g, 'I')
       .replace(/[ÓÒÖÔ]/g, 'O').replace(/[ÚÙÜÛ]/g, 'U').replace(/Ñ/g, 'N');
  return s.replace(/\s+/g, ' ');
}

/** Nombre de sede normalizado, para cruzar tablas que solo traen el nombre. */
function normNombre_(n) {
  return String(n === null || n === undefined ? '' : n)
    .toUpperCase()
    .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E').replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O').replace(/[ÚÙÜÛ]/g, 'U').replace(/Ñ/g, 'N')
    .replace(/[^A-Z0-9]/g, '');
}

// =====================================================================
// REATRIBUCIONES DE ORIGEN — decisiones de NEGOCIO, no de dato
//
// HubSpot dice de dónde vino una sede, pero a veces el negocio sabe algo
// que HubSpot no: una alianza cuyo pipeline se alimentó de un evento, por
// ejemplo. Esas correcciones van ACÁ, declaradas, con ventana de fechas y
// con el motivo escrito — no reescritas a mano en la hoja, donde nadie
// sabría después por qué un número no cuadra con el CRM.
//
// La ventana se evalúa con la MISMA fecha con la que el tablero fecha la
// sede (la más temprana entre HubSpot y la vinculación en plataforma), así
// una sede nunca queda reatribuida en una cosecha distinta a la que se le
// pinta. Los deals llevan la misma regla aplicada sobre su createdate real
// en pull_deals.py, porque su tabla viene pre-agregada por mes.
//
// Se declara en pantalla (cintaOrigen) a propósito: un ajuste silencioso
// es exactamente lo que revienta en un comité cuando alguien abre HubSpot.
// =====================================================================
var REATRIBUCION_ORIGEN = [
  { de: 'DENTALINK', a: 'EVENTO', bucket: 'Eventos',
    desde: '2026-07-28', hasta: '2026-08-31',
    nota: 'Lo que entró por Dentalink entre el 28-jul y el 31-ago-2026 ' +
      'cuenta como EVENTO: ese pipeline salió del evento, no de la alianza.' }
];

/** El origen que MANDA para el tablero: el de HubSpot, salvo que una regla
    de reatribución aplique para esa fecha. */
function origenEfectivo_(origen, fechaISO) {
  var o = normOrigen_(origen);
  var f = String(fechaISO || '').substring(0, 10);
  if (!f) return o;
  for (var i = 0; i < REATRIBUCION_ORIGEN.length; i++) {
    var R = REATRIBUCION_ORIGEN[i];
    if (o === R.de && f >= R.desde && f <= R.hasta) return R.a;
  }
  return o;
}

/** El bucket de marketing que corresponde a una reatribución, si la hay.
    Sin esto, una sede reatribuida a EVENTO se filtraría como EVENTO pero
    NO contaría en "las que trajo marketing", que se calcula con
    origen_bucket — dos números distintos en la misma pantalla. */
function bucketReatribuido_(origen, fechaISO, bucketActual) {
  var o = normOrigen_(origen);
  var f = String(fechaISO || '').substring(0, 10);
  if (!f) return bucketActual;
  for (var i = 0; i < REATRIBUCION_ORIGEN.length; i++) {
    var R = REATRIBUCION_ORIGEN[i];
    if (o === R.de && f >= R.desde && f <= R.hasta) return R.bucket || bucketActual;
  }
  return bucketActual;
}

/* PUNTO UNICO DE LECTURA DE SEDES, con el origen ya reatribuido.

   Por que existe: la hoja SEDES se leia en CINCO lugares distintos
   (universoSedes_ dos veces, atribSede_, la exclusion de CreditOp en F4,
   el cruce de origen de F5). La reatribucion se aplico primero solo en
   universoSedes_, y el resultado fue que la tabla "de que origen salio esa
   plata" de F1 — que se arma con atribSede_ — seguia mostrando DENTALINK
   con plata en agosto. Un ajuste de atribucion aplicado en unos lectores y
   no en otros es peor que no aplicarlo: los numeros de la misma pantalla
   dejan de cuadrar entre si.

   Ahora TODO lector pasa por aca. Si manana alguien agrega un sexto
   lector, hereda la reatribucion sin tener que saber que existe.

   Se memoiza porque son 3.600 filas y varios frentes la piden. */
var _SEDES_REATRIB = null;
var _SEDES_REATRIB_N = 0;

function sedesReatribuidas_() {
  if (_SEDES_REATRIB) return _SEDES_REATRIB;
  var filas = leerHoja_('SEDES');
  // La sede se fecha igual que su cosecha: la mas temprana entre la
  // creacion en HubSpot y la vinculacion en la plataforma. Asi una sede
  // nunca queda reatribuida en una ventana distinta a la de la cosecha en
  // la que se pinta.
  var vincDia = {};
  leerHoja_('PLATAFORMA_SEDES').forEach(function (r) {
    var id = String(r.id_sede || '').trim();
    if (id) vincDia[id] = String(r.created || '').substring(0, 10);
  });
  var n = 0;
  filas.forEach(function (s) {
    var fc = String(s.fecha_creacion || '').substring(0, 10);
    var fv = vincDia[String(s.id_internal || '').trim()] || '';
    var fecha = (fc && fv) ? (fc < fv ? fc : fv) : (fc || fv);
    var antes = normOrigen_(s.origen);
    var nuevo = origenEfectivo_(s.origen, fecha);
    if (nuevo === antes) return;
    s.origen = nuevo;
    // El bucket de marketing va junto: sin esto la sede se filtraria como
    // EVENTO pero no contaria en "las que trajo marketing", que se calcula
    // con origen_bucket.
    s.origen_bucket = bucketReatribuido_(antes, fecha, s.origen_bucket);
    n++;
  });
  _SEDES_REATRIB_N = n;
  _SEDES_REATRIB = filas;
  return filas;
}

/** Cuantas sedes movio la reatribucion, para declararlo en pantalla. */
function sedesReatribuidasN_() {
  sedesReatribuidas_();
  return _SEDES_REATRIB_N;
}

// Presets. Las llaves van normalizadas igual que normOrigen_.
var PRESETS_ORIGEN = {
  todos: [],
  marketing: ['EVENTO', 'REFERIDO', 'PAGINA WEB', 'SOCIAL MEDIA'],
  comercial: ['FARMER', 'HUNTER', 'HUNTER EXT', 'PROSPECCION', 'FREELANCE', 'EMPLEADO'],
  alianzas: ['DT DENTAL', 'DENTALINK', 'OK VET', 'STARKEY', 'BOSTON', 'INVISALIGN',
             'ESSILOR', 'NOVO NORDISK', 'CREDITOP', 'PAGUI', 'ANDREC', 'PREMIUM'],
  sin_origen: [SIN_ORIGEN]
};

var ETIQUETA_PRESET = {
  todos: 'Todos los orígenes', marketing: 'Marketing', comercial: 'Equipo comercial',
  alianzas: 'Alianzas y marcas', sin_origen: 'Sin origen registrado', otros: 'Otros'
};
var NOMBRE_GRUPO_SRV_ = ETIQUETA_PRESET;

/** A qué grupo pertenece un origen, para agrupar la lista en el selector. */
function grupoDeOrigen_(o) {
  var n = normOrigen_(o);
  var g = 'otros';
  Object.keys(PRESETS_ORIGEN).forEach(function (k) {
    if (k === 'todos') return;
    if (PRESETS_ORIGEN[k].indexOf(n) >= 0) g = k;
  });
  return g;
}

/**
 * Catálogo de orígenes con su conteo de sedes. Se devuelve SIEMPRE completo,
 * sin importar el filtro activo: es lo que alimenta el selector.
 */
function catalogoOrigenes_(sedes) {
  var g = {};
  sedes.forEach(function (s) {
    var o = normOrigen_(s.origen);
    g[o] = (g[o] || 0) + 1;
  });
  return Object.keys(g)
    .sort(function (a, b) { return g[b] - g[a]; })
    .map(function (k) {
      return { origen: k, sedes: g[k], grupo: grupoDeOrigen_(k) };
    });
}

/* Los tres ROLES del objeto Sedes de HubSpot. No son un dueño con equipo
   inferido: son tres asignaciones que CONVIVEN — a una sede la trae un
   hunter, la cultiva un farmer y la retiene un CS, los tres a la vez. Por eso
   son tres filtros y no uno, y por eso se combinan con Y y no con O:
   "las sedes que trajo Johanna Y que hoy cultiva Viviana". */
/* Quien aparece en cada selector de rol, por lista explicita del negocio.
   NO se infiere de los datos: las propiedades hunter/farmer/cs de HubSpot
   traen gente que ya salio del equipo o que quedo asignada por error — el
   hunter con 536 sedes esta inactivo, y hay farmers con 1 sola sede que son
   un dedazo.

   Se filtra la LISTA, no los datos: esas sedes siguen contando en todos los
   totales, solo que no se puede filtrar por esa persona.

   Los ids van fijos y no por nombre a proposito: los nombres cortos del
   negocio no coinciden con los de HubSpot ("Lady Moreno" contra "LADY DIANA
   MORENO DURAN") y un match difuso se equivoca en silencio.

   Si entra o sale alguien del equipo, se edita aca. */
var GENTE_ROL = {
  hunter: {
    '83703393': 'Johanna Vásquez',
    '89418948': 'Gabriela Quitian',
    '83917986': 'Paola Carranza',
    '83703394': 'Hanheyr Pérez'
  },
  farmer: {
    '83703392': 'Guillermo Lenis',
    '84380856': 'Lady Moreno',
    '83703389': 'Edilberto Espitia',
    '83748989': 'Margarita Jaramillo',
    '84380859': 'Viviana Zuluaga',
    '83748988': 'Maryori Palacio',
    '83703390': 'Johana Quiroz',
    '84418150': 'Caterine Rios',
    '84380858': 'Giohanna Sanchez',
    '83748986': 'John Hinestroza',
    '94438568': 'Emmanuel Buitrago'
  },
  cs: {
    '84380860': 'Mariana Botero',
    '88454157': 'Lina Camacho'
  }
};

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

// =====================================================================
/* Registros de la plataforma que son basura declarada: el propio nombre
   dice BORRAR, duplicado o pruebas. Se cuentan aparte de las cuentas sin
   ficha para que la escalera no los presente como sedes reales que el
   tablero pierde. */
var DESCARTES_PLATAFORMA = {
  '996c3ae9-0bc1-49a2-83b1-f35a7528ab5b': 'CEDIMED - BORRAR',
  '70f6b1e2-44b0-47d4-b5ac-b0e327a38f50': 'Dra Valentina Palacio (duplicado)',
  '09f0df2f-20e3-42be-94d0-cbe03a955d8c': 'Welli Pruebas - La migracion no fallo'
};

// EL UNIVERSO — UNA SOLA REGLA, ACORDADA CON BI (9-sep-2026)
//
// Hubo un tiempo en que el tablero ofrecia dos universos, 'growth' y 'bi',
// porque los dos equipos contaban sedes distintas y ninguno estaba
// equivocado: Growth arrancaba de HubSpot, BI de la plataforma. El selector
// existia para poder comparar celda por celda y cerrar la discusion.
//
// La discusion se cerro EL 9-SEP-2026 CON UNA REGLA DISTINTA A LA DEL
// 7-SEP: se probaron las 4 combinaciones posibles (fecha CRM vs fecha
// minima) x (universo recortado vs TODAS las fichas) contra las cosechas
// reales que BI tenia en pantalla ese dia, y la que calca sus numeros
// (diferencia de 1 a 7 sedes por mes, contra 20-40 de cualquier otra) es
// FECHA MINIMA + TODAS LAS FICHAS, SIN NINGUN RECORTE. Ni deshabilitadas,
// ni sin id_internal, ni sin cuenta en plataforma, ni pais. BI cuenta el
// embudo de marketing completo (todo el que entro alguna vez); el recorte
// del 7-sep media el embudo operativo (solo quien llego a operar), y esa
// era precisamente la razon de que los dos tableros NUNCA cuadraran exacto
// mes a mes, aunque la fecha ya estuviera de acuerdo desde el 7-sep.
//
// Que un aliado este deshabilitado, o no tenga id_internal, o no tenga
// cuenta en la plataforma SIGUE contando y visible (ver universo.* mas
// abajo y la escalera de Profundizacion) — ya no se resta de nada. Es
// informacion, no un filtro.
//
// El selector se saco a proposito. Dejarlo puesto invita a leer el mapa con
// una regla que el otro equipo ya no usa, que es justo el problema que
// veniamos a cerrar.


function universoSedes_(origenes, roles) {
  // Las dos arrancan de la MISMA lectura reatribuida. Se copian con slice
  // porque cada una se filtra por su lado (todas lleva la regla del
  // universo, cruda no) y no deben pisarse.
  var todas = sedesReatribuidas_().slice();
  var cruda = sedesReatribuidas_().slice();

  function esDeshabilitada_(s) {
    return String(s.pipeline || '').toLowerCase().indexOf('deshabilitad') >= 0;
  }

  // ---- REGLA DEL UNIVERSO acordada con BI (1 sep 2026) --------------
  // Una sede entra al tablero SI Y SOLO SI existe en institucion_medica
  // con country_code = 'COL'. La fecha de cosecha sigue siendo la de
  // HubSpot (hs_createdate); la plataforma manda en la EXISTENCIA, porque
  // una sede sin cuenta no puede originar credito y no es cosecha de nada.
  var plataforma = leerHoja_('PLATAFORMA_SEDES');
  var paisDe = {}, espDe = {}, vincDe = {}, vincDiaDe = {};
  plataforma.forEach(function (r) {
    var id = String(r.id_sede || '').trim();
    if (!id) return;
    paisDe[id] = String(r.pais || 'COL');
    espDe[id] = String(r.especialidad || '');
    // Mes de vinculacion = institucion_medica.created. Es lo que BI llama
    // fecha_vinculacion (verificado: coincide en 2.603 de 2.604 sedes) y el
    // segundo reloj con el que se pueden leer las cohortes.
    vincDe[id] = String(r.created || '').substring(0, 7);
    // El dia completo tambien, para poder comparar contra la fecha de
    // creacion al dia y no solo al mes.
    vincDiaDe[id] = String(r.created || '').substring(0, 10);
  });
  var hayPlataforma = plataforma.length > 0;

  // La reatribucion de origen ya viene aplicada desde sedesReatribuidas_(),
  // que es el unico lector de la hoja. Aca solo se cuenta para declararla.
  var reatribuidas = sedesReatribuidasN_();

  var fueraSinId = 0, fueraNoPlat = 0, fueraPais = 0;
  // ACORDADO CON BI EL 9-SEP-2026: esto YA NO FILTRA. Se cuenta cada motivo
  // para seguir declarandolo en la escalera (informacion sobre la calidad
  // del dato), pero ninguna sede sale de `todas` por esto — BI no le resta
  // nada a sus cosechas y el tablero tiene que contar exactamente lo mismo.
  // La prioridad de conteo se conserva (deshabilitada gana) solo para que
  // cada sede se declare en un unico motivo y la escalera siga cerrando.
  if (hayPlataforma) {
    todas.forEach(function (s) {
      if (esDeshabilitada_(s)) return;   // se cuenta en su propio paso
      var id = String(s.id_internal || '').trim();
      if (!id) { fueraSinId++; return; }
      var pais = paisDe[id];
      if (pais === undefined) { fueraNoPlat++; return; }
      if (pais !== 'COL') { fueraPais++; return; }
    });
  }

  // ---- SEDES DESHABILITADAS: contadas, YA NO excluidas ---------------
  // Antes del 9-sep-2026 una sede deshabilitada (pipeline
  // Aliados_deshabilitados: aliado con el que ya no operamos, cuenta rota,
  // contrato terminado, o un duplicado del mismo consultorio como los
  // "tasa 0" / "subvencionada" de Dentix) se sacaba de todo el tablero. Eso
  // es correcto para "con quien operamos hoy" pero es exactamente lo que
  // hacia que el tablero contara MENOS sedes por cosecha que BI, que no le
  // resta nada a sus cohortes. Acordado con BI el 9-sep-2026: se cuenta
  // igual que ellos, sin excluir nada — la baja sigue siendo visible (ver
  // universo.deshabilitadas y la escalera) pero ya no resta.
  //
  // La definicion de "deshabilitada" es el PIPELINE, no una propiedad:
  // HubSpot tiene un pipeline entero llamado "Aliados_deshabilitados" y
  // mover la sede ahi es el acto administrativo con el que el equipo la da
  // de baja. La bandera fb_deshabilitado es un subconjunto estricto (339 de
  // 344 el 3 sep 2026), asi que el pipeline es la fuente mas completa y la
  // que no se queda vieja.
  //
  // Se busca por "deshabilitad" sobre el pipeline y NO sobre la etapa a
  // proposito: hay una etapa "A revisar / Deshabilitar" en el pipeline de
  // Capacitacion muertos que es una lista de candidatas, no una baja.
  // Los tres sets (deshabHS/deshabId/deshabNom) se conservan para poder
  // seguir contando y declarando la baja en pantalla, aunque ya ningun
  // lector los use para excluir.
  var deshabHS = {}, deshabId = {}, deshabNom = {};
  var fueraDeshab = 0, deshabNombres = [];
  // Se aprovecha este mismo recorrido (la hoja todavia entera) para dos
  // cosas mas: el total crudo de HubSpot y que id_internal estan
  // referenciados. Puesto mas abajo, `cruda` ya viene recortada y el conteo
  // saldria inflado.
  var totalHubSpot = cruda.length;
  var refFicha = {};
  cruda.forEach(function (s) {
    var u0 = String(s.id_internal || '').trim();
    if (u0) refFicha[u0] = true;
  });
  cruda.forEach(function (s) {
    if (!esDeshabilitada_(s)) return;
    fueraDeshab++;
    var hs = String(s.id || '').trim();
    if (hs) deshabHS[hs] = true;
    var iid = String(s.id_internal || '').trim();
    if (iid) deshabId[iid] = true;
    var nm = normNombre_(s.nombre_sede);
    if (nm) deshabNom[nm] = true;
    if (deshabNombres.length < 400) deshabNombres.push(s.nombre_sede || hs);
  });

  // Cuentas vinculadas en la plataforma que ninguna ficha de HubSpot
  // referencia. NO entran al universo — el tablero arranca del CRM — pero se
  // cuentan para poder declararlas en la escalera: son la causa mas comun de
  // que los dos conteos no cuadren, y un descarte que no se cuenta es un
  // descarte que nadie audita.
  //
  // SE PROBO inyectarlas como sede sintetica el 9-sep-2026, para cuadrar
  // exacto con BI, y el resultado midio PEOR, no mejor: contra las cosechas
  // reales que BI tenia en pantalla ese dia, el error promedio subio de
  // 2,50 a 4,17 sedes/mes, y enero paso de +3 a +17. La razon mas probable:
  // el reporte de BI TAMBIEN arranca de una tabla ligada a HubSpot (no
  // literalmente de institucion_medica cruda), asi que estas cuentas son
  // invisibles para los dos lados, no solo para el nuestro. Inyectarlas a
  // ciegas para "parecerse mas a BI" habria sido ajustar el numero a un
  // resultado, no a una regla — por eso se descarto y se dejo solo el
  // conteo informativo.
  var platSinFicha = 0, platDescartes = 0;
  plataforma.forEach(function (r) {
    var id = String(r.id_sede || '').trim();
    if (!id || refFicha[id]) return;
    if (String(r.pais || 'COL') !== 'COL') return;
    platSinFicha++;
    if (DESCARTES_PLATAFORMA[id]) platDescartes++;
  });

  var baseSinFiltro = todas.length;

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
  //
  // '__equipo__' es un valor especial: "cualquiera de la lista de este rol",
  // en vez de una persona puntual. Sirve para reproducir un reporte que
  // filtra por el EQUIPO completo (los 4 hunters, por ejemplo) sin tener que
  // elegir persona por persona y sumar a mano.
  function pasaRoles_(s) {
    if (!hayRol) return true;
    var v = rolDe[String(s.id || '').trim()];
    for (var i = 0; i < ROLES.length; i++) {
      var R2 = ROLES[i], q = selRol[R2.id];
      if (!q) continue;
      var propio = v && v[R2.id];
      if (q === '__equipo__') {
        if (!propio || !(GENTE_ROL[R2.id] || {})[propio]) return false;
      } else if (!propio || propio !== q) {
        return false;
      }
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
                noPlataforma: fueraNoPlat, otroPais: fueraPais,
                deshabilitadas: fueraDeshab, deshabLista: deshabNombres,
                platSinFicha: platSinFicha, totalHubSpot: totalHubSpot,
                baseSinFiltro: baseSinFiltro,
                platDescartes: platDescartes },
    // Set de negacion de deshabilitadas, por las tres llaves con las que las
    // distintas tablas nombran una sede. Se aplica SIEMPRE, no solo cuando
    // hay filtro puesto.
    deshabHS: deshabHS, deshabId: deshabId, deshabNom: deshabNom,
    especialidadDe: espDe,
    // La fecha de vinculacion por id_internal. vincDiaDe es la que usa la
    // cosecha: se compara contra hs_createdate y gana la mas temprana, que
    // es la definicion acordada con BI (fecha_minima_admin_hubspot).
    vincDe: vincDe, vincDiaDe: vincDiaDe,
    // El pais por cuenta de plataforma. Lo necesita la pestana de
    // profundizacion para poder decir CUANTAS sedes de otro pais trae la
    // vista de BI por cosecha, en vez de dejar el numero escrito a mano
    // — que es como los textos de CONFIG llegaron a decir 170 firmas donde
    // el KPI decia 52.
    paisDe: paisDe,
    origenes: lista,
    etiqueta: etiquetaUniverso_(lista, todas.length, filas.length),
    catalogo: catalogoOrigenes_(todas),
    // Las reatribuciones de origen, para declararlas en pantalla: cuántas
    // sedes se movieron y con qué regla.
    reatribucion: { sedes: reatribuidas, reglas: REATRIBUCION_ORIGEN.map(function (R) {
      return { de: R.de, a: R.a, desde: R.desde, hasta: R.hasta, nota: R.nota };
    }) },
    // sinFiltro = NINGUN filtro global esta puesto. Es el unico atajo valido
    // para "devolver la tabla entera".
    sinFiltro: todos && !hayRol,
    // Roles: lo elegido, el catalogo por rol y la etiqueta para la cinta.
    roles: selRol, rolesTodos: !hayRol,
    rolEtiqueta: !hayRol ? 'Todos los roles'
      : ROLES.filter(function (R2) { return selRol[R2.id]; })
          .map(function (R2) {
            var g = GENTE_ROL[R2.id] || {};
            return R2.nombre + ': ' +
              (g[selRol[R2.id]] || nomOwner[selRol[R2.id]] || selRol[R2.id]);
          }).join(' · '),
    catalogoRoles: ROLES.map(function (R2) {
      var permitida = GENTE_ROL[R2.id] || {};
      var gente = [], fuera = 0;
      Object.keys(catRol[R2.id]).forEach(function (oid) {
        if (oid === '0') return;
        if (!permitida[oid]) { fuera += catRol[R2.id][oid]; return; }
        // El nombre corto del negocio y no el de HubSpot: es el que la gente
        // reconoce en un selector.
        gente.push({ id: oid, nombre: permitida[oid],
                     sedes: catRol[R2.id][oid] });
      });
      gente.sort(function (a, b) { return b.sedes - a.sedes; });
      return { id: R2.id, nombre: R2.nombre, gente: gente,
               sinAsignar: catRol[R2.id]['0'] || 0,
               // Sedes asignadas a alguien que no esta en la lista del rol.
               // Cuentan en los totales; solo no son filtrables por persona.
               fueraDeLista: fuera };
    }),
    rolFuera: fueraRol
  };
}

/** Texto corto que describe la selección, para el encabezado. */
function etiquetaUniverso_(lista, totalBase, n) {
  if (!lista.length) return 'Todos los orígenes';
  var claves = Object.keys(PRESETS_ORIGEN);
  for (var i = 0; i < claves.length; i++) {
    var k = claves[i];
    if (k === 'todos') continue;
    var p = PRESETS_ORIGEN[k];
    if (p.length === lista.length && p.every(function (x) { return lista.indexOf(x) >= 0; })) {
      return ETIQUETA_PRESET[k];
    }
  }
  if (lista.length === 1) return lista[0];
  return lista.length + ' orígenes';
}

/** Filtra por id_internal las tablas que traen la llave de sede. */
function filtrarPorId_(filas, campo, U) {
  // Sin filtro se devuelve la tabla entera: ya no se resta nada por
  // deshabilitada (acordado con BI el 9-sep-2026 — ver universoSedes_).
  if (U.sinFiltro) return filas;
  return filas.filter(function (r) { return !!U.ids[String(r[campo] || '').trim()]; });
}

/**
 * Filtra por nombre de sede las tablas que solo traen el nombre.
 * El cruce calza 97,7% de PLATA_SEDES, 98,4% de RESCATE_BQ y 98,8% de
 * WP_CANJES; el resto son sedes que no existen en HubSpot con ese nombre.
 * Cuando no hay filtro activo NO se cruza nada, así que el total sigue
 * siendo el real y el 2% no se pierde.
 */
function filtrarPorNombre_(filas, campo, U) {
  // Sin filtro, tabla entera: ya no se resta nada por deshabilitada.
  if (U.sinFiltro) return filas;
  return filas.filter(function (r) { return !!U.nombres[normNombre_(r[campo])]; });
}

// =====================================================================
// VENTANAS DE DECISION  (definicion del negocio, no un balde estadistico)
//
// WELLI ya tiene tres ventanas establecidas segun cuanto tarda el paciente
// en decidir, y eso depende de la ESPECIALIDAD de la sede, no del monto ni
// del canal. Reemplazan los tramos por dias (0-1, 2-3, 4-7...) que el
// tablero mostraba antes: esos describian la curva, estas explican POR QUE
// tiene esa forma y con cual pieza se trabaja cada grupo.
//
// El dato confirma el marco (dias entre aprobacion y firma, base COL):
//   C corta  Fisioterapia 92% mismo dia (0,3 d) · Odontologia 91% en <=3 d
//            (1,7 d) · Dermatologia y Estetica 53% mismo dia (1,5 d)
//   B media  Audiologia 3,4 d · Oftalmologia 3,8 d · Veterinaria 6,2 d
//   A larga  Cirugia plastica 7,9 d, solo 19% mismo dia y 21% entre el
//            dia 16 y el 30
//
// "Dermatologia y Estetica" viene como un solo valor y podia caer en C
// (Dermatologia) o en B (Estetica). Se resolvio con el comportamiento
// medido, no a dedo: va en C.
// =====================================================================

var VENTANAS = [
  { id: 'C', nombre: 'Ventana corta', orden: 1,
    comportamiento: 'Firma el mismo día o no firma. Decisión impulsiva ligada al ' +
      'momento de la consulta.',
    especialidades: ['ODONTOLOGIA', 'MEDICINA GENERAL', 'DERMATOLOGIA Y ESTETICA',
                     'FISIOTERAPIA'] },
  { id: 'B', nombre: 'Ventana media', orden: 2,
    comportamiento: 'Decisión meditada pero rápida. Vínculo emocional fuerte con la ' +
      'clínica. Resuelve en 1 a 2 semanas.',
    especialidades: ['MEDICINA ESTETICA', 'OBESIDAD Y CIRUGIA BARIATRICA',
                     'OFTALMOLOGIA', 'VETERINARIA', 'AUDIOLOGIA'] },
  { id: 'A', nombre: 'Ventana larga', orden: 3,
    comportamiento: 'Decisión lenta y plana, con repunte real al final del mes. ' +
      'Requiere acompañamiento sin presión.',
    especialidades: ['CIRUGIA PLASTICA'] }
];

var VENTANA_SIN = { id: '—', nombre: 'Sin ventana asignada', orden: 4,
  comportamiento: 'Especialidades que todavía no están clasificadas en ninguna de ' +
    'las tres ventanas.', especialidades: [] };

/** Normaliza una especialidad igual que los origenes: mayusculas sin tildes. */
function normEsp_(e) {
  return normOrigen_(e);
}

/** Indice especialidad -> ventana, armado una sola vez. */
var _VENT_IDX = null;
function ventanaDeEsp_(esp) {
  if (!_VENT_IDX) {
    _VENT_IDX = {};
    VENTANAS.forEach(function (v) {
      v.especialidades.forEach(function (e) { _VENT_IDX[e] = v; });
    });
  }
  var k = normEsp_(esp);
  return _VENT_IDX[k] || VENTANA_SIN;
}

/** Las tres ventanas mas la bolsa de no asignadas, en orden de decision. */
function ventanasOrdenadas_() {
  return VENTANAS.concat([VENTANA_SIN]);
}
