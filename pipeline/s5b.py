# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

rep("""    cohorte: hayCoh,
    mes: hayCoh ? mesComp : '',
    mesPrev: hayCoh ? mesPrevEmb : '',
    sedes: hayCoh ? cA.sedes : 0,
    aportaron: hayCoh ? cA.aportaron : 0,
    sinId: hayCoh ? Math.max(0, cA.sedes - cA.verificables) : 0,""",
    """    cohorte: hayCoh,
    mes: hayCoh ? mesEti : '',
    mesPrev: hayCoh ? mesPrevEti : '',
    sedes: sedesPer,
    universo: U.etiqueta,
    origenTodos: U.todos,""")

rep("""        sublabel: hayCoh
          ? 'radicadas en ' + mesComp + ' por las ' + fNumSrv_(cA.sedes) +
            ' sedes que trajo marketing ese mes'
          : 'radicadas por pacientes de sedes que trajo marketing',""",
    """        sublabel: hayCoh
          ? 'radicadas en el período por las ' + fNumSrv_(sedesPer) +
            ' sedes que entraron en el período'
          : 'radicadas por pacientes de las sedes del universo',""")

rep("""        deltaEtiqueta: hayCoh && mesPrevEmb ? 'vs cosecha de ' + mesPrevEmb : '',
        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: !hayEm ? notaEm : (hayCoh
          ? 'Solo la cosecha del mes: las sedes que entraron en ' + mesComp +
            ' y los créditos que radicaron en ' + mesComp + '. No incluye las ' +
            'sedes que marketing trajo en meses anteriores.'
          : (emComparable ? '' : notaEmCobertura)), color: 'amarillo' }),""",
    """        deltaEtiqueta: hayCoh ? 'vs cosecha de ' + mesPrevEti : '',
        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: !hayEm ? notaEm : (hayCoh
          ? 'Doble corte: la sede entró en el período Y el crédito se radicó en ' +
            'el período. No incluye las sedes que entraron antes, que son la ' +
            'mayor parte de la plata del negocio. Universo: ' + U.etiqueta + '.'
          : (emComparable ? '' : notaEmCobertura)), color: 'amarillo' }),""")

rep("""        sublabel: hayCoh
          ? 'el motor aprobó / solicitudes · cosecha de ' + mesComp
          : 'el motor aprobó / solicitudes',""",
    """        sublabel: hayCoh
          ? 'el motor aprobó / solicitudes · cosecha del período'
          : 'el motor aprobó / solicitudes',""")

rep("""        deltaEtiqueta: hayCoh && mesPrevEmb ? 'vs cosecha de ' + mesPrevEmb : '',
        pendiente: !hayAp, fuente: 'BigQuery · profile_institucion',""",
    """        deltaEtiqueta: hayCoh ? 'vs cosecha de ' + mesPrevEti : '',
        pendiente: !hayAp, fuente: 'BigQuery · profile_institucion',""")

rep("""        sublabel: hayCoh
          ? 'desembolsados / aprobados · cosecha de ' + mesComp
          : 'desembolsados / aprobados',""",
    """        sublabel: hayCoh
          ? 'desembolsados / aprobados · cosecha del período'
          : 'desembolsados / aprobados',""")

rep("""        deltaEtiqueta: hayCoh && mesPrevEmb ? 'vs cosecha de ' + mesPrevEmb : '',
        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: 'De los créditos que el motor APROBÓ""",
    """        deltaEtiqueta: hayCoh ? 'vs cosecha de ' + mesPrevEti : '',
        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: 'De los créditos que el motor APROBÓ""")

rep("""        sublabel: hayCoh
          ? 'lo que puso la cosecha de ' + mesComp + ' · ' +
            fNumSrv_(cA.aportaron) + ' de ' + fNumSrv_(cA.sedes) + ' sedes aportaron'
          : 'crédito desembolsado en esas sedes',""",
    """        sublabel: hayCoh
          ? 'lo que puso la cosecha del período · ' + U.etiqueta
          : 'crédito desembolsado en esas sedes',""")

rep("""        deltaEtiqueta: hayCoh && mesPrevEmb ? 'vs cosecha de ' + mesPrevEmb : '',
        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: !hayEm ? notaEm : (hayCoh
          ? 'Es lo que rindió la adquisición DE ESTE MES, no todo el stock que ' +
            'marketing ha traído. Sirve para calcular CAC contra el gasto del mes. ' +
            'El aporte del stock completo es varias veces mayor y crece con cada ' +
            'cosecha que sobrevive.'
          : (emComparable ? '' : notaEmCobertura)), color: 'morado' })""",
    """        deltaEtiqueta: hayCoh ? 'vs cosecha de ' + mesPrevEti : '',
        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: !hayEm ? notaEm : (hayCoh
          ? 'Es lo que rindió la adquisición DEL PERÍODO, no todo el stock. ' +
            'Sirve para calcular CAC contra el gasto del período. El aporte del ' +
            'stock completo es varias veces mayor y crece con cada cosecha que ' +
            'sobrevive.'
          : (emComparable ? '' : notaEmCobertura)), color: 'morado' })""")

rep("""    serieRevenue: hayCd && hayCoh
      ? Object.keys(serieCoh).sort().map(function (k) {
          return { x: k, y: serieCoh[k] };
        })
      : serieAgrupada_(sMonto, gran, R),
    serieCohorte: hayCd && hayCoh,
    // Share de ESA plata por canal, con % y ticket.
    canales: hayCd && hayCoh ? canalesCoh : [],
    montoCanales: totCoh""",
    """    serieRevenue: hayCoh
      ? Object.keys(cA.dia).sort().map(function (k) {
          return { x: k, y: cA.dia[k] };
        })
      : serieAgrupada_(sMonto, gran, R),
    serieCohorte: hayCoh,
    // Share de ESA plata por origen, con % y ticket.
    canales: hayCoh ? canalesCoh : [],
    montoCanales: totCoh""")

io.open(p, 'w', encoding='utf8').write(s)
print('textos de la seccion 5 ok')
