# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()
old = """    h += filaKPIs(em.kpis);

    if (em.hay) {"""
new = """    h += filaKPIs(em.kpis);

    // Sin esta linea la seccion se lee como el total del mes. No lo es: es
    // solo la cosecha nueva, y pesa ~1%. Decirlo aqui evita el malentendido
    // y de paso es el mejor argumento para el frente 2.
    if (em.contexto) {
      h += '<div class="lectura">Es la cosecha nueva, no el mes completo: ' +
        'estas ' + fNum(em.sedes) + ' sedes pusieron ' + fPct(em.contexto.pctMonto) +
        ' de la plata del período (' + fCopC(em.contexto.monto) + ' en total, ' +
        fNum(em.contexto.sol) + ' solicitudes). Los otros ' +
        fCopC(em.contexto.montoResto) + ' los pusieron sedes que entraron en meses ' +
        'anteriores — por eso el negocio se sostiene en el stock, no en la ' +
        'adquisición del mes.</div>';
    }

    if (em.hay) {"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('linea de contexto agregada')
