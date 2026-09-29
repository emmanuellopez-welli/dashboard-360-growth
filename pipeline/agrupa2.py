# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
L = io.open(p, encoding='utf8').read().split('\n')
k = next(i for i, l in enumerate(L)
         if l.strip() == 'f.impactos = Object.keys(ag).sort().map(function (k, i) {')
ind = L[k][:len(L[k]) - len(L[k].lstrip())]
print('linea %d, indentacion %d' % (k + 1, len(ind)))

bloque = """// Se agrupa por (audiencia, pieza), NO por dia. Una pieza de la cadencia
// gotea varios dias seguidos porque las sedes entran al workflow cuando
// cumplen la condicion: 04_wa_1w salio 5 dias corridos a 211, 6, 1, 2 y 12
// sedes. Eso es UN toque de la cadencia, no cinco comunicaciones, y
// pintarlo como cinco marcas llena la grafica de escalera.
var agP = {};
Object.keys(ag).forEach(function (kk) {
  var b = ag[kk];
  var kp = b.audiencia + '|' + b.pieza;
  if (!agP[kp]) {
    agP[kp] = { audiencia: b.audiencia, nombre: b.nombre, pieza: b.pieza,
                canal: b.canal, sedes: 0, fecha: b.fecha, fechaFin: b.fecha,
                dias: [], picoSedes: 0, fechaPico: b.fecha };
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
Object.keys(ag).forEach(function (kk) {
  var b = ag[kk];
  b.dias.sort(function (a, c) { return a.fecha < c.fecha ? -1 : 1; });
  b.tramo = Math.round(
    (new Date(b.fechaFin + 'T00:00:00Z') - new Date(b.fecha + 'T00:00:00Z'))
    / 86400000) + 1;
  b.fecha = b.fechaPico;
});

f.impactos = Object.keys(ag).sort(function (a, c) {
  return ag[a].fecha < ag[c].fecha ? -1 : (ag[a].fecha > ag[c].fecha ? 1 : 0);
}).map(function (kk, i) {"""
nuevas = [(ind + l if l.strip() else l) for l in bloque.split('\n')]
# el cuerpo del map usaba 'k' como nombre de la clave
L = L[:k] + nuevas + L[k + 1:]
s = '\n'.join(L)
s = s.replace(ind + '  var b = ag[k];\n' + ind + '  b.id = ',
              ind + '  var b = ag[kk];\n' + ind + '  b.id = ', 1)
io.open(p, 'w', encoding='utf8').write(s)
print('agrupacion aplicada')
