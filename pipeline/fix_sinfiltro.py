# -*- coding: utf-8 -*-
import io

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Filtro_Origen.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b, n=1):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, n)

# U.todos es SOLO el flag de origen. Los helpers que cortan por id o por
# nombre lo usaban como atajo de "no hay filtro", asi que con origen en Todos
# y un equipo elegido devolvian la tabla entera sin filtrar. Se separa el
# atajo real: sinFiltro = ninguno de los dos filtros esta puesto.
rep("""    // Equipo: lo elegido, el catalogo con conteos y la etiqueta para la cinta.
    equipos: listaEq, equiposTodos: todosEq,""",
    """    // sinFiltro = NINGUNO de los dos filtros globales esta puesto. Es el
    // unico atajo valido para "devolver la tabla entera": usar U.todos, que
    // habla solo del origen, dejaba pasar todo cuando habia equipo elegido.
    sinFiltro: todos && todosEq,
    // Equipo: lo elegido, el catalogo con conteos y la etiqueta para la cinta.
    equipos: listaEq, equiposTodos: todosEq,""")
rep("""function filtrarPorId_(filas, campo, U) {
  if (U.todos) return filas;""",
    """function filtrarPorId_(filas, campo, U) {
  if (U.sinFiltro) return filas;""")
rep("""function filtrarPorNombre_(filas, campo, U) {
  if (U.todos) return filas;""",
    """function filtrarPorNombre_(filas, campo, U) {
  if (U.sinFiltro) return filas;""")
io.open(p, 'w', encoding='utf8').write(s)
print('Filtro_Origen.gs: sinFiltro')

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
# el corte de eventos por sede tambien tiene que mirar los dos filtros
rep("""  if (U && !U.todos) {""",
    """  if (U && !U.sinFiltro) {""")
io.open(p, 'w', encoding='utf8').write(s)
print('Code.gs: eventos')
