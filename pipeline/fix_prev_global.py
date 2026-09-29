# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

old = """  // --- rango y período anterior de la misma longitud -------------------
  var dFin = parseISO_(fin) || new Date();
  var dIni = parseISO_(inicio) || sumarDias_(dFin, -83);
  if (dIni > dFin) { var tmp = dIni; dIni = dFin; dFin = tmp; }
  var dias = diasEntre_(dIni, dFin);
  var pFin = sumarDias_(dIni, -1);
  var pIni = sumarDias_(pFin, -(dias - 1));
"""
new = """  // --- rango y período anterior ----------------------------------------
  // El anterior se calculaba SIEMPRE restando dias, y eso rompe la
  // comparacion cuando el rango es un mes: el anterior de julio (31 dias
  // atras) arrancaba el 31 de MAYO, asi que cualquier cosa que agrupara por
  // mes comparaba contra mayo + junio. La plata de social media de julio
  // salia -63,6% cuando lo real era +149,6% contra junio.
  //
  // Si el rango es un mes completo, el anterior es el MES anterior completo.
  // Si no, se sigue restando dias, que para una semana es lo correcto.
  var dFin = parseISO_(fin) || new Date();
  var dIni = parseISO_(inicio) || sumarDias_(dFin, -83);
  if (dIni > dFin) { var tmp = dIni; dIni = dFin; dFin = tmp; }
  var dias = diasEntre_(dIni, dFin);

  var pIni, pFin;
  var finMes = new Date(Date.UTC(dFin.getUTCFullYear(), dFin.getUTCMonth() + 1, 0));
  var esMesCompleto = (dIni.getUTCDate() === 1) &&
    (fmtFecha_(dFin) >= fmtFecha_(finMes) || fmtFecha_(dFin) === hoyISO_());
  if (esMesCompleto) {
    var nMes = (dFin.getUTCFullYear() * 12 + dFin.getUTCMonth()) -
               (dIni.getUTCFullYear() * 12 + dIni.getUTCMonth()) + 1;
    pIni = new Date(Date.UTC(dIni.getUTCFullYear(), dIni.getUTCMonth() - nMes, 1));
    pFin = new Date(Date.UTC(dIni.getUTCFullYear(), dIni.getUTCMonth(), 0));
  } else {
    pFin = sumarDias_(dIni, -1);
    pIni = sumarDias_(pFin, -(dias - 1));
  }
"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('periodo anterior alineado a mes')
