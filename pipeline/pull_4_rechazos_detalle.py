# -*- coding: utf-8 -*-
"""Mismo universo de pull_4_rechazos.py (sedes con las ultimas 4 solicitudes
consecutivas rechazadas, <=90 dias, sin AAA) pero con el desglose de las 4
solicitudes individuales: fecha y monto_solicitado de cada una, no solo la
suma. Pedido 22-sep-2026."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SQL = """
WITH ranked AS (
  SELECT medico_id, estado, created_on, monto_solicitado,
    ROW_NUMBER() OVER (PARTITION BY medico_id ORDER BY created_on DESC) AS rn
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL AND created_on IS NOT NULL
),
ultimas4 AS (
  SELECT medico_id,
    COUNT(*) AS n4,
    SUM(CASE WHEN estado = 'rejected' THEN 1 ELSE 0 END) AS rechazadas4,
    MAX(created_on) AS ultima_fecha
  FROM ranked WHERE rn <= 4
  GROUP BY medico_id
),
universo AS (
  SELECT medico_id FROM ultimas4
  WHERE n4 = 4 AND rechazadas4 = 4
    AND DATE(ultima_fecha) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
)
SELECT r.medico_id, r.rn, CAST(r.created_on AS STRING) AS fecha, r.monto_solicitado
FROM ranked r
JOIN universo u ON u.medico_id = r.medico_id
WHERE r.rn <= 4
ORDER BY r.medico_id, r.rn
"""

filas = lib.bq(SQL, project='welli-tecnologia')
print('filas (sede x solicitud, deberia ser universo x 4):', len(filas))

# info de sede (nombre/correo/telefono/hubspot), igual que antes
im = lib.bq("""
SELECT id, nombre_comercial, razon_social, email_notificaciones, telefono_whatsapp
FROM `welli-tecnologia.public.institucion_medica`
""", project='welli-tecnologia')
infoSede = {r['id']: r for r in im}

d = json.load(io.open('sheet_data.json', encoding='utf8'))

def norm_(s):
    return str(s or '').strip().lower()

aaaT = d['AAA']
aaaH = aaaT[0]
nombresAAA = set(norm_(r[aaaH.index('sede')]) for r in aaaT[1:])

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

porSede = {}
for f in filas:
    porSede.setdefault(f['medico_id'], []).append(f)

out = []
excluidas_aaa = 0
for iid, sols in porSede.items():
    sols.sort(key=lambda x: int(x['rn']))
    info = infoSede.get(iid, {})
    hs = porInternal.get(iid, {})
    nombre = hs.get('nombre_sede_hs') or info.get('nombre_comercial') or info.get('razon_social')
    if norm_(nombre) in nombresAAA or norm_(info.get('nombre_comercial')) in nombresAAA or norm_(info.get('razon_social')) in nombresAAA:
        excluidas_aaa += 1
        continue
    fila = {
        'id_internal': iid,
        'id_hubspot': hs.get('id_hubspot', ''),
        'nombre_sede': nombre,
        'telefono': info.get('telefono_whatsapp', ''),
        'email': info.get('email_notificaciones', ''),
        'pipeline_hubspot': hs.get('pipeline', '(sin ficha en HubSpot)'),
        'etapa_hubspot': hs.get('etapa', ''),
    }
    montoTotal = 0
    for s in sols:
        n = int(s['rn'])
        fila['fecha_%d' % n] = s['fecha']
        monto = int(s['monto_solicitado'] or 0)
        fila['monto_%d' % n] = monto
        montoTotal += monto
    fila['monto_rechazado_total'] = montoTotal
    out.append(fila)

print('excluidas por ser AAA:', excluidas_aaa)
print('total final:', len(out))
print('suma monto_rechazado_total:', sum(o['monto_rechazado_total'] for o in out))

json.dump(out, io.open('rechazos_4_detalle.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
print('escrito rechazos_4_detalle.json')
