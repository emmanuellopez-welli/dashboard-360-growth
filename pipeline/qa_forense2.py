# -*- coding: utf-8 -*-
from qa_rest import *
import collections, json, io

print('=== A. huerfanas por nombre, casos exactos')
nomSedes=collections.defaultdict(list)
for s in SEDES:
    nm=normNombre(s.get('nombre_sede'))
    if nm: nomSedes[nm].append(s)
nomUniv={normNombre(s.get('nombre_sede')) for s in todas}
orf=collections.Counter(); orfM=collections.Counter()
for r in hjGes:
    if not enR(r): continue
    if normNombre(r.get('sede')) in nomSedes: continue
    orf[str(r.get('sede'))]+=num(r.get('casos')); orfM[str(r.get('sede'))]+=num(r.get('monto_trabajado'))
for k,v in orf.most_common():
    print('  ',repr(k),'casos',v,'monto',round(orfM[k]))
print('  TOTAL huerfano casos',sum(orf.values()),'de',gA['casos'],
      '=',round(sum(orf.values())/gA['casos']*100,1),'%')

print()
print('=== B. gestion en sedes DESHABILITADAS (excluidas del denominador de credito)')
desh=collections.Counter(); deshM=collections.Counter()
for r in hjGes:
    if not enR(r): continue
    if normNombre(r.get('sede')) in deshabNom:
        desh[str(r.get('sede'))]+=num(r.get('casos')); deshM[str(r.get('sede'))]+=num(r.get('monto_trabajado'))
print('  casos',sum(desh.values()),'monto',round(sum(deshM.values())),desh.most_common(10))
noplat=collections.Counter()
for r in hjGes:
    if not enR(r): continue
    nm=normNombre(r.get('sede'))
    if nm in nomSedes and nm not in nomUniv and nm not in deshabNom:
        noplat[str(r.get('sede'))]+=num(r.get('casos'))
print('  fuera del universo por plataforma/pais (no deshab):',sum(noplat.values()),noplat.most_common(5))

print()
print('=== C. interesado vs firmo, dia por dia')
igual=0; dif=[]
for d,v in sorted(gDia.items()): pass
per=[r for r in hjGes if enR(r)]
ag=collections.defaultdict(lambda: [0.0,0.0])
for r in per:
    ag[fch(r)][0]+=num(r.get('interesado')); ag[fch(r)][1]+=num(r.get('firmo'))
for d in sorted(ag):
    i,f=ag[d]
    if i!=f: dif.append((d,i,f))
print('  dias con interesado != firmo:',len(dif),dif)
print('  total interesado',gA['interesado'],'firmo',gA['firmo'])
# fila por fila
filas_dif=[(fch(r),str(r.get('sede')),num(r.get('interesado')),num(r.get('firmo')))
           for r in per if num(r.get('interesado'))!=num(r.get('firmo'))]
print('  filas con interesado != firmo:',len(filas_dif),filas_dif[:10])

print()
print('=== D. causal: filas con casos>0 y monto 0')
cero=[r for r in hjCau if enR(r) and num(r.get('casos'))>0 and num(r.get('monto'))==0]
print('  filas',len(cero),'casos',sum(num(r.get('casos')) for r in cero),
      'de',totC,'=',round(sum(num(r.get('casos')) for r in cero)/totC*100,1),'%')
porDia=collections.Counter()
for r in cero: porDia[fch(r)]+=num(r.get('casos'))
print('  por dia',sorted(porDia.items()))

print()
print('=== E. desenlace: valores y casos que faltan')
vals=collections.Counter()
for r in hjDes:
    if enR(r): vals[str(r.get('desenlace'))]+=num(r.get('casos'))
print('  ',dict(vals))
# por dia gestion vs desenlace
gd=collections.Counter(); dd=collections.Counter()
for r in hjGes:
    if enR(r): gd[fch(r)]+=num(r.get('casos'))
for r in hjDes:
    if enR(r): dd[fch(r)]+=num(r.get('casos'))
print('  dias con descuadre:',[(d,gd[d],dd[d]) for d in sorted(gd) if gd[d]!=dd[d]])

print()
print('=== F. deltas de los KPI de oportunidad vs cobertura temporal')
d=json.load(io.open('f4/out11.json',encoding='utf-8'))
for k in d['f4']['oportunidad']['kpis']:
    print('  ',k['label'],k['valor'],'delta',k.get('delta'))
rP=cortar(PINI,PFIN)
diasA=sorted(rA['porDia']); diasP=sorted(rP['porDia'])
print('  dias con credito periodo actual',len(diasA),diasA[0],diasA[-1])
print('  dias con credito periodo previo',len(diasP),diasP[0],diasP[-1])
pdA=rA['mApr']/len(diasA); pdP=rP['mApr']/len(diasP)
print('  mApr/dia actual',round(pdA),'previo',round(pdP),
      'delta por dia %',round((pdA/pdP-1)*100,1),'| delta crudo %',
      round((rA['mApr']/rP['mApr']-1)*100,1))
print('  apr/dia actual',round(rA['apr']/len(diasA),1),'previo',round(rP['apr']/len(diasP),1))

print()
print('=== G. lift de WA con tasas sin redondear')
r_=waAg['respondio']; n_=waAg['no']
print('  tasa respondio',r_['firmaron']/r_['casos']*100,'tasa no',n_['firmaron']/n_['casos']*100)
print('  lift real',round((r_['firmaron']/r_['casos'])/(n_['firmaron']/n_['casos']),2),
      '| lift del motor 11.4 (usa tasas ya redondeadas 15.9/1.4)')

print()
print('=== H. embudo: monotonia')
print('  interesado monto',270307200,'< firmo monto',round(mFirmo),'->',
      'el ultimo paso del embudo CRECE en plata')

print()
print('=== I. numerador de cobertura fuera del alcance del denominador')
fuera=[r for r in hjGes if enR(r) and fch(r)>ultimoCredito]
print('  casos trabajados en dias sin credito:',sum(num(r.get('casos')) for r in fuera),
      'monto',round(sum(num(r.get('monto_trabajado')) for r in fuera)))
print('  pctCasos sin esos dias:',round_js((gA['casos']-sum(num(r.get('casos')) for r in fuera))/oprCasos*1000)/10)
