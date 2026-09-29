# -*- coding: utf-8 -*-
"""Sedes con las ultimas 4 solicitudes de credito consecutivas RECHAZADAS
('rejected' en profile_institucion.estado -- definicion confirmada con
Emmanuel: no incluye 'dismissed'/'rejected_validation'/'not_taken'/'fraud'),
y cuya ultima solicitud no tiene mas de 90 dias. Pedido puntual, no es parte
del tablero.

22-sep-2026, segunda vuelta: se excluyen las sedes AAA (cuentas top-tier,
hoja AAA de sheet_data.json, cruce por nombre -- esa hoja no trae id_internal,
solo el nombre de sede) y se agrega el monto rechazado (suma de
COALESCE(monto_aprobado, monto) de esas 4 solicitudes)."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SQL = """
WITH ranked AS (
  SELECT medico_id, estado, created_on, monto_solicitado AS monto,
    ROW_NUMBER() OVER (PARTITION BY medico_id ORDER BY created_on DESC) AS rn
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL AND created_on IS NOT NULL
),
ultimas4 AS (
  SELECT medico_id,
    COUNT(*) AS n4,
    SUM(CASE WHEN estado = 'rejected' THEN 1 ELSE 0 END) AS rechazadas4,
    SUM(monto) AS monto_rechazado,
    MAX(created_on) AS ultima_fecha
  FROM ranked WHERE rn <= 4
  GROUP BY medico_id
)
SELECT u.medico_id, CAST(u.ultima_fecha AS STRING) AS ultima_fecha, u.monto_rechazado,
  im.nombre_comercial, im.razon_social, im.email_notificaciones,
  im.telefono_whatsapp
FROM ultimas4 u
JOIN `welli-tecnologia.public.institucion_medica` im ON im.id = u.medico_id
WHERE u.n4 = 4 AND u.rechazadas4 = 4
  AND DATE(u.ultima_fecha) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
ORDER BY u.ultima_fecha DESC
"""

filas = lib.bq(SQL, project='welli-tecnologia')
print('sedes con las ultimas 4 solicitudes rechazadas y <=90 dias (antes de excluir AAA):', len(filas))

d = json.load(io.open('sheet_data.json', encoding='utf8'))

# nombres AAA a excluir (normalizados: minusculas, sin espacios de sobra)
def norm_(s):
    return str(s or '').strip().lower()

aaaT = d['AAA']
aaaH = aaaT[0]
nombresAAA = set(norm_(r[aaaH.index('sede')]) for r in aaaT[1:])
print('sedes AAA a excluir:', len(nombresAAA))

# cruce con SEDES local (HubSpot) para id/nombre/pipeline/etapa
S = d['SEDES']
h = S[0]
porInternal = {}
for r in S[1:]:
    iid = str(r[h.index('id_internal')] or '').strip()
    if iid:
        porInternal[iid] = {
            'id_hubspot': r[h.index('id')],
            'nombre_sede_hs': r[h.index('nombre_sede')],
            'pipeline': r[h.index('pipeline')],
            'etapa': r[h.index('etapa')],
        }

out = []
excluidas_aaa = 0
for f in filas:
    iid = f['medico_id']
    hs = porInternal.get(iid, {})
    nombre = hs.get('nombre_sede_hs') or f['nombre_comercial'] or f['razon_social']
    if norm_(nombre) in nombresAAA or norm_(f['nombre_comercial']) in nombresAAA or norm_(f['razon_social']) in nombresAAA:
        excluidas_aaa += 1
        continue
    out.append({
        'id_internal': iid,
        'id_hubspot': hs.get('id_hubspot', ''),
        'nombre_sede': nombre,
        'telefono': f['telefono_whatsapp'],
        'email': f['email_notificaciones'],
        'monto_rechazado': int(f['monto_rechazado'] or 0),
        'pipeline_hubspot': hs.get('pipeline', '(sin ficha en HubSpot)'),
        'etapa_hubspot': hs.get('etapa', ''),
        'ultima_solicitud': f['ultima_fecha'],
    })

print('excluidas por ser AAA:', excluidas_aaa)
en_hubspot = sum(1 for o in out if o['id_hubspot'])
print('total final:', len(out), '| con ficha en HubSpot:', en_hubspot)
print('suma monto_rechazado total:', sum(o['monto_rechazado'] for o in out))

json.dump(out, io.open('rechazos_4_consecutivos.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
print('escrito rechazos_4_consecutivos.json')
