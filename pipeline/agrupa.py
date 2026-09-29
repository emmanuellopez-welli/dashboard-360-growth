# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

old = """  f.impactos = Object.keys(ag).sort().map(function (k, i) {"""
assert old in s
# se agrupa por (audiencia, pieza) antes de armar los impactos
nuevo = """  // Se agrupa por (audiencia, pieza), NO por dia. Una pieza de la cadencia
  // gotea varios dias seguidos porque las sedes entran al workflow cuando
  // cumplen la condicion: 04_wa_1w salio 5 dias corridos a 211, 6, 1, 2 y 12
  // sedes. Eso es UN toque de la cadencia, no cinco comunicaciones, y
  // pintarlo como cinco marcas llena la grafica de escalera.
  var agP = {};
  Object.keys(ag).forEach(function (k) {
    var b = ag[k];
    var kp = b.audiencia + '|' + b.pieza;
    if (!agP[kp]) {
      agP[kp] = { audiencia: b.audiencia, nombre: b.nombre, pieza: b.pieza,
                  canal: b.canal, sedes: 0, fecha: b.fecha, fechaFin: b.fecha,
                  dias: [], picoSedes: 0 };
    }
    var q = agP[kp];
    q.sedes += b.sedes;
    if (b.fecha < q.fecha) q.fecha = b.fecha;
    if (b.fecha > q.fechaFin) q.fechaFin = b.fecha;
    q.dias.push({ fecha: b.fecha, sedes: b.sedes });
    // La marca se ancla al dia del LOTE grande, que es cuando de verdad se
    // mando; los dias siguientes son goteo de sedes que entraron despues.
    if (b.sedes > q.picoSedes) { q.picoSedes = b.sedes; q.fechaPico = b.fecha; }
  });
  ag = agP;
  Object.keys(ag).forEach(function (k) {
    var b = ag[k];
    b.dias.sort(function (a, c) { return a.fecha < c.fecha ? -1 : 1; });
    b.tramo = b.fecha === b.fechaFin
      ? 1 : (Math.round((new Date(b.fechaFin) - new Date(b.fecha)) / 86400000) + 1);
    b.fecha = b.fechaPico || b.fecha;
  });

  f.impactos = Object.keys(ag).sort(function (a, c) {
    return ag[a].fecha < ag[c].fecha ? -1 : (ag[a].fecha > ag[c].fecha ? 1 : 0);
  }).map(function (k, i) {"""
s = s.replace(old, nuevo, 1)
io.open(p, 'w', encoding='utf8').write(s)
print('impactos agrupados por pieza')
