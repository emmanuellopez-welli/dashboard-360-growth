# -*- coding: utf-8 -*-
"""Re-pulls PLATAFORMA_SEDES agregando nombre_comercial y, desde
21-sep-2026, email_notificaciones.

Por que el email: se encontro que excluir marcas (Sonria/Dentisalud/
OdontoFamily/CityDent, ver CLAUDE.md seccion 35) SOLO por nombre_sede deja
huecos -- "City Suba" es una sede de CityDent cuyo nombre_comercial en
institucion_medica NO dice "citydent" en ningun lado, solo el correo
(citydentsuba@yahoo.co) delata la cadena real. El nombre comercial de una
cadena grande es inconsistente entre sedes; el correo de facturacion casi
siempre lo es. wpExcluidas_() en Code.gs ahora cruza por los DOS campos.

Por que el nombre (ya existia): acordado con BI el 9-sep-2026 contar TODAS
las cuentas de plataforma, incluso las que no tienen ficha en HubSpot
(universoSedes_ ahora las inyecta como sede sintetica). Esa sede sintetica
necesita un nombre para mostrarse en el tablero -- antes PLATAFORMA_SEDES
solo traia id_sede/pais/created/especialidad."""
import lib, json, io

plat = lib.bq("""
SELECT id, IFNULL(country_code,'COL') AS pais,
       CAST(DATE(created, "America/Bogota") AS STRING) AS created,
       IFNULL(especialidad,'') AS especialidad,
       IFNULL(nombre_comercial, IFNULL(razon_social, '')) AS nombre,
       IFNULL(email_notificaciones, '') AS email
FROM `welli-tecnologia.public.institucion_medica`""", project='welli-tecnologia')

T = {'PLATAFORMA_SEDES': [['id_sede', 'pais', 'created', 'especialidad', 'nombre', 'email']] +
     [[r['id'], r['pais'], r['created'], r['especialidad'], r['nombre'], r['email']] for r in plat]}
col = sum(1 for r in plat if r['pais'] == 'COL')
print('%d sedes  (%d COL, %d otras)' % (len(plat), col, len(plat) - col))
sin_nombre = sum(1 for r in plat if not r['nombre'])
print('sin nombre_comercial ni razon_social: %d' % sin_nombre)

json.dump(T, io.open('tables_plataforma_nombre.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_plataforma_nombre.json')
