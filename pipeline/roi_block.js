  // ---- Lo que devolvió la pauta --------------------------------------
  // La pauta de Meta es a MEDICOS (campaña "Médicos_Formulario_de_Facebook"),
  // no a pacientes, así que las sedes de origen "Social media" son el
  // resultado de ese gasto y se le pueden atribuir.
  //
  // El retorno se mide contra la COSECHA: la plata que pusieron las sedes de
  // social media que entraron ese mes. Contra el stock de todas las sedes de
  // social media daría un múltiplo mucho más alto, pero mezclaría el gasto de
  // este mes con sedes que trajo el gasto de hace seis.
  //
  // OJO CON LA PALABRA ROI: el monto desembolsado es capital del crédito, no
  // margen de WELLI. Esto es originación por peso de pauta, que es un
  // múltiplo de volumen. El ROI de verdad necesita el margen por crédito, que
  // hoy no está en ninguna fuente del tablero.
  var cdRoi = leerHoja_('COSECHA_DIA');
  var metaRoi = leerHoja_('META_ADS');
  var agRoi = {};
  function bRoi_(m) {
    if (!agRoi[m]) {
      agRoi[m] = { mes: m, leads: 0, gasto: 0, sedes: 0, sol: 0, apr: 0,
                   des: 0, plata: 0 };
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
  cdRoi.forEach(function (r) {
    if (String(r.canal || '') !== 'Social media') return;
    var m = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    var b = bRoi_(m);
    b.sol += num_(r.solicitudes);
    b.apr += num_(r.aprobados);
    b.des += num_(r.desembolsos);
    b.plata += num_(r.monto);
  });
  // Las sedes de social media por cosecha salen de agCos, que ya las cuenta.
  Object.keys(agCos).forEach(function (m) {
    if (esCargaInicial_(m)) return;
    var s = agCos[m].canMkt['Social media'];
    if (s) bRoi_(m).sedes = s;
  });
  var serieRoi = Object.keys(agRoi).sort().filter(function (m) {
    return agRoi[m].gasto > 0 || agRoi[m].sedes > 0;
  }).map(function (m) {
    var b = agRoi[m];
    return { mes: m, leads: b.leads, gasto: Math.round(b.gasto),
             cpl: b.leads ? Math.round(b.gasto / b.leads) : 0,
             sedes: b.sedes,
             leadASede: b.leads ? Math.round((b.sedes / b.leads) * 1000) / 10 : 0,
             costoSede: b.sedes ? Math.round(b.gasto / b.sedes) : 0,
             plata: Math.round(b.plata),
             multiplo: b.gasto ? Math.round((b.plata / b.gasto) * 10) / 10 : 0 };
  });
  var rMes = null, rPrev = null;
  serieRoi.forEach(function (x) {
    if (x.mes === mesComp) rMes = x;
    if (x.mes === mesPrevF1) rPrev = x;
  });
  f.retorno = rMes
    ? { mes: rMes.mes, serie: serieRoi, fila: rMes,
        kpis: [
          kpi_('Plata de social media', rMes.plata, { formato: 'copC',
            sublabel: 'crédito desembolsado por las ' + fNumSrv_(rMes.sedes) +
              ' sedes que entraron por social media en ' + rMes.mes,
            delta: rPrev && rPrev.plata ? delta_(rMes.plata, rPrev.plata) : null,
            deltaEtiqueta: rPrev ? 'vs cosecha de ' + rPrev.mes : '',
            fuente: 'profile_institucion + HubSpot', color: 'morado',
            nota: 'Es la cosecha del mes, no todo el stock de social media: la ' +
              'plata que puso el gasto de ESTE mes. Las cosechas recientes ' +
              'todavía están madurando, así que el mes en curso sale bajo y sube ' +
              'en los siguientes refresh.' }),
          kpi_('Originación por peso de pauta', rMes.multiplo, { formato: 'num1',
            sublabel: 'veces el gasto de Meta del mes',
            delta: rPrev && rPrev.multiplo ? delta_(rMes.multiplo, rPrev.multiplo) : null,
            deltaEtiqueta: rPrev ? 'vs ' + rPrev.mes : '',
            fuente: 'Meta Ads + profile_institucion', color: 'verde',
            nota: 'NO es ROI. El monto desembolsado es capital del crédito, no ' +
              'margen de WELLI, así que esto mide cuánta originación compra cada ' +
              'peso de pauta. Para un ROI real falta el margen por crédito, que ' +
              'no está en ninguna fuente conectada.' }),
          kpi_('Costo por sede', rMes.costoSede, { formato: 'cop',
            sublabel: 'gasto de Meta / sedes de social media del mes · ' +
              fPctSrv_(rMes.leadASede) + ' de los leads llegó a sede',
            delta: rPrev && rPrev.costoSede
              ? delta_(rMes.costoSede, rPrev.costoSede) : null,
            deltaEtiqueta: rPrev ? 'vs ' + rPrev.mes : '',
            invertido: true, fuente: 'Meta Ads + HubSpot', color: 'ambar',
            nota: 'El CPL solo dice qué cuesta un formulario. Esto dice qué cuesta ' +
              'una sede, que es lo que el negocio compra.' })
        ] }
    : null;

