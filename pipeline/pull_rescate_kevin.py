# -*- coding: utf-8 -*-
"""
Llena las tres hojas del contrato de rescate desde welli-growth.rescate.

    python pull_rescate_kevin.py --esquema   # solo imprime el esquema real
    python pull_rescate_kevin.py             # introspecta, mapea y escribe

Corre en DOS pasos a proposito. El esquema de rescate.gestion /
.seguimiento / .lista_dia no lo conozco: en vez de adivinar nombres de
columna y fallar en silencio, el script primero lee
INFORMATION_SCHEMA.COLUMNS, resuelve cada campo del contrato contra los
alias conocidos, y avisa exactamente cual no encontro.

Contrato de salida (lo que lee Code.gs):
  RESCATE_GESTION  fecha | casos | llamadas | contesto | colgo | tercero |
                   hablo | interesado | firmo | monto_trabajado | sin_nota
  RESCATE_CAUSAL   fecha | causal | casos | monto
  RESCATE_POOL     fecha | rescatados | monto_rescatado | churn_casos |
                   churn_monto | pool_trabajable | entraron |
                   entraron_recuperables | monto_recuperable
"""
import sys
import json
import collections

import lib

PROY = 'welli-growth'
DS = 'rescate'
HOJA_ID = None          # se resuelve de Config si hace falta escribir

# Alias por campo del contrato. El primero que exista en la tabla gana.
# Salen de como el analisis de priorizacion nombra las cosas; si la tabla
# usa otro nombre, se agrega aca y no se toca el resto del script.
ALIAS = {
    'fecha': ['fecha', 'fecha_gestion', 'dia', 'date', 'created_at',
              'fecha_registro', 'fecha_corte'],
    'caso': ['id_caso', 'caso_id', 'id', 'credito_id', 'id_credito',
             'documento', 'cedula'],
    'causal': ['causal', 'causal_principal', 'resultado', 'tipificacion',
               'motivo'],
    'canal': ['canal', 'medio'],
    'nota': ['nota', 'observacion', 'comentario', 'notas'],
    'monto': ['monto', 'monto_aprobado', 'valor', 'valor_aprobado'],
    'firmo': ['firmo', 'firmado', 'is_signed', 'desembolsado', 'cerrado'],
    'agente': ['agente', 'asesor', 'usuario', 'owner', 'gestor'],
}

# Que causal cuenta como cada paso del embudo. Es la parte del mapeo que
# NO se puede inferir del esquema: son los valores, no los nombres.
# Verificar contra SELECT DISTINCT antes de dar por bueno el conteo.
EMBUDO = {
    'contesto': ['Cuelga', 'Contesta un tercero', 'Interesado · va a firmar',
                 'Duda de tasa', 'Duda de monto', 'Pospone',
                 'No realiza el tratamiento', 'No lo necesita',
                 'Desconoce la solicitud', 'Ya pagó de contado',
                 'Se fue con otro (Addi/otro)'],
    'colgo': ['Cuelga'],
    'tercero': ['Contesta un tercero'],
    'interesado': ['Interesado · va a firmar'],
}
NO_CONTACTO = ['No contesta']


def q(sql):
    return lib.bq(sql, project=PROY)


def esquema():
    """Columnas reales de las tres tablas."""
    sql = """
    SELECT table_name, column_name, data_type
    FROM `%s.%s.INFORMATION_SCHEMA.COLUMNS`
    ORDER BY table_name, ordinal_position
    """ % (PROY, DS)
    cols = collections.defaultdict(list)
    for r in q(sql):
        cols[r['table_name']].append((r['column_name'], r['data_type']))
    return cols


def resolver(cols_tabla, campo):
    """Primer alias de `campo` que exista en la tabla, o None."""
    nombres = {c.lower(): c for c, _t in cols_tabla}
    for a in ALIAS.get(campo, []):
        if a in nombres:
            return nombres[a]
    return None


def main():
    cols = esquema()
    print('TABLAS EN %s.%s' % (PROY, DS))
    for t in sorted(cols):
        print('\n  %s  (%d columnas)' % (t, len(cols[t])))
        for c, ty in cols[t]:
            print('      %-34s %s' % (c, ty))

    faltan = []
    plan = {}
    for tabla, campos in [('gestion', ['fecha', 'caso', 'causal', 'canal',
                                       'nota', 'monto', 'agente']),
                          ('seguimiento', ['fecha', 'caso', 'firmo', 'monto']),
                          ('lista_dia', ['fecha', 'caso', 'monto'])]:
        if tabla not in cols:
            faltan.append('tabla %s no existe' % tabla)
            continue
        plan[tabla] = {}
        for campo in campos:
            real = resolver(cols[tabla], campo)
            plan[tabla][campo] = real
            if real is None:
                faltan.append('%s.%s sin alias conocido' % (tabla, campo))

    print('\nMAPEO RESUELTO')
    print(json.dumps(plan, indent=2, ensure_ascii=False))

    if faltan:
        print('\nFALTA RESOLVER (agregar el nombre real a ALIAS):')
        for f in faltan:
            print('  - %s' % f)

    # Los valores de causal no se pueden inferir: se listan para verificar
    # el mapeo de EMBUDO antes de contar nada.
    if 'gestion' in plan and plan['gestion'].get('causal'):
        cz = plan['gestion']['causal']
        print('\nVALORES REALES DE %s (para verificar EMBUDO):' % cz)
        sql = ('SELECT `%s` AS causal, COUNT(*) AS n FROM `%s.%s.gestion` '
               'GROUP BY 1 ORDER BY n DESC' % (cz, PROY, DS))
        conocidas = set(sum(EMBUDO.values(), [])) | set(NO_CONTACTO)
        for r in q(sql):
            v = r['causal']
            marca = '' if v in conocidas else '   <-- SIN MAPEAR'
            print('  %6s  %s%s' % (r['n'], v, marca))

    if faltan:
        print('\nNo escribo nada: primero hay que cerrar el mapeo.')
        return 1

    print('\nEsquema resuelto. Siguiente paso: correr con --escribir '
          'para armar las tres hojas.')
    return 0


if __name__ == '__main__':
    if '--esquema' in sys.argv or True:
        sys.exit(main())
