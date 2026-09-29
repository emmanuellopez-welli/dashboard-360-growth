from qa_rest import *
import collections
cd=collections.Counter()
for d in oprDia: cd[lunes(d)]+=1
for s in semanas:
    n=cd[s['semana']]
    prom=s['oportunidad']/n
    print(s['semana'],'dias credito',n,'oport',s['oportunidad'],'oport/dia',round(prom,1),
          'cob mostrada',s['cobertura'],'cob normalizada 7d',round(s['casos']/(prom*7)*100,1))
