  // ---- LA OPORTUNIDAD Y LO QUE CERRAMOS, POR VENTANA -------------------
  // Reemplaza la seccion de "plata sobre la mesa". Esa cifra era un STOCK
  // historico de 15.845 aprobados sin firmar: no es meta de nadie y no se
  // mueve con nada que hagamos este mes.
  //
  // Aca la pregunta es de cohorte y si tiene dueno: de los creditos que el
  // motor APROBO en el periodo, cuantos firmamos. Numerador y denominador son
  // el MISMO grupo de creditos, asi que "cerramos X de lo que podiamos" es una
  // division honesta. Y todo va contra el periodo anterior, que es la unica
  // referencia que dice si mejoramos.
  var rv = leerHoja_('RESCATE_VENTANA');
  var selRv = {};
  (U.origenes || []).forEach(function (o) { selRv[o] = true; });

  function cortarRv_(desde, hasta) {
    var t = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
    var porV = {}, porDia = {};
    rv.forEach(function (r) {
      var fch = String(r.fecha || '');
      if (fch < desde || fch > hasta) return;
      if (!U.todos && !selRv[normOrigen_(r.origen)]) return;
      var v = String(r.ventana || '-');
      var apr = num_(r.aprobados), firm = num_(r.firmados);
      var mA = num_(r.monto_apr), mF = num_(r.monto_firm);
      t.apr += apr; t.firm += firm; t.mApr += mA; t.mFirm += mF;
      if (!porV[v]) porV[v] = { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      var b = porV[v];
      b.apr += apr; b.firm += firm; b.mApr += mA; b.mFirm += mF;
      if (!porDia[fch]) porDia[fch] = { apr: 0, firm: 0 };
      porDia[fch].apr += apr;
      porDia[fch].firm += firm;
    });
    t.porV = porV;
    t.porDia = porDia;
    return t;
  }
  var rA = cortarRv_(R.inicio, R.fin);
  var rP = cortarRv_(R.prevInicio, R.prevFin);
  var hayRv = rA.apr > 0;

  function cierre_(b) { return b && b.apr ? (b.firm / b.apr) : null; }
  var NOMV = { C: 'Corta', B: 'Media', A: 'Larga', '-': 'Sin ventana' };

  f.oportunidad = {
    hay: hayRv,
    universo: U.etiqueta,
    // Una fila por ventana, con la oportunidad, lo cerrado y el delta del
    // cierre en PUNTOS contra el periodo anterior.
    filas: ['C', 'B', 'A', '-'].filter(function (v) {
      return (rA.porV[v] && rA.porV[v].apr) || (rP.porV[v] && rP.porV[v].apr);
    }).map(function (v) {
      var a = rA.porV[v] || { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      var p = rP.porV[v] || { apr: 0, firm: 0, mApr: 0, mFirm: 0 };
      var cA2 = cierre_(a), cP2 = cierre_(p);
      var vv = ventanasOrdenadas_().filter(function (x) { return x.id === v; })[0];
      return {
        id: v, ventana: NOMV[v] || v,
        nombre: vv ? vv.nombre : 'Sin ventana asignada',
        especialidades: vv && vv.especialidades && vv.especialidades.length
          ? vv.especialidades.join(' · ') : '(sin clasificar)',
        comportamiento: vv ? vv.comportamiento : '',
        apr: a.apr, firm: a.firm,
        pct: cA2 === null ? 0 : Math.round(cA2 * 1000) / 10,
        mApr: Math.round(a.mApr), mFirm: Math.round(a.mFirm),
        // Lo que quedo aprobado y sin firmar en el periodo: es la oportunidad
        // que si es de este periodo, no el stock historico.
        mSinCerrar: Math.round(a.mApr - a.mFirm),
        sinCerrar: a.apr - a.firm,
        aprPrev: p.apr, firmPrev: p.firm,
        pctPrev: cP2 === null ? null : Math.round(cP2 * 1000) / 10,
        dPct: (cA2 !== null && cP2 !== null)
          ? Math.round((cA2 - cP2) * 1000) / 10 : null,
        dApr: p.apr ? Math.round(((a.apr - p.apr) / p.apr) * 1000) / 10 : null,
        dMFirm: p.mFirm ? Math.round(((a.mFirm - p.mFirm) / p.mFirm) * 1000) / 10 : null
      };
    }),
    kpis: [
      kpi_('La oportunidad del período', Math.round(rA.mApr), { formato: 'copC',
        sublabel: fNumSrv_(rA.apr) + ' créditos que el motor aprobó · ' + U.etiqueta,
        delta: rP.mApr ? delta_(rA.mApr, rP.mApr) : null,
        fuente: 'BigQuery · profile_institucion', color: 'azul',
        nota: 'Plata de los créditos APROBADOS radicados en el período. Es la ' +
          'oportunidad que sí le pertenece a este período, no el stock histórico ' +
          'de aprobados sin firmar.' }),
      kpi_('Lo que cerramos', Math.round(rA.mFirm), { formato: 'copC',
        sublabel: fNumSrv_(rA.firm) + ' créditos firmados de esos mismos',
        delta: rP.mFirm ? delta_(rA.mFirm, rP.mFirm) : null,
        fuente: 'BigQuery · profile_institucion', color: 'verde' }),
      kpi_('Tasa de cierre', rA.apr ? Math.round((rA.firm / rA.apr) * 1000) / 10 : 0,
        { formato: 'pct', sublabel: 'firmados / aprobados',
          delta: cierre_(rP) !== null
            ? Math.round((cierre_(rA) - cierre_(rP)) * 1000) / 10 : null,
          deltaEnPuntos: true,
          fuente: 'BigQuery · profile_institucion', color: 'ambar',
          nota: 'El mismo grupo de créditos arriba y abajo de la división. Es la ' +
            'cifra que el rescate mueve.' }),
      kpi_('Se quedó sin cerrar', Math.round(rA.mApr - rA.mFirm), { formato: 'copC',
        sublabel: fNumSrv_(rA.apr - rA.firm) + ' créditos aprobados que nadie tomó',
        delta: (rP.mApr - rP.mFirm) ? delta_(rA.mApr - rA.mFirm, rP.mApr - rP.mFirm) : null,
        deltaInvertido: true,
        fuente: 'BigQuery · profile_institucion', color: 'morado',
        nota: 'Ojo: parte todavía está dentro de sus 30 días y puede firmarse. La ' +
          'cifra del mes en curso baja en los siguientes refresh.' })
    ]
  };

  // ---- QUE HICIMOS Y QUE LOGRAMOS --------------------------------------
  // Las acciones de rescate de 2026 SON los workflows long tail: las
  // campanas de rescate de Hilos se detuvieron en nov-2025 y RESCATE_PIEZAS
  // lista exactamente las tres piezas LT. Asi que la accion se cuenta desde
  // el log real de impactos, no desde una tabla de piezas sin fecha.
  var tcR = leerHoja_('LT_TOUCHES');
  var accAg = {};
  var accTot = { piezas: 0, sedes: 0, wa: 0, mail: 0 };
  var accPrev = { piezas: 0, sedes: 0, wa: 0, mail: 0 };
  function sumaAcc_(desde, hasta, dest, ag) {
    var vistos = {};
    tcR.forEach(function (r) {
      var fch = String(r.fecha || '');
      if (fch < desde || fch > hasta) return;
      var pieza = String(r.pieza || ''), can = String(r.canal || '');
      var s = num_(r.sedes);
      dest.sedes += s;
      if (can === 'WhatsApp') dest.wa += s; else dest.mail += s;
      if (!vistos[pieza]) { vistos[pieza] = true; dest.piezas++; }
      if (ag) {
        if (!ag[pieza]) {
          ag[pieza] = { pieza: pieza, canal: can, sedes: 0,
                        audiencia: String(r.audiencia || '') };
        }
        ag[pieza].sedes += s;
      }
    });
  }
  sumaAcc_(R.inicio, R.fin, accTot, accAg);
  sumaAcc_(R.prevInicio, R.prevFin, accPrev, null);

  function dPct_(a, b) {
    return b ? Math.round(((a - b) / b) * 1000) / 10 : null;
  }
  f.acciones = {
    hay: accTot.sedes > 0 || accPrev.sedes > 0,
    piezas: Object.keys(accAg).sort().map(function (k) { return accAg[k]; }),
    // Una fila por metrica, con el periodo, el anterior y el cambio. Es el
    // formato "hicimos X y logramos Y" en una sola lectura vertical.
    filas: [
      { bloque: 'Lo que hicimos', metrica: 'Piezas de cadencia enviadas',
        act: accTot.piezas, prev: accPrev.piezas, d: dPct_(accTot.piezas, accPrev.piezas),
        f: 'num' },
      { bloque: 'Lo que hicimos', metrica: 'Impactos a sedes',
        act: accTot.sedes, prev: accPrev.sedes, d: dPct_(accTot.sedes, accPrev.sedes),
        f: 'num' },
      { bloque: 'Lo que hicimos', metrica: 'por WhatsApp',
        act: accTot.wa, prev: accPrev.wa, d: dPct_(accTot.wa, accPrev.wa), f: 'num' },
      { bloque: 'Lo que hicimos', metrica: 'por email',
        act: accTot.mail, prev: accPrev.mail, d: dPct_(accTot.mail, accPrev.mail),
        f: 'num' },
      { bloque: 'Lo que logramos', metrica: 'Créditos aprobados (oportunidad)',
        act: rA.apr, prev: rP.apr, d: dPct_(rA.apr, rP.apr), f: 'num' },
      { bloque: 'Lo que logramos', metrica: 'Créditos firmados',
        act: rA.firm, prev: rP.firm, d: dPct_(rA.firm, rP.firm), f: 'num' },
      { bloque: 'Lo que logramos', metrica: 'Tasa de cierre',
        act: rA.apr ? Math.round((rA.firm / rA.apr) * 1000) / 10 : 0,
        prev: rP.apr ? Math.round((rP.firm / rP.apr) * 1000) / 10 : null,
        d: (cierre_(rA) !== null && cierre_(rP) !== null)
          ? Math.round((cierre_(rA) - cierre_(rP)) * 1000) / 10 : null,
        f: 'pct', puntos: true },
      { bloque: 'Lo que logramos', metrica: 'Plata firmada',
        act: Math.round(rA.mFirm), prev: Math.round(rP.mFirm),
        d: dPct_(rA.mFirm, rP.mFirm), f: 'cop' },
      { bloque: 'Lo que logramos', metrica: 'Plata aprobada sin cerrar',
        act: Math.round(rA.mApr - rA.mFirm), prev: Math.round(rP.mApr - rP.mFirm),
        d: dPct_(rA.mApr - rA.mFirm, rP.mApr - rP.mFirm), f: 'cop', invertido: true }
    ],
    etiquetaPeriodo: R.inicio + ' a ' + R.fin,
    etiquetaPrev: R.prevInicio + ' a ' + R.prevFin,
    // Si no hubo accion en ninguno de los dos periodos hay que decirlo, no
    // dejar una tabla de ceros que se lee como "no funciono".
    sinAccion: accTot.sedes === 0,
    notaSinAccion: 'No hay impactos de rescate registrados en el período. Las ' +
      'campañas de Hilos se detuvieron en nov-2025 y los workflows long tail ' +
      'arrancaron el 28-ago-2026: fuera de esa ventana la tabla mide resultado ' +
      'sin acción que se le pueda atribuir.'
  };

