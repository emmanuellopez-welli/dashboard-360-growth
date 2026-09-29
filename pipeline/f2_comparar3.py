# -*- coding: utf-8 -*-
import io, re
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

# cada mapa apunta a su medidor por id, y el motor resuelve las filas
for viejo, mid in [('mActivas', 'activas'), ('mExitosas', 'exitosas'),
                   ('mDesembolsos', 'desembolsos'), ('mDesembolsosMes', 'desembolsos_mes'),
                   ('mInactivas', 'inactivas'), ('mMuertas', 'muertas')]:
    s = s.replace('filas: %s, ultimo: ultimo_(%s)' % (viejo, viejo),
                  "filas: A['%s'], ultimo: ultimo_(A['%s'])" % (mid, mid), 1)
    s = s.replace('filas: %s,\n      ultimo: ultimo_(%s)' % (viejo, viejo),
                  "filas: A['%s'],\n      ultimo: ultimo_(A['%s'])" % (mid, mid), 1)
assert 'mActivas' not in s and 'mDesembolsosMes' not in s, 'quedaron referencias viejas'

# ---------- promedio por columna y filas del grupo B ----------
anc = "  f.mapas = ["
nuevo = """  /* PROMEDIO por columna. Para los mapas de % es la tasa AGRUPADA (suma de
     n sobre suma de sedes de las cosechas que ya llegaron a ese mes), no el
     promedio de los porcentajes: promediar tasas de cohortes de 60 y de 241
     sedes le da el mismo peso a las dos y no es lo que pasa en la realidad.

     Para los mapas de plata es el promedio POR COSECHA (suma / cuantas
     llegaron a ese mes), que es lo comparable con la celda de una cosecha.

     En las dos, el denominador son solo las cosechas CON dato en esa columna:
     M7 promedia dos cosechas y M0 promedia ocho, y mezclarlas seria comparar
     cosas distintas. */
  function promedio_(filas, esMonto) {
    if (!filas.length) return null;
    var celdas = [], extras = [], cuantas = [];
    for (var k = 0; k <= MAXM; k++) {
      var sn = 0, sm = 0, sSedes = 0, n = 0;
      filas.forEach(function (r) {
        if (r.celdas[k] === null || r.celdas[k] === undefined) return;
        sn += r.celdas[k];
        sm += (r.extras[k] || 0);
        sSedes += r.n;
        n++;
      });
      cuantas.push(n);
      if (!n) { celdas.push(null); extras.push(null); continue; }
      if (esMonto) {
        celdas.push(Math.round(sn / n));
        extras.push(Math.round(sm / n));
      } else {
        // n de la celda = total, y el % sale de dividirlo por sSedes. Se
        // guarda sSedes como 'base' para que el frontend calcule la tasa
        // agrupada en vez de dividir por el total de una cosecha.
        celdas.push(sn);
        extras.push(null);
      }
      if (!esMonto) celdas[celdas.length - 1] = sn;
    }
    var base = [];
    for (var k2 = 0; k2 <= MAXM; k2++) {
      var sS = 0;
      filas.forEach(function (r) {
        if (r.celdas[k2] === null || r.celdas[k2] === undefined) return;
        sS += r.n;
      });
      base.push(sS);
    }
    var totSedes = 0;
    filas.forEach(function (r) { totSedes += r.n; });
    return { cosecha: 'PROMEDIO', n: esMonto ? filas.length : totSedes,
             celdas: celdas, extras: extras, base: base, cuantas: cuantas,
             esPromedio: true, esMonto: !!esMonto };
  }

  f.mapas = ["""
assert anc in s
s = s.replace(anc, nuevo, 1)

# a cada mapa se le cuelga el promedio y, si hay comparacion, las filas de B
old = """  f.hay = cosechas.length > 0;"""
new = """  // A cada mapa se le cuelga su promedio y, si hay comparacion, las filas del
  // grupo B con su propio promedio. El frontend intercala.
  f.mapas.forEach(function (m) {
    var esMonto = !!m.conMonto;
    m.promedio = promedio_(m.filas, esMonto);
    if (B) {
      m.filasB = B[m.id] || [];
      m.promedioB = promedio_(m.filasB, esMonto);
    }
  });

  f.comparar = {
    activo: !!B,
    clave: cmpKey,
    etiquetaA: U.todos ? 'Todos los orígenes' : U.etiqueta,
    etiquetaB: B ? (ETIQUETA_PRESET[cmpKey] || cmpKey) : '',
    // Los presets que se pueden elegir, con su conteo de sedes en el universo
    // actual: un grupo con cero sedes no es una comparacion util.
    opciones: Object.keys(PRESETS_ORIGEN).filter(function (k) {
      return PRESETS_ORIGEN[k].length > 0;
    }).map(function (k) {
      var set = {}, n = 0;
      PRESETS_ORIGEN[k].forEach(function (o) { set[o] = true; });
      (U.base || []).forEach(function (x) {
        if (set[normOrigen_(x.origen)]) n++;
      });
      return { clave: k, nombre: ETIQUETA_PRESET[k] || k, sedes: n };
    }).filter(function (o) { return o.sedes > 0; })
  };

  f.hay = cosechas.length > 0;"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('paso 3: promedio y comparacion en el payload')
