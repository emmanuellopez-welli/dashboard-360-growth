/**
 * Arma la pagina de consulta de las sedes deshabilitadas que el tablero
 * dejo de contar. Lee deshab_lista.json (salida de la hoja SEDES real).
 */
const fs = require('fs');
const des = JSON.parse(fs.readFileSync('deshab_lista.json', 'utf8'));
const MKT = new Set(['PAGINA WEB', 'SOCIAL MEDIA', 'EVENTO', 'FREELANCE', 'REFERIDO',
  'DENTALINK', 'OK VET', 'DT DENTAL', 'STARKEY', 'ESSILOR', 'ANDREC', 'NOVO NORDISK']);
const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = n => Math.round(n).toLocaleString('es-CO');
const cop = n => n >= 1e9 ? '$' + (n / 1e9).toFixed(2).replace('.', ',') + ' MM'
  : n >= 1e6 ? '$' + (n / 1e6).toFixed(1).replace('.', ',') + ' M'
    : n > 0 ? '$' + f(n) : '—';
const MES = { '01': 'enero', '02': 'febrero', '03': 'marzo', '04': 'abril', '05': 'mayo',
  '06': 'junio', '07': 'julio', '08': 'agosto', '09': 'septiembre', '10': 'octubre',
  '11': 'noviembre', '12': 'diciembre' };
const etq = c => {
  const p = c.split('-');
  return MES[p[1]] ? MES[p[1]] + ' ' + p[0] : c;
};

const g = {};
des.forEach(x => { (g[x.c] = g[x.c] || []).push(x); });
const meses = Object.keys(g).sort();
const tot = { n: des.length, a: 0, m: 0 };
des.forEach(x => { tot.a += x.a; tot.m += x.m; });

let resumen = '';
meses.forEach(k => {
  const v = g[k];
  const a = v.reduce((s, x) => s + x.a, 0), m = v.reduce((s, x) => s + x.m, 0);
  const c26 = k >= '2026-01';
  resumen += '<tr' + (c26 ? ' class="c26"' : '') + '>' +
    '<td class="mes"><a href="#m' + k + '">' + esc(etq(k)) + '</a>' +
    '</td>' +
    '<td class="num">' + f(v.length) + '</td>' +
    '<td class="num">' + f(a) + '</td>' +
    '<td class="num">' + cop(m) + '</td></tr>';
});

let detalle = '';
meses.forEach(k => {
  const v = g[k].slice().sort((x, y) => y.m - x.m || y.a - x.a ||
    x.n.localeCompare(y.n, 'es'));
  const a = v.reduce((s, x) => s + x.a, 0), m = v.reduce((s, x) => s + x.m, 0);
  const conVol = v.filter(x => x.a > 0).length;
  detalle += '<section class="bloque" id="m' + k + '">' +
    '<header class="bh"><h3>' + esc(etq(k)) + '</h3>' +
    '<p class="bmeta">' + f(v.length) + ' sede' + (v.length === 1 ? '' : 's') +
    ' · ' + f(a) + ' aplicaciones · ' + cop(m) + ' · ' +
    f(conVol) + ' alcanzó a operar</p></header>' +
    '<div class="tw"><table class="det"><thead><tr><th>Sede</th><th>Origen</th>' +
    '<th class="num">Apps</th><th class="num">Plata desembolsada</th>' +
    '</tr></thead><tbody>';
  v.forEach(x => {
    const mk = MKT.has(x.o);
    detalle += '<tr data-b="' + esc((x.n + ' ' + x.o).toLowerCase()) + '"' +
      (x.a > 0 ? ' class="opero"' : '') + '>' +
      '<td>' + (esc(x.n) || '<span class="sin">(sin nombre)</span>') + '</td>' +
      '<td class="ori">' + (x.o === '(sin origen)'
        ? '<span class="sin">sin origen</span>'
        : '<span class="pill' + (mk ? ' pill-mkt' : '') + '">' + esc(x.o) + '</span>') +
      '</td>' +
      '<td class="num">' + (x.a ? f(x.a) : '<span class="sin">0</span>') + '</td>' +
      '<td class="num">' + (x.m ? '<b>' + cop(x.m) + '</b>'
        : '<span class="sin">—</span>') + '</td></tr>';
  });
  detalle += '</tbody></table></div></section>';
});

const CSS = [
':root{--ama:#FFCE00;--azul:#4C7DFF;--mora:#8C65C9;--fondo:#FBFAF6;--panel:#FFFFFF;',
'--linea:#E7E3D8;--linea2:#F1EEE5;--ink:#141310;--ink2:#5C574C;--ink3:#918B7C;',
'--banda:#FFF9E0;--sombra:0 1px 2px rgba(20,19,16,.05),0 8px 24px rgba(20,19,16,.05)}',
'@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){',
'--fondo:#15141A;--panel:#1D1C23;--linea:#302E38;--linea2:#26242D;--ink:#F3F1EA;',
'--ink2:#A9A49A;--ink3:#736E66;--banda:#2A2413;--azul:#8AA8FF;--mora:#B08FE0;',
'--sombra:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.28)}}',
':root[data-theme="dark"]{--fondo:#15141A;--panel:#1D1C23;--linea:#302E38;',
'--linea2:#26242D;--ink:#F3F1EA;--ink2:#A9A49A;--ink3:#736E66;--banda:#2A2413;',
'--azul:#8AA8FF;--mora:#B08FE0;',
'--sombra:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.28)}',
'*{box-sizing:border-box}',
'body{margin:0;background:var(--fondo);color:var(--ink);',
'font:400 15px/1.55 Inter,Arial,system-ui,sans-serif;-webkit-font-smoothing:antialiased}',
'.wrap{max-width:1000px;margin:0 auto;padding:44px 22px 80px;display:flex;',
'flex-direction:column;gap:30px}',
'.eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;',
'color:var(--ink3);margin:0}',
'h1{font-size:clamp(28px,4.4vw,42px);font-weight:800;letter-spacing:-.022em;',
'line-height:1.08;margin:8px 0 0;text-wrap:balance}',
'.bajada{margin:14px 0 0;font-size:16.5px;color:var(--ink2);max-width:63ch}',
'.bajada b{color:var(--ink);font-weight:600}',
'.cifras{display:grid;gap:1px;background:var(--linea);border:1px solid var(--linea);',
'border-radius:12px;overflow:hidden;grid-template-columns:repeat(4,1fr)}',
'@media(max-width:640px){.cifras{grid-template-columns:repeat(2,1fr)}}',
'.cifra{background:var(--panel);padding:15px 16px 16px}',
'.cifra .k{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;',
'text-transform:uppercase;color:var(--ink3)}',
'.cifra .v{display:block;font-size:26px;font-weight:800;letter-spacing:-.02em;',
'margin-top:5px;font-variant-numeric:tabular-nums}',
'.cifra .s{display:block;font-size:12.5px;color:var(--ink2);margin-top:2px}',
'.panel{background:var(--panel);border:1px solid var(--linea);border-radius:12px;',
'box-shadow:var(--sombra);overflow:hidden}',
'.panel>h2{margin:0;padding:16px 18px 14px;font-size:16px;font-weight:700;',
'letter-spacing:-.01em;border-bottom:1px solid var(--linea)}',
'.panel>h2 span{display:block;font-size:13px;font-weight:400;color:var(--ink2);',
'margin-top:3px;letter-spacing:0}',
'.tw{overflow-x:auto}',
'table{width:100%;border-collapse:collapse;font-size:14px}',
'th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.07em;',
'text-transform:uppercase;color:var(--ink3);padding:10px 14px;',
'border-bottom:1px solid var(--linea);white-space:nowrap;background:var(--panel)}',
'td{padding:9px 14px;border-bottom:1px solid var(--linea2);vertical-align:baseline}',
'tbody tr:last-child td{border-bottom:0}',
'.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
'th.num{text-align:right}',
'#resumen tr.c26 td.mes{box-shadow:inset 3px 0 0 var(--ama)}',
'.marca{display:inline-block;width:3px;height:11px;background:var(--ama);',
'vertical-align:-1px;margin:0 3px}',
'#resumen td.mes{font-weight:600}',
'#resumen td.mes a{color:inherit;text-decoration:none;',
'border-bottom:1px solid var(--linea)}',
'#resumen td.mes a:hover{color:var(--azul);border-bottom-color:currentColor}',
'#resumen td.mes a:focus-visible{outline:2px solid var(--azul);outline-offset:2px}',
'tfoot td{padding:11px 14px;border-top:2px solid var(--linea);font-weight:700;',
'font-variant-numeric:tabular-nums}',
'.tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.05em;',
'text-transform:uppercase;padding:2px 6px;border-radius:4px;vertical-align:1px;',
'background:var(--banda);color:var(--ink2);margin-left:6px}',
'.pill{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 8px;',
'border-radius:999px;background:var(--linea2);color:var(--ink2);white-space:nowrap}',
'.pill-mkt{background:color-mix(in oklab,var(--azul) 15%,transparent);color:var(--azul)}',
'.sin{color:var(--ink3)}.ori{white-space:nowrap}',
'.barra{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 18px;',
'border-bottom:1px solid var(--linea);background:var(--panel)}',
'.barra input[type=search]{flex:1 1 220px;min-width:0;font:inherit;font-size:14px;',
'padding:8px 11px;border:1px solid var(--linea);border-radius:8px;',
'background:var(--fondo);color:var(--ink)}',
'.barra input[type=search]:focus-visible{outline:2px solid var(--azul);outline-offset:1px}',
'.chk{display:inline-flex;gap:7px;align-items:center;font-size:13.5px;color:var(--ink2);',
'cursor:pointer;user-select:none;white-space:nowrap}',
'.chk input{accent-color:var(--azul);width:15px;height:15px}',
'#cuenta{font-size:12.5px;color:var(--ink3);font-variant-numeric:tabular-nums}',
'.bloque{border-top:1px solid var(--linea)}',
'.bloque:first-of-type{border-top:0}',
'.bh{padding:14px 18px 12px;background:var(--banda)}',
'.bh h3{margin:0;font-size:15px;font-weight:700;letter-spacing:-.01em}',
'.bmeta{margin:3px 0 0;font-size:12.5px;color:var(--ink2);',
'font-variant-numeric:tabular-nums}',
'tr.opero td:first-child{font-weight:500}',
'.nota{font-size:13.5px;color:var(--ink2);line-height:1.6;',
'border-left:3px solid var(--mora);padding:2px 0 2px 15px;margin:0}',
'.nota+.nota{margin-top:14px}.nota b{color:var(--ink);font-weight:600}',
'footer{font-size:12.5px;color:var(--ink3);border-top:1px solid var(--linea);',
'padding-top:16px}',
'code{font-size:12px;background:var(--linea2);padding:1px 5px;border-radius:4px}'
].join('\n');

const JS = [
'(function () {',
'  var q = document.getElementById("q"), sv = document.getElementById("soloVol"),',
'      cta = document.getElementById("cuenta");',
'  var filas = [].slice.call(document.querySelectorAll(".det tbody tr"));',
'  var bloques = [].slice.call(document.querySelectorAll(".bloque"));',
'  function pintar() {',
'    var t = q.value.trim().toLowerCase(), v = sv.checked, n = 0;',
'    filas.forEach(function (r) {',
'      var ok = (!t || r.dataset.b.indexOf(t) >= 0) &&',
'               (!v || r.classList.contains("opero"));',
'      r.hidden = !ok;',
'      if (ok) n++;',
'    });',
'    bloques.forEach(function (b) {',
'      b.hidden = !b.querySelector(".det tbody tr:not([hidden])");',
'    });',
'    cta.textContent = n + " de " + TOTAL + " sedes";',
'  }',
'  q.addEventListener("input", pintar);',
'  sv.addEventListener("change", pintar);',
'  pintar();',
'})();'
].join('\n');

const html = '<title>Sedes deshabilitadas fuera del tablero</title>\n' +
'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">\n' +
'<style>\n' + CSS + '\n</style>\n' +
'<div class="wrap">\n' +
'<header>\n' +
'  <p class="eyebrow">Tablero 360 · corte del universo</p>\n' +
'  <h1>Sedes deshabilitadas fuera del tablero</h1>\n' +
'  <p class="bajada">Toda sede que vive en el pipeline <b>Aliados_deshabilitados</b> ' +
'de HubSpot dejó de contar en adquisición y en los seis mapas de cohortes. ' +
'Estas son, mes por mes según su cosecha. Ojo con <b>octubre 2025</b>: es la ' +
'fecha de la migración a HubSpot, no una captación real, y ahí cae ' +
'toda la base histórica.</p>\n' +
'</header>\n' +
'<div class="cifras">\n' +
'  <div class="cifra"><span class="k">Sedes fuera</span><span class="v">' +
f(tot.n) + '</span><span class="s">9,5% de la base</span></div>\n' +
'  <div class="cifra"><span class="k">Aplicaciones</span><span class="v">' +
f(tot.a) + '</span><span class="s">16,7% del histórico</span></div>\n' +
'  <div class="cifra"><span class="k">Plata</span><span class="v">' +
cop(tot.m) + '</span><span class="s">6,9% del histórico</span></div>\n' +
'  <div class="cifra"><span class="k">Cosecha 2026</span><span class="v">57</span>' +
'<span class="s">las que mueven cohortes</span></div>\n' +
'</div>\n' +
'<div class="panel">\n' +
'  <h2>Cuántas por mes<span>Los mapas de cohortes arrancan en enero 2026: ' +
'solo los meses marcados <i class="marca"></i> cambian algún denominador; los tres de 2025 salen de los totales históricos.</span></h2>\n' +
'  <div class="tw"><table id="resumen"><thead><tr><th>Cosecha</th>' +
'<th class="num">Sedes</th><th class="num">Apps</th><th class="num">Plata</th>' +
'</tr></thead><tbody>' + resumen + '</tbody>' +
'<tfoot><tr><td>Total</td><td class="num">' + f(tot.n) + '</td>' +
'<td class="num">' + f(tot.a) + '</td><td class="num">' + cop(tot.m) +
'</td></tr></tfoot></table></div>\n</div>\n' +
'<div class="panel">\n' +
'  <h2>Cuáles, una por una<span>Ordenadas dentro de cada mes por la plata ' +
'que alcanzaron a desembolsar.</span></h2>\n' +
'  <div class="barra">\n' +
'    <input type="search" id="q" placeholder="Buscar sede u origen…" ' +
'aria-label="Buscar sede u origen">\n' +
'    <label class="chk"><input type="checkbox" id="soloVol"> ' +
'Solo las que alcanzaron a operar</label>\n' +
'    <span id="cuenta"></span>\n' +
'  </div>\n' + detalle + '\n</div>\n' +
'<div class="panel" style="padding:18px">\n' +
'  <p class="nota"><b>Buena parte son fichas duplicadas del mismo consultorio.</b> ' +
'Los pares Dentix “tasa 0” / “subvencionada”, DentiSalud ' +
'Restrepo y Colombia Smile son el mismo sitio partido en dos registros. Darlos ' +
'de baja es depuración, no pérdida de aliado.</p>\n' +
'  <p class="nota"><b>El corte reescribe la historia hacia abajo.</b> ' +
'Innovadentix (373 apps, $253 M) y Dentalsys (330 apps, $234 M) eran de ' +
'página web y de cosecha marzo 2026: ese mes de marketing ahora se ve peor ' +
'de lo que fue. El corte responde bien “con quién operamos hoy” y ' +
'engaña en “qué tan bien captó marketing en su momento”.</p>\n' +
'  <p class="nota"><b>Dos tablas no alcanzó a cubrir.</b> El mapa de deals ' +
'de adquisición y la gráfica de Long Tail vienen pre-agregadas sin ' +
'llave de sede, así que ahí las deshabilitadas siguen contando.</p>\n' +
'</div>\n' +
'<footer>Fuente: hoja SEDES del Tablero 360, refresh del 2 de septiembre de 2026 ' +
'· 343 sedes en el pipeline Aliados_deshabilitados · la bandera ' +
'<code>fb_deshabilitado</code> cubre 339 de las 343, por eso la definición ' +
'es el pipeline y no la propiedad.</footer>\n' +
'</div>\n' +
'<script>\nvar TOTAL = ' + tot.n + ';\n' + JS + '\n<\/script>\n';

fs.writeFileSync('deshabilitadas.html', html);
console.log('escrito deshabilitadas.html  ' + Math.round(html.length / 1024) + ' KB');
