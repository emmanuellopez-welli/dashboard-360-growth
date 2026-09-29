  var ac = f.activacion;
  if (ac) {
    h += '<h2 class="sec">6 · De las sedes que trajimos, ¿cuántas arrancaron?</h2>' +
      '<p class="sec-sub">cosecha de ' + esc(ac.mes) + ' · activa = radicó al menos una ' +
      'solicitud en el mes · exitosa = 3 o más solicitudes, o ya con desembolso</p>';
    h += filaKPIs(ac.kpis);
    h += '<div class="grid2" style="margin-top:14px">' +
      panel('De nuevas a exitosas',
        'las ' + fNum(ac.mkt.total) + ' sedes que trajo marketing en ' + esc(ac.mes),
        '', 'gF1Act') +
      panel('¿Marketing trae sedes que arrancan mejor?',
        'la cosecha del mes de marketing contra toda la base nueva del mes',
        tabla([
          { t: 'Grupo', k: 'grupo', txt: true },
          { t: 'Nuevas', k: 'nuevas', fmt: fNum },
          { t: 'Activas', k: 'activas', fmt: fNum },
          { t: '% activas', k: 'pctAct', fmt: fPct },
          { t: 'Exitosas', k: 'exitosas', fmt: fNum },
          { t: '% exitosas', k: 'pctExi', fmt: fPct }
        ], ac.comparar)) +
      '</div>';
    pintar('gF1Act', function (el) {
      chBarrasH(el, (ac.pasos || []).map(function (p) {
        return { etiqueta: p.etapa, y: p.valor, d: p };
      }), { color: 'var(--s1)', formato: fNum, anchoEtiqueta: 110,
        detalle: function (d) {
          return [{ nombre: 'Sedes', valor: fNum(d.d.valor) },
                  { nombre: '% de las nuevas del mes', valor: fPct(d.d.pct) }];
        } });
    });
  }

