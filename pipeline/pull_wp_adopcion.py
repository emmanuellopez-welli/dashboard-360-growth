# -*- coding: utf-8 -*-
"""Adopcion de WelliPoints, replicando el tablero externo
(points.welli.com.co/admin) con datos reales de BigQuery
welli-growth.wp_data. La cuenta "habilitada" (2.467 en el admin externo)
vive en el sistema auth_user de la app, que NO es accesible por BigQuery
-- se usa wellipoints_snapshot (el ledger de puntos, 3.104 sedes) como el
universo mas cercano que SI se puede consultar y verificar, declarado
como tal en el tablero.

EXCLUSION DE MARCAS (21-sep-2026, pedido de negocio): Sonria, Dentisalud,
OdontoFamily y CityDent quedan afuera de TODA la pestana de Welli Points,
incluida esta foto de adopcion. Las hojas WP_SEDE_MES/WP_SEDE_INC/
WP_CANJES2/WP_HABILITADAS/WP_LOGIN_SEDES/WP_LOGIN_DIA/WP_PTS_SEDE_MES se
excluyen del lado de Code.gs (que si tiene id_sede por fila, ver
wpExcluidas_/leerWP_) -- pero WP_ADOPCION_KPI/MUNDO/TOP salen de un
agregado de BigQuery SIN id_sede en el resultado final, asi que la
exclusion tiene que ir aca, en el WHERE de la query, o no hay forma de
aplicarla despues.

OJO: nombre_sede de HubSpot SOLO no alcanza -- se encontro "City Suba"
(una sede real de CityDent) cuyo nombre en HubSpot y en la plataforma de
credito NO dice "citydent" en ningun lado, solo el correo de facturacion
(citydentsuba@yahoo.co) la delata. Y "Sonria sede Toberin" si decia
"sonria" en la plataforma de credito pero no en el nombre que tenia
cargado HubSpot ese dia. Por eso se cruzan TRES campos y se unen: HubSpot
nombre_sede + institucion_medica.nombre_comercial + .email_notificaciones
(el mismo criterio de wpExcluidas_ en Code.gs, ver CLAUDE.md seccion 35)."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

T = {}

_MARCAS = ('sonria', 'dentisalud', 'odontofamily', 'citydent')
def marca_(txt):
    t = str(txt or '').lower()
    return any(m in t for m in _MARCAS)

# Fuente 1: HubSpot SEDES (local, ya en sheet_data.json)
H = json.load(io.open('sheet_data.json', encoding='utf8'))
_S = H['SEDES']
_h = _S[0]
excl_ids = set()
for r in _S[1:]:
    if marca_(r[_h.index('nombre_sede')]):
        iid = str(r[_h.index('id_internal')] or '').strip()
        if iid:
            excl_ids.add(iid)
print('excluidas solo por HubSpot nombre_sede:', len(excl_ids))

# Fuente 2: institucion_medica en vivo (nombre comercial + correo de
# facturacion) -- consulta directa, no depende de PLATAFORMA_SEDES local.
inst = lib.bq("""
SELECT id, IFNULL(nombre_comercial, '') AS nombre,
       IFNULL(email_notificaciones, '') AS email
FROM `welli-tecnologia.public.institucion_medica`
""", project='welli-tecnologia')
for r in inst:
    if marca_(r['nombre']) or marca_(r['email']):
        excl_ids.add(str(r['id']).strip())
print('total excluidas tras cruzar HubSpot + institucion_medica (nombre/correo):', len(excl_ids))
EXCL_SQL = ','.join('"%s"' % i for i in excl_ids)

# ---- KPI resumen ---------------------------------------------------------
kpi = lib.bq("""
WITH habilitadas AS (
  SELECT DISTINCT id_sede FROM `welli-growth.wp_data.wellipoints_snapshot`
  WHERE id_sede NOT IN (%(excl)s)
),
logins AS (
  SELECT DISTINCT sede_id FROM `welli-growth.wp_data.wp_dashboard_visitas`
  WHERE sede_id NOT IN (%(excl)s)
)
SELECT
  (SELECT COUNT(*) FROM habilitadas) AS habilitadas,
  (SELECT COUNT(*) FROM logins) AS con_login,
  (SELECT COUNT(*) FROM habilitadas h WHERE h.id_sede NOT IN (SELECT sede_id FROM logins)) AS nunca_login
""" % {'excl': EXCL_SQL}, project='welli-data')[0]
print('KPI:', kpi)
T['WP_ADOPCION_KPI'] = [['habilitadas', 'con_login', 'nunca_login'],
                         [kpi['habilitadas'], kpi['con_login'], kpi['nunca_login']]]

# ---- por mundo (ultimo mundo conocido por sede que alguna vez entro) -----
mundo = lib.bq("""
SELECT IFNULL(mundo, 'sin clasificar') AS mundo, COUNT(*) AS sedes
FROM (
  SELECT sede_id, mundo,
         ROW_NUMBER() OVER (PARTITION BY sede_id ORDER BY timestamp DESC) rn
  FROM `welli-growth.wp_data.wp_dashboard_visitas`
  WHERE sede_id NOT IN (%(excl)s)
) WHERE rn = 1
GROUP BY mundo ORDER BY sedes DESC
""" % {'excl': EXCL_SQL}, project='welli-data')
T['WP_ADOPCION_MUNDO'] = [['mundo', 'sedes']] + [[r['mundo'], int(r['sedes'])] for r in mundo]
print('mundo:', T['WP_ADOPCION_MUNDO'])

# ---- tendencia 60 dias (sedes unicas que entraron ese dia) ---------------
# Ya no la usa el tablero (reemplazada por wpAdopcionDia_ sobre WP_LOGIN_DIA
# en Code.gs, seccion 28), se deja escrita por compatibilidad/respaldo.
tend = lib.bq("""
SELECT CAST(DATE(timestamp) AS STRING) AS dia, COUNT(DISTINCT sede_id) AS sedes
FROM `welli-growth.wp_data.wp_dashboard_visitas`
WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
  AND sede_id NOT IN (%(excl)s)
GROUP BY dia ORDER BY dia
""" % {'excl': EXCL_SQL}, project='welli-data')
T['WP_ADOPCION_TENDENCIA'] = [['dia', 'sedes']] + [[r['dia'], int(r['sedes'])] for r in tend]
print('dias con tendencia:', len(T['WP_ADOPCION_TENDENCIA']) - 1)

# ---- top 20 mas activas ---------------------------------------------------
top = lib.bq("""
SELECT sede_id, ANY_VALUE(sede_nombre) AS sede_nombre, ANY_VALUE(email) AS email,
       COUNT(*) AS visitas, MAX(timestamp) AS ultimo
FROM `welli-growth.wp_data.wp_dashboard_visitas`
WHERE sede_id NOT IN (%(excl)s)
GROUP BY sede_id ORDER BY visitas DESC LIMIT 20
""" % {'excl': EXCL_SQL}, project='welli-data')
T['WP_ADOPCION_TOP'] = [['sede', 'email', 'visitas', 'ultimo_acceso']] + \
    [[r['sede_nombre'], r['email'], int(r['visitas']), str(r['ultimo'])[:16]] for r in top]
print('top activas:', len(T['WP_ADOPCION_TOP']) - 1)

json.dump(T, io.open('tables_wp_adopcion.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_wp_adopcion.json')
