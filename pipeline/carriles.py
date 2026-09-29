# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()

old_a = """  var dias = Object.keys(porDia).sort();
  // El alto de la banda de etiquetas depende de cuantos impactos coincidan en
  // el mismo dia: se apilan, y si no se reserva el espacio se salen del SVG.
  var maxApilado = 0;
  dias.forEach(function (d) {
    if (porDia[d].length > maxApilado) maxApilado = porDia[d].length;
  });
  var banda = maxApilado ? 14 + maxApilado * 15 : 10;"""
new_a = """  var dias = Object.keys(porDia).sort();"""
assert old_a in s
s = s.replace(old_a, new_a, 1)

# el bloque de marcas: se reescribe con asignacion de carriles
ini = s.index("  // Marcas primero: van DEBAJO de las barras para no taparlas.")
fin = s.index("  serie.forEach(function (p, i) {\n    var bwd = Math.max(2, bw * 0.62);")
nuevo = """  // Marcas primero: van DEBAJO de las barras para no taparlas.
  //
  // Los rotulos se reparten en CARRILES. Apilar solo por dia no basta: si dos
  // impactos caen en dias vecinos de un rango largo, sus etiquetas quedan a
  // pocos pixeles y se pisan hasta ser ilegibles. Se recorren de izquierda a
  // derecha y cada uno baja al primer carril donde quepa sin tocar al
  // anterior, que es la colocacion estandar para etiquetas de evento.
  var marcas = [];
  dias.forEach(function (fch) {
    porDia[fch].forEach(function (im) {
      marcas.push({ im: im, cx: x(idx[fch]) + bw / 2 });
    });
  });
  marcas.sort(function (a, b) { return a.cx - b.cx; });
  var finCarril = [];
  marcas.forEach(function (m) {
    var txt = m.im.pieza + ' ' + fNum(m.im.sedes);
    m.ancho = txt.length * 5.3 + 14;          // aprox del ancho a 9,5px
    // Cerca del borde derecho la etiqueta se voltea a la izquierda del punto.
    m.izq = (m.cx + m.ancho) > (W - 12);
    var x0 = m.izq ? m.cx - m.ancho : m.cx;
    var c = 0;
    while (finCarril[c] !== undefined && finCarril[c] > x0 - 6) c++;
    m.carril = c;
    finCarril[c] = x0 + m.ancho;
  });
  var carriles = finCarril.length || 1;
  var banda = marcas.length ? 12 + carriles * 14 : 10;
"""
s = s[:ini] + nuevo + s[fin:]

# banda se calcula despues de x()/y(), asi que hay que reordenar: se mueve el
# calculo de geometria antes del bloque de marcas
old_geo = """  var H = (opt.alto || 250) + banda;
  var pl = 46, pr = 12, pt = banda, pb = 30;
  var an = W - pl - pr, al = H - pt - pb;
  var top = ejeMax(Math.max.apply(null, serie.map(function (p) { return p.y; }))) || 1;
  var bw = an / serie.length;
  var x = function (i) { return pl + i * bw; };
  var y = function (v) { return pt + al - (v / top) * al; };
"""
new_geo = """  // La geometria horizontal no depende de la banda de etiquetas, asi que se
  // calcula primero: los carriles necesitan x() para saber donde cae cada
  // marca, y la banda necesita los carriles para saber cuanto alto reservar.
  var pl = 46, pr = 12, pb = 30;
  var an = W - pl - pr;
  var top = ejeMax(Math.max.apply(null, serie.map(function (p) { return p.y; }))) || 1;
  var bw = an / serie.length;
  var x = function (i) { return pl + i * bw; };
"""
assert old_geo in s
s = s.replace(old_geo, new_geo, 1)

# despues de calcular la banda, se define el resto de la geometria vertical
anc = "  var carriles = finCarril.length || 1;\n  var banda = marcas.length ? 12 + carriles * 14 : 10;\n"
s = s.replace(anc, anc + """  var H = (opt.alto || 250) + banda;
  var pt = banda, al = H - pt - pb;
  var y = function (v) { return pt + al - (v / top) * al; };

""", 1)

# el dibujo de las marcas usa ahora el carril
old_dib = """  dias.forEach(function (fch) {
    var i = idx[fch];
    var cx = x(i) + bw / 2;
    porDia[fch].forEach(function (im, k) {
      var col = colorWf(im.audiencia);
      // WhatsApp continua, email punteada: el canal sin depender del color.
      var dash = im.canal === 'WhatsApp' ? '' : ' stroke-dasharray="3 3"';
      var yTop = banda - 8 - k * 15;
      s += '<line x1="' + cx.toFixed(1) + '" y1="' + yTop + '" x2="' + cx.toFixed(1) +
        '" y2="' + (pt + al) + '" stroke="' + col + '" stroke-width="1.5"' +
        dash + ' opacity=".8"/>';
      // Etiqueta directa. Se ancla al lado con mas espacio para no salirse.
      var alaIzq = cx > W * 0.62;
      var tx = alaIzq ? cx - 7 : cx + 7;
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + yTop + '" r="3.5" fill="' +
        col + '"/>';
      s += '<text x="' + tx.toFixed(1) + '" y="' + (yTop + 3.5) +
        '" text-anchor="' + (alaIzq ? 'end' : 'start') +
        '" font-size="9.5" font-weight="700" fill="' + col + '">' +
        esc(im.pieza) + '<tspan font-weight="400" fill="var(--texto-3)"> ' +
        esc(fNum(im.sedes)) + '</tspan></text>';
    });
  });"""
new_dib = """  marcas.forEach(function (m) {
    var im = m.im, col = colorWf(im.audiencia);
    // WhatsApp continua, email punteada: el canal sin depender del color.
    var dash = im.canal === 'WhatsApp' ? '' : ' stroke-dasharray="3 3"';
    var yl = 8 + m.carril * 14;
    s += '<line x1="' + m.cx.toFixed(1) + '" y1="' + yl + '" x2="' + m.cx.toFixed(1) +
      '" y2="' + (pt + al) + '" stroke="' + col + '" stroke-width="1.5"' +
      dash + ' opacity=".75"/>';
    s += '<circle cx="' + m.cx.toFixed(1) + '" cy="' + yl + '" r="3.2" fill="' +
      col + '"/>';
    s += '<text x="' + (m.izq ? m.cx - 6 : m.cx + 6).toFixed(1) + '" y="' + (yl + 3.4) +
      '" text-anchor="' + (m.izq ? 'end' : 'start') +
      '" font-size="9.5" font-weight="700" fill="' + col + '">' +
      esc(im.pieza) + '<tspan font-weight="400" fill="var(--texto-3)"> ' +
      esc(fNum(im.sedes)) + '</tspan></text>';
  });"""
assert old_dib in s
s = s.replace(old_dib, new_dib, 1)
io.open(p, 'w', encoding='utf8').write(s)
print('carriles implementados')
