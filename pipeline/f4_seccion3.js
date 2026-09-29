  // --- 3. La gestion humana: que hizo el equipo y que se recupero -----
  var ge = f.gestion || {};
  if (ge.hay) {
    h += '<h2 class="sec">3 · La gestión: qué hicimos y qué se recuperó</h2>' +
      '<p class="sec-sub">la operación humana sobre pacientes con crédito ' +
      'aprobado sin firmar — la lista diaria que trabaja el equipo de rescate' +
      (ge.fuenteViva
        ? ' · ' + esc(ge.etiquetaPeriodo) + ' contra ' + esc(ge.etiquetaPrev)
        : '') +
      '</p>';

    if (!ge.fuenteViva && ge.foto) {
      h += '<div class="aviso-foto"><b>Foto del ' + esc(ge.foto.fecha) +
        ', sin fuente viva todavía.</b> Las tablas de ' +
        'welli-growth.rescate aún no entran al refresh diario, así que estos ' +
        'números no se mueven con el selector de fechas y no hay comparativo ' +
        'contra el período anterior. El embudo es de ' +
        esc(ge.foto.ventanaEmbudo) + ' y el pool de los ' +
        esc(ge.foto.ventanaPool) + '.</div>';
    }

    h += '<div class="grid2" style="margin-top:10px">' +
      panel('El embudo de la gestión',
        'de la lista diaria a la firma',
        embudoGestion(ge.embudo || [])) +
      panel('Acción y recuperación, lado a lado',
        'lo que hizo el equipo, y lo que se recuperó del pool completo',
        tablaAccion(ge.filas || [], ge)) +
      '</div>';

    // El desenlace va inmediatamente despues de la tasa de cierre: sin esto
    // el 3% se lee como resultado final, y la mayoria de los casos sigue viva.
    var de = ge.desenlace;
    if (de) {
      h += '<div style="margin-top:12px">' +
        panel('En qué quedaron los casos trabajados',
          'el período todavía no se puede cerrar',
          '<div class="desenl">' +
          '<div class="des-cel des-ok"><span class="des-n">' +
          fNum(de.firmaron) + '</span><span class="des-e">firmaron</span></div>' +
          '<div class="des-cel des-vivo"><span class="des-n">' +
          fNum(de.vivos) + '</span><span class="des-e">siguen vivos, dentro ' +
          'de su ventana</span></div>' +
          '<div class="des-cel des-mal"><span class="des-n">' +
          fNum(de.vencidos) + '</span><span class="des-e">se vencieron</span></div>' +
          '<div class="des-cel"><span class="des-n">' + fNum(de.sinCruce) +
          '</span><span class="des-e">sin cruce contra ningún crédito</span></div>' +
          '</div>') +
        '</div>';
    }

    if ((ge.causales || []).length) {
      h += '<div style="margin-top:12px">' +
        panelGran('Por qué no toman el crédito',
          'causales que registró el equipo · la causal describe cómo terminó ' +
          'la llamada, no cómo terminó el caso',
          '', 'gF4Causal') +
        '</div>';
      pintar('gF4Causal', function (el) {
        chBarrasH(el, (ge.causales || []).slice(0, 12).map(function (c) {
          return { etiqueta: c.causal, y: c.casos, d: c };
        }), { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 190,
          detalle: function (d) {
            return [{ nombre: 'Casos', valor: fNum(d.d.casos) },
                    { nombre: '% de las causales', valor: fPct(d.d.pct) }];
          } });
      });
    }

    h += limitesDato(ge.limites || [], 'Qué NO dicen estos números');
  }

