# -*- coding: utf-8 -*-
"""
Intento de reproducir "133 rescatados / $892M recuperados en 30 dias" del
correo de rescate (corte miercoles 2-sep-2026), usando SOLO lista_dia +
seguimiento -- SIN el join contra gestion (que limita a lo que Kevin
efectivamente llamo ese dia). El correo habla de un POOL TRABAJABLE de ~900
casos que se mueve solo (recuperables, churn) y de el probablemente sale un
numero mas grande que "lo que Kevin trabajo y firmo" (~300M en RESCATE_POOL).

Definiciones del correo que se intentan respetar:
  - Pool TRABAJABLE = sin CreditOp (Sonria/Dentix/Dentisalud) ni "recortes"
    (creditos con monto_aprobado << monto_solicitado, >10% de recorte).
  - Ventana: aprobado hace <=30 dias (cosechas Recien/Media/Madura/Por vencer
    del correo son exactamente 0-7, 8-15, 16-23, 24-30 dias).
  - "Rescatado" = de esos, firmo dentro de la ventana observada.
"""
import lib

SQL_BASE = """
SELECT documento, fecha, aliado, monto, dias_aprob, dias_vencer, p_recup,
       valor_esperado, cadencia, bucket
FROM `welli-growth.rescate.lista_dia`
QUALIFY ROW_NUMBER() OVER (PARTITION BY documento ORDER BY fecha DESC) = 1
"""
lista = lib.bq(SQL_BASE, project='welli-data', location='US')
print('lista_dia (ultima fila por documento):', len(lista))

seg = lib.bq("""
SELECT documento, firmo, monto, estado_credito, dias_vencer, fecha_firma
FROM `welli-growth.rescate.seguimiento`
QUALIFY ROW_NUMBER() OVER (PARTITION BY documento ORDER BY capturado_en DESC) = 1
""", project='welli-data', location='US')
print('seguimiento (ultima fila por documento):', len(seg))
segIdx = {r['documento']: r for r in seg}

CREDITOP_INT = ('sonria', 'sonría', 'dentix', 'dentisalud')

def es_creditop(aliado):
    a = (aliado or '').lower()
    return any(k in a for k in CREDITOP_INT)

pool = 0
recortes = 0
creditop = 0
firmaron_n = 0
firmaron_m = 0
sin_seg = 0
for r in lista:
    if es_creditop(r['aliado']):
        creditop += 1
        continue
    pool += 1
    s = segIdx.get(r['documento'])
    if not s:
        sin_seg += 1
        continue
    if s['firmo']:
        ff = str(s['fecha_firma'] or '')
        if '2026-08-03' <= ff <= '2026-09-02':
            firmaron_n += 1
            firmaron_m += float(s['monto'] or 0)

print('pool (sin CreditOp):', pool, '| creditop excluido:', creditop)
print('sin fila en seguimiento:', sin_seg)
print('firmaron (de todo el pool, sin ventana de tiempo):', firmaron_n,
      'por $%.0f' % firmaron_m)
