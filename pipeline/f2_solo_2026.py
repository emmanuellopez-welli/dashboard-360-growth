# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

# El piso va como constante y no como literal suelto: los cinco mapas tienen
# que arrancar en el mismo mes o dejan de ser comparables entre si.
anc = """/* =====================================================================
   FRENTE 2 · PROFUNDIZACION"""
nuevo = """/* Primera cosecha que entra a profundizacion. Las de 2025 arrastran la
   migracion a HubSpot y un pipeline que ya no existe, asi que ensucian la
   comparacion entre cosechas sin aportar nada accionable. Si algun dia se
   quiere ver mas historia, se cambia aca y los cinco mapas la toman juntos. */
var COSECHA_PISO_F2 = '2026-01';

""" + anc
assert anc in s and 'COSECHA_PISO_F2' not in s
s = s.replace(anc, nuevo, 1)

# el corte, en el unico lugar donde se arman las cosechas del frente
old = """  U.filas.forEach(function (s) {
    var c = String(s.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(c) || esCargaInicial_(c)) return;
    if (!cos[c]) cos[c] = { cosecha: c, ids: [], total: 0, sinId: 0 };"""
new = """  U.filas.forEach(function (s) {
    var c = String(s.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(c) || esCargaInicial_(c)) return;
    if (c < COSECHA_PISO_F2) return;
    if (!cos[c]) cos[c] = { cosecha: c, ids: [], total: 0, sinId: 0 };"""
assert old in s
s = s.replace(old, new, 1)

# la nota del subtitulo, que hoy solo habla de la carga inicial
old2 = """  f.notaCarga = 'Se excluye la cosecha ' + COSECHA_CARGA_INICIAL +
    ': ahí se cargó la base histórica a HubSpot de un golpe.';"""
new2 = """  f.notaCarga = 'Desde ' + COSECHA_PISO_F2 + ': las cosechas de 2025 arrastran ' +
    'la migración a HubSpot (la de ' + COSECHA_CARGA_INICIAL + ' son 1.922 sedes ' +
    'cargadas de golpe) y un pipeline que ya no existe.';"""
assert old2 in s
io.open(p, 'w', encoding='utf8').write(s.replace(old2, new2, 1))
print('F2: piso en 2026-01')
