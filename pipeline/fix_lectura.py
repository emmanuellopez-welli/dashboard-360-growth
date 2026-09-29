# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
old = """      return 'La ventana larga concentra ' + fPctSrv_(A_.pct16a30) +
        ' de sus firmas entre el día 16 y el 30, contra ' + fPctSrv_(C_.pct16a30) +
        ' de la corta: el rescate sirve en cirugía plástica, no en odontología. ' +
        'Y los ' + fCopSrv_(vivoTardio) + ' que hoy están en día 16 a 30 son los que ' +
        'se pierden si nadie escribe.';"""
new = """      // La lectura se arma con los numeros del periodo, no a mano, para que
      // no se desincronice. Ahora habla de CIERRE por ventana, que es lo que
      // el frente mide desde que dejo de contar el stock historico.
      var oC = null, oA = null;
      ((f.oportunidad && f.oportunidad.filas) || []).forEach(function (r) {
        if (r.id === 'C') oC = r;
        if (r.id === 'A') oA = r;
      });
      var base = 'La ventana larga concentra ' + fPctSrv_(A_.pct16a30) +
        ' de sus firmas entre el día 16 y el 30, contra ' + fPctSrv_(C_.pct16a30) +
        ' de la corta: el rescate sirve en cirugía plástica, no en odontología.';
      if (oC && oA && oC.apr && oA.apr) {
        base += ' Y cierra ' + fPctSrv_(oA.pct) + ' de lo que le aprueban contra ' +
          fPctSrv_(oC.pct) + ' de la corta, así que ahí están los ' +
          fCopSrv_(oA.mSinCerrar) + ' que se quedaron sin firmar.';
      }
      return base;"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('lectura reescrita')
