# -*- coding: utf-8 -*-
"""Devuelve 0 en cuanto la conexion de BigQuery quede ACTIVE."""
import sys, lib
items = getattr(lib.C.connected_accounts.list(), 'items', [])
act = [i for i in items
       if str(getattr(getattr(i, 'toolkit', None), 'slug', '')) == 'googlebigquery'
       and getattr(i, 'status', '') == 'ACTIVE']
if act:
    print('ACTIVE: %s' % getattr(act[0], 'id', '?'))
    sys.exit(0)
est = [getattr(i, 'status', '?') for i in items
       if str(getattr(getattr(i, 'toolkit', None), 'slug', '')) == 'googlebigquery']
print('todavia no: %s' % ', '.join(est))
sys.exit(1)
