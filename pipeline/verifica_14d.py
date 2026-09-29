# -*- coding: utf-8 -*-
"""
Verificacion INDEPENDIENTE del dato "aprobados sin whatsapp, ultimos 14
dias" antes de que se lo informen al CEO. Codigo escrito desde cero (no
reusa probe_14d.py), y chequea cosas que el primer calculo no valido:

  1. Duplicados por DOCUMENTO (no solo por telefono): si un paciente aplico
     mas de una vez, no se debe contar dos veces.
  2. Calidad de la normalizacion de telefono: cuantos numeros, de cada
     lado, NO tienen exactamente 10 digitos utiles despues de limpiar --
     ahi es donde un cruce por "ultimos 10 digitos" puede fallar (de mas o
     de menos).
  3. Que el subconjunto de 14 dias sea де verdad un subconjunto del total
     historico de aprobados (mismo criterio estado='approved'), como
     control de coherencia.
  4. Cobertura real del webhook en la ventana (dias con evento vs dias de
     la ventana), para poder decir si el hueco es realista o es un corte
     de datos.
  5. Un segundo metodo de conteo (JOIN en SQL sobre los ultimos 10 digitos
     via subquery, en vez de cruzar a mano en Python) para comparar contra
     el primer numero sin depender del mismo codigo.
"""
import lib, re, datetime, collections

def norm(t):
    d = re.sub(r'\D', '', str(t or ''))
    return d[-10:] if len(d) >= 10 else d   # deja corto visible, no lo trunca a nada

HOY = datetime.date(2026, 9, 8)
DESDE = HOY - datetime.timedelta(days=14)

# ---- 1. la base de aprobados en la ventana, esta vez con documento Y sin
#         dedupear todavia, para poder medir duplicados ------------------
ap = lib.bq("""
  SELECT documento, nro_celular_paciente,
         DATE(fecha_solicitud, "America/Bogota") AS fecha_bog
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND DATE(fecha_solicitud, "America/Bogota") >= DATE_SUB(CURRENT_DATE("America/Bogota"), INTERVAL 14 DAY)
""", project='welli-data')
print('filas crudas (estado=approved, ultimos 14 dias):', len(ap))

docs = collections.Counter(r['documento'] for r in ap)
dup_docs = {d: n for d, n in docs.items() if n > 1}
print('documentos duplicados (>1 solicitud aprobada en la ventana):', len(dup_docs))
if dup_docs:
    ejemplos = list(dup_docs.items())[:5]
    print('  ejemplos:', ejemplos)

con_tel = [r for r in ap if r['nro_celular_paciente'] and str(r['nro_celular_paciente']).strip()]
print('con celular no vacio:', len(con_tel), 'de', len(ap),
      '(%d sin celular, quedan fuera del cruce)' % (len(ap) - len(con_tel)))

# calidad del telefono: longitud tras limpiar no-digitos
largos = collections.Counter(len(re.sub(r'\D', '', str(r['nro_celular_paciente']))) for r in con_tel)
print('distribucion de longitud de celular (despues de limpiar):', dict(sorted(largos.items())))

# dedupe por documento (no por telefono esta vez), quedandome con la
# solicitud mas reciente si hay mas de una
por_doc = {}
for r in con_tel:
    d = r['documento']
    if d not in por_doc or r['fecha_bog'] > por_doc[d]['fecha_bog']:
        por_doc[d] = r
print('pacientes UNICOS por documento (con celular) en la ventana:', len(por_doc))

# ---- 2. eventos outbound: calidad del telefono tambien -----------------
msg = lib.bq("""
  SELECT telefono, direccion, evento, DATE(ts_evento,"America/Bogota") AS dia
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion = 'OUTBOUND'
    AND DATE(ts_evento,"America/Bogota") >= DATE_SUB(CURRENT_DATE("America/Bogota"), INTERVAL 60 DAY)
""", project='welli-data', location='US')
print('\neventos OUTBOUND ultimos 60 dias (para tener contexto amplio):', len(msg))
largos_msg = collections.Counter(len(re.sub(r'\D', '', str(r['telefono']))) for r in msg)
print('distribucion de longitud de telefono en eventos_hilos:', dict(sorted(largos_msg.items())))

dias_con_evento = set(r['dia'] for r in msg if r['dia'])
dias_ventana = set()
d = DESDE
while d <= HOY:
    dias_ventana.add(d.isoformat())
    d += datetime.timedelta(days=1)
huecos = sorted(dias_ventana - dias_con_evento)
print('dias de la ventana de 14d SIN ningun evento outbound registrado:', huecos)

msgTel = set(norm(r['telefono']) for r in msg if r['telefono'])
# tambien traigo el historico completo (sin corte de 60d) para el cruce real
msg_full = lib.bq("""
  SELECT DISTINCT RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10) AS tel
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion = 'OUTBOUND'
""", project='welli-data', location='US')
msgTelFull = set(r['tel'] for r in msg_full if r['tel'])
print('telefonos unicos con outbound, historico completo:', len(msgTelFull))

# ---- 3. metodo 1: cruce en Python sobre por_doc (paciente unico) -------
sin_msj_doc = [d for d, r in por_doc.items() if norm(r['nro_celular_paciente']) not in msgTelFull]
print('\nMETODO 1 (unico por documento):')
print('  pacientes aprobados con celular en la ventana:', len(por_doc))
print('  sin ningun mensaje outbound:', len(sin_msj_doc),
      '(%.1f%%)' % (100.0 * len(sin_msj_doc) / len(por_doc)))

# ---- 4. metodo 2: el mismo cruce pero por TELEFONO unico (como el primer
#         calculo), para ver si documento vs telefono cambia el numero ---
tels_unicos = {}
for r in con_tel:
    t = norm(r['nro_celular_paciente'])
    if t not in tels_unicos or r['fecha_bog'] > tels_unicos[t]['fecha_bog']:
        tels_unicos[t] = r
sin_msj_tel = [t for t in tels_unicos if t not in msgTelFull]
print('\nMETODO 2 (unico por telefono, como el calculo anterior):')
print('  telefonos aprobados unicos en la ventana:', len(tels_unicos))
print('  sin ningun mensaje outbound:', len(sin_msj_tel),
      '(%.1f%%)' % (100.0 * len(sin_msj_tel) / len(tels_unicos)))

# ---- 5. control de coherencia: subconjunto del total historico ---------
ap_total = lib.bq("""
  SELECT DISTINCT RIGHT(REGEXP_REPLACE(nro_celular_paciente, r'[^0-9]', ''), 10) AS tel
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
""", project='welli-data')
tot_set = set(r['tel'] for r in ap_total if r['tel'])
fuera = [t for t in tels_unicos if t not in tot_set]
print('\ncontrol de coherencia: telefonos de la ventana de 14d que NO estan',
      'en el total historico de aprobados (deberia ser 0):', len(fuera))
print('total historico de aprobados con celular:', len(tot_set))
