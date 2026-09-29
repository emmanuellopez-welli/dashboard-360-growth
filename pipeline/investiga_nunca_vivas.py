# -*- coding: utf-8 -*-
"""
Pregunta de Emmanuel: las sedes 'nunca vivas' (nunca radicaron ni una
sola solicitud) -- tienen valor real? vale la pena invertir en activarlas?

Cruza institucion_medica (universo, fecha creacion) contra profile_institucion
(quien SI aplico alguna vez) para aislar el id de las 'nunca vivas', y luego
cruza esos id contra la hoja SEDES local (etapa/pipeline/origen/ciudad de
HubSpot) para ver si son prospectos reales dormidos o basura de HubSpot.
"""
import lib, io, sys, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

Q = """
WITH t_instituciones AS (
  SELECT id AS id_sede, DATE(created) AS created
  FROM `welli-tecnologia.public.institucion_medica`
  WHERE COALESCE(deshabilidato, FALSE) = FALSE
),
apps_base AS (
  SELECT DISTINCT app.medico_id AS id_sede
  FROM `welli-tecnologia.public.profile_institucion` app
)
SELECT i.id_sede, i.created
FROM t_instituciones i
LEFT JOIN apps_base a ON a.id_sede = i.id_sede
WHERE a.id_sede IS NULL
"""
filas = lib.bq(Q, project='welli-tecnologia')
print('nunca vivas (universo habilitado, nunca aplicaron):', len(filas))

nunca = {r['id_sede']: str(r['created'])[:10] for r in filas}

d = json.load(io.open('sheet_data.json', encoding='utf-8'))
sedes = d['SEDES']
head = sedes[0]
idx = {c: i for i, c in enumerate(head)}

def col(row, name):
    return row[idx[name]] if idx[name] < len(row) else None

match = []
for row in sedes[1:]:
    iid = col(row, 'id_internal')
    if iid and iid in nunca:
        match.append(row)

print('de esas, con ficha en HubSpot (SEDES):', len(match))

# distribucion por etapa de pipeline
por_etapa = collections.Counter(col(r, 'etapa') for r in match)
print('\n-- por etapa/pipeline --')
for k, v in por_etapa.most_common(20):
    print(' ', k, v)

por_pipeline = collections.Counter(col(r, 'pipeline') for r in match)
print('\n-- por pipeline --')
for k, v in por_pipeline.most_common(20):
    print(' ', k, v)

por_origen = collections.Counter(col(r, 'origen_bucket') for r in match)
print('\n-- por origen_bucket --')
for k, v in por_origen.most_common(20):
    print(' ', k, v)

por_ciudad = collections.Counter(col(r, 'ciudad_municipio') for r in match)
print('\n-- top ciudades --')
for k, v in por_ciudad.most_common(15):
    print(' ', k, v)

por_alerta = collections.Counter(col(r, 'alert_level') for r in match)
print('\n-- alert_level --')
for k, v in por_alerta.most_common(10):
    print(' ', k, v)

por_asesor = collections.Counter(col(r, 'asesor_comercial') for r in match)
print('\n-- top asesor_comercial (quien las tiene asignadas) --')
for k, v in por_asesor.most_common(10):
    print(' ', k, v)

vis = sum(1 for r in match if str(col(r, 'visita_recibida')).lower() in ('true', '1', 'si'))
print('\ncon visita_recibida=True:', vis, 'de', len(match))

cap = sum(1 for r in match if col(r, 'fecha_capacitado'))
print('con fecha_capacitado (ya las capacitaron):', cap, 'de', len(match))

# antiguedad
hoy = '2026-09-17'
import datetime
def dias(f):
    try:
        y, m, dd = map(int, f.split('-')[:3])
        return (datetime.date(2026, 9, 17) - datetime.date(y, m, dd)).days
    except Exception:
        return None

buckets = collections.Counter()
for iid, created in nunca.items():
    dd = dias(created)
    if dd is None:
        buckets['sin fecha'] += 1
    elif dd < 90:
        buckets['<90d (normal, aun no vence)'] += 1
    elif dd < 180:
        buckets['90-180d'] += 1
    elif dd < 365:
        buckets['180-365d'] += 1
    else:
        buckets['>365d'] += 1
print('\n-- antiguedad de TODAS las nunca-vivas (no solo las con ficha HubSpot) --')
for k, v in buckets.most_common():
    print(' ', k, v)

print('\ntotal nunca-vivas SIN ficha en HubSpot (no aparecen en SEDES):', len(nunca) - len(match))
