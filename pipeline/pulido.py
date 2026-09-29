# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

# El chip dice el tramo cuando la pieza goteo varios dias
rep("""        '<i class="' + (im.canal === 'WhatsApp' ? 'wa' : 'mail') + '"></i>' +
        esc(etiquetaX(im.fecha, 'dia')) + ' · ' + esc(im.pieza) +
        ' <small>' + fNum(im.sedes) + '</small></button>';""",
    """        '<i class="' + (im.canal === 'WhatsApp' ? 'wa' : 'mail') + '"></i>' +
        esc(etiquetaX(im.fecha, 'dia')) + ' · ' + esc(im.pieza) +
        ' <small>' + fNum(im.sedes) +
        (im.tramo > 1 ? ' · ' + im.tramo + 'd' : '') + '</small></button>';""")

rep("""        'title="' + esc(im.nombre + ' · ' + im.pieza + ' · ' + im.canal + ' a ' +
          fNum(im.sedes) + ' sedes') + '">' +""",
    """        'title="' + esc(im.nombre + ' · ' + im.pieza + ' · ' + im.canal + ' a ' +
          fNum(im.sedes) + ' sedes' + (im.tramo > 1
            ? ', repartidas en ' + im.tramo + ' días según fueron entrando al workflow: ' +
              (im.dias || []).map(function (x) {
                return etiquetaX(x.fecha, 'dia') + ' ' + fNum(x.sedes);
              }).join(', ')
            : '')) + '">' +""")

# El rotulo de la grafica tambien
rep("""    m.ancho = (m.im.pieza + ' ' + fNum(m.im.sedes)).length * 5.3 + 14;""",
    """    m.etq = m.im.pieza + ' ' + fNum(m.im.sedes) +
      (m.im.tramo > 1 ? ' ·' + m.im.tramo + 'd' : '');
    m.ancho = m.etq.length * 5.3 + 14;""")
rep("""      esc(im.pieza) + '<tspan font-weight="400" fill="var(--texto-3)"> ' +
      esc(fNum(im.sedes)) + '</tspan></text>';""",
    """      esc(im.pieza) + '<tspan font-weight="400" fill="var(--texto-3)"> ' +
      esc(fNum(im.sedes) + (im.tramo > 1 ? ' ·' + im.tramo + 'd' : '')) +
      '</tspan></text>';""")

# El tooltip del dia: si el impacto goteo, se dice cuantas sedes de ESE dia
rep("""      (porDia[p.x] || []).forEach(function (im) {
        det.push({ nombre: im.nombre + ' · ' + im.canal,
                   valor: im.pieza + ' a ' + fNum(im.sedes) + ' sedes' });
      });""",
    """      (porDia[p.x] || []).forEach(function (im) {
        var hoy = (im.dias || []).filter(function (x) { return x.fecha === p.x; })[0];
        det.push({ nombre: im.nombre + ' · ' + im.canal,
                   valor: im.pieza + ' a ' + fNum(hoy ? hoy.sedes : im.sedes) +
                     ' sedes' + (im.tramo > 1
                       ? ' (de ' + fNum(im.sedes) + ' en ' + im.tramo + ' días)' : '') });
      });""")

# El subtitulo explica el criterio de agrupacion, que no es obvio
rep("""        ? 'cada color es un workflow · línea continua WhatsApp, punteada email · ' +
          'apaga los que no quieras ver'""",
    """        ? 'cada color es un workflow · línea continua WhatsApp, punteada email · ' +
          'una marca es una pieza de la cadencia, aunque haya goteado varios ' +
          'días · apaga las que no quieras ver'""")
io.open(p, 'w', encoding='utf8').write(s)
print('pulido ok')
