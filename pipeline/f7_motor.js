/* =====================================================================
   FRENTE 7 · LONG TAIL
   La pregunta: cuando impactamos a la cola larga, ¿aplican más?

   Tres piezas:
     1. la linea de solicitudes por dia de la poblacion de los workflows
     2. los impactos reales marcados sobre esa linea, encendibles y
        apagables uno por uno
     3. la cadencia declarada de cada workflow, que es la ficha tecnica:
        dia 0 impacta, espera 4 dias, vuelve a impactar con otra pieza

   Los impactos NO son fechas de calendario sueltas: cada sede entra al
   workflow y recibe la cadencia relativa a SU dia de entrada. Como las
   entradas son en lote, en el calendario se ven como picos.
   ===================================================================== */
function armarF7_(R, cfg, U) {
  var f = {};
  var ACC = ['PERFILAMIENTO', 'REACTIVAR', 'DESEMBOLSO', 'RECONOCIMIENTO', 'ESTRENA'];
  var NOMBRE = {
    PERFILAMIENTO: 'Qué paciente sí pasa',
    REACTIVAR: 'Vuelve a aplicar',
    DESEMBOLSO: 'Tu trabajo sí sirve',
    RECONOCIMIENTO: 'Reconocimiento',
    ESTRENA: 'Estrena tu primer paciente'
  };

  // ---- Poblacion: sedes del universo elegido que estan en una audiencia --
  // Responde al filtro global de origen como todo lo demas.
  var pob = {}, porAud = {};
  ACC.forEach(function (a) { porAud[a] = 0; });
  U.filas.forEach(function (s) {
    var a = String(s.audiencia_long_tail || '').trim().toUpperCase();
    if (ACC.indexOf(a) < 0) return;
    var id = String(s.id_internal || '').trim();
    if (id) pob[id] = a;
    porAud[a]++;
  });
  var totalPob = 0;
  ACC.forEach(function (a) { totalPob += porAud[a]; });
  f.hay = totalPob > 0;
  f.universo = U.etiqueta;
  f.poblacion = totalPob;

  // ---- Serie de solicitudes por dia, dentro del rango ------------------
  var ap = leerHoja_('LT_APPS_DIA');
  var dia = {}, audSet = {};
  ap.forEach(function (r) {
    var a = String(r.audiencia || '').trim().toUpperCase();
    if (ACC.indexOf(a) < 0) return;
    var fch = String(r.fecha || '');
    if (fch < R.inicio || fch > R.fin) return;
    if (!dia[fch]) dia[fch] = { x: fch, sol: 0, des: 0, sedes: 0, por: {} };
    var b = dia[fch];
    var sol = num_(r.solicitudes);
    b.sol += sol;
    b.des += num_(r.desembolsos);
    b.sedes += num_(r.sedes_activas);
    b.por[a] = (b.por[a] || 0) + sol;
    audSet[a] = true;
  });
  // Se rellenan los dias sin actividad: un hueco en la linea se lee como
  // "no hay dato" cuando en realidad es un cero, y en una serie diaria eso
  // cambia la forma de la curva.
  var serie = [];
  var d0 = new Date(R.inicio + 'T00:00:00Z');
  var d1 = new Date(R.fin + 'T00:00:00Z');
  for (var t = d0.getTime(); t <= d1.getTime(); t += 86400000) {
    var k = new Date(t).toISOString().substring(0, 10);
    var b = dia[k] || { x: k, sol: 0, des: 0, sedes: 0, por: {} };
    serie.push({ x: k, y: b.sol, sol: b.sol, des: b.des, sedes: b.sedes, por: b.por });
  }
  f.serie = serie;

  // ---- Impactos reales, del historial de lt_ultima_pieza ---------------
  var tc = leerHoja_('LT_TOUCHES');
  var ag = {};
  tc.forEach(function (r) {
    var a = String(r.audiencia || '').trim().toUpperCase();
    if (ACC.indexOf(a) < 0) return;
    var fch = String(r.fecha || '');
    if (fch < R.inicio || fch > R.fin) return;
    var k = fch + '|' + a + '|' + String(r.pieza || '');
    if (!ag[k]) {
      ag[k] = { fecha: fch, audiencia: a, nombre: NOMBRE[a] || a,
                pieza: String(r.pieza || ''), canal: String(r.canal || ''),
                sedes: 0 };
    }
    ag[k].sedes += num_(r.sedes);
  });
  f.impactos = Object.keys(ag).sort().map(function (k, i) {
    var b = ag[k];
    b.id = 'imp' + i;
    // Solicitudes del dia del impacto y de los 3 dias siguientes, para poder
    // leer el efecto sin salir de la marca. No es causalidad, es vecindad.
    var idx = -1;
    for (var j = 0; j < serie.length; j++) if (serie[j].x === b.fecha) { idx = j; break; }
    b.solDia = idx >= 0 ? serie[idx].sol : null;
    var post = 0, npost = 0, pre = 0, npre = 0;
    for (var d = 1; d <= 3; d++) {
      if (idx + d < serie.length) { post += serie[idx + d].sol; npost++; }
      if (idx - d >= 0) { pre += serie[idx - d].sol; npre++; }
    }
    b.antes3 = npre ? Math.round((pre / npre) * 10) / 10 : null;
    b.despues3 = npost ? Math.round((post / npost) * 10) / 10 : null;
    b.delta = (b.antes3 !== null && b.despues3 !== null && b.antes3 > 0)
      ? Math.round(((b.despues3 - b.antes3) / b.antes3) * 1000) / 10 : null;
    return b;
  });

  // ---- Cadencia declarada de cada workflow ------------------------------
  var cd = leerHoja_('LT_CADENCIA');
  var wf = {};
  cd.forEach(function (r) {
    var wid = String(r.workflow_id || '');
    if (!wid) return;
    if (!wf[wid]) {
      wf[wid] = { id: wid, nombre: String(r.workflow || '').replace(/^\[Growth\]\s*/, ''),
                  audiencia: String(r.audiencia || ''), activo: String(r.activo) === 'si',
                  sedes: porAud[String(r.audiencia || '').toUpperCase()] || 0,
                  pasos: [], vacio: false };
    }
    if (String(r.pieza || '') === '(VACIO)') { wf[wid].vacio = true; return; }
    wf[wid].pasos.push({ impacto: num_(r.impacto), dia: num_(r.dia),
                         canal: String(r.canal || ''), pieza: String(r.pieza || '') });
  });
  f.workflows = Object.keys(wf).map(function (k) {
    var w = wf[k];
    w.pasos.sort(function (a, b) { return a.dia - b.dia || a.impacto - b.impacto; });
    w.impactos = w.pasos.length;
    w.duracion = w.pasos.length ? w.pasos[w.pasos.length - 1].dia : 0;
    // Solicitudes del periodo de esa audiencia, para poder poner el esfuerzo
    // al lado del resultado. Es el numero que hace hablar a la tabla.
    var sol = 0;
    serie.forEach(function (p) { sol += (p.por[w.audiencia] || 0); });
    w.solicitudes = sol;
    w.solPorSede = w.sedes ? Math.round((sol / w.sedes) * 100) / 100 : 0;
    return w;
  }).filter(function (w) { return w.audiencia !== '(ENRUTADOR)'; })
    .sort(function (a, b) { return b.sedes - a.sedes; });

  // Audiencias sin workflow que las toque: quedan declaradas, no escondidas.
  var conWf = {};
  f.workflows.forEach(function (w) {
    if (w.activo && !w.vacio) conWf[w.audiencia] = true;
  });
  f.sinTocar = ACC.filter(function (a) {
    return porAud[a] > 0 && !conWf[a];
  }).map(function (a) {
    var sol = 0;
    serie.forEach(function (p) { sol += (p.por[a] || 0); });
    return { audiencia: a, nombre: NOMBRE[a], sedes: porAud[a], solicitudes: sol };
  });

  // ---- KPIs -------------------------------------------------------------
  var totSol = 0, totDes = 0;
  serie.forEach(function (p) { totSol += p.sol; totDes += p.des; });
  var totImp = 0, sedesToc = {};
  f.impactos.forEach(function (i) { totImp += i.sedes; });
  var dias = serie.length || 1;
  f.kpis = [
    kpi_('Sedes en la cola larga', totalPob, { formato: 'num', color: 'azul',
      sublabel: 'población de los workflows · ' + U.etiqueta,
      fuente: 'HubSpot · audiencia_long_tail',
      nota: 'Las cinco audiencias con pieza asignada. No incluye "No contactar" ' +
        'ni "Sin pieza asignada".' }),
    kpi_('Solicitudes del período', totSol, { formato: 'num', color: 'verde',
      sublabel: fNumSrv_(Math.round((totSol / dias) * 10) / 10) + ' por día en ' +
        fNumSrv_(dias) + ' días',
      fuente: 'BigQuery · profile_institucion',
      nota: 'Radicadas por pacientes de las sedes que están en la población de ' +
        'los workflows.' }),
    kpi_('Impactos enviados', totImp, { formato: 'num', color: 'ambar',
      sublabel: f.impactos.length + ' envíos distintos en el período',
      fuente: 'HubSpot · historial de lt_ultima_pieza',
      nota: 'Cada impacto es un envío de una pieza a un lote de sedes. Sale del ' +
        'historial de la propiedad, que es el log que escriben los workflows.' }),
    kpi_('Solicitudes por sede', totalPob ? Math.round((totSol / totalPob) * 100) / 100 : 0,
      { formato: 'num', color: 'morado',
        sublabel: 'en el período, por sede de la cola larga',
        fuente: 'BigQuery + HubSpot',
        nota: 'Es la unidad de comparación entre audiencias: una audiencia con ' +
          'muchas sedes y pocas solicitudes es esfuerzo mal puesto.' })
  ];

  f.textos = { funcionando: cfg.f7_funcionando || '', cuello: cfg.f7_cuello || '',
               atencion: cfg.f7_atencion || '', fecha: cfg.textos_fecha || '' };
  return f;
}
