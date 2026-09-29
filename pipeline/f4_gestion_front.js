/* Embudo de la gestion de rescate. Barras horizontales proporcionales a los
   casos TRABAJADOS, no al paso anterior: la pregunta del negocio es "de los
   que trabajamos, cuantos llegaron hasta aca", y encadenar porcentajes
   esconde el tamano real de cada fuga.

   Los pasos de fuga (colgo) van marcados aparte: no son un avance del
   embudo, son la salida. */
function embudoGestion(pasos) {
  if (!(pasos || []).length) return '<div class="vacio-graf">Sin gestión en el período</div>';
  var max = 0;
  pasos.forEach(function (p) { if (p.casos > max) max = p.casos; });
  var h = '<div class="emb-ges">';
  pasos.forEach(function (p) {
    var fuga = p.paso.indexOf('colgo') === 0 || p.paso.indexOf('y colg') === 0;
    var w = max ? Math.max(1.5, (p.casos / max) * 100) : 0;
    h += '<div class="emb-fila' + (fuga ? ' emb-fuga' : '') + '">' +
      '<div class="emb-etq">' + esc(p.paso) +
      (p.sub ? ' <span class="emb-sub">' + esc(p.sub) + '</span>' : '') +
      '</div>' +
      '<div class="emb-pista"><div class="emb-barra" style="width:' + w + '%"></div></div>' +
      '<div class="emb-num"><b>' + fNum(p.casos) + '</b>' +
      '<span class="emb-pct">' + fPct(p.pct) + '</span></div>' +
      '</div>';
  });
  return h + '</div><p class="sub" style="margin:8px 0 0">Los porcentajes son ' +
    'sobre los casos trabajados, no sobre el paso anterior.</p>';
}

/* Los limites del dato, al lado de los numeros y no en un pie de pagina.
   Van aca porque cada uno cambia como se lee una cifra de arriba. */
function limitesDato(lista, titulo) {
  if (!(lista || []).length) return '';
  var h = '<div class="limites"><div class="limites-tit">' +
    esc(titulo || 'Qué NO dicen estos números') + '</div><ul>';
  lista.forEach(function (t) { h += '<li>' + esc(t) + '</li>'; });
  return h + '</ul></div>';
}
