# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# Un solo helper para los dos filtros globales sobre las tablas que traen
# origen y equipo. Tenerlo en un lugar evita que una tabla nueva se olvide de
# uno de los dos, que es exactamente lo que paso con SEDE_OWNER y F5.
helper = """
/** ¿Esta fila pasa los DOS filtros globales? Las tablas de creditos traen
    origen y equipo como columnas, asi que el corte es directo. Se usa en
    todas para que ninguna se quede con un filtro a medias. */
function pasaFiltros_(r, U, selOrig) {
  if (!U.todos && !selOrig[normOrigen_(r.origen)]) return false;
  if (!U.equiposTodos) {
    var eq = String(r.equipo || '(SIN OWNER)');
    if (U.equipos.indexOf(eq) < 0) return false;
  }
  return true;
}
"""
anc = 'function armarF1_('
j = s.rindex('/*', 0, s.index(anc))
s = s[:j] + helper.lstrip('\n') + '\n' + s[j:]

# --- seccion 5 de F1 ---
rep("""      var o = normOrigen_(r.origen);
      if (!U.todos && !selCd[o]) return;
      var fch = String(r.fecha || '');""",
    """      if (!pasaFiltros_(r, U, selCd)) return;
      var o = normOrigen_(r.origen);
      var fch = String(r.fecha || '');""")

# --- retorno de la pauta (social media) ---
rep("""  cdRoi.forEach(function (r) {
    if (normOrigen_(r.origen) !== 'SOCIAL MEDIA') return;""",
    """  cdRoi.forEach(function (r) {
    if (normOrigen_(r.origen) !== 'SOCIAL MEDIA') return;
    // El retorno de la pauta tambien respeta el equipo: si se filtra Farmer,
    // la plata que se muestra es la de las sedes de social media de Farmer.
    if (!U.equiposTodos &&
        U.equipos.indexOf(String(r.equipo || '(SIN OWNER)')) < 0) return;""")

# --- F4 ---
rep("""      if (!U.todos && !selRv[normOrigen_(r.origen)]) return;""",
    """      if (!pasaFiltros_(r, U, selRv)) return;""")

# --- mesesConDatos_ no debe filtrar: el catalogo de meses es del dataset ---
io.open(p, 'w', encoding='utf8').write(s)
print('motor: pasaFiltros_ en las tres')
