# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

old = """        pasos: [
          { etapa: 'Nuevas', valor: actM.total, pct: 100 },
          { etapa: 'Activas', valor: actM.activas, pct: actM.pctAct },
          { etapa: 'Exitosas', valor: actM.exitosas, pct: actM.pctExi }
        ],"""
new = """        pasos: [
          { etapa: 'Nuevas', valor: actM.total, pct: 100 },
          { etapa: 'Activas', valor: actM.activas, pct: actM.pctAct },
          { etapa: 'Exitosas', valor: actM.exitosas, pct: actM.pctExi }
        ],
        // La version GLOBAL: todas las sedes que entraron, sin importar quien
        // las trajo. Es la que pinta el frente; la de marketing se deja
        // calculada porque el dato ya esta y no cuesta nada.
        pasosTodas: [
          { etapa: 'Nuevas', valor: actT.total, pct: 100 },
          { etapa: 'Activas', valor: actT.activas, pct: actT.pctAct },
          { etapa: 'Exitosas', valor: actT.exitosas, pct: actT.pctExi }
        ],
        kpisTodas: [
          kpi_('Sedes activas', actT.activas, { formato: 'num', color: 'azul',
            sublabel: 'de ' + fNumSrv_(actT.total) + ' que entraron en ' + mesComp +
              ' · ' + fPctSrv_(actT.pctAct),
            fuente: 'profile_institucion',
            nota: 'Activa = radicó al menos una solicitud de crédito en el mes ' +
              'en que la sede entró. Todos los orígenes.' +
              (actT.sinId
                ? ' Ojo: ' + fNumSrv_(actT.sinId) + ' de las ' + fNumSrv_(actT.total) +
                  ' no tienen id_internal en HubSpot, así que no se pueden cruzar ' +
                  'contra la plataforma y cuentan como dormidas sin poder ' +
                  'verificarlo.'
                : '') }),
          kpi_('Sedes exitosas', actT.exitosas, { formato: 'num', color: 'verde',
            sublabel: '3 o más solicitudes, o ya con desembolso · ' +
              fPctSrv_(actT.pctExi) + ' de las nuevas',
            fuente: 'profile_institucion',
            nota: 'Con una sola solicitud no se distingue una sede que arrancó ' +
              'de una que probó el sistema una vez. De las activas, ' +
              fPctSrv_(actT.pctExiDeAct) + ' llegó a exitosa.' }),
          kpi_('Sedes dormidas', actT.dormidas, { formato: 'num', color: 'ambar',
            sublabel: 'entraron y no radicaron nada en el mes',
            fuente: 'profile_institucion',
            nota: 'Son el objetivo natural de activación: ya están creadas y ' +
              'no cuestan adquisición, solo acompañamiento.' })
        ],"""
assert old in s
io.open(p, 'w', encoding='utf8').write(s.replace(old, new, 1))
print('activacion: version global')
