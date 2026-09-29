# -*- coding: utf-8 -*-
from qa_rest import *
import collections

print('=== 1. HUERFANAS (sede no cruza con SEDES por nombre normalizado)')
nomSedes=collections.defaultdict(list)
for s in SEDES:
    nm=normNombre(s.get('nombre_sede'))
    if nm: nomSedes[nm].append(s)
nomUniv={normNombre(s.get('nombre_sede')) for s in todas}
for nombre,h,camposN,camposM in [
        ('RESCATE_GESTION',hjGes,['casos','contesto','hablo','firmo'],['monto_trabajado']),
        ('RESCATE_CAUSAL',hjCau,['casos'],['monto']),
        ('RESCATE_DESENLACE',hjDes,['casos'],['monto']),
        ('RESCATE_WA',hjWa,['casos','firmaron'],['monto_firmado']),
        ('RESCATE_POOL',hjPool,['rescatados','trabajados'],['monto_rescatado'])]:
    per=[r for r in h if enR(r)]
    orf=[r for r in per if normNombre(r.get('sede')) not in nomSedes]
    orfU=[r for r in per if normNombre(r.get('sede')) not in nomUniv]
    def tot(rows,c): return sum(num(r.get(c)) for r in rows)
    print(' ',nombre,'filas periodo',len(per),'| huerfanas vs SEDES',len(orf),
          '| fuera del universo depurado',len(orfU))
    for c in camposN+camposM:
        print('     ',c,'total',round(tot(per,c)),'huerfano',round(tot(orf,c)),
              'fuera universo',round(tot(orfU,c)))
    nombres=collections.Counter(str(r.get('sede') or '') for r in orf)
    print('      top nombres huerfanos:',nombres.most_common(8))

print()
print('=== 2. COLISIONES DE NOMBRE (doble conteo / falsa exclusion)')
col={k:v for k,v in nomSedes.items() if len(v)>1}
print('  nombres normalizados con >1 ficha en SEDES:',len(col),
      '| fichas involucradas',sum(len(v) for v in col.values()))
# nombres de gestion que caen en un nombre colisionado
afect=collections.Counter()
for r in hjGes:
    if not enR(r): continue
    nm=normNombre(r.get('sede'))
    if nm in col: afect[str(r.get('sede'))]+=num(r.get('casos'))
print('  casos de gestion cuyo nombre apunta a >1 ficha:',sum(afect.values()),
      afect.most_common(8))
# CREDITOP: colision de nombre con no-CREDITOP
cu=[s for s in SEDES if normOrigen(s.get('origen'))=='CREDITOP']
print('  sedes CREDITOP:',[(str(s.get('id')),str(s.get('nombre_sede'))) for s in cu])
for s in cu:
    nm=normNombre(s.get('nombre_sede'))
    otros=[o for o in nomSedes.get(nm,[]) if normOrigen(o.get('origen'))!='CREDITOP']
    if otros: print('   COLISION CreditUp/no-CreditUp:',s.get('nombre_sede'),
                    [(str(o.get('id')),normOrigen(o.get('origen'))) for o in otros])

print()
print('=== 3. SUMAS QUE NO CUADRAN')
print('  gestion: contesto',gA['contesto'],'vs hablo+colgo+tercero',
      gA['hablo']+gA['colgo']+gA['tercero'])
print('  gestion: llamadas',gA['llamadas'],'vs casos',gA['casos'])
tdes=sum(dvAg.values())
print('  desenlace casos periodo',tdes,'vs casos trabajados',gA['casos'],
      'FALTAN',gA['casos']-tdes)
print('  wa casos',waAg['respondio']['casos']+waAg['no']['casos'],'vs casos',gA['casos'])
print('  causal casos',totC,'vs casos',gA['casos'])
print('  semanas: suma casos',sum(s['casos'] for s in semanasTodas),
        '| cohortes suma casos',sum(c['casos'] for c in cohortes))
for s in semanasTodas:
    c=[x for x in cohortes if x['semana']==s['semana']]
    c=c[0] if c else None
    if c and c['casos']!=s['casos']:
        print('   semana',s['semana'],'gestion',s['casos'],'desenlace',c['casos'],
              'dif',s['casos']-c['casos'])
# monto por dia causal vs gestion
mal=[(d,round(v['monto']),round(v['mCau'])) for d,v in sorted(gDia.items())
     if abs(v['mCau']-v['monto'])>1]
print('  dias donde monto causal != monto_trabajado:',len(mal),mal[:10])
print('  dias con casos>0 y monto 0:',[(d,v['casos']) for d,v in sorted(gDia.items())
       if v['casos']>0 and v['monto']==0])

print()
print('=== 4. DIVISIONES / PORCENTAJES')
todas_celdas=[dd for w in calendario for dd in w['dias']]
print('  celdas calendario',len(todas_celdas),
      '| con cobertura calculada',sum(1 for x in todas_celdas if x['cobertura'] is not None),
      '| hubo gestion',sum(1 for x in todas_celdas if x['hubo']),
      '| sinCredito',sum(1 for x in todas_celdas if x['sinCredito']),
      '| sinMonto',sum(1 for x in todas_celdas if x['sinMonto']))
for x in todas_celdas:
    if x['hubo']:
        print('   ',x['fecha'],x['dow'],'casos',x['casos'],'monto',x['monto'],
              'entroM',x['entroMonto'],'cob',x['cobertura'],'cobCasos',x['coberturaCasos'],
              'sinCredito',x['sinCredito'],'sinMonto',x['sinMonto'])
print('  coberturas > 100%:',[(x['fecha'],x['cobertura'],x['coberturaCasos'])
       for x in todas_celdas if (x['cobertura'] or 0)>100 or (x['coberturaCasos'] or 0)>100])

print()
print('=== 5. FECHAS')
fges=sorted({fch(r) for r in hjGes})
print('  gestion: primera',fges[0],'ultima',fges[-1],'dias distintos',len(fges))
print('  credito: ultima fecha con datos',ultimoCredito)
print('  periodo pedido',INI,'a',FIN)
fdes=sorted({fch(r) for r in hjDes}); fcau=sorted({fch(r) for r in hjCau})
print('  desenlace',fdes[0],fdes[-1],'| causal',fcau[0],fcau[-1])
print('  dias de gestion sin fila de credito:',[d for d in fges if d not in oprDia or d>ultimoCredito])
print('  dias del periodo sin credito (Aug1-Sep6):',
      [d for d in [(datetime.date.fromisoformat(INI)+datetime.timedelta(days=i)).isoformat()
                   for i in range(37)] if d not in rA['porDia']])

print()
print('=== 6. DUPLICADOS (misma fecha + misma sede)')
for nombre,h,extra in [('RESCATE_GESTION',hjGes,None),('RESCATE_CAUSAL',hjCau,'causal'),
                       ('RESCATE_DESENLACE',hjDes,'desenlace'),('RESCATE_WA',hjWa,'grupo'),
                       ('RESCATE_POOL',hjPool,None)]:
    c=collections.Counter()
    for r in h:
        k=(fch(r),str(r.get('sede')))+((str(r.get(extra)),) if extra else ())
        c[k]+=1
    dup={k:v for k,v in c.items() if v>1}
    print(' ',nombre,'filas',len(h),'llaves',len(c),'llaves duplicadas',len(dup),
          'filas extra',sum(v-1 for v in dup.values()))
    if dup: print('    ejemplos',list(dup.items())[:5])

print()
print('=== 7. INVENTARIO (KPIs no usados) y sedes de cobertura')
invTot=sum(num(s.get('aprobados_no_firmados')) for s in Ufilas)
print('  invTot hoja SEDES (incluye CREDITOP):',invTot)
print('  cobertura.sedes cuenta strings crudos; nombres distintos:',len(sedesGes))
print('  incluye centinelas:',[x for x in sedesGes if not normNombre(x) or 'sin' in x.lower()][:10])
