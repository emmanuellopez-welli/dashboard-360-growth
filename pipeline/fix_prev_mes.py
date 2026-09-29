# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

old = """  var mIniRoi = R.inicio.substring(0, 7), mFinRoi = R.fin.substring(0, 7);
  var rMes = sumaRoi_(mIniRoi, mFinRoi);
  var rPrev = sumaRoi_(R.prevInicio.substring(0, 7), R.prevFin.substring(0, 7));"""
new = """  // BUG que esto arregla: el periodo anterior se calculaba en DIAS, asi que
  // el anterior de julio (31 dias atras) arrancaba el 31 de MAYO y al cortar
  // a mes daba "mayo a junio" — dos meses de plata contra uno. Julio ($24,0 M)
  // salia -63,6% cuando junio hizo $9,6 M y lo real es +149,6%.
  //
  // El retorno de la pauta es mensual por naturaleza (el gasto de Meta viene
  // por mes), asi que el comparativo tiene que contar MESES: tantos meses
  // atras como meses tenga el rango.
  var mIniRoi = R.inicio.substring(0, 7), mFinRoi = R.fin.substring(0, 7);
  var nMeses = (Number(mFinRoi.substring(0, 4)) * 12 + Number(mFinRoi.substring(5, 7))) -
               (Number(mIniRoi.substring(0, 4)) * 12 + Number(mIniRoi.substring(5, 7))) + 1;
  var rMes = sumaRoi_(mIniRoi, mFinRoi);
  var rPrev = sumaRoi_(mesMas_(mIniRoi, -nMeses), mesMas_(mIniRoi, -1));"""
assert old in s
s = s.replace(old, new, 1)

# El rango que no es un mes completo: el retorno igual se mide por mes, y hay
# que decirlo o se lee como si fuera de la semana.
old2 = """    ? { mes: rMes.mes, serie: serieRoi, fila: rMes, meses: rMes.meses,
        mesIni: mIniRoi, mesFin: mFinRoi,"""
new2 = """    ? { mes: rMes.mes, serie: serieRoi, fila: rMes, meses: rMes.meses,
        mesIni: mIniRoi, mesFin: mFinRoi,
        // El gasto de Meta llega por mes, asi que este bloque siempre mide
        // meses completos. Con una semana elegida hay que decirlo.
        mesCompleto: (R.inicio.substring(8, 10) === '01' &&
          R.fin >= fmtFecha_(new Date(Date.UTC(
            Number(mFinRoi.substring(0, 4)),
            Number(mFinRoi.substring(5, 7)), 0)))),"""
assert old2 in s
io.open(p, 'w', encoding='utf8').write(s.replace(old2, new2, 1))
print('comparativo por meses')
