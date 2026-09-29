# -*- coding: utf-8 -*-
"""
Siembra la hoja META_ADS: una fila por dia x anuncio.

Misma logica que apps_script/Fuentes_MetaAds.gs:
 - leads = SOLO actions con action_type == 'lead'. NO sumar 'lead_grouped'
   ni 'offsite_conversion.*_add_meta_leads': son el mismo lead duplicado.
 - CPL no existe como campo: se deriva gasto/leads.
 - ctr ya viene en porcentaje (2.07 = 2,07%).
"""
import lib, requests, json, io, time, collections

V = 'v21.0'
ACT = 'act_1373974740859060'
DESDE = '2026-01-01'
HASTA = time.strftime('%Y-%m-%d')
T = lib.KEYS['META_ACCESS_TOKEN']


def leads_de(actions):
    if not actions:
        return 0
    tot = 0
    for a in actions:
        if a.get('action_type') == 'lead':
            tot += float(a.get('value') or 0)
    return tot


def pull():
    url = 'https://graph.facebook.com/%s/%s/insights' % (V, ACT)
    params = {
        'level': 'ad',
        'fields': 'campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,actions',
        'time_range': json.dumps({'since': DESDE, 'until': HASTA}),
        'time_increment': 1,
        'limit': 500,
        'access_token': T,
    }
    filas = []
    vueltas = 0
    while url and vueltas < 200:
        for intento in range(4):
            r = requests.get(url, params=params, timeout=120)
            if r.status_code == 200:
                break
            txt = r.text
            print('  %d %s' % (r.status_code, txt[:150]))
            if r.status_code == 429 or '"code":17' in txt or '80004' in txt:
                time.sleep(8 * (intento + 1))
                continue
            raise RuntimeError('Meta %d: %s' % (r.status_code, txt[:400]))
        else:
            raise RuntimeError('se agotaron los reintentos')

        d = r.json()
        filas += d.get('data', [])
        nxt = (d.get('paging') or {}).get('next')
        url, params = nxt, None
        vueltas += 1
        print('   pagina %d, %d filas acumuladas' % (vueltas, len(filas)))
    return filas


if __name__ == '__main__':
    crudo = pull()
    tabla = [['fecha', 'campana', 'adset', 'anuncio', 'leads', 'gasto',
              'impresiones', 'clics', 'ctr_pct', 'cpl']]
    for r in crudo:
        leads = leads_de(r.get('actions'))
        gasto = float(r.get('spend') or 0)
        tabla.append([
            str(r.get('date_start') or '')[:10],
            r.get('campaign_name') or '', r.get('adset_name') or '',
            r.get('ad_name') or '',
            leads, gasto,
            int(float(r.get('impressions') or 0)),
            int(float(r.get('clicks') or 0)),
            float(r.get('ctr') or 0),
            round(gasto / leads) if leads else 0,
        ])
    json.dump({'META_ADS': tabla}, io.open('tables_meta.json', 'w', encoding='utf8'),
              ensure_ascii=False)

    f = tabla[1:]
    tl = sum(x[4] for x in f)
    tg = sum(x[5] for x in f)
    ti = sum(x[6] for x in f)
    tc = sum(x[7] for x in f)
    def cop(x):
        return '$' + format(int(x), ',').replace(',', '.')
    print('\nMETA_ADS %d filas (%s a %s)' % (len(f), DESDE, HASTA))
    print('TOTALES 2026: leads %d | gasto %s | CPL %s | impresiones %s | clics %s | CTR %.2f%%'
          % (tl, cop(tg), cop(tg / tl) if tl else 0,
             format(ti, ',').replace(',', '.'), format(tc, ',').replace(',', '.'),
             100.0 * tc / ti if ti else 0))

    porMes = collections.defaultdict(lambda: collections.Counter())
    for x in f:
        b = porMes[x[0][:7]]
        b['leads'] += x[4]; b['gasto'] += x[5]; b['impr'] += x[6]; b['clics'] += x[7]
    print('\nPor mes:')
    for m in sorted(porMes):
        b = porMes[m]
        print('  %s  leads %5d  gasto %14s  CPL %10s'
              % (m, b['leads'], cop(b['gasto']),
                 cop(b['gasto'] / b['leads']) if b['leads'] else '-'))

    camp = collections.defaultdict(lambda: collections.Counter())
    for x in f:
        b = camp[x[2] or '(sin adset)']
        b['leads'] += x[4]; b['gasto'] += x[5]
    print('\nPor grupo de anuncios:')
    for k, b in sorted(camp.items(), key=lambda x: -x[1]['gasto']):
        print('  %-38s leads %5d  gasto %14s  CPL %10s'
              % (k[:38], b['leads'], cop(b['gasto']),
                 cop(b['gasto'] / b['leads']) if b['leads'] else '-'))
