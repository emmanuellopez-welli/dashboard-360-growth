# -*- coding: utf-8 -*-
"""Agrega los broadcasts de Hilos por campana, mes y tema."""
import json, io, collections, re, datetime

# Hallazgo 2026-09-08 (mismo patron que los deals de HubSpot): Hilos SI
# manda el offset explicito ("...-06:00"), pero antes se le hacia [:10] al
# string crudo sin convertir a la zona real del negocio (Bogota, -05:00).
# Con -06:00 el error solo mueve un broadcast de fecha si cae en la
# ventana de una hora entre las 11pm y medianoche Bogota, pero se corrige
# igual para no dejar el mismo bug a medias.
def fechaBogotaOffset(iso):
    iso = str(iso or '')
    try:
        dt = datetime.datetime.fromisoformat(iso)
    except Exception:
        return iso[:10]
    if dt.tzinfo is None:
        return iso[:10]
    dt_bog = dt.astimezone(datetime.timezone(datetime.timedelta(hours=-5)))
    return dt_bog.strftime('%Y-%m-%d')

RAW = json.load(io.open('hilos_raw.json', encoding='utf8'))
BC, FL = RAW['broadcasts'], RAW['flows']

TEMAS = [
    ('Cobranza y pagos', ['cobranza', 'precobranza', 'pago', 'mora', 'extracto', 'recaudo', 'factura']),
    ('Rescate y activacion', ['rescate', 'activacion', 'aprobado', 'firma', 'otp', 'estanc', 'no_firm']),
    ('Sedes y aliados', ['sede', 'aliado', 'clinica', 'medico', 'farmer', 'capacit', 'onboarding']),
    ('Welli Points', ['wellipoint', 'welli_point', 'wp_', 'puntos', 'concurso', 'premio']),
    ('Producto y novedades', ['cupon', 'novedad', 'lanzamiento', 'nuevo', 'producto']),
    ('Encuestas y NPS', ['encuesta', 'nps', 'satisfacc', 'opinion']),
    ('Adquisicion pacientes', ['paciente', 'credito', 'solicitud', 'preaprob', 'campana']),
]


def tema(name):
    n = (name or '').lower()
    for t, kws in TEMAS:
        if any(k in n for k in kws):
            return t
    return 'Otros'


def num(v):
    try:
        return int(v or 0)
    except Exception:
        return 0


# --------------------------------------------------- BROADCAST por campana
BC_COLS = ['campana', 'fecha', 'mes', 'tema', 'estado', 'enviados', 'entregados', 'leidos',
           'respuestas', 'fallidos', 'pendientes', 'tasa_entrega_pct', 'tasa_lectura_pct',
           'tasa_respuesta_pct']
bc_rows = []
for b in BC:
    name = b.get('name') or ''
    f = fechaBogotaOffset(b.get('created_on'))
    sent, deliv = num(b.get('sent')), num(b.get('delivered'))
    read, ans = num(b.get('read')), num(b.get('answered'))
    bc_rows.append([name, f, f[:7], tema(name), b.get('status', ''), sent, deliv, read, ans,
                    num(b.get('failed')), num(b.get('pending')),
                    round(100.0 * deliv / sent, 1) if sent else 0,
                    round(100.0 * read / deliv, 1) if deliv else 0,
                    round(100.0 * ans / deliv, 1) if deliv else 0])
bc_rows.sort(key=lambda x: x[1], reverse=True)
HILOS_BROADCAST = [BC_COLS] + bc_rows

# --------------------------------------------------- agregado por MES
mes = collections.defaultdict(collections.Counter)
for r in bc_rows:
    if not r[2]:
        continue
    b = mes[r[2]]
    b['campanas'] += 1
    b['enviados'] += r[5]
    b['entregados'] += r[6]
    b['leidos'] += r[7]
    b['respuestas'] += r[8]
HILOS_MES = [['mes', 'campanas', 'enviados', 'entregados', 'leidos', 'respuestas',
              'tasa_lectura_pct', 'tasa_respuesta_pct']]
for m in sorted(mes):
    b = mes[m]
    HILOS_MES.append([m, b['campanas'], b['enviados'], b['entregados'], b['leidos'],
                      b['respuestas'],
                      round(100.0 * b['leidos'] / b['entregados'], 1) if b['entregados'] else 0,
                      round(100.0 * b['respuestas'] / b['entregados'], 1) if b['entregados'] else 0])

# --------------------------------------------------- agregado por TEMA
tm = collections.defaultdict(collections.Counter)
for r in bc_rows:
    b = tm[r[3]]
    b['campanas'] += 1
    b['enviados'] += r[5]
    b['entregados'] += r[6]
    b['leidos'] += r[7]
    b['respuestas'] += r[8]
HILOS_TEMA = [['tema', 'campanas', 'enviados', 'entregados', 'leidos', 'respuestas',
               'tasa_lectura_pct', 'tasa_respuesta_pct']]
for t, b in sorted(tm.items(), key=lambda x: -x[1]['enviados']):
    HILOS_TEMA.append([t, b['campanas'], b['enviados'], b['entregados'], b['leidos'],
                       b['respuestas'],
                       round(100.0 * b['leidos'] / b['entregados'], 1) if b['entregados'] else 0,
                       round(100.0 * b['respuestas'] / b['entregados'], 1) if b['entregados'] else 0])

# --------------------------------------------------- FLOWS
HILOS_FLOWS = [['flow', 'estado', 'contactos', 'completados', 'corriendo', 'fallidos',
                'tasa_completado_pct']]
for f in FL:
    n = num(f.get('num_contacts'))
    comp = num(f.get('completed'))
    HILOS_FLOWS.append([f.get('name', ''), f.get('status', ''), n, comp,
                        num(f.get('running')), num(f.get('failed')),
                        round(100.0 * comp / n, 1) if n else 0])
HILOS_FLOWS[1:] = sorted(HILOS_FLOWS[1:], key=lambda x: -x[2])

TABLES = {'HILOS_BROADCAST': HILOS_BROADCAST, 'HILOS_MES': HILOS_MES,
          'HILOS_TEMA': HILOS_TEMA, 'HILOS_FLOWS': HILOS_FLOWS}

if __name__ == '__main__':
    json.dump(TABLES, io.open('tables_hilos.json', 'w', encoding='utf8'), ensure_ascii=False)
    for k, v in TABLES.items():
        print('%-20s %6d filas' % (k, len(v) - 1))
    print()
    for row in HILOS_TEMA:
        print(' | '.join(str(x)[:22] for x in row))
    print()
    for row in HILOS_MES:
        print(' | '.join(str(x)[:22] for x in row))
