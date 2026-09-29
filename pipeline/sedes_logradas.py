# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# Sede LOGRADA = sede con al menos una firma. Hay que contarlas como conjunto:
# la misma sede aparece en varios dias, asi que sumar filas la contaria de mas.
rep("""      if (!org[o]) org[o] = { origen: o, sol: 0, apr: 0, des: 0, monto: 0 };
      var b = org[o];
      b.sol += r.sol; b.apr += r.apr; b.des += r.conv; b.monto += r.mConv;""",
    """      if (!org[o]) {
        org[o] = { origen: o, sol: 0, apr: 0, des: 0, monto: 0, firm: {} };
      }
      var b = org[o];
      b.sol += r.sol; b.apr += r.apr; b.des += r.conv; b.monto += r.mConv;
      // Sede lograda = sede que firmo. Como conjunto y no como suma: la misma
      // sede aparece en varios dias del periodo.
      if (r.conv > 0) b.firm[r.sede] = true;""")

rep("""    return { canal: k === '(SIN ORIGEN)' ? 'Sin origen' : k,
             sol: b.sol, apr: b.apr, des: b.des, monto: b.monto,
             pct: totCoh ? Math.round((b.monto / totCoh) * 1000) / 10 : 0,
             ticket: b.des ? Math.round(b.monto / b.des) : 0,
             conv: b.apr ? Math.round((b.des / b.apr) * 1000) / 10 : 0 };""",
    """    var logradas = Object.keys(b.firm || {}).length;
    return { canal: k === '(SIN ORIGEN)' ? 'Sin origen' : k,
             sol: b.sol, apr: b.apr, des: b.des, monto: b.monto,
             // Sedes que firmaron, y la plata que puso cada una. Es lo que
             // distingue un origen que trae una sede grande de uno que trae
             // varias chicas: el ticket habla del credito, esto de la sede.
             sedes: logradas,
             porSede: logradas ? Math.round(b.monto / logradas) : 0,
             pct: totCoh ? Math.round((b.monto / totCoh) * 1000) / 10 : 0,
             ticket: b.des ? Math.round(b.monto / b.des) : 0,
             conv: b.apr ? Math.round((b.des / b.apr) * 1000) / 10 : 0 };""")
io.open(p, 'w', encoding='utf8').write(s)
print('motor: sedes logradas')

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()
rep("""              { t: 'Origen', k: 'canal', f: 'txt', txt: true },
              { t: 'Solicitudes', k: 'sol' },
              { t: 'Aprobados', k: 'apr' },
              { t: 'Desembolsos', k: 'des' },
              { t: 'Conv', k: 'conv', f: 'pct' },
              { t: 'Ticket', k: 'ticket', f: 'cop' },
              { t: 'Plata', k: 'monto', f: 'cop' },
              { t: '% de la plata', k: 'pct', f: 'pct' }""",
    """              { t: 'Origen', k: 'canal', f: 'txt', txt: true },
              { t: 'Solicitudes', k: 'sol' },
              { t: 'Aprobados', k: 'apr' },
              { t: 'Desembolsos', k: 'des' },
              { t: 'Conv', k: 'conv', f: 'pct' },
              { t: 'Sedes logradas', k: 'sedes' },
              { t: 'Plata', k: 'monto', f: 'cop' },
              { t: 'Plata/sede', k: 'porSede', f: 'cop' },
              { t: 'Ticket', k: 'ticket', f: 'cop' },
              { t: '% de la plata', k: 'pct', f: 'pct' }""")
rep("""          panel('¿De qué origen salió esa plata?',
            fCopC(em.montoCanales) + ' de la cosecha del período, repartidos por ' +
            'el origen de la sede',""",
    """          panel('¿De qué origen salió esa plata?',
            fCopC(em.montoCanales) + ' de la cosecha del período, repartidos por ' +
            'el origen de la sede · sede lograda = sede que firmó al menos un ' +
            'crédito',""")
io.open(p, 'w', encoding='utf8').write(s)
print('tabla: dos columnas nuevas')
