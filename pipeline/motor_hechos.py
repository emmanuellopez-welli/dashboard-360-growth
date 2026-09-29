# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# el bloque de hechos va antes de armarF1_
h = io.open('hechos.js', encoding='utf8').read().rstrip('\n')
anc = 'function armarF1_('
j = s.rindex('/*', 0, s.index(anc))
s = s[:j] + h + '\n\n' + s[j:]

# pasaFiltros_ ya no hace falta: el filtro vive en U.idsHS
ini = s.index('/** ¿Esta fila pasa los DOS filtros globales?')
fin = s.index('\n}\n', ini) + 3
s = s[:ini] + s[fin:]

# ---- F1 seccion 5: el corte de cohorte sale de los hechos ----
old = s[s.index('  var cdF1 = leerHoja_(\'COSECHA_DIA\');'):
         s.index('  var cohA = cortarCd_(R.inicio, R.fin, mesIni, mesFin);')]
new = """  // El corte de la cohorte sale de la tabla de hechos: la sede entro en un
  // mes que toca el rango Y el credito se radico dentro del rango. El filtro
  // global (origen y los tres roles) ya viene resuelto en U.idsHS.
  var AT = atribSede_(U);
  function mesMas_(c, k) {
    if (!/^\d{4}-\d{2}$/.test(String(c || ''))) return '';
    var t = Number(c.substring(0, 4)) * 12 + (Number(c.substring(5, 7)) - 1) + k;
    return ('0000' + Math.floor(t / 12)).slice(-4) + '-' + ('0' + (t % 12 + 1)).slice(-2);
  }
  var mesIni = R.inicio.substring(0, 7), mesFin = R.fin.substring(0, 7);
  var mesPrevIni = mesMas_(mesIni, -1), mesPrevFin = mesMas_(mesFin, -1);

  var sedesPer = 0, sedesPerPrev = 0;
  Object.keys(agCos).forEach(function (m) {
    if (esCargaInicial_(m)) return;
    var b = agCos[m];
    if (m >= mesIni && m <= mesFin) sedesPer += b.total;
    if (m >= mesPrevIni && m <= mesPrevFin) sedesPerPrev += b.total;
  });

  function cortarCd_(desde, hasta, mDesde, mHasta, conCargaInicial) {
    var t = { sol: 0, apr: 0, conv: 0, monto: 0 };
    var dia = {}, org = {};
    recorrerHechos_(U, desde, hasta, function (r) {
      var a = AT[r.sede];
      if (!a) return;
      var cos = a.cosecha;
      if (cos < mDesde || cos > mHasta) return;
      if (!conCargaInicial && esCargaInicial_(cos)) return;
      t.sol += r.sol; t.apr += r.apr; t.conv += r.conv; t.monto += r.mConv;
      dia[r.fecha] = (dia[r.fecha] || 0) + r.mConv;
      var o = a.origen;
      if (!org[o]) org[o] = { origen: o, sol: 0, apr: 0, des: 0, monto: 0 };
      var b = org[o];
      b.sol += r.sol; b.apr += r.apr; b.des += r.conv; b.monto += r.mConv;
    });
    t.dia = dia;
    t.org = org;
    return t;
  }
  var todoPer = cortarCd_(R.inicio, R.fin, '0000-00', '9999-99', true);
"""
s = s.replace(old, new, 1)

# ---- el retorno de social media ----
old2 = s[s.index('  var cdRoi = leerHoja_(\'COSECHA_DIA\');'):
          s.index('  // Las sedes de social media por cosecha salen de agCos')]
new2 = """  var metaRoi = leerHoja_('META_ADS');
  var agRoi = {};
  function bRoi_(m) {
    if (!agRoi[m]) {
      agRoi[m] = { mes: m, leads: 0, gasto: 0, sedes: 0, sol: 0, apr: 0,
                   des: 0, plata: 0, plataM0: 0, desM0: 0 };
    }
    return agRoi[m];
  }
  metaRoi.forEach(function (r) {
    var m = String(fechaCelda_(r.fecha) || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    var b = bRoi_(m);
    b.leads += num_(r.leads);
    b.gasto += num_(r.gasto);
  });
  // La plata de social media, de la tabla de hechos: respeta el filtro de
  // roles igual que todo lo demas.
  recorrerHechos_(U, '2000-01-01', '9999-12-31', function (r) {
    var a = AT[r.sede];
    if (!a || a.origen !== 'SOCIAL MEDIA') return;
    var m = a.cosecha;
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    var b = bRoi_(m);
    b.sol += r.sol; b.apr += r.apr; b.des += r.conv; b.plata += r.mConv;
    if (r.fecha.substring(0, 7) === m) {
      b.plataM0 += r.mConv;
      b.desM0 += r.conv;
    }
  });
"""
s = s.replace(old2, new2, 1)

# ---- F4 ----
old3 = s[s.index('  var rv = leerHoja_(\'RESCATE_VENTANA\');'):
          s.index('  var rA = cortarRv_(R.inicio, R.fin);')]
new3 = """  // La oportunidad y el cierre por ventana, tambien de la tabla de hechos.
  var AT4 = atribSede_(U);
  function cortarRv_(desde, hasta) {
    var t = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
    var porV = {}, porDia = {};
    recorrerHechos_(U, desde, hasta, function (r) {
      var a = AT4[r.sede];
      var v = (a && a.ventana) ? a.ventana : '-';
      t.apr += r.apr; t.firm += r.conv; t.mApr += r.mApr; t.mFirm += r.mConv;
      if (!porV[v]) porV[v] = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      var b = porV[v];
      b.apr += r.apr; b.firm += r.conv; b.mApr += r.mApr; b.mFirm += r.mConv;
      if (!porDia[r.fecha]) porDia[r.fecha] = { apr: 0, firm: 0 };
      porDia[r.fecha].apr += r.apr;
      porDia[r.fecha].firm += r.conv;
    });
    t.porV = porV;
    t.porDia = porDia;
    return t;
  }
"""
s = s.replace(old3, new3, 1)

# ---- deals: el filtro de rol no aplica (el owner del deal es otro campo) ----
rep("""    // El owner que manda en deals es el del DEAL, no el de la sede: el deal
    // existe antes que la sede y lo trabaja un hunter.
    if (!pasaFiltros_(r, U, selDc)) return;""",
    """    // El origen si corta; el rol NO: el owner del deal es su propio campo y
    // los tres roles del filtro son de la SEDE, que en un deal abierto
    // todavia no existe. Se dice en el subtitulo de la seccion.
    var o = normOrigen_(r.origen);
    if (!U.todos && !selDc[o]) return;""")

# ---- meta ----
rep("""      equipos: U.equipos, equiposTodos: U.equiposTodos,
      equipoEtiqueta: U.equipoEtiqueta, catalogoEquipos: U.catalogoEquipos,""",
    """      roles: U.roles, rolesTodos: U.rolesTodos,
      rolEtiqueta: U.rolEtiqueta, catalogoRoles: U.catalogoRoles,""")
rep("""function getDashboardData(inicio, fin, origenes, equipos) {""",
    """function getDashboardData(inicio, fin, origenes, roles) {""")
rep("""  var U = universoSedes_(origenes, equipos);""",
    """  var U = universoSedes_(origenes, roles);""")

# mesesConDatos_ leia COSECHA_DIA
rep("""  leerHoja_('COSECHA_DIA').forEach(function (r) {
    var c = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(c) || esCargaInicial_(c)) return;
    if (c < min) min = c;
  });""",
    """  leerHoja_('SEDES').forEach(function (r) {
    var c = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(c) || esCargaInicial_(c)) return;
    if (c < min) min = c;
  });""")
io.open(p, 'w', encoding='utf8').write(s)
print('motor sobre la tabla de hechos')
