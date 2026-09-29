# -*- coding: utf-8 -*-
"""
Migra el tablero a las fuentes acordadas con BI.

  solicitudes          -> welli-data.comercial_ops.t_sol_v2 / fecha_solicitud
  desembolsos y plata  -> welli-data.comercial_ops.t_des_v2 / fecha_firma_contrato
  universo de sedes    -> institucion_medica (existencia + country_code = 'COL')

Sin filtro de estado: en t_des_v2 es_desembolso es true en las 44.106 filas, o
sea que la tabla YA es el universo de desembolsos. Desembolso es desembolso,
girado o no.

La columna Origen de las tablas v2 NO se usa: es un tercer vocabulario
("Ref. Farmer", "Página Web") y viene vacia en 58% de las filas. El origen
manda desde HubSpot, que es donde el negocio lo clasifica.

Escribe tres hojas:
  PLATAFORMA_SEDES  id_sede, pais, created      -> la regla del universo
  PLATA_SEDE_MES    id_sede, mes, desembolsos, monto
  EMBUDO_ORIGEN     fecha, origen, solicitudes, desembolsados, monto
"""
import lib, json, io, collections, unicodedata

COL = "IFNULL(country_code,'COL') = 'COL'"


def norm_orig(o):
    s = (o or '').strip()
    if not s:
        return '(SIN ORIGEN)'
    s = ''.join(c for c in unicodedata.normalize('NFD', s.upper())
                if unicodedata.category(c) != 'Mn')
    return ' '.join(s.split())


def n(v):
    try:
        return int(float(v))
    except Exception:
        return 0


if __name__ == '__main__':
    # ---- 1. el universo: quien existe en la plataforma y de que pais ----
    print('--- PLATAFORMA_SEDES ---')
    # La especialidad va aca porque de ella sale la ventana de decision del
    # frente 4 (C corta / B media / A larga). Sin ella el mapeo se cae.
    plat = lib.bq("""
    SELECT id, IFNULL(country_code,'COL') AS pais,
           CAST(DATE(created, "America/Bogota") AS STRING) AS created,
           IFNULL(especialidad,'') AS especialidad
    FROM `welli-tecnologia.public.institucion_medica`""", project='welli-tecnologia')
    T = {'PLATAFORMA_SEDES': [['id_sede', 'pais', 'created', 'especialidad']] +
         [[r['id'], r['pais'], r['created'], r['especialidad']] for r in plat]}
    col = sum(1 for r in plat if r['pais'] == 'COL')
    print('   %d sedes  (%d COL, %d otras)' % (len(plat), col, len(plat) - col))

    # ---- 2. plata firmada por sede y mes (t_des_v2) ----
    print('--- PLATA_SEDE_MES desde t_des_v2 ---')
    des = lib.bq("""
    SELECT id_clinica AS id_sede,
           FORMAT_DATE('%%Y-%%m', DATE(fecha_firma_contrato)) AS mes,
           COUNT(*) AS desembolsos,
           SUM(monto_aprobado) AS monto
    FROM `welli-data.comercial_ops.t_des_v2`
    WHERE %s AND id_clinica IS NOT NULL
    GROUP BY 1, 2 ORDER BY 1, 2""" % COL, project='welli-data')
    T['PLATA_SEDE_MES'] = [['id_sede', 'mes', 'desembolsos', 'monto']] + \
        [[r['id_sede'], r['mes'], n(r['desembolsos']), n(r['monto'])] for r in des]
    tm = sum(n(r['monto']) for r in des)
    print('   %d filas sede x mes   $%s' % (len(des), format(tm, ',').replace(',', '.')))

    # ---- 3. embudo por dia y origen ----
    # Se baja por dia x clinica y se colapsa a dia x origen usando el origen de
    # HubSpot. Por sede serian 135.552 filas (~8 MB); por origen son ~5.000.
    print('--- EMBUDO_ORIGEN desde t_sol_v2 + t_des_v2 ---')
    H = json.load(io.open('sheet_data.json', encoding='utf8'))
    S = H['SEDES']
    h = S[0]
    iI, iO = h.index('id_internal'), h.index('origen')
    origen_de = {}
    for r in S[1:]:
        k = str(r[iI] or '').strip()
        if k:
            origen_de[k] = norm_orig(r[iO])

    sol = lib.bq("""
    SELECT CAST(DATE(fecha_solicitud, "America/Bogota") AS STRING) AS fecha, id_clinica, COUNT(*) AS n
    FROM `welli-data.comercial_ops.t_sol_v2`
    WHERE %s AND id_clinica IS NOT NULL
    GROUP BY 1, 2""" % COL, project='welli-data')
    print('   t_sol_v2: %d filas dia x clinica' % len(sol))

    de2 = lib.bq("""
    SELECT CAST(DATE(fecha_firma_contrato) AS STRING) AS fecha, id_clinica,
           COUNT(*) AS n, SUM(monto_aprobado) AS monto
    FROM `welli-data.comercial_ops.t_des_v2`
    WHERE %s AND id_clinica IS NOT NULL
    GROUP BY 1, 2""" % COL, project='welli-data')
    print('   t_des_v2: %d filas dia x clinica' % len(de2))

    NO_HS = '(NO ESTA EN HUBSPOT)'
    ag = collections.defaultdict(lambda: [0, 0, 0])   # sol, des, monto
    sin_hs_sol = 0
    for r in sol:
        o = origen_de.get(str(r['id_clinica']))
        if o is None:
            o = NO_HS
            sin_hs_sol += n(r['n'])
        ag[(r['fecha'], o)][0] += n(r['n'])
    for r in de2:
        o = origen_de.get(str(r['id_clinica'])) or NO_HS
        b = ag[(r['fecha'], o)]
        b[1] += n(r['n'])
        b[2] += n(r['monto'])

    filas = [['fecha', 'origen', 'solicitudes', 'desembolsados', 'monto']]
    for (f, o) in sorted(ag):
        b = ag[(f, o)]
        filas.append([f, o, b[0], b[1], b[2]])
    T['EMBUDO_ORIGEN'] = filas
    print('   colapsado a %d filas dia x origen' % (len(filas) - 1))
    print('   solicitudes de clinicas que no estan en HubSpot: %d' % sin_hs_sol)

    # ---- control: marketing ene-ago 2026 ----
    MKT = {'EVENTO', 'REFERIDO', 'PAGINA WEB', 'SOCIAL MEDIA'}
    s2 = d2 = m2 = 0
    for r in filas[1:]:
        if r[1] in MKT and '2026-01-01' <= r[0] <= '2026-08-31':
            s2 += r[2]; d2 += r[3]; m2 += r[4]
    print('   CONTROL marketing ene-ago 2026: %d solicitudes, %d desembolsos, $%s'
          % (s2, d2, format(m2, ',').replace(',', '.')))

    json.dump(T, io.open('tables_v2.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_v2.json')
