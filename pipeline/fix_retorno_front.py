# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

rep("""    h += filaKPIs(rt.kpis);
    h += '<div style="margin-top:14px">' +
      panel('Del gasto a la plata, mes a mes',""",
    """    h += filaKPIs(rt.kpis);
    // El acumulado, dicho aparte y con su nombre. Antes estaba EN la tarjeta
    // con la etiqueta "plata de social media" y contradecia a la tabla de
    // abajo, que mide el periodo: $0 arriba y $8 M abajo con el mismo nombre.
    if (rt.acumulado > (rt.fila.plataM0 || 0)) {
      h += '<div class="lectura">Esa cosecha lleva <b>' + fCopC(rt.acumulado) +
        '</b> acumulados hasta hoy (' + fNum(rt.multiploAcum) + 'x el gasto), ' +
        'pero ' + fCopC(rt.acumulado - (rt.fila.plataM0 || 0)) + ' entraron ' +
        'después del período. Una cosecha sigue rindiendo meses después de que ' +
        'se pagó la pauta, así que el número de arriba es el piso, no el total.</div>';
    }
    h += '<div style="margin-top:14px">' +
      panel('Del gasto a la plata, mes a mes',""")

# la tabla marca cuales meses estan dentro del rango
rep("""        ], (rt.serie || []).map(function (x) {
          var y = {}; for (var kk in x) y[kk] = x[kk];
          y.multiplo = fNum(x.multiplo) + 'x';
          return y;
        }))) +""",
    """        ], (rt.serie || []).map(function (x) {
          var y = {}; for (var kk in x) y[kk] = x[kk];
          y.multiplo = fNum(x.multiplo) + 'x';
          // El mes que se esta viendo se marca: la tabla trae todos los meses
          // a proposito, porque la tendencia es lo util, pero hay que saber
          // cual es el del filtro.
          var dentro = x.mes >= rt.mesIni && x.mes <= rt.mesFin;
          y.mes = x.mes + (dentro ? '  ←' : '');
          return y;
        }))) +""")
io.open(p, 'w', encoding='utf8').write(s)
print('acumulado aparte + mes marcado')
