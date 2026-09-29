# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()
old = """  var pIni, pFin;
  var finMes = new Date(Date.UTC(dFin.getUTCFullYear(), dFin.getUTCMonth() + 1, 0));
  var esMesCompleto = (dIni.getUTCDate() === 1) &&
    (fmtFecha_(dFin) >= fmtFecha_(finMes) || fmtFecha_(dFin) === hoyISO_());
  if (esMesCompleto) {
    var nMes = (dFin.getUTCFullYear() * 12 + dFin.getUTCMonth()) -
               (dIni.getUTCFullYear() * 12 + dIni.getUTCMonth()) + 1;
    pIni = new Date(Date.UTC(dIni.getUTCFullYear(), dIni.getUTCMonth() - nMes, 1));
    pFin = new Date(Date.UTC(dIni.getUTCFullYear(), dIni.getUTCMonth(), 0));
  } else {"""
new = """  // Getters LOCALES, no UTC: parseISO_ construye la fecha local y mezclar los
  // dos husos hacia que la condicion no se cumpliera nunca.
  var pIni, pFin;
  var finMes = new Date(dFin.getFullYear(), dFin.getMonth() + 1, 0);
  var esMesCompleto = (dIni.getDate() === 1) &&
    (fmtFecha_(dFin) >= fmtFecha_(finMes) || fmtFecha_(dFin) === hoyISO_());
  if (esMesCompleto) {
    var nMes = (dFin.getFullYear() * 12 + dFin.getMonth()) -
               (dIni.getFullYear() * 12 + dIni.getMonth()) + 1;
    pIni = new Date(dIni.getFullYear(), dIni.getMonth() - nMes, 1);
    pFin = new Date(dIni.getFullYear(), dIni.getMonth(), 0);
  } else {"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('getters locales')
