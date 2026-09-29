# -*- coding: utf-8 -*-
"""
CREDITO_DIA: los creditos por SEDE y por DIA. Una sola tabla de hechos.

Por que este cambio. Las tablas agregadas (COSECHA_DIA, RESCATE_VENTANA)
llevaban el filtro cocido como dimension: primero origen, despues equipo,
despues owner. Cada filtro nuevo obligaba a re-agregar todo, y con TRES roles
por sede (hunter, farmer, CS conviven) la agregacion explota: habria que
cruzar tres dimensiones de persona.

Con los hechos a nivel sede x dia, los atributos de la sede (origen, cosecha,
ventana, hunter, farmer, CS) viven en tablas de dimension chicas y el motor
filtra por lo que sea. Cualquier filtro futuro sale sin re-pull.

La llave es el id de HubSpot (11 digitos) y no el id_internal (UUID de 36):
sobre 117 mil filas esa diferencia son ~3 MB del artefacto.
"""
import lib, json, io, collections

SQL = """
WITH base AS (
  SELECT medico_id, DATE(created_on, "America/Bogota") AS fecha,
    -- 'dismissed' SACADO de apr y de conv (9-sep-2026, a pedido de Emmanuel):
    -- un credito dismissed es un RECHAZO/descarte, no un aprobado ni mucho
    -- menos un desembolso. Contarlo inflaba "aprobados" y "desembolsado" con
    -- plata que nunca salio -- se encontro auditando Family Dental Pro SAS
    -- (2 de sus 3 "desembolsos" de enero eran reales, el tercero, $2.7M, era
    -- un credito dismissed).
    CASE
      WHEN estado IN ('firma_contrato','approved','not_taken',
        'pendiente_aprobacion_medico','desembolsado','pendiente_validacion_cliente',
        'fulfilled','pendiente_desembolso') THEN 1 ELSE 0 END AS apr,
    CASE
      WHEN estado IN ('pendiente_aprobacion_medico','desembolsado',
        'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'
        ) THEN 1 ELSE 0 END AS conv,
    COALESCE(monto_aprobado, monto) AS monto
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL AND created_on IS NOT NULL
)
SELECT medico_id, CAST(fecha AS STRING) AS fecha,
  COUNT(*) AS sol, SUM(apr) AS apr, SUM(conv) AS conv,
  SUM(IF(apr = 1, monto, 0)) AS m_apr,
  SUM(IF(conv = 1, monto, 0)) AS m_conv
FROM base GROUP BY 1, 2 ORDER BY 2, 1"""


def n(v):
    try:
        return int(float(v))
    except Exception:
        return 0


if __name__ == '__main__':
    d = json.load(io.open('sheet_data.json', encoding='utf8'))
    S = d['SEDES']
    h = S[0]
    # id_internal (el que usa BigQuery) -> id de HubSpot (la llave compacta)
    hsDe = {}
    for r in S[1:]:
        k = str(r[h.index('id_internal')] or '').strip()
        if k:
            hsDe[k] = str(r[h.index('id')])
    print('sedes cruzables: %d' % len(hsDe))

    r = lib.bq(SQL, project='welli-tecnologia')
    print('%d filas dia x sede en BigQuery' % len(r))

    # Las sedes que existen en la plataforma pero NO en HubSpot se quedan con
    # una llave centinela. Si se botaran, el total del periodo saldria 4,2%
    # corto: son creditos reales del negocio. No se pueden atribuir a un
    # origen ni a un rol, asi que entran cuando no hay filtro y salen cuando
    # si lo hay, que es exactamente lo correcto.
    SIN_HS = '(SIN HUBSPOT)'
    filas = [['sede', 'fecha', 'sol', 'apr', 'conv', 'm_apr', 'm_conv']]
    fuera = 0
    for x in r:
        hs = hsDe.get(str(x['medico_id']))
        if not hs:
            hs = SIN_HS
            fuera += 1
        filas.append([hs, x['fecha'], n(x['sol']), n(x['apr']), n(x['conv']),
                      n(x['m_apr']), n(x['m_conv'])])
    print('%d filas  (%d de sedes que no estan en HubSpot, con llave centinela)'
          % (len(filas) - 1, fuera))
    peso = len(json.dumps(filas, ensure_ascii=False)) / 1048576.0
    print('peso en JSON: %.2f MB   (COSECHA_DIA + RESCATE_VENTANA pesaban 2,80 MB)'
          % peso)

    ctl = [0, 0, 0, 0]
    for f in filas[1:]:
        if '2026-08-01' <= f[1] <= '2026-08-31':
            ctl[0] += f[2]; ctl[1] += f[3]; ctl[2] += f[4]; ctl[3] += f[6]
    print()
    print('  CONTROL agosto 2026: %d solicitudes, %d aprobados, %d firmados, $%s'
          % (ctl[0], ctl[1], ctl[2], format(ctl[3], ',').replace(',', '.')))
    print('  BigQuery directo:    19.126 solicitudes, 6.345 aprobados, 2.825 firmados')

    json.dump({'CREDITO_DIA': filas},
              io.open('tables_cdia.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_cdia.json')
