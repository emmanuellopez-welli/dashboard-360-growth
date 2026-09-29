import re, json, time
import os
# La carpeta del proyecto se movio de OneDrive/Escritorio a Desktop (18-sep-2026);
# se prueban ambas para que los pulls viejos sigan corriendo sin editarlos.
_RUTAS = [r"c:/Users/millo/Desktop/Dashboard 360 mkt/.env",
          r"c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/.env"]
env = ""
for _r in _RUTAS:
    if os.path.exists(_r):
        env = open(_r).read()
        break
if not env:
    raise RuntimeError("No encuentro el .env en ninguna de las rutas conocidas")
KEYS = dict(re.findall(r'([A-Z_]+)\s*[:=]\s*(\S+)', env))
from composio import Composio
C = Composio(api_key=KEYS['COMPOSIO_API_KEY'])
USER = "pg-test-bb3aeea3-7e05-4b0e-a8a8-0ebf4e1075f4"

# Los datasets de WELLI NO estan en US. Sin location explicita, el job se
# crea en US, falla con "Dataset not found in location US", y jobComplete
# nunca llega -> el helper giraba 5 minutos sin decir nada.
BQ_LOCATION = "us-central1"


# La cuenta de BigQuery se vence sola cada tanto (9-sep-2026: la que venia
# usandose por defecto amanecio EXPIRED y todo pull murio con un 401 que no
# dice cual es la cuenta). En vez de dejar que Composio elija, se busca UNA
# ACTIVA y se fija. Se cachea porque listar cuentas en cada query es una
# llamada de red por consulta.
_CUENTA_BQ = [None]


def cuenta_bq():
    if _CUENTA_BQ[0]:
        return _CUENTA_BQ[0]
    for i in getattr(C.connected_accounts.list(), 'items', []):
        tk = getattr(i, 'toolkit', None)
        slug = getattr(tk, 'slug', tk)
        if slug == 'googlebigquery' and getattr(i, 'status', None) == 'ACTIVE':
            _CUENTA_BQ[0] = getattr(i, 'id', None)
            return _CUENTA_BQ[0]
    raise RuntimeError('No hay ninguna cuenta de BigQuery ACTIVE en Composio: '
                       'hay que reautorizar la conexion.')


def ex(slug, args, user=None, cuenta=None):
    kw = {}
    if cuenta:
        kw['connected_account_id'] = cuenta
    r = C.tools.execute(slug, arguments=args, user_id=user or USER,
                        dangerously_skip_version_check=True, **kw)
    return r


def _uid():
    items = getattr(C.connected_accounts.list(), 'items', [])
    for i in items:
        if i.status == 'ACTIVE':
            return getattr(i, 'user_id', None) or getattr(i, 'userId', None)
    return None


def bq(sql, project="welli-tecnologia", uid=None, location=None):
    """Corre una query y devuelve lista de dicts. Falla rapido y con el
    mensaje real de BigQuery en vez de agotar un timeout ciego."""
    loc = location or BQ_LOCATION
    cta = cuenta_bq()
    r = ex("GOOGLEBIGQUERY_INSERT_JOB", {
        "projectId": project,
        "jobReference": {"projectId": project, "location": loc},
        "configuration": {"query": {"query": sql, "useLegacySql": False}}
    }, user=uid, cuenta=cta)
    if not r.get('successful', r.get('successfull', False)):
        raise RuntimeError("INSERT_JOB fallo: " + json.dumps(r)[:600])

    d = r['data']
    # El job puede venir ya fallado: revisar SIEMPRE errorResult primero.
    err = ((d.get('status') or {}).get('errorResult') or {}).get('message')
    if err:
        raise RuntimeError("BigQuery: " + err)

    job = d['jobReference']['jobId']
    for _ in range(90):
        g = ex("GOOGLEBIGQUERY_GET_QUERY_RESULTS",
               {"projectId": project, "jobId": job, "location": loc,
                "maxResults": 20000}, user=uid, cuenta=cta)
        if not g.get('successful', g.get('successfull', False)):
            raise RuntimeError("GET_QUERY_RESULTS fallo: " + json.dumps(g)[:400])
        gd = g['data']
        errs = gd.get('errors') or []
        if errs:
            raise RuntimeError("BigQuery: " + json.dumps(errs)[:400])
        if gd.get('jobComplete'):
            campos = [f['name'] for f in gd.get('schema', {}).get('fields', [])]
            filas = []
            for row in gd.get('rows', []):
                filas.append(dict(zip(campos, [c.get('v') for c in row['f']])))
            # paginacion por pageToken
            token = gd.get('pageToken')
            while token:
                g2 = ex("GOOGLEBIGQUERY_GET_QUERY_RESULTS",
                        {"projectId": project, "jobId": job, "location": loc,
                         "pageToken": token, "maxResults": 20000}, user=uid,
                        cuenta=cta)
                g2d = g2.get('data', {})
                for row in g2d.get('rows', []):
                    filas.append(dict(zip(campos, [c.get('v') for c in row['f']])))
                token = g2d.get('pageToken')
            return filas
        time.sleep(2)
    raise TimeoutError("bq: el job no termino en 3 minutos")
