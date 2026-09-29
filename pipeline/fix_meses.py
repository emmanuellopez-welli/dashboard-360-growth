# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
ini = s.index('/** Meses que tienen dato en alguna fuente fechada')
fin = s.index('\n}\n', ini) + 3
nuevo = '''/** Los meses que el tablero puede medir, del mas viejo a hoy.
    NO es el rango de profile_institucion: ahi hay creditos desde 2023 y el
    selector salia con 41 meses casi todos vacios. El piso es la primera
    COSECHA de sedes, porque antes de eso el tablero no tiene universo que
    cortar: sin sedes creadas no hay nada que medir por origen ni por ventana.
    Se excluye la carga inicial, que es la migracion historica a HubSpot. */
function mesesConDatos_() {
  var min = '9999-99';
  leerHoja_('COSECHA_DIA').forEach(function (r) {
    var c = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(c) || esCargaInicial_(c)) return;
    if (c < min) min = c;
  });
  var hoy = hoyISO_().substring(0, 7);
  if (min === '9999-99' || min > hoy) return [hoy];
  var out = [];
  var t = Number(min.substring(0, 4)) * 12 + (Number(min.substring(5, 7)) - 1);
  var th = Number(hoy.substring(0, 4)) * 12 + (Number(hoy.substring(5, 7)) - 1);
  for (; t <= th; t++) {
    out.push(('0000' + Math.floor(t / 12)).slice(-4) + '-' +
             ('0' + (t % 12 + 1)).slice(-2));
  }
  return out;
}
'''
io.open(p, 'w', encoding='utf8').write(s[:ini] + nuevo + s[fin:])
print('piso = primera cosecha')
