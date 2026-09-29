import lib, requests, json, io, collections, time
H = {'Authorization': 'Token ' + lib.KEYS['HILOS_API_KEY']}
BASE = 'https://api.hilos.io/api/'

def get(path, params=None, tries=4):
    for a in range(tries):
        try:
            r = requests.get(BASE+path, headers=H, params=params, timeout=90)
            if r.status_code == 200: return r.json()
            print('  ', r.status_code, r.text[:120])
        except Exception as e: print('  exc', str(e)[:120])
        time.sleep(3)
    return None

def paged(path, limit=40, cap=None):
    out, url, params = [], BASE+path, {'limit':limit}
    while url:
        for a in range(4):
            try:
                r = requests.get(url, headers=H, params=params, timeout=90)
                if r.status_code==200: break
                print('  ',r.status_code); time.sleep(3)
            except Exception as e: print('  exc',str(e)[:100]); time.sleep(3)
        else: break
        d = r.json(); out += d.get('results',[])
        url, params = d.get('next'), None
        print(f'   {path}: {len(out)}/{d.get("count")}')
        if cap and len(out) >= cap: break
    return out

if __name__ == '__main__':
    bc = paged('broadcast', limit=40)
    fl = paged('flow', limit=40)
    json.dump({'broadcasts':bc,'flows':fl}, io.open('hilos_raw.json','w',encoding='utf8'), ensure_ascii=False)
    print('SAVED broadcasts', len(bc), 'flows', len(fl))
