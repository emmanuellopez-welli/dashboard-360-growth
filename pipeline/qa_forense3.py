# -*- coding: utf-8 -*-
from qa_rest import *
import collections

print('=== J. impacto real de la exclusion CREDITOP')
# credito con y sin exclusion
def cortar2(desde,hasta,excl):
    t=dict(apr=0.0,firm=0.0,mApr=0.0,mFirm=0.0)
    for r in HECHOS:
        if r['fecha']<desde or r['fecha']>hasta: continue
        if r['sede'] in deshabHS: continue
        if excl and r['sede'] in fueraHS: continue
        t['apr']+=r['apr']; t['firm']+=r['conv']; t['mApr']+=r['mApr']; t['mFirm']+=r['mConv']
    return t
con=cortar2(INI,FIN,True); sin=cortar2(INI,FIN,False)
print('  apr con exclusion',con['apr'],'sin',sin['apr'],'quitados',sin['apr']-con['apr'],
      '=',round((sin['apr']-con['apr'])/sin['apr']*100,2),'%')
print('  mApr quitado',round(sin['mApr']-con['mApr']))
# gestion quitada
q=[r for r in hoja('RESCATE_GESTION') if normNombre(r.get('sede')) in fueraNom]
print('  filas gestion quitadas',len(q),
      [(str(r.get('fecha'))[:10],str(r.get('sede')),num(r.get('casos')),num(r.get('monto_trabajado'))) for r in q])

print()
print('=== K. (sin aliado): peso en cada cifra')
sa=[r for r in hjGes if enR(r) and str(r.get('sede'))=='(sin aliado)']
print('  filas',len(sa),'casos',sum(num(r.get('casos')) for r in sa),
      'monto',sum(num(r.get('monto_trabajado')) for r in sa),
      'contesto',sum(num(r.get('contesto')) for r in sa),
      'hablo',sum(num(r.get('hablo')) for r in sa),
      'firmo',sum(num(r.get('firmo')) for r in sa))
casosSA=sum(num(r.get('casos')) for r in sa)
print('  ticket trabajado sin ellos', round((gA['monto_trabajado'])/(gA['casos']-casosSA)),
      'vs con ellos',round(gA['monto_trabajado']/gA['casos']),
      '| bolsa',round(oprMonto/oprCasos))
print('  veces el ticket sin ellos',round((gA['monto_trabajado']/(gA['casos']-casosSA))/(oprMonto/oprCasos),2))
print('  pctCasos sin ellos',round((gA['casos']-casosSA)/oprCasos*100,1))
# donde caen
print('  fechas',collections.Counter(fch(r) for r in sa))
# en desenlace / wa
sad=[r for r in hjDes if enR(r) and str(r.get('sede'))=='(sin aliado)']
print('  desenlace (sin aliado):',collections.Counter({str(r.get('desenlace')):0 for r in sad}),
      sum(num(r.get('casos')) for r in sad),
      collections.Counter(str(r.get('desenlace')) for r in sad))
saw=[r for r in hjWa if enR(r) and str(r.get('sede'))=='(sin aliado)']
print('  wa (sin aliado): casos',sum(num(r.get('casos')) for r in saw),
      'grupos',collections.Counter(str(r.get('grupo')) for r in saw))

print()
print('=== L. sin_cruce vs desenlace: 70 casos sin credito cruzado')
print('  sin_cruce 70 + otro 2 = 72 de 488 desenlaces =',round(72/488*100,1),'%')
sc=[r for r in hjDes if enR(r) and str(r.get('desenlace'))=='sin_cruce']
print('  sedes del sin_cruce:',collections.Counter(str(r.get('sede')) for r in sc).most_common(5))

print()
print('=== M. cobertura semanal: numerador incluye sedes/dias sin denominador')
for s in semanas:
    print('  ',s['semana'],'casos',s['casos'],'oport',s['oportunidad'],'cob',s['cobertura'])
print('  suma oportunidad semanal',sum(s['oportunidad'] for s in semanas),
      'vs oprCasos del periodo',oprCasos)
