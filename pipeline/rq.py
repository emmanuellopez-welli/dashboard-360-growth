# -*- coding: utf-8 -*-
"""
Helper para consultar welli-growth.rescate.

DOS COSAS QUE NO SON OBVIAS Y COSTARON UNA HORA:

1. El dataset `rescate` vive en la multi-region **US**, no en us-central1
   como el resto de WELLI (welli-tecnologia.public y welli-data.comercial_ops).
   BigQuery reporta el desajuste de location con el mensaje
   "User does not have permission to query table", que parece un problema de
   IAM y no lo es. Si aparece ese error: revisar location ANTES de pedir
   permisos.

2. La cuenta dedicada `ca_lLXjcxMOKDpu` que se uso para probar el acceso el
   3-sep-2026 quedo EXPIRED. Con el acceso real a welli-growth ya restaurado
   (8-sep-2026) se prueba que ni siquiera hace falta esa cuenta dedicada: el
   connected account POR DEFECTO de lib.bq() ya llega a welli-growth.rescate
   con project=welli-data, location=US, igual que refreshWelliPoints con
   wp_data. Se deja de usar la cuenta dedicada por completo.
"""
import lib

JOB_PROJ = 'welli-data'
LOC = 'US'


def q(sql, proy=JOB_PROJ, loc=LOC):
    return lib.bq(sql, project=proy, location=loc)
