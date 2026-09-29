# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# BUG: COSECHA_DIA paso de tener columna 'canal' con valores capitalizados a
# 'origen' normalizado en mayusculas cuando se amplio a todos los origenes.
# El filtro seguia mirando r.canal, que ya no existe, asi que descartaba TODAS
# las filas y la plata de social media salia siempre en cero.
#
# Y de paso: la tabla ahora trae todas las fechas, no solo el mes de la
# cosecha, asi que se separan las dos lecturas.
#   plataM0  lo que puso la cosecha en SU PRIMER MES  -> comparable entre meses
#   plata    lo que ha puesto hasta hoy               -> el retorno real
rep("""  cdRoi.forEach(function (r) {
    if (String(r.canal || '') !== 'Social media') return;
    var m = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    var b = bRoi_(m);
    b.sol += num_(r.solicitudes);
    b.apr += num_(r.aprobados);
    b.des += num_(r.desembolsos);
    b.plata += num_(r.monto);
  });""",
"""  cdRoi.forEach(function (r) {
    if (normOrigen_(r.origen) !== 'SOCIAL MEDIA') return;
    var m = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    var b = bRoi_(m);
    b.sol += num_(r.solicitudes);
    b.apr += num_(r.aprobados);
    b.des += num_(r.desembolsos);
    b.plata += num_(r.monto);
    // El primer mes de la cosecha, aparte: es la unica cifra comparable
    // entre meses, porque una cosecha vieja ha tenido mas tiempo de rendir.
    if (String(r.fecha || '').substring(0, 7) === m) {
      b.plataM0 += num_(r.monto);
      b.desM0 += num_(r.desembolsos);
    }
  });""")

rep("""      agRoi[m] = { mes: m, leads: 0, gasto: 0, sedes: 0, sol: 0, apr: 0,
                   des: 0, plata: 0 };""",
    """      agRoi[m] = { mes: m, leads: 0, gasto: 0, sedes: 0, sol: 0, apr: 0,
                   des: 0, plata: 0, plataM0: 0, desM0: 0 };""")

rep("""             plata: Math.round(b.plata),
             multiplo: b.gasto ? Math.round((b.plata / b.gasto) * 10) / 10 : 0 };""",
    """             plata: Math.round(b.plata),
             plataM0: Math.round(b.plataM0),
             des: b.des, desM0: b.desM0,
             multiplo: b.gasto ? Math.round((b.plata / b.gasto) * 10) / 10 : 0,
             multiploM0: b.gasto ? Math.round((b.plataM0 / b.gasto) * 10) / 10 : 0 };""")

# Los KPIs se anclaban al ultimo mes del rango: con el filtro en todo el año
# mostraban solo agosto. Ahora suman los meses DENTRO del rango.
rep("""  // El retorno de la pauta es mensual por naturaleza (el gasto de Meta viene
  // por mes), asi que se ancla al ultimo mes del rango y compara con el
  // anterior. mesMas_ ya esta definido arriba, en el bloque de la seccion 5.
  var mesRoiPrev = mesMas_(mesComp, -1);
  var rMes = null, rPrev = null;
  serieRoi.forEach(function (x) {
    if (x.mes === mesComp) rMes = x;
    if (x.mes === mesRoiPrev) rPrev = x;
  });""",
    """  // El gasto de Meta viene por mes, pero los KPIs tienen que respetar el
  // rango: anclados al ultimo mes, con el filtro en todo el año mostraban
  // solo agosto y el resto del año quedaba invisible.
  function sumaRoi_(desde, hasta) {
    var t = { mes: '', leads: 0, gasto: 0, sedes: 0, plata: 0, plataM0: 0,
              des: 0, meses: 0 };
    serieRoi.forEach(function (x) {
      if (x.mes < desde || x.mes > hasta) return;
      t.leads += x.leads; t.gasto += x.gasto; t.sedes += x.sedes;
      t.plata += x.plata; t.plataM0 += x.plataM0; t.des += x.des;
      t.meses++;
    });
    t.cpl = t.leads ? Math.round(t.gasto / t.leads) : 0;
    t.costoSede = t.sedes ? Math.round(t.gasto / t.sedes) : 0;
    t.leadASede = t.leads ? Math.round((t.sedes / t.leads) * 1000) / 10 : 0;
    t.multiplo = t.gasto ? Math.round((t.plata / t.gasto) * 10) / 10 : 0;
    t.mes = desde === hasta ? desde : desde + ' a ' + hasta;
    return t;
  }
  var mIniRoi = R.inicio.substring(0, 7), mFinRoi = R.fin.substring(0, 7);
  var rMes = sumaRoi_(mIniRoi, mFinRoi);
  var rPrev = sumaRoi_(R.prevInicio.substring(0, 7), R.prevFin.substring(0, 7));
  if (!rMes.meses) rMes = null;
  if (!rPrev.meses) rPrev = null;""")

rep("""  f.retorno = rMes
    ? { mes: rMes.mes, serie: serieRoi, fila: rMes,""",
    """  f.retorno = rMes
    ? { mes: rMes.mes, serie: serieRoi.filter(function (x) {
          return x.mes >= mIniRoi && x.mes <= mFinRoi;
        }), fila: rMes, meses: rMes.meses,""")

rep("""            sublabel: 'crédito desembolsado por las ' + fNumSrv_(rMes.sedes) +
              ' sedes que entraron por social media en ' + rMes.mes,""",
    """            sublabel: 'crédito desembolsado por las ' + fNumSrv_(rMes.sedes) +
              ' sedes que entraron por social media · ' + rMes.mes,""")
rep("""            deltaEtiqueta: rPrev ? 'vs cosecha de ' + rPrev.mes : '',
            fuente: 'profile_institucion + HubSpot', color: 'morado',
            nota: 'Es la cosecha del mes, no todo el stock de social media: la ' +
              'plata que puso el gasto de ESTE mes. Las cosechas recientes ' +
              'todavía están madurando, así que el mes en curso sale bajo y sube ' +
              'en los siguientes refresh.' }),""",
    """            deltaEtiqueta: rPrev ? 'vs ' + rPrev.mes : '',
            fuente: 'profile_institucion + HubSpot', color: 'morado',
            nota: 'Es lo que han puesto HASTA HOY las cosechas de social media del ' +
              'período, no todo el stock del canal. Ojo al comparar meses entre sí: ' +
              'una cosecha de enero ha tenido ocho meses para rendir y una de agosto ' +
              'apenas días. La columna "1er mes" de la tabla es la que sí compara.' }),""")
rep("""            sublabel: 'veces el gasto de Meta del mes',""",
    """            sublabel: 'veces el gasto de Meta del período',""")
rep("""            sublabel: 'gasto de Meta / sedes de social media del mes · ' +
              fPctSrv_(rMes.leadASede) + ' de los leads llegó a sede',""",
    """            sublabel: 'gasto de Meta / sedes de social media · ' +
              fPctSrv_(rMes.leadASede) + ' de los leads llegó a sede',""")
io.open(p, 'w', encoding='utf8').write(s)
print('bug del ROI corregido')
