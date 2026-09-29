# -*- coding: utf-8 -*-
"""Crea un Google Sheet aparte con las 26 sedes de 2026 sin id_internal, para
que el equipo les llene la vinculacion de plataforma (no para mandarselo a
BI: el conteo ya cuadra con ellos sin excluir nada, este es un problema de
completar dato, no de universo)."""
import lib, json, io

filas = [
 ['cosecha', 'nombre_sede', 'id_hubspot', 'link_hubspot', 'origen', 'nota'],
]

DATA = [
 ('2026-01', 'TJD Ingenieros/Sede principal', '45698417211', '', 'DESHABILITADA'),
 ('2026-01', 'Dra. Danya Parra G.', '45711266896', 'PAGINA WEB', ''),
 ('2026-01', 'Delgado Lady Vanessa', '45697393204', 'SOCIAL MEDIA', ''),
 ('2026-01', 'Dra. Samira Acosta Ejach', '45626168997', '', ''),
 ('2026-01', 'Dra Viviana Lucia Cubillos Moncayo', '45720344964', 'PROSPECCION', ''),
 ('2026-01', 'Insignia Studio Dental', '45721234233', 'PAGINA WEB', ''),
 ('2026-01', 'Oral People SAS', '45619577780', '', ''),
 ('2026-01', 'Dra Melissa Lugo', '46291548166', 'FARMER', ''),
 ('2026-01', 'Andres Fernando Santos Rodriguez', '46768457396', 'INVISALIGN', ''),
 ('2026-02', 'Dra Silvia Prada', '48796984330', 'FARMER', ''),
 ('2026-02', 'Instituto de Cirugia Maxilofacial del Caribe Cartagena', '49066502662', '', ''),
 ('2026-03', 'Dr Juan Urrea', '49470730918', 'SOCIAL MEDIA', ''),
 ('2026-03', 'Clinica Somer', '50163251575', 'EVENTO', ''),
 ('2026-04', 'Dra. Ingrid M. Insignares A. Ortodoncia y Estetica', '51198748463', 'SOCIAL MEDIA', ''),
 ('2026-04', 'Centro Oncologico de Antioquia - COA', '52252239195', 'PROSPECCION', ''),
 ('2026-04', 'Clinica Medellin', '53393580837', 'PROSPECCION', ''),
 ('2026-05', 'Clinica de Marly SAS', '56514020686', 'PROSPECCION', ''),
 ('2026-06', 'Dr Amaury Amaris Vergara', '57701703076', 'BOSTON', ''),
 ('2026-07', 'Neo Laser Pereira', '58317511569', 'PAGINA WEB', ''),
 ('2026-07', 'Neo Laser Cali', '58317574051', 'PAGINA WEB', ''),
 ('2026-08', 'Consultorio Medico Odontologico Dentalinnvova', '60098896446', 'EVENTO', ''),
 ('2026-08', 'Dental Clinic 10 S.A.S', '60246484555', 'DT DENTAL', ''),
 ('2026-08', 'Dr Sergio Santafe', '61035973520', 'HUNTER', ''),
 ('2026-08', 'Vital Dent PJ', '61038670461', 'DT DENTAL', ''),
 ('2026-09', 'Lovelly Spa', '61186495580', 'FARMER', ''),
 ('2026-09', 'Dra Juliana Buitrago', '61241769084', 'SOCIAL MEDIA', ''),
]

HUBSPOT_PORTAL = '50421361'
HUBSPOT_OBJ = '2-50958246'
for cos, nombre, hs_id, origen, nota in DATA:
    link = 'https://app.hubspot.com/contacts/%s/record/%s/%s' % (HUBSPOT_PORTAL, HUBSPOT_OBJ, hs_id)
    filas.append([cos, nombre, hs_id, link, origen, nota])

TITLE = 'Sedes sin id_internal 2026 - completar vinculacion'
r = lib.ex('GOOGLESHEETS_CREATE_GOOGLE_SHEET1', {'title': TITLE})
if not r.get('successful', r.get('successfull')):
    raise RuntimeError(json.dumps(r)[:500])
sid = r['data']['spreadsheetId']
print('creado sheet', sid)

r2 = lib.ex('GOOGLESHEETS_BATCH_UPDATE', {
    'spreadsheet_id': sid, 'sheet_name': 'Sheet1', 'values': filas,
    'first_cell_location': 'A1', 'valueInputOption': 'RAW'})
print('escritura:', r2.get('successful', r2.get('successfull')))

print()
print('URL: https://docs.google.com/spreadsheets/d/%s/edit' % sid)
