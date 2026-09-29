# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# --- punto 4: deals, ahora con el universo del filtro y las exclusiones ---
rep("""    h += '<h2 class="sec">4 · Los deals que entraron, ¿se cierran?</h2>' +
      '<p class="sec-sub">negocios de HubSpot por mes de creación y cuántos llegaron a ' +
      'cierre ganado · solo orígenes de marketing</p>';""",
    """    h += '<h2 class="sec">4 · Los deals que entraron, ¿se cierran?</h2>' +
      '<p class="sec-sub">negocios de HubSpot por mes de creación y cuántos llegaron a ' +
      'cierre ganado · ' + esc(dc.universo || '') +
      (dc.excluidos ? ' · se excluyen los cerrados perdidos por ' +
        esc(dc.excluidos) : '') + '</p>';""")

# --- punto 5: titulo y subtitulo dependen del filtro ---
rep("""    h += '<h2 class="sec">5 · ¿En qué termina la demanda que trajo marketing?</h2>' +
      '<p class="sec-sub">' + (em.cohorte
        ? 'solo la cosecha de ' + esc(em.mes) + ': las ' + fNum(em.sedes) +
          ' sedes que entró marketing ese mes, con los créditos que radicaron ' +
          'ese mes · profile_institucion'
        : 'de los créditos radicados en el período por pacientes de sedes de ' +
          'origen marketing · profile_institucion') + '</p>';""",
    """    h += '<h2 class="sec">5 · ¿En qué termina la demanda ' +
      (em.origenTodos ? 'que entró' : 'de ese origen') + '?</h2>' +
      '<p class="sec-sub">' + (em.cohorte
        ? 'doble corte: las ' + fNum(em.sedes) + ' sedes que entraron en el ' +
          'período (' + esc(em.mes) + ') y los créditos que radicaron en el ' +
          'período · ' + esc(em.universo || '')
        : 'de los créditos radicados en el período · ' + esc(em.universo || '')) +
      '</p>';""")

rep("""        panel(em.cohorte ? 'Embudo de la cosecha de ' + esc(em.mes) : 'Embudo del período',
          'pasar el mouse da el % de cada salto', '', 'gF1Emb') +""",
    """        panel(em.cohorte ? 'Embudo de la cosecha del período' : 'Embudo del período',
          'pasar el mouse da el % de cada salto', '', 'gF1Emb') +""")

rep("""        panel('Monto desembolsado por día',
          em.serieCohorte
            ? 'la misma plata de la tarjeta, día por día · cosecha de ' + esc(em.mes)
            : 'COP por ' + g + ' · fecha de firma del contrato',
          '', 'gF1Rev') +""",
    """        panel('Monto desembolsado por día',
          em.serieCohorte
            ? 'la misma plata de la tarjeta, día por día'
            : 'COP por ' + g + ' · fecha de firma del contrato',
          '', 'gF1Rev') +""")

rep("""          panel('¿De qué canal salió esa plata?',
            fCopC(em.montoCanales) + ' de la cosecha de ' + esc(em.mes) +
            ', repartidos por el origen de la sede',""",
    """          panel('¿De qué origen salió esa plata?',
            fCopC(em.montoCanales) + ' de la cosecha del período, repartidos por ' +
            'el origen de la sede',""")

rep("""              { t: 'Canal', k: 'canal', f: 'txt', txt: true },
              { t: 'Sedes', k: 'sedes' },
              { t: 'Solicitudes', k: 'sol' },""",
    """              { t: 'Origen', k: 'canal', f: 'txt', txt: true },
              { t: 'Solicitudes', k: 'sol' },""")

io.open(p, 'w', encoding='utf8').write(s)
print('frontend ok')
