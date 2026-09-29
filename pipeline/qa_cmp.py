# -*- coding: utf-8 -*-
from qa_rest import *
import json, io
d=json.load(io.open('f4/out11.json',encoding='utf-8'))
g=d['f4']['gestion']; mot=d['f4']['cobertura']
print('COB mine ',cob)
print('COB motor',mot)
print('cob diff:',{k:(cob[k],mot[k]) for k in cob if cob[k]!=mot[k]})
print('span',spanIni,spanFin,'ultimoCredito',ultimoCredito,'stock',round_js(stockN),round_js(stockM),'corte',corte)
print('stock motor',g['stock'])
for a,b in zip(semanas,g['semanas']):
    diff={k:(a[k],b[k]) for k in a if a[k]!=b[k]}
    print(' sem',a['semana'],'DIFF' if diff else 'ok',diff)
print('n semanas',len(semanas),len(g['semanas']))
for a,b in zip(cohortes,g['cohortes']):
    diff={k:(a[k],b[k]) for k in a if a[k]!=b[k]}
    print(' coh',a['semana'],'DIFF' if diff else 'ok',diff)
print('n cohortes',len(cohortes),len(g['cohortes']))
print('wa mine',waAg,'tasas',tasaWa(waAg['respondio']),tasaWa(waAg['no']),
      'lift',round_js(tasaWa(waAg['respondio'])/tasaWa(waAg['no'])*10)/10)
print('desenlace mine',dvAg,'sinCruce',dvAg['sin_cruce']+dvAg['otro'],'mFirmo',round(mFirmo))
print('recuperado mine: firmas',gA['firmo'],'monto_rescatado(pool)',round(pA['monto_rescatado']),
      'cierre',round_js(gA['firmo']/bTot*1000)/10,
      'resueltos',dvAg['firmo']+dvAg['vencido'],
      'cierreResuelto',round_js(dvAg['firmo']/(dvAg['firmo']+dvAg['vencido'])*1000)/10)
print('pool cols',pA)
print('historia n mine',len(historia),'motor',len(g['historia']))
hm=g['historia']
for a,b in zip(historia,hm):
    diff={k:(a[k],b[k]) for k in a if a[k]!=b[k]}
    if diff: print(' hist',a['mes'],diff)
# calendario compare
mc={ (w['semana'],dd['fecha']):dd for w in g['calendario'] for dd in w['dias'] }
mine={ (w['semana'],dd['fecha']):dd for w in calendario for dd in w['dias'] }
print('cal keys mine',len(mine),'motor',len(mc))
for k in sorted(set(mine)|set(mc)):
    a=mine.get(k); b=mc.get(k)
    if a is None or b is None: print(' cal MISSING',k, a is None, b is None); continue
    diff={x:(a[x],b[x]) for x in a if x in b and a[x]!=b[x]}
    if diff: print(' cal',k[1],diff)
print('embudo mine:')
mCau=sum(c['monto'] for c in causales); mNo=sum(c['monto'] for c in causales if re.search(r'no\s*contesta|no\s*contactad',c['causal'],re.I))
mCol=sum(c['monto'] for c in causales if (not re.search(r'no\s*contesta|no\s*contactad',c['causal'],re.I)) and re.search(r'cuelga',c['causal'],re.I))
mInt=sum(c['monto'] for c in causales if re.search(r'interesad',c['causal'],re.I))
cuadraMonto = mTrab>0 and abs(mCau-mTrab)<=1
pasos=[('Aprobado sin firmar',oprCasos,oprMonto),('Entro a la lista',bTot,mTrab),
 ('Contesto alguien',gA['contesto'],mTrab-mNo),('y colgo',gA['colgo'],mCol),
 ('Hablo',gA['hablo'],mTrab-mNo-mCol),('Interesado',gA['interesado'],mInt),('Firmo',gA['firmo'],mFirmo)]
for (et,c,m),b in zip(pasos,g['embudo']):
    pc=round_js(c/oprCasos*1000)/10; pm=round_js(m/oprMonto*1000)/10
    ok = (round_js(c)==b['casos']) and (round_js(m)==b['monto']) and pc==b['pct'] and pm==b['pctMonto']
    print('  ',et,round_js(c),round_js(m),pc,pm,'OK' if ok else ('MOTOR: %s %s %s %s'%(b['casos'],b['monto'],b['pct'],b['pctMonto'])))
print('cuadraMonto',cuadraMonto,'mCau-mTrab',mCau-mTrab)
nEmb=sum(c['casos'] for c in causales if re.search(r'no\s*contesta|cuelga|no\s*contactad',c['causal'],re.I))
nReal=totC-nEmb
print('nEmbudo',nEmb,'nReal',nReal,'hablo',gA['hablo'],'casos-hablo',bTot-gA['hablo'],
      'cuadraCausal',(nReal==gA['hablo'] and nEmb==bTot-gA['hablo']))
