# -*- coding: utf-8 -*-
"""
Dos cosas en profundizacion:

  1. COMPARAR dos grupos de origen en los mismos mapas. La idea del negocio es
     "que tan efectivas son las cosechas de marketing contra las de comercial",
     y eso no se responde filtrando dos veces y recordando los numeros: hay
     que verlos en la misma tabla.

  2. Una fila de PROMEDIO al final de cada mapa, por columna M0..M7.
"""
import io

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()


def rep(a, b):
    global s
    assert a in s, a[:100]
    s = s.replace(a, b, 1)


# ---------- la firma acepta el grupo a comparar ----------
rep("function armarF2_(R, ev, cfg, U) {",
    "function armarF2_(R, ev, cfg, U, comparar) {")

# ---------- las cosechas se arman por GRUPO ----------
rep("""  // ---- Cosechas del universo elegido -------------------------------
  // U.filas ya viene cortado por el filtro global de origen y por la regla
  // del universo acordada con BI.
  var cos = {};                       // cosecha -> { ids:[], total, sinId }
  var sinIdTot = 0;
  U.filas.forEach(function (s) {
    var c = String(s.cosecha || '').substring(0, 7);
    if (!/^\\d{4}-\\d{2}$/.test(c) || esCargaInicial_(c)) return;
    if (c < COSECHA_PISO_F2) return;
    if (!cos[c]) cos[c] = { cosecha: c, ids: [], total: 0, sinId: 0 };
    var b = cos[c];
    b.total++;
    var id = String(s.id_internal || '').trim();
    if (id) b.ids.push(id);
    else { b.sinId++; sinIdTot++; }
  });""",
    """  // ---- Cosechas, por GRUPO -----------------------------------------
  // Grupo A = el universo del filtro global (U.filas, ya cortado por origen
  // y por rol). Grupo B = el preset elegido en el comparador, tomado de
  // U.base para que traiga el MISMO universo (regla de plataforma + roles)
  // pero otro origen. Sin eso la comparacion mezclaria dos poblaciones.
  var sinIdTot = 0;
  function cosechasDe_(filas) {
    var cos = {};
    filas.forEach(function (s) {
      var c = String(s.cosecha || '').substring(0, 7);
      if (!/^\\d{4}-\\d{2}$/.test(c) || esCargaInicial_(c)) return;
      if (c < COSECHA_PISO_F2) return;
      if (!cos[c]) cos[c] = { cosecha: c, ids: [], total: 0, sinId: 0 };
      var b = cos[c];
      b.total++;
      var id = String(s.id_internal || '').trim();
      if (id) b.ids.push(id);
      else { b.sinId++; sinIdTot++; }
    });
    return cos;
  }
  var cos = cosechasDe_(U.filas);

  var cmpKey = String(comparar || '').trim();
  var cmpOrig = {};
  (PRESETS_ORIGEN[cmpKey] || []).forEach(function (o) { cmpOrig[o] = true; });
  var hayCmp = !!cmpKey && !!PRESETS_ORIGEN[cmpKey] &&
    (PRESETS_ORIGEN[cmpKey].length > 0);
  var cosB = hayCmp
    ? cosechasDe_((U.base || []).filter(function (s) {
        return !!cmpOrig[normOrigen_(s.origen)];
      }))
    : null;""")

# ---------- mapa_ recibe el set de cosechas ----------
rep("""  function mapa_(medir) {
    return cosechas.map(function (c) {
      var b = cos[c];""",
    """  function mapa_(medir, cosSet, cosLista) {
    cosSet = cosSet || cos;
    return (cosLista || cosechas).filter(function (c) {
      return !!cosSet[c];
    }).map(function (c) {
      var b = cosSet[c];""")

# ---------- cada mapa se calcula para los dos grupos ----------
rep("""  var cosechas = Object.keys(cos).sort();""",
    """  // La lista de cosechas es la UNION de los dos grupos: si marketing arranco
  // en enero y comercial en noviembre, la tabla tiene que mostrar las dos sin
  // que una desaparezca.
  var setCos = {};
  Object.keys(cos).forEach(function (c) { setCos[c] = true; });
  if (cosB) Object.keys(cosB).forEach(function (c) { setCos[c] = true; });
  var cosechas = Object.keys(setCos).sort();""")

io.open(p, 'w', encoding='utf8').write(s)
print('paso 1: cosechas por grupo')
