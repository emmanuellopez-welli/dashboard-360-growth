# -*- coding: utf-8 -*-
"""
Arma las cuatro hojas del frente de rescate desde welli-growth.rescate.

Escribe tables_rescate.json; sube_rescate.py lo lleva a la hoja y a
sheet_data.json.

DOS TRAMPAS DEL TRASPASO QUE ESTE SCRIPT RESPETA:
  · trampa 3 — lista_dia puede traer el mismo paciente repetido. Todo JOIN
    contra ella dedupe con QUALIFY ROW_NUMBER() PARTITION BY (fecha, documento)
    ORDER BY rank.
  · trampa 4 — gestion guarda una fila por cada Guardar, no por paciente.
    Contar filas sobreestima el trabajo (529 filas = 499 casos, 6% de mas).
    Se dedupe por (fecha, documento) tomando el ts mayor.

Y la que costo mas: el dataset vive en la multi-region US, no en us-central1.
BigQuery reporta el desajuste como "User does not have permission to query
table", que parece IAM y no lo es. Ver rq.py.
"""
import io
import json
import collections

import rq

# El embudo, mapeado contra los valores REALES de gestion.causal
# (verificados el 3-sep-2026 con rescate_valores.py).
NO_CONTESTA = 'No contesta'
COLGO = 'Cuelga'
TERCERO = 'Contesta un tercero'      # aun sin casos, queda por si aparece
INTERESADO = 'Interesado · va a firmar'

# gestion deduplicada + el aliado y el monto que trae lista_dia.
BASE = """
WITH g AS (
  SELECT fecha, documento, causal, canal, nota, usuario, trabajado
  FROM `welli-growth.rescate.gestion`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento ORDER BY ts DESC) = 1),
l AS (
  SELECT fecha, documento, aliado, monto, telefono
  FROM `welli-growth.rescate.lista_dia`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento ORDER BY rank) = 1),
s AS (
  SELECT documento, MAX(firmo) AS firmo,
         MAX(IF(firmo, monto, 0)) AS monto_firmado
  FROM `welli-growth.rescate.seguimiento` GROUP BY documento),
ev AS (
  -- ts_evento es TIMESTAMP (verificado 2026-09-08 via INFORMATION_SCHEMA.COLUMNS
  -- una vez restaurado el acceso), asi que necesita el mismo ajuste de zona
  -- horaria que los deals de HubSpot (UTC por defecto vs Bogota real).
  SELECT RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10) AS tel,
         DATE(ts_evento, "America/Bogota") AS dia
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE evento = 'message.received'),
x AS (
  SELECT g.fecha, g.documento, g.causal, g.canal, g.trabajado,
         IFNULL(l.aliado, '(sin aliado)') AS sede,
         IFNULL(l.monto, 0) AS monto,
         g.nota IS NULL OR TRIM(g.nota) = '' AS sin_nota,
         IFNULL(s.firmo, FALSE) AS firmo,
         IFNULL(s.monto_firmado, 0) AS monto_firmado,
         (SELECT COUNT(*) FROM ev
          WHERE ev.tel = RIGHT(REGEXP_REPLACE(l.telefono, r'[^0-9]', ''), 10)
            AND ev.dia >= g.fecha) > 0 AS wa_respondio
  FROM g LEFT JOIN l USING (fecha, documento)
         LEFT JOIN s USING (documento)
  WHERE g.trabajado)
"""


def fnum(v):
    try:
        return int(float(v or 0))
    except (TypeError, ValueError):
        return 0


def main():
    T = {}

    # ---- 1. RESCATE_GESTION: el embudo por dia y sede -------------------
    filas = rq.q(BASE + """
    SELECT CAST(fecha AS STRING) AS fecha, sede,
           COUNT(*) AS casos,
           COUNTIF(canal IN ('Llamada', 'Ambos')) AS llamadas,
           COUNTIF(causal != '%s') AS contesto,
           COUNTIF(causal = '%s') AS colgo,
           COUNTIF(causal = '%s') AS tercero,
           COUNTIF(causal NOT IN ('%s', '%s', '%s')) AS hablo,
           COUNTIF(causal = '%s') AS interesado,
           COUNTIF(firmo) AS firmo,
           SUM(monto) AS monto_trabajado,
           COUNTIF(sin_nota) AS sin_nota
    FROM x GROUP BY 1, 2 ORDER BY 1, 2
    """ % (NO_CONTESTA, COLGO, TERCERO, NO_CONTESTA, COLGO, TERCERO,
           INTERESADO))
    cab = ['fecha', 'sede', 'casos', 'llamadas', 'contesto', 'colgo',
           'tercero', 'hablo', 'interesado', 'firmo', 'monto_trabajado',
           'sin_nota']
    T['RESCATE_GESTION'] = [cab] + [
        [r['fecha'], r['sede']] + [fnum(r[c]) for c in cab[2:]]
        for r in filas]

    # ---- 2. RESCATE_CAUSAL ---------------------------------------------
    filas = rq.q(BASE + """
    SELECT CAST(fecha AS STRING) AS fecha, sede,
           IFNULL(causal, '(sin causal)') AS causal,
           COUNT(*) AS casos, SUM(monto) AS monto
    FROM x GROUP BY 1, 2, 3 ORDER BY 1, 4 DESC
    """)
    T['RESCATE_CAUSAL'] = [['fecha', 'sede', 'causal', 'casos', 'monto']] + [
        [r['fecha'], r['sede'], r['causal'], fnum(r['casos']),
         fnum(r['monto'])] for r in filas]

    # ---- 3. RESCATE_POOL: el desenlace de los casos trabajados ----------
    # OJO: esto NO es el pool completo. El "133 rescatados / $892 M" del
    # correo lo calcula rescatados.resumen(), cuyo SQL no tengo; probe cinco
    # definiciones contra profile_institucion y ninguna lo reproduce. Asi que
    # esta hoja trae el desenlace de lo GESTIONADO, que si es exacto, y el
    # tablero declara que el numero del pool esta pendiente de su fuente.
    filas = rq.q(BASE + """
    SELECT CAST(fecha AS STRING) AS fecha, sede,
           COUNTIF(firmo) AS rescatados,
           SUM(IF(firmo, monto_firmado, 0)) AS monto_rescatado,
           COUNT(*) AS trabajados,
           SUM(monto) AS monto_trabajado
    FROM x GROUP BY 1, 2 ORDER BY 1, 2
    """)
    T['RESCATE_POOL'] = [['fecha', 'sede', 'rescatados', 'monto_rescatado',
                          'trabajados', 'monto_trabajado']] + [
        [r['fecha'], r['sede'], fnum(r['rescatados']),
         fnum(r['monto_rescatado']), fnum(r['trabajados']),
         fnum(r['monto_trabajado'])] for r in filas]

    # ---- 4. RESCATE_WA: la atribucion que el traspaso daba por imposible -
    # eventos_hilos SI tiene los webhooks (message.received INBOUND desde el
    # 31-jul). Responder por WhatsApp despues de la gestion separa 16,0% de
    # firma contra 1,7%: chi2 = 28,5 con Yates, p ~ 1e-7.
    filas = rq.q(BASE + """
    SELECT CAST(fecha AS STRING) AS fecha, sede,
           IF(wa_respondio, 'respondio', 'no') AS grupo,
           COUNT(*) AS casos, COUNTIF(firmo) AS firmaron,
           SUM(IF(firmo, monto_firmado, 0)) AS monto_firmado
    FROM x GROUP BY 1, 2, 3 ORDER BY 1, 2, 3
    """)
    T['RESCATE_WA'] = [['fecha', 'sede', 'grupo', 'casos', 'firmaron',
                        'monto_firmado']] + [
        [r['fecha'], r['sede'], r['grupo'], fnum(r['casos']),
         fnum(r['firmaron']), fnum(r['monto_firmado'])] for r in filas]

    # ---- 5. RESCATE_DESENLACE: en que quedaron los casos trabajados ----
    # Sin esto la tasa de cierre se lee como resultado final, y no lo es: la
    # mayoria sigue aprobada dentro de su ventana de 30 dias.
    filas = rq.q("""
    WITH sd AS (
      SELECT fecha, documento, estado_credito, monto, clinica
      FROM `welli-growth.rescate.seguimiento`
      QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento
                                 ORDER BY capturado_en DESC) = 1)
    SELECT CAST(fecha AS STRING) AS fecha,
           IFNULL(NULLIF(TRIM(clinica), ''), '(sin aliado)') AS sede,
           CASE
             WHEN estado_credito IN ('desembolsado', 'pendiente_desembolso',
                                     'firma_contrato', 'fulfilled') THEN 'firmo'
             WHEN estado_credito = 'approved' THEN 'vivo'
             WHEN estado_credito IN ('not_taken', 'dismissed') THEN 'vencido'
             WHEN estado_credito IS NULL OR TRIM(estado_credito) = ''
               THEN 'sin_cruce'
             ELSE 'otro'
           END AS desenlace,
           COUNT(*) AS casos, SUM(monto) AS monto
    FROM sd GROUP BY 1, 2, 3 ORDER BY 1, 2
    """)
    T['RESCATE_DESENLACE'] = [['fecha', 'sede', 'desenlace', 'casos',
                               'monto']] + [
        [r['fecha'], r['sede'], r['desenlace'], fnum(r['casos']),
         fnum(r['monto'])] for r in filas]

    # ---- 6. RESCATE_HIST: los 22 meses anteriores ----------------------
    # gestion_historica: 36.281 filas, oct-2024 a jul-2026, CERO solape con
    # gestion (verificado). Pero NO es la misma operacion:
    #   · la registran 15 a 21 personas por mes, no una — es el equipo
    #     comercial entero, con picos de 560 casos/dia
    #   · no hay priorizacion: se gestionaba todo, no una lista de 52
    #   · otra taxonomia: razon_rechazo dice "No contesta" en 19% de los
    #     casos contra 45% de causal en la tabla viva. Son 26 puntos de
    #     diferencia de FORMULARIO, no de gestion, y por eso el embudo de
    #     contacto NO se puede unir entre las dos.
    #   · otra medicion de la firma: marcado_firma_credito contra el cruce
    #     con seguimiento.
    # Lo comparable es volumen, firmas y tasa de cierre. Va como contexto,
    # con la discontinuidad marcada, no como serie continua.
    filas = rq.q("""
    SELECT FORMAT_DATE('%Y-%m', fecha_seguimiento) AS mes,
           COUNT(*) AS casos,
           COUNTIF(marcado_firma_credito) AS firmas,
           COUNT(DISTINCT comercial) AS personas,
           COUNTIF(medio_contacto = 'Hilos') AS por_whatsapp,
           COUNTIF(medio_contacto = 'Llamada') AS por_llamada
    FROM `welli-growth.rescate.gestion_historica`
    WHERE tiene_gestion = 'True' AND fecha_seguimiento IS NOT NULL
    GROUP BY 1 ORDER BY 1
    """)
    T['RESCATE_HIST'] = [['mes', 'casos', 'firmas', 'personas',
                          'por_whatsapp', 'por_llamada']] + [
        [r['mes']] + [fnum(r[c]) for c in ('casos', 'firmas', 'personas',
                                           'por_whatsapp', 'por_llamada')]
        for r in filas]

    json.dump(T, io.open('tables_rescate.json', 'w', encoding='utf8'),
              ensure_ascii=False)

    print('tables_rescate.json escrito')
    for k, v in T.items():
        print('  %-18s %5d filas' % (k, len(v) - 1))

    # Cuadre contra lo que ya sabemos, para no publicar a ciegas.
    g = T['RESCATE_GESTION']
    ix = {c: i for i, c in enumerate(g[0])}
    tot = collections.Counter()
    for r in g[1:]:
        for c in ('casos', 'llamadas', 'contesto', 'colgo', 'hablo',
                  'interesado', 'firmo'):
            tot[c] += r[ix[c]]
    print('\nCUADRE')
    print('  casos trabajados   %4d   (esperado 499: 529 filas menos la trampa 4)'
          % tot['casos'])
    print('  contesto           %4d   (%.1f%%)'
          % (tot['contesto'], 100.0 * tot['contesto'] / max(1, tot['casos'])))
    print('  colgo              %4d' % tot['colgo'])
    print('  hablo              %4d' % tot['hablo'])
    print('  interesado         %4d   (esperado 19)' % tot['interesado'])
    print('  firmaron           %4d   (esperado 19)' % tot['firmo'])
    wa = T['RESCATE_WA']
    iw = {c: i for i, c in enumerate(wa[0])}
    for grp in ('respondio', 'no'):
        cs = sum(r[iw['casos']] for r in wa[1:] if r[iw['grupo']] == grp)
        fs = sum(r[iw['firmaron']] for r in wa[1:] if r[iw['grupo']] == grp)
        print('  wa=%-10s     %4d casos, %2d firmas (%.1f%%)'
              % (grp, cs, fs, 100.0 * fs / max(1, cs)))


if __name__ == '__main__':
    main()
