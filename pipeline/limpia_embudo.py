# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
L = io.open(p, encoding='utf8').read().split('\n')

# El bloque viejo de EMBUDO_* ya no alimenta nada: cA/cP se sobrescriben
# siempre con el corte de cohorte y serieSolicitudes no se pinta. Se elimina
# entero, que ademas saca dos hojas de 9.668 filas del bundle del artefacto.
ini = next(i for i, l in enumerate(L) if 'var ORIG_MKT_CRUDO' in l)
while ini > 0 and L[ini - 1].strip().startswith('//'):
    ini -= 1
fin = next(i for i, l in enumerate(L)
           if 'LA SECCION 5 se acota a la COSECHA' in l or
              '---- La seccion 5 se acota a la COSECHA' in l)
print('elimino lineas %d-%d (%d)' % (ini + 1, fin, fin - ini))
print('  primera:', L[ini].strip()[:64])
print('  ultima :', L[fin - 1].strip()[:64])
L = L[:ini] + L[fin:]
s = '\n'.join(L)

# lo que quedaba referenciando el bloque viejo
s = s.replace("""    hay: hayEm,""", """    hay: hayCoh,""")
s = s.replace("""    hayAp: hayAp,\n""", "")
s = s.replace("""        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: !hayEm ? notaEm : (hayCoh""",
              """        fuente: 'BigQuery · profile_institucion',
        nota: (hayCoh""")
s = s.replace("""        pendiente: !hayAp, fuente: 'BigQuery · profile_institucion',""",
              """        fuente: 'BigQuery · profile_institucion',""")
s = s.replace("""        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: 'De los créditos que el motor APROBÓ""",
              """        fuente: 'BigQuery · profile_institucion',
        nota: 'De los créditos que el motor APROBÓ""")
s = s.replace("""        pendiente: !hayEm, fuente: 'BigQuery · profile_institucion',
        nota: !hayEm ? notaEm : (hayCoh
          ? 'Es lo que rindió la adquisición DEL PERÍODO""",
              """        fuente: 'BigQuery · profile_institucion',
        nota: (hayCoh
          ? 'Es lo que rindió la adquisición DEL PERÍODO""")
s = s.replace("""    serieSolicitudes: serieAgrupada_(sSol, gran, R),\n""", "")
s = s.replace("""    serieRevenue: hayCoh
      ? Object.keys(cA.dia).sort().map(function (k) {
          return { x: k, y: cA.dia[k] };
        })
      : serieAgrupada_(sMonto, gran, R),""",
              """    serieRevenue: Object.keys(cA.dia || {}).sort().map(function (k) {
      return { x: k, y: cA.dia[k] };
    }),""")
io.open(p, 'w', encoding='utf8').write(s)
print('bloque viejo eliminado')
