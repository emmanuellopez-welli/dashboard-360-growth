# -*- coding: utf-8 -*-
import datetime, collections
from qa_lib import *

INI,FIN='2026-08-01','2026-09-06'
PINI,PFIN='2026-06-25','2026-07-31'
HOY='2026-09-07'

SEDES=hoja('SEDES')
PLAT=hoja('PLATAFORMA_SEDES')
paisDe={}; espDe={}
for r in PLAT:
    i=str(r.get('id_sede') or '').strip()
    if not i: continue
    paisDe[i]=str(r.get('pais') or 'COL')
    espDe[i]=str(r.get('especialidad') or '')

def esDeshab(s): return 'deshabilitad' in str(s.get('pipeline') or '').lower()

deshabHS=set(); deshabNom=set(); deshabId=set()
for s in SEDES:
    if not esDeshab(s): continue
    if str(s.get('id') or '').strip(): deshabHS.add(str(s['id']).strip())
    if str(s.get('id_internal') or '').strip(): deshabId.add(str(s['id_internal']).strip())
    if normNombre(s.get('nombre_sede')): deshabNom.add(normNombre(s.get('nombre_sede')))

todas=[]
for s in SEDES:
    if esDeshab(s): continue
    i=str(s.get('id_internal') or '').strip()
    if not i: continue
    p=paisDe.get(i)
    if p is None or p!='COL': continue
    todas.append(s)
Ufilas=todas  # sin filtro de origen => todas

# CREDITOP exclusion
fueraHS=set(); fueraInt=set(); fueraNom=set(); fueraN=0
for s in SEDES:
    if normOrigen(s.get('origen'))!='CREDITOP': continue
    fueraN+=1
    if str(s.get('id') or '').strip(): fueraHS.add(str(s['id']).strip())
    if str(s.get('id_internal') or '').strip(): fueraInt.add(str(s['id_internal']).strip())
    if normNombre(s.get('nombre_sede')): fueraNom.add(normNombre(s.get('nombre_sede')))

# hechos
idx={}
for r in hoja('CREDITO_SEDES'):
    idx[int(num(r.get('i')))]=str(r.get('sede') or '').strip()
BASE=datetime.date(2025,1,1)
HECHOS=[]
for r in hoja('CREDITO_DIA'):
    d=int(num(r.get('d')))
    HECHOS.append(dict(sede=idx.get(int(num(r.get('s'))),''),
        fecha=(BASE+datetime.timedelta(days=d)).isoformat(),
        apr=num(r.get('apr')), conv=num(r.get('conv')),
        mApr=num(r.get('m_apr')), mConv=num(r.get('m_conv'))))

def recorrer(desde,hasta):
    for r in HECHOS:
        if r['fecha']<desde or r['fecha']>hasta: continue
        if r['sede'] in deshabHS: continue   # sinFiltro path
        if r['sede'] in fueraHS: continue
        yield r

# atribSede_: sobre TODA la hoja SEDES (incl deshabilitadas)
AT={}
for s in SEDES:
    hs=str(s.get('id') or '').strip()
    if not hs: continue
    interno=str(s.get('id_internal') or '').strip()
    AT[hs]=ventanaDeEsp(espDe.get(interno,''))

def cortar(desde,hasta):
    t=dict(apr=0,firm=0,mApr=0.0,mFirm=0.0)
    porV=collections.defaultdict(lambda: dict(apr=0,firm=0,mApr=0.0,mFirm=0.0))
    porDia=collections.defaultdict(lambda: dict(apr=0,firm=0,mApr=0.0,mFirm=0.0))
    for r in recorrer(desde,hasta):
        v=AT.get(r['sede'],'-')
        t['apr']+=r['apr']; t['firm']+=r['conv']; t['mApr']+=r['mApr']; t['mFirm']+=r['mConv']
        for b in (porV[v],porDia[r['fecha']]):
            b['apr']+=r['apr']; b['firm']+=r['conv']; b['mApr']+=r['mApr']; b['mFirm']+=r['mConv']
    t['porV']=porV; t['porDia']=porDia
    return t
