# -*- coding: utf-8 -*-
"""Comprime CREDITO_DIA: la fecha a dias desde 2025-01-01 y la sede a un
indice compacto. Sobre 116 mil filas eso baja la tabla de 5,60 a 3,58 MB, que
es la diferencia entre caber en el artefacto con margen o al filo.

El indice se emite EN EL MISMO archivo (CREDITO_SEDES), asi que no puede
desincronizarse de los hechos: los dos salen de la misma pasada."""
import json, io, datetime

T = json.load(io.open('tables_cdia.json', encoding='utf8'))['CREDITO_DIA']
BASE = datetime.date(2025, 1, 1)


def dia(s):
    return (datetime.date(int(s[:4]), int(s[5:7]), int(s[8:10])) - BASE).days


sedes = sorted(set(f[0] for f in T[1:]))
ix = {s: i for i, s in enumerate(sedes)}

hechos = [['s', 'd', 'sol', 'apr', 'conv', 'm_apr', 'm_conv']]
for f in T[1:]:
    hechos.append([ix[f[0]], dia(f[1]), f[2], f[3], f[4], f[5], f[6]])

idx = [['i', 'sede']] + [[i, s] for i, s in enumerate(sedes)]

out = {'CREDITO_DIA': hechos, 'CREDITO_SEDES': idx}
json.dump(out, io.open('tables_cdia.json', 'w', encoding='utf8'), ensure_ascii=False)
print('CREDITO_DIA    %6d filas  %.2f MB' % (len(hechos) - 1,
      len(json.dumps(hechos, ensure_ascii=False)) / 1048576.0))
print('CREDITO_SEDES  %6d filas  %.2f MB' % (len(idx) - 1,
      len(json.dumps(idx, ensure_ascii=False)) / 1048576.0))
print('base de dias: 2025-01-01')
