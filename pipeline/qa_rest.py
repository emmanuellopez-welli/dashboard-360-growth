# -*- coding: utf-8 -*-
from qa_ges import *
import re

rA=cortar(INI,FIN)
oprCasos=rA['apr']-rA['firm']; oprMonto=rA['mApr']-rA['mFirm']
mTrab=gA['monto_trabajado']; bTot=gA['casos']
sedesGes=set(); diasGes=set()
for r in hjGes:
    if not enR(r): continue
    nm=str(r.get('sede') or '').strip()
    if nm: sedesGes.add(nm)
    diasGes.add(fch(r))
cob=dict(casos=round_js(bTot),oprCasos=oprCasos,pctCasos=round_js(bTot/oprCasos*1000)/10,
    monto=round_js(mTrab),oprMonto=round_js(oprMonto),pctMonto=round_js(mTrab/oprMonto*1000)/10,
    sedes=len(sedesGes),dias=len(diasGes),
    ticketTrabajado=round_js(mTrab/bTot),ticketBolsa=round_js(oprMonto/oprCasos))
cob['veces']=round_js(cob['ticketTrabajado']/cob['ticketBolsa']*10)/10

spanIni=min(fch(r) for r in hjGes if re.match(r'^\d{4}-\d{2}-\d{2}$',fch(r)))
spanFin=max(fch(r) for r in hjGes if re.match(r'^\d{4}-\d{2}-\d{2}$',fch(r)))
oprSem={}; oprDia={}; ultimoCredito=''
for r in recorrer(lunes(spanIni),spanFin):
    k=lunes(r['fecha'])
    b=oprSem.setdefault(k,dict(apr=0,firm=0,mApr=0.0,mFirm=0.0))
    o=oprDia.setdefault(r['fecha'],dict(apr=0,firm=0,mApr=0.0,mFirm=0.0))
    for x in (b,o):
        x['apr']+=r['apr']; x['firm']+=r['conv']; x['mApr']+=r['mApr']; x['mFirm']+=r['mConv']
    if r['fecha']>ultimoCredito: ultimoCredito=r['fecha']

semAg={}
for r in hjGes:
    f=fch(r)
    if not re.match(r'^\d{4}-\d{2}-\d{2}$',f): continue
    k=lunes(f)
    b=semAg.setdefault(k,dict(semana=k,casos=0.0,contesto=0.0,hablo=0.0,firmo=0.0,monto=0.0,dias=set()))
    b['casos']+=num(r.get('casos')); b['contesto']+=num(r.get('contesto'))
    b['hablo']+=num(r.get('hablo')); b['firmo']+=num(r.get('firmo'))
    b['monto']+=num(r.get('monto_trabajado')); b['dias'].add(f)
semanas=[]
for k in sorted(semAg):
    b=dict(semAg[k]); o=oprSem.get(k,dict(apr=0,firm=0,mApr=0.0,mFirm=0.0))
    b['dias']=len(b['dias'])
    b['oportunidad']=o['apr']-o['firm']; b['mOportunidad']=round_js(o['mApr']-o['mFirm'])
    b['cobertura']=round_js(b['casos']/b['oportunidad']*1000)/10 if b['oportunidad'] else None
    b['tasaContacto']=round_js(b['contesto']/b['casos']*1000)/10 if b['casos'] else 0
    b['tasaCierre']=round_js(b['firmo']/b['casos']*1000)/10 if b['casos'] else 0
    semanas.append(b)
semanasTodas=list(semanas)
semanas=[x for x in semanas if x['casos']>=5]

stockN=0.0; stockM=0.0
corte=min(spanFin,ultimoCredito)
for k in range(31):
    dS=(datetime.date.fromisoformat(corte)-datetime.timedelta(days=k)).isoformat()
    o=oprDia.get(dS)
    if not o: continue
    stockN+=o['apr']-o['firm']; stockM+=o['mApr']-o['mFirm']

gDia={}
def cel(d): return gDia.setdefault(d,dict(fecha=d,casos=0.0,contesto=0.0,hablo=0.0,firmo=0.0,monto=0.0,mNoContesta=0.0,mColgo=0.0,mFirmo=0.0,mCau=0.0))
for r in hjGes:
    d=fch(r)
    if not re.match(r'^\d{4}-\d{2}-\d{2}$',d): continue
    c=cel(d)
    c['casos']+=num(r.get('casos')); c['contesto']+=num(r.get('contesto'))
    c['hablo']+=num(r.get('hablo')); c['firmo']+=num(r.get('firmo'))
    c['monto']+=num(r.get('monto_trabajado'))
for r in hjCau:
    d=fch(r)
    if d not in gDia: continue
    n=str(r.get('causal') or ''); c=gDia[d]
    c['mCau']+=num(r.get('monto'))
    if re.search(r'no\s*contesta|no\s*contactad',n,re.I): c['mNoContesta']+=num(r.get('monto'))
    elif re.search(r'cuelga',n,re.I): c['mColgo']+=num(r.get('monto'))
for r in hjDes:
    d=fch(r)
    if d not in gDia: continue
    if str(r.get('desenlace') or '')=='firmo': gDia[d]['mFirmo']+=num(r.get('monto'))

DOW=['lun','mar','mie','jue','vie']
calendario=[]
for k in sorted({lunes(d) for d in gDia}):
    lun=datetime.date.fromisoformat(k); dias=[]
    for i in range(5):
        d=(lun+datetime.timedelta(days=i)).isoformat()
        g2=gDia.get(d); o2=oprDia.get(d)
        sinCredito=(not o2) or bool(ultimoCredito and d>ultimoCredito)
        enN=(o2['apr']-o2['firm']) if o2 else 0
        enM=(o2['mApr']-o2['mFirm']) if o2 else 0
        cuadra=bool(g2 and g2['monto']>0 and abs(g2['mCau']-g2['monto'])<=1)
        dias.append(dict(fecha=d,dow=DOW[i],hubo=bool(g2),sinCredito=bool(sinCredito),
            sinMonto=bool(g2 and g2['casos']>0 and g2['monto']==0),
            entroCasos=round_js(enN),entroMonto=round_js(enM),
            casos=g2['casos'] if g2 else 0,contesto=g2['contesto'] if g2 else 0,
            hablo=g2['hablo'] if g2 else 0,firmo=g2['firmo'] if g2 else 0,
            monto=round_js(g2['monto']) if g2 else 0,mFirmo=round_js(g2['mFirmo']) if g2 else 0,
            mHablo=round_js(g2['monto']-g2['mNoContesta']-g2['mColgo']) if (g2 and cuadra) else None,
            cobertura=round_js(g2['monto']/enM*1000)/10 if (g2 and not sinCredito and enM>0 and g2['monto']>0) else None,
            coberturaCasos=round_js(g2['casos']/enN*1000)/10 if (g2 and not sinCredito and enN>0) else None))
    calendario.append(dict(semana=k,dias=dias))

cohAg={}
for r in hjDes:
    f=fch(r)
    if not re.match(r'^\d{4}-\d{2}-\d{2}$',f): continue
    k=lunes(f)
    b=cohAg.setdefault(k,dict(semana=k,firmo=0.0,vivo=0.0,vencido=0.0,sinCruce=0.0,mFirmo=0.0,mVivo=0.0,mVencido=0.0))
    d3=str(r.get('desenlace') or ''); n3=num(r.get('casos')); m3=num(r.get('monto'))
    if d3=='firmo':
        b['firmo']+=n3; b['mFirmo']+=m3
    elif d3=='vivo':
        b['vivo']+=n3; b['mVivo']+=m3
    elif d3=='vencido':
        b['vencido']+=n3; b['mVencido']+=m3
    else:
        b['sinCruce']+=n3
cohortes=[]
for k in sorted(cohAg):
    b=dict(cohAg[k]); cc=b['firmo']+b['vivo']+b['vencido']; res=b['firmo']+b['vencido']
    b['casos']=cc+b['sinCruce']; b['conCredito']=cc; b['resuelto']=res
    b['pctResuelto']=round_js(res/cc*1000)/10 if cc else 0
    b['cierreTodos']=round_js(b['firmo']/cc*1000)/10 if cc else 0
    b['cierreResuelto']=round_js(b['firmo']/res*1000)/10 if res else None
    b['legible']=b['pctResuelto']>=80
    for m in ('mFirmo','mVivo','mVencido'): b[m]=round_js(b[m])
    if b['casos']>=5: cohortes.append(b)

waAg={'respondio':dict(casos=0.0,firmaron=0.0,monto=0.0),'no':dict(casos=0.0,firmaron=0.0,monto=0.0)}
for r in hjWa:
    if not enR(r): continue
    k='respondio' if str(r.get('grupo') or '')=='respondio' else 'no'
    waAg[k]['casos']+=num(r.get('casos')); waAg[k]['firmaron']+=num(r.get('firmaron'))
    waAg[k]['monto']+=num(r.get('monto_firmado'))
def tasaWa(b): return round_js(b['firmaron']/b['casos']*1000)/10 if b['casos'] else 0

dvAg={'firmo':0.0,'vivo':0.0,'vencido':0.0,'sin_cruce':0.0,'otro':0.0}
for r in hjDes:
    if not enR(r): continue
    k=str(r.get('desenlace') or 'otro')
    if k not in dvAg: k='otro'
    dvAg[k]+=num(r.get('casos'))
mFirmo=sum(num(r.get('monto')) for r in hjDes if enR(r) and str(r.get('desenlace') or '')=='firmo')

historia=[]
for r in hjHist:
    mes=str(r.get('mes') or '')
    if not re.match(r'^\d{4}-\d{2}$',mes): continue
    casos=num(r.get('casos')); firmas=num(r.get('firmas'))
    historia.append(dict(mes=mes,casos=casos,firmas=firmas,personas=num(r.get('personas')),
        tasa=round_js(firmas/casos*10000)/100 if casos else 0,
        wa=num(r.get('por_whatsapp')),llamada=num(r.get('por_llamada')),era='anterior'))
mesNuevo={}
for r in hjGes:
    m=str(r.get('fecha') or '')[:7]
    if not re.match(r'^\d{4}-\d{2}$',m): continue
    b=mesNuevo.setdefault(m,dict(mes=m,casos=0.0,firmas=0.0))
    b['casos']+=num(r.get('casos')); b['firmas']+=num(r.get('firmo'))
for m in sorted(mesNuevo):
    if m<='2026-07': continue
    b=mesNuevo[m]
    historia.append(dict(mes=m,casos=b['casos'],firmas=b['firmas'],personas=1,
        tasa=round_js(b['firmas']/b['casos']*10000)/100 if b['casos'] else 0,wa=0,llamada=0,era='nueva'))
historia.sort(key=lambda x:x['mes'])
