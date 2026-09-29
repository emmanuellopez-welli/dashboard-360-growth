import io
p='Code.gs'
s=io.open(p,encoding='utf8').read()
old = "    wf[wid] = { id: wid, nombre: String(r.workflow || '').replace(/^\[Growth\]\s*/, ''),"
assert old in s, 'no coincide'
new = (
"    // El nombre viene como \"[Growth] <emoji> 04 Vuelve a aplicar\". Se quita\n"
"    // el prefijo de equipo y la basura no imprimible del emoji, que en la\n"
"    // hoja llega mutilada.\n"
"    var nom = String(r.workflow || '')\n"
"      .replace(/^\s*(LT|\[Growth\])\s*/i, '')\n"
"      .replace(/[^A-Za-z0-9\u00C0-\u017F .\-]/g, '')\n"
"      .replace(/^[\s.\-]+/, '').trim();\n"
"    wf[wid] = { id: wid, nombre: nom || ('workflow ' + wid),"
)
io.open(p,'w',encoding='utf8').write(s.replace(old,new,1))
print('nombres ok')
