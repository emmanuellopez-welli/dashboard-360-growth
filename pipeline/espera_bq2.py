# -*- coding: utf-8 -*-
"""Sale con 0 cuando la vista de fechas unificadas se pueda leer."""
import sys, io, lib, re
act = [i for i in getattr(lib.C.connected_accounts.list(), 'items', [])
       if str(getattr(getattr(i, 'toolkit', None), 'slug', '')) == 'googlebigquery'
       and getattr(i, 'status', '') == 'ACTIVE']
for c in act:
    cid = getattr(c, 'id')
    s = io.open('rq.py', encoding='utf8').read()
    io.open('rq.py', 'w', encoding='utf8').write(
        re.sub(r"CONEXION = '[^']+'", "CONEXION = '%s'" % cid, s))
    try:
        import importlib, rq
        importlib.reload(rq)
        n = rq.q('SELECT COUNT(*) AS n FROM '
                 '`welli-data.data_ops.v_datos_hubspot`',
                 proy='welli-data', loc='us-central1')
        print('OK con %s · %s filas en la vista' % (cid, n[0]['n']))
        sys.exit(0)
    except Exception as e:
        print('  %s -> %s' % (cid, str(e)[:90]))
print('todavia sin acceso')
sys.exit(1)
