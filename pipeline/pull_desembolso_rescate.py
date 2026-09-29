# -*- coding: utf-8 -*-
"""
DESEMBOLSO_RESCATE_DIA: los desembolsos que son RESULTADO DE RESCATE, por
dia -- no "toda la empresa" (eso fue un error de la primera version de
este script, ver mas abajo).

CORRECCION IMPORTANTE (9-sep-2026): la version anterior de este pull traia
TODOS los desembolsos de la empresa, sin importar si necesitaron rescate o
no. Eso estaba mal para esta pestana: Rescate es un frente con una
poblacion propia (creditos aprobados que casi se pierden), y Kevin es
UNA PALANCA de ese frente -- el negocio va a sumar mas palancas despues, y
la meta de plata tiene que seguir siendo "lo que rescato CUALQUIER
palanca", no "todo lo que la empresa desembolso".

La query es la misma que uso la jefa la primera vez (tablas, estados,
join), esta vez CON el filtro que se habia quitado por error:

  DATE_DIFF(fecha_firma_contrato, creado, DAY) > 2

Ese filtro es la definicion misma de "rescate": un credito que firma en
0, 1 o 2 dias se convirtio SOLO, organico, sin que ninguna palanca
tuviera que intervenir. Uno que tarda mas de 2 dias es, por definicion,
un caso que en algun punto se hubiera perdido si nadie lo hubiera
trabajado -- sea con la gestion de Kevin hoy, o con la palanca que sea
manana. Quitar ese filtro (como se hizo la primera vez) mezclaba las dos
poblaciones y disparaba la meta a una escala que no tenia nada que ver
con rescate (42x la de Kevin, en vez de las ~3x que da con el filtro
puesto -- un numero mucho mas creible para "todo lo que se rescato,
incluyendo lo que Kevin no alcanzo a tocar").

  estados == 'desembolsado', 'pendiente_desembolso', 'fulfilled',
             'firma_contrato'   (profile_institucion)
  fecha  == fecha_firma_contrato (t_solicitudes)
  monto  == monto_aprobado (profile_institucion)
  llave  == referencia_pago, con t_solicitudes deduplicada por la fila mas
            reciente (mayor fecha_corte_solicitud).

Las dos tablas viven en us-central1 (welli-tecnologia y welli-data), asi
que es una sola query -- sin el cruce entre regiones que necesitan los
datos de WhatsApp.
"""
import io
import json

import lib

PISO = '2024-01-01'

SQL = """
WITH p AS (
  SELECT referencia_pago, DATE(created) AS creado, monto_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado IN ('desembolsado', 'pendiente_desembolso', 'fulfilled', 'firma_contrato')
), s AS (
  SELECT referencia_pago, fecha_firma_contrato,
         ROW_NUMBER() OVER (PARTITION BY referencia_pago
                            ORDER BY fecha_corte_solicitud DESC) AS rn
  FROM `welli-data.data_ops.t_solicitudes`
)
SELECT CAST(s.fecha_firma_contrato AS STRING) AS fecha,
       COUNT(*) AS casos,
       SUM(p.monto_aprobado) AS monto
FROM p JOIN s ON s.referencia_pago = p.referencia_pago AND s.rn = 1
WHERE s.fecha_firma_contrato IS NOT NULL
  AND s.fecha_firma_contrato >= DATE '%s'
  AND DATE_DIFF(s.fecha_firma_contrato, p.creado, DAY) > 2
GROUP BY fecha
ORDER BY fecha
""" % PISO


def main():
    filas = lib.bq(SQL, project='welli-tecnologia')
    cab = ['fecha', 'casos', 'monto']
    T = {'DESEMBOLSO_RESCATE_DIA': [cab] + [
        [r['fecha'], int(r['casos'] or 0), int(float(r['monto'] or 0))]
        for r in filas
    ]}
    json.dump(T, io.open('tables_desembolso_rescate.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('dias con fila:', len(filas))
    tot = sum(int(float(r['monto'] or 0)) for r in filas)
    print('monto total rescate (%s a hoy, >2d hasta firmar): $%d' % (PISO, tot))
    print('rango:', filas[0]['fecha'] if filas else '(vacio)', '->',
          filas[-1]['fecha'] if filas else '')


if __name__ == '__main__':
    main()
