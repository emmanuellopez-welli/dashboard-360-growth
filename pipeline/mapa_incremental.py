# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

# ---------- el mapa incremental, derivado del acumulado ----------
anc = """  /** Titular de un mapa: la ultima celda cerrada de la cosecha mas madura"""
nuevo = """  /* El mismo mapa de plata pero SIN acumular: cuanto se desembolso en ESE
     mes y nada mas. Se deriva restando el acumulado del mes anterior, asi
     que no necesita datos nuevos y no puede desincronizarse del acumulado.

     Los dos mapas responden preguntas distintas y hacen falta los dos: el
     acumulado dice cuanto vale una cosecha a los N meses (el argumento de
     por que profundizacion importa), el incremental dice en que mes de vida
     una cosecha produce de verdad (el argumento de cuando intervenir). */
  function incremental_(filas) {
    return filas.map(function (r) {
      var celdas = [], extras = [];
      var prevN = 0, prevM = 0;
      for (var k = 0; k < r.celdas.length; k++) {
        if (r.celdas[k] === null || r.celdas[k] === undefined) {
          celdas.push(null); extras.push(null);
          continue;
        }
        celdas.push(r.celdas[k] - prevN);
        extras.push((r.extras[k] || 0) - prevM);
        prevN = r.celdas[k];
        prevM = r.extras[k] || 0;
      }
      return { cosecha: r.cosecha, n: r.n, sinId: r.sinId,
               cruzables: r.cruzables, celdas: celdas, extras: extras };
    });
  }
  var mDesembolsosMes = incremental_(mDesembolsos);

  /** Titular de un mapa: la ultima celda cerrada de la cosecha mas madura"""
assert anc in s
s = s.replace(anc, nuevo, 1)

# ---------- se inserta como mapa 5, y muertas pasa a 6 ----------
old = """    { id: 'muertas', orden: 5,"""
new = """    { id: 'desembolsos_mes', orden: 5,
      titulo: 'La plata de cada mes, sin acumular',
      pregunta: '¿En qué mes de vida produce de verdad una cosecha?',
      sub: 'Lo que se desembolsó en ESE mes y nada más. El mapa de arriba acumula; ' +
        'este no, así que se ve en qué mes pica y en cuál se apaga.',
      def: 'desembolsos y plata del mes, no acumulados',
      formato: 'num', clase: 'plata', escala: 'desembolsos del mes',
      colN: 'Sedes', pctCelda: false, conMonto: true,
      filas: mDesembolsosMes, ultimo: ultimo_(mDesembolsosMes) },

    { id: 'muertas', orden: 6,"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('mapa incremental agregado como 5')
