# -*- coding: utf-8 -*-
import io, re
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()


def rep(a, b):
    global s
    assert a in s, a[:100]
    s = s.replace(a, b, 1)


# Los cinco medidores se guardan como funciones para poder correrlos sobre los
# dos grupos sin duplicar la definicion.
rep("""  var mActivas = mapa_(function (idx, ids) {""",
    """  var MEDIR = {};
  MEDIR.activas = function (idx, ids) {""")
rep("""  var mExitosas = mapa_(function (idx, ids) {""",
    """  MEDIR.exitosas = function (idx, ids) {""")
rep("""  var mInactivas = mapa_(function (idx, ids) {""",
    """  MEDIR.inactivas = function (idx, ids) {""")
rep("""  var mDesembolsos = mapa_(function (idx, ids) {""",
    """  MEDIR.desembolsos = function (idx, ids) {""")
rep("""  var mMuertas = mapa_(function (idx, ids) {""",
    """  MEDIR.muertas = function (idx, ids) {""")

# los cierres ' });' de cada medidor pasan a ' };'
for k in ['activas', 'exitosas', 'inactivas', 'desembolsos', 'muertas']:
    i = s.index('MEDIR.%s = function (idx, ids) {' % k)
    j = s.index('\n  });\n', i)
    s = s[:j] + '\n  };\n' + s[j + len('\n  });\n'):]

# y se corren sobre los dos grupos
rep("""var mDesembolsosMes = incremental_(mDesembolsos);""",
    """/* Corre los cinco medidores sobre un grupo de cosechas. El sexto mapa (la
   plata sin acumular) se deriva del cuarto, asi que sale gratis. */
function mapasDe_(cosSet) {
  var m = {};
  ['activas', 'exitosas', 'inactivas', 'desembolsos', 'muertas']
    .forEach(function (k) { m[k] = mapa_(MEDIR[k], cosSet); });
  m.desembolsos_mes = incremental_(m.desembolsos);
  return m;
}
var A = mapasDe_(cos);
var B = cosB ? mapasDe_(cosB) : null;""")
io.open(p, 'w', encoding='utf8').write(s)
print('paso 2: medidores reutilizables')
