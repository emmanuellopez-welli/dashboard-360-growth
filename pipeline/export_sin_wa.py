# -*- coding: utf-8 -*-
"""Exporta a Excel los pacientes aprobados de los ultimos 14 dias que NO
recibieron ningun mensaje de WhatsApp (direccion OUTBOUND en eventos_hilos).
Mismo criterio ya verificado en verifica_14d.py, con nombre y monto
agregados para que la lista sea accionable."""
import lib, re, datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

HOY = datetime.date(2026, 9, 8)

ap = lib.bq("""
  SELECT documento, nombre_paciente, nro_celular_paciente, monto_aprobado,
         id_clinica, nombre_comercial, especialidad,
         DATE(fecha_solicitud, "America/Bogota") AS fecha_bog
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
    AND DATE(fecha_solicitud, "America/Bogota") >= DATE_SUB(CURRENT_DATE("America/Bogota"), INTERVAL 14 DAY)
""", project='welli-data')

msg_full = lib.bq("""
  SELECT DISTINCT RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10) AS tel
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion = 'OUTBOUND'
""", project='welli-data', location='US')
msgTelFull = set(r['tel'] for r in msg_full if r['tel'])

por_doc = {}
for r in ap:
    d = r['documento']
    if d not in por_doc or r['fecha_bog'] > por_doc[d]['fecha_bog']:
        por_doc[d] = r

sin_msj = [r for r in por_doc.values() if norm(r['nro_celular_paciente']) not in msgTelFull]
sin_msj.sort(key=lambda r: r['fecha_bog'])

print('total aprobados en la ventana:', len(por_doc))
print('sin ningun mensaje de WhatsApp:', len(sin_msj))

wb = Workbook()
ws = wb.active
ws.title = 'Sin WhatsApp (14d)'

cab = ['Documento', 'Nombre paciente', 'Celular', 'Fecha solicitud',
       'Monto aprobado', 'Clínica', 'Especialidad']
ws.append(cab)
for c in range(1, len(cab) + 1):
    cell = ws.cell(row=1, column=c)
    cell.font = Font(bold=True, color='FFFFFF')
    cell.fill = PatternFill(start_color='2E7D32', end_color='2E7D32', fill_type='solid')

for r in sin_msj:
    ws.append([
        r['documento'],
        r['nombre_paciente'] or '',
        r['nro_celular_paciente'] or '',
        r['fecha_bog'],
        float(r['monto_aprobado']) if r['monto_aprobado'] is not None else None,
        r['nombre_comercial'] or '',
        r['especialidad'] or ''
    ])

anchos = [14, 28, 14, 16, 16, 26, 22]
for i, a in enumerate(anchos, 1):
    ws.column_dimensions[get_column_letter(i)].width = a

ws.freeze_panes = 'A2'

# Hoja de resumen, para que el archivo se explique solo.
ws2 = wb.create_sheet('Resumen')
ws2.append(['Ventana', '%s a %s (America/Bogota)' % (HOY - datetime.timedelta(days=14), HOY)])
ws2.append(['Aprobados (vivos, sin firmar) con celular en la ventana', len(por_doc)])
ws2.append(['Sin ningún mensaje de WhatsApp (OUTBOUND)', len(sin_msj)])
ws2.append(['% sin contactar', round(100.0 * len(sin_msj) / len(por_doc), 1)])
ws2.append(['Fuente', 'welli-data.comercial_ops.t_sol_v2 (aprobados) '
            'cruzado por celular contra welli-growth.rescate.eventos_hilos (mensajes enviados)'])
ws2.append(['Generado', datetime.datetime.now().strftime('%Y-%m-%d %H:%M')])
ws2.column_dimensions['A'].width = 45
ws2.column_dimensions['B'].width = 50

wb.save('Aprobados_sin_WhatsApp_14d.xlsx')
print('escrito Aprobados_sin_WhatsApp_14d.xlsx')
