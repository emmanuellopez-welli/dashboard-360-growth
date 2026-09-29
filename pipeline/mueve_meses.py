# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
old = """      generado: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm')
    },
    estado: estado,
    // Los meses que tienen dato, para poblar el selector. Se sacan del rango
    // real de las fuentes fechadas en vez de una lista fija, asi el selector
    // no ofrece meses vacios ni se queda corto cuando entren datos nuevos.
    mesesDatos: mesesConDatos_(),
    textos: cfg
  };"""
new = """      generado: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
      // Los meses que tienen dato, para poblar el selector. Se sacan del
      // rango real de las fuentes fechadas en vez de una lista fija, asi el
      // selector no ofrece meses vacios ni se queda corto cuando entre dato
      // nuevo. Va en meta porque es el frontend quien lo consume.
      mesesDatos: mesesConDatos_()
    },
    estado: estado,
    textos: cfg
  };"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('mesesDatos movido a meta')
