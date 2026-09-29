# -*- coding: utf-8 -*-
from qa_univ import *
import re, collections

def sinCU(h): return [r for r in h if normNombre(r.get('sede')) not in fueraNom]
hjGes0=hoja('RESCATE_GESTION')
hjGes=sinCU(hjGes0)
hjCau=sinCU(hoja('RESCATE_CAUSAL'))
hjPool=sinCU(hoja('RESCATE_POOL'))
hjWa=sinCU(hoja('RESCATE_WA'))
hjDes=sinCU(hoja('RESCATE_DESENLACE'))
hjHist=hoja('RESCATE_HIST')
gesQuitadas=len(hjGes0)-len(hjGes)

def fch(r): return str(r.get('fecha') or '')[:10]
def enR(r,a=INI,b=FIN): return a<=fch(r)<=b

GC=['casos','llamadas','contesto','colgo','tercero','hablo','interesado','firmo','monto_trabajado','sin_nota']
def suma(h,cols,a,b):
    t={c:0.0 for c in cols}; n=0
    for r in h:
        if not (a<=fch(r)<=b): continue
        n+=1
        for c in cols: t[c]+=num(r.get(c))
    t['_dias']=n
    return t
gA=suma(hjGes,GC,INI,FIN); gP=suma(hjGes,GC,PINI,PFIN)
pA=suma(hjPool,['rescatados','monto_rescatado','trabajados','monto_trabajado'],INI,FIN)

agC={}
for r in hjCau:
    if not enR(r): continue
    k=str(r.get('causal') or '(sin causal)')
    b=agC.setdefault(k,dict(causal=k,casos=0.0,monto=0.0))
    b['casos']+=num(r.get('casos')); b['monto']+=num(r.get('monto'))
totC=sum(c['casos'] for c in agC.values())
causales=sorted(agC.values(), key=lambda c:-c['casos'])
for c in causales: c['pct']=round_js(c['casos']/totC*1000)/10 if totC else 0
