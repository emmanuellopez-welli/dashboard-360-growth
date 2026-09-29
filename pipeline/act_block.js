  // ---------- Activación de la cosecha del mes ------------------------
  // La pregunta que faltaba: de las sedes que entraron este mes, cuántas
  // llegaron a usar el producto. Una sede creada que nunca radica una
  // solicitud es una sede que costó plata y no existe para el negocio.
  //
  //   activa  = radicó al menos 1 solicitud en el mes en que entró
  //   exitosa = radicó 3 o más, o ya tiene un desembolso
  //
  // El umbral de 3 es la definición de la casa: con una sola solicitud no se
  // distingue una sede que arrancó de una que probó el sistema una vez.
  //
  // Se mide en el MISMO mes de la cosecha, no acumulado: es activación, no
  // supervivencia. La supervivencia mes a mes ya está en los mapas de
  // cohorte de profundización.
  var actF1 = leerHoja_('ACT_SEDE_MES');
  var actIdx = {};
  actF1.forEach(function (r) {
    var m = String(r.mes || '').substring(0, 7);
    if (m !== mesComp) return;
    actIdx[String(r.id_sede || '').trim()] = {
      sol: num_(r.solicitudes), apr: num_(r.aprobados), des: num_(r.desembolsos)
    };
  });
  function activacionDe_(ids) {
    var t = (ids || []).length, act = 0, exi = 0, sol = 0, des = 0;
    (ids || []).forEach(function (id) {
      var a = actIdx[id];
      if (!a) return;
      sol += a.sol;
      des += a.des;
      if (a.sol >= 1) act++;
      if (a.sol >= 3 || a.des >= 1) exi++;
    });
    return { total: t, activas: act, exitosas: exi, dormidas: t - act,
             solicitudes: sol, desembolsos: des,
             pctAct: t ? Math.round((act / t) * 1000) / 10 : 0,
             pctExi: t ? Math.round((exi / t) * 1000) / 10 : 0,
             pctExiDeAct: act ? Math.round((exi / act) * 1000) / 10 : 0 };
  }
  var actM = bComp ? activacionDe_(bComp.idsMkt) : null;
  var actT = bComp ? activacionDe_(bComp.ids) : null;
  f.activacion = (actM && actT && actT.total)
    ? { mes: mesComp, mkt: actM, todas: actT,
        pasos: [
          { etapa: 'Nuevas', valor: actM.total, pct: 100 },
          { etapa: 'Activas', valor: actM.activas, pct: actM.pctAct },
          { etapa: 'Exitosas', valor: actM.exitosas, pct: actM.pctExi }
        ],
        // La comparación contra toda la base nueva del mes dice si marketing
        // trae sedes que arrancan mejor o solo trae más sedes.
        comparar: [
          { grupo: 'Las que trajo marketing', nuevas: actM.total,
            activas: actM.activas, pctAct: actM.pctAct,
            exitosas: actM.exitosas, pctExi: actM.pctExi },
          { grupo: 'Toda la base nueva del mes', nuevas: actT.total,
            activas: actT.activas, pctAct: actT.pctAct,
            exitosas: actT.exitosas, pctExi: actT.pctExi }
        ],
        kpis: [
          kpi_('Sedes activas', actM.activas, { formato: 'num', color: 'azul',
            sublabel: 'de ' + fNumSrv_(actM.total) + ' que trajo marketing en ' +
              mesComp + ' · ' + fPctSrv_(actM.pctAct),
            fuente: 'profile_institucion',
            nota: 'Activa = radicó al menos una solicitud de crédito en el mes ' +
              'en que la sede entró.' }),
          kpi_('Sedes exitosas', actM.exitosas, { formato: 'num', color: 'verde',
            sublabel: '3 o más solicitudes, o ya con desembolso · ' +
              fPctSrv_(actM.pctExi) + ' de las nuevas',
            fuente: 'profile_institucion',
            nota: 'Con una sola solicitud no se distingue una sede que arrancó ' +
              'de una que probó el sistema una vez. De las activas, ' +
              fPctSrv_(actM.pctExiDeAct) + ' llegó a exitosa.' }),
          kpi_('Sedes dormidas', actM.dormidas, { formato: 'num', color: 'ambar',
            sublabel: 'entraron y no radicaron nada en el mes',
            fuente: 'profile_institucion',
            nota: 'Son el objetivo natural de activación: ya están creadas y ' +
              'no cuestan adquisición, solo acompañamiento.' })
        ] }
    : null;

