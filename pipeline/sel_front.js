/* ------------------------------------------------- mes y semana */
/* Dos calendarios libres dejaban armar rangos que no significan nada (del 14
   de julio al 3 de septiembre) y hacian que casi todo el tablero cayera en
   comparaciones raras. Con mes + semana el rango siempre es un periodo real
   del negocio, y el comparativo "periodo anterior" siempre es el mes o la
   semana de antes.

   Las semanas arrancan lunes y van RECORTADAS al mes, asi que las semanas de
   agosto son solo de agosto y sumadas dan agosto exacto. */
var MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var MES_SEL = '';

function nombreMes(m) {
  var a = Number(m.substring(0, 4)), i = Number(m.substring(5, 7)) - 1;
  return MESES_TXT[i] + ' ' + a;
}

/** Las semanas de un mes, recortadas a sus bordes. */
function semanasDeMes(m) {
  var a = Number(m.substring(0, 4)), i = Number(m.substring(5, 7)) - 1;
  var ini = new Date(Date.UTC(a, i, 1));
  var fin = new Date(Date.UTC(a, i + 1, 0));
  var hoy = new Date(iso(new Date()) + 'T00:00:00Z');
  // No se ofrecen semanas que todavia no empezaron: un rango en el futuro
  // sale vacio y se lee como una caida.
  if (fin > hoy) fin = hoy;
  var out = [];
  var d = new Date(ini.getTime());
  while (d <= fin) {
    // retrocede al lunes de esa semana, sin salirse del mes
    var dow = (d.getUTCDay() + 6) % 7;          // 0 = lunes
    var l = new Date(d.getTime() - dow * 86400000);
    if (l < ini) l = new Date(ini.getTime());
    var v = new Date(l.getTime() + (6 - ((l.getUTCDay() + 6) % 7)) * 86400000);
    if (v > fin) v = new Date(fin.getTime());
    out.push({ desde: v0(l), hasta: v0(v) });
    d = new Date(v.getTime() + 86400000);
  }
  return out;
}
function v0(d) { return d.toISOString().substring(0, 10); }

function etiquetaSemana(s, i) {
  var d1 = Number(s.desde.substring(8, 10)), d2 = Number(s.hasta.substring(8, 10));
  return 'Semana ' + (i + 1) + ' · ' + d1 + ' al ' + d2;
}

function montarSelectores() {
  var meses = (D && D.meta && D.meta.mesesDatos) ? D.meta.mesesDatos : [];
  if (!meses.length) return;
  var sm = document.getElementById('selMes');
  if (!MES_SEL || meses.indexOf(MES_SEL) < 0) MES_SEL = meses[meses.length - 1];
  // Del mas reciente al mas viejo: el mes que se consulta casi siempre es el
  // ultimo, y ponerlo primero ahorra un scroll cada vez.
  sm.innerHTML = meses.slice().reverse().map(function (m) {
    return '<option value="' + m + '"' + (m === MES_SEL ? ' selected' : '') + '>' +
      esc(nombreMes(m)) + '</option>';
  }).join('');
  poblarSemanas();
}

function poblarSemanas(sel) {
  var ss = document.getElementById('selSemana');
  var sem = semanasDeMes(MES_SEL);
  ss.innerHTML = '<option value="">Todo el mes</option>' +
    sem.map(function (s, i) {
      return '<option value="' + s.desde + '|' + s.hasta + '"' +
        (sel === s.desde + '|' + s.hasta ? ' selected' : '') + '>' +
        esc(etiquetaSemana(s, i)) + '</option>';
    }).join('');
  if (!sel) ss.value = '';
}

/** Escribe el rango en los inputs ocultos, que son la entrada de cargar(). */
function aplicarSeleccion(recargar) {
  var m = document.getElementById('selMes').value || MES_SEL;
  MES_SEL = m;
  var v = document.getElementById('selSemana').value;
  var a, b;
  if (v) {
    a = v.split('|')[0];
    b = v.split('|')[1];
  } else {
    var y = Number(m.substring(0, 4)), i = Number(m.substring(5, 7)) - 1;
    a = m + '-01';
    b = v0(new Date(Date.UTC(y, i + 1, 0)));
    var hoy = iso(new Date());
    if (b > hoy) b = hoy;
  }
  document.getElementById('fDesde').value = a;
  document.getElementById('fHasta').value = b;
  if (recargar !== false) cargar();
}
