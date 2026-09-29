# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Filtro_Origen.gs'
s = io.open(p, encoding='utf8').read()

old = """  var listaEq = [];
  (equipos || []).forEach(function (x) {
    var v = String(x || '').trim();
    if (!v) return;
    if (v.charAt(0) === '@') {
      (EQUIPOS_HS[v.substring(1)] || []).forEach(function (id) { listaEq.push(id); });
    } else {
      listaEq.push(v);
    }
  });"""
new = """  var listaEq = [];
  var tokens = [];
  (equipos || []).forEach(function (x) {
    var v = String(x || '').trim();
    if (!v) return;
    tokens.push(v);
    if (v.charAt(0) === '@') {
      (EQUIPOS_HS[v.substring(1)] || []).forEach(function (id) { listaEq.push(id); });
    } else {
      listaEq.push(v);
    }
  });"""
assert old in s
s = s.replace(old, new, 1)

# La etiqueta se arma con los TOKENS, no con los ids expandidos: "Todo Farmer"
# se lee; los diez nombres de los farmers no caben en la cinta.
old2 = """    equipoEtiqueta: todosEq ? 'Todos los owners'
      : listaEq.map(function (id) { return nomDe[id] || id; }).join(' + '),"""
new2 = """    equipoEtiqueta: todosEq ? 'Todos los owners'
      : tokens.map(function (t) {
          return t.charAt(0) === '@' ? 'todo ' + t.substring(1)
                                     : (nomDe[t] || t);
        }).join(' + '),"""
assert old2 in s
io.open(p, 'w', encoding='utf8').write(s.replace(old2, new2, 1))
print('etiqueta legible')
