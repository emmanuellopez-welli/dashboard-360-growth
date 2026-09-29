# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# El total del periodo tiene que ser el MISMO que muestra la tabla de abajo:
# la plata radicada DENTRO del periodo. El acumulado hasta hoy va aparte, como
# segundo dato, porque es otra pregunta.
rep("""    t.multiplo = t.gasto ? Math.round((t.plata / t.gasto) * 10) / 10 : 0;""",
    """    // El multiplo titular usa la plata DEL PERIODO, que es comparable entre
    // meses. El acumulado va aparte: una cosecha de enero ha tenido ocho
    // meses para rendir y una de agosto unos dias, asi que compararlos da
    // caidas de 70% que solo miden la diferencia de edad.
    t.multiplo = t.gasto ? Math.round((t.plataM0 / t.gasto) * 10) / 10 : 0;
    t.multiploAcum = t.gasto ? Math.round((t.plata / t.gasto) * 10) / 10 : 0;""")

# La serie de la tabla vuelve a ser TODOS los meses con gasto: con un rango de
# un mes quedaba una sola fila y se perdia la tendencia, que es lo util.
rep("""    ? { mes: rMes.mes, serie: serieRoi.filter(function (x) {
          return x.mes >= mIniRoi && x.mes <= mFinRoi;
        }), fila: rMes, meses: rMes.meses,""",
    """    ? { mes: rMes.mes, serie: serieRoi, fila: rMes, meses: rMes.meses,
        mesIni: mIniRoi, mesFin: mFinRoi,
        // El acumulado hasta hoy, para el segundo dato de la tarjeta.
        acumulado: Math.round(rMes.plata),
        multiploAcum: rMes.multiploAcum,""")

rep("""          kpi_('Plata de social media', rMes.plata, { formato: 'copC',
            sublabel: 'crédito desembolsado por las ' + fNumSrv_(rMes.sedes) +
              ' sedes que entraron por social media · ' + rMes.mes,
            delta: rPrev && rPrev.plata ? delta_(rMes.plata, rPrev.plata) : null,
            deltaEtiqueta: rPrev ? 'vs ' + rPrev.mes : '',
            fuente: 'profile_institucion + HubSpot', color: 'morado',
            nota: 'Es lo que han puesto HASTA HOY las cosechas de social media del ' +
              'período, no todo el stock del canal. Ojo al comparar meses entre sí: ' +
              'una cosecha de enero ha tenido ocho meses para rendir y una de agosto ' +
              'apenas días. La columna "1er mes" de la tabla es la que sí compara.' }),""",
    """          kpi_('Plata de social media', Math.round(rMes.plataM0), { formato: 'copC',
            sublabel: 'firmada DENTRO del período por las ' + fNumSrv_(rMes.sedes) +
              ' sedes que entraron por social media · ' + rMes.mes,
            delta: rPrev && rPrev.plataM0
              ? delta_(rMes.plataM0, rPrev.plataM0) : null,
            deltaEtiqueta: rPrev ? 'vs ' + rPrev.mes : '',
            fuente: 'profile_institucion + HubSpot', color: 'morado',
            nota: 'Es la MISMA medida que la tabla de abajo: la sede entró en el ' +
              'período y el crédito se firmó en el período. El acumulado hasta hoy ' +
              'va debajo, y casi siempre es mayor porque una cosecha sigue ' +
              'rindiendo después de su mes.' }),""")

rep("""          kpi_('Originación por peso de pauta', rMes.multiplo, { formato: 'x',
            sublabel: 'veces el gasto de Meta del período',
            delta: rPrev && rPrev.multiplo ? delta_(rMes.multiplo, rPrev.multiplo) : null,""",
    """          kpi_('Originación por peso de pauta', rMes.multiplo, { formato: 'x',
            sublabel: 'plata del período / gasto de Meta del período',
            delta: rPrev && rPrev.multiplo ? delta_(rMes.multiplo, rPrev.multiplo) : null,""")
io.open(p, 'w', encoding='utf8').write(s)
print('retorno: misma medida que la tabla')
