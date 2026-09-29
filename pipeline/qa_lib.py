# -*- coding: utf-8 -*-
import json, io, unicodedata, re, datetime
SD = None
def hojas():
    global SD
    if SD is None:
        SD = json.load(io.open('sheet_data.json', encoding='utf-8'))
    return SD
def hoja(n):
    h = hojas().get(n)
    if not h or len(h) < 2: return []
    head = [str(x).strip() for x in h[0]]
    out=[]
    for fila in h[1:]:
        if ''.join('' if v is None else str(v) for v in fila)=='' : continue
        o={}
        for j,k in enumerate(head):
            o[k]= fila[j] if j < len(fila) else None
        out.append(o)
    return out
def num(v):
    if v is None or v=='' : return 0
    try: return float(v)
    except: return 0
def _strip(s):
    s = str('' if s is None else s).upper()
    for a,b in (('ÁÀÄÂ','A'),('ÉÈËÊ','E'),('ÍÌÏÎ','I'),('ÓÒÖÔ','O'),('ÚÙÜÛ','U'),('Ñ','N')):
        for ch in a: s=s.replace(ch,b)
    return s
def normOrigen(o):
    s = str('' if o is None else o).strip()
    if not s: return 'SIN ORIGEN'
    return re.sub(r'\s+',' ', _strip(s))
def normNombre(n):
    return re.sub(r'[^A-Z0-9]','', _strip(n))
VENTANAS = [('C',['ODONTOLOGIA','MEDICINA GENERAL','DERMATOLOGIA Y ESTETICA','FISIOTERAPIA']),
            ('B',['MEDICINA ESTETICA','OBESIDAD Y CIRUGIA BARIATRICA','OFTALMOLOGIA','VETERINARIA','AUDIOLOGIA']),
            ('A',['CIRUGIA PLASTICA'])]
VIDX={}
for vid,esps in VENTANAS:
    for e in esps: VIDX[e]=vid
def ventanaDeEsp(esp): return VIDX.get(normOrigen(esp),'—')
def lunes(iso):
    d=datetime.date.fromisoformat(iso)
    return (d - datetime.timedelta(days=d.weekday())).isoformat()
def r1(x):  # Math.round to 1 decimal of pct*1000/10
    return round_js(x*1000)/10.0
def round_js(x):
    import math
    return math.floor(x+0.5) if x>=0 else -math.floor(-x+0.5)
