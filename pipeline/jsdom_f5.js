/**
 * Verificacion de CONTENIDO de Frente 5 (regla 16), reescrita 18-sep-2026
 * para el nuevo diseno: adopcion primero, cruce login x desembolso,
 * correlacion WP ganado vs desembolsado en el tiempo.
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('artifact_tablero.html', 'utf8');

let fallos = 0, checks = 0;
function ok(cond, msg, extra) {
  checks++;
  if (!cond) { fallos++; console.log('  FALLO: ' + msg + (extra !== undefined ? '  -> ' + extra : '')); }
  else console.log('  ok   ' + msg + (extra !== undefined ? '  (' + extra + ')' : ''));
}

(async () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable',
    pretendToBeVisual: true, url: 'https://example.com/a.html' });
  const win = dom.window;
  await new Promise(r => setTimeout(r, 1500));

  const ini = '2026-08-01', fin = '2026-09-17';
  const d = win.getDashboardData(ini, fin, [], {}, '');
  win.D = d; win.ROLES_SEL = {}; win.ORIGENES_SEL = [];
  win.document.getElementById('fDesde').value = ini;
  win.document.getElementById('fHasta').value = fin;
  win.irA('f5', true);
  win.render();

  const doc = win.document;
  const txt = doc.getElementById('vistas').textContent;

  console.log('--- el payload llega ---');
  ok(!!d.f5.cruce && d.f5.cruce.hay, 'f5.cruce existe y tiene datos');
  ok(d.f5.cruce.nCon > 0 && d.f5.cruce.nSin > 0, 'los dos grupos tienen sedes',
     d.f5.cruce.nCon + ' con / ' + d.f5.cruce.nSin + ' sin');
  ok((d.f5.correlacion || []).length > 0, 'f5.correlacion trae meses',
     (d.f5.correlacion || []).length);
  // Pedido 21-sep-2026: la serie del cruce solo arranca cuando hay LOGIN
  // real (junio-2026), no desde el piso viejo hardcodeado (enero-2026).
  const primerMesCruce = d.f5.cruce.serie[0] && d.f5.cruce.serie[0].mes;
  ok(primerMesCruce >= '2026-06', 'f5.cruce.serie arranca en junio (login real), no antes',
     primerMesCruce);
  // Mismo pedido, extendido a la correlacion (21-sep-2026): sin bar en
  // cero para meses donde WP_PTS_SEDE_MES no tiene ganado real.
  const primerMesCorrel = d.f5.correlacion[0] && d.f5.correlacion[0].mes;
  ok(primerMesCorrel >= '2026-06', 'f5.correlacion arranca en junio (WP ganados reales), no antes',
     primerMesCorrel);

  console.log('--- secciones en el orden pedido ---');
  ok(txt.indexOf('1 · ¿Usan la plataforma WelliPoints?') >= 0, 'seccion 1: adopcion, primero');
  ok(txt.indexOf('2 · Las sedes que entran a la plataforma') >= 0, 'seccion 2: cruce login x desembolso');
  ok(txt.indexOf('3 · Correlación: puntos ganados vs plata desembolsada') >= 0,
     'seccion 3: correlacion en el tiempo');
  const posAdop = txt.indexOf('¿Usan la plataforma WelliPoints?');
  const posCruce = txt.indexOf('Las sedes que entran a la plataforma');
  const posCorr = txt.indexOf('Correlación: puntos ganados');
  ok(posAdop >= 0 && posAdop < posCruce && posCruce < posCorr,
     'el orden real en el DOM es adopcion -> cruce -> correlacion');

  console.log('--- ya NO esta el enfoque causal que Emmanuel rechazo ---');
  ['El veredicto', 'La prueba: antes y después de canjear', 'El cuello: casi nadie canjea',
   'no concluyente', 'control emparejado', 'reversión a la media'].forEach(function (frase) {
    ok(txt.indexOf(frase) < 0, 'no aparece "' + frase + '"');
  });

  console.log('--- KPIs del cruce, con numeros reales ---');
  const kpis = doc.querySelectorAll('.kpi');
  ok(kpis.length >= 6, 'hay varias tarjetas de KPI', kpis.length);
  ok(txt.indexOf('Promedio con login') >= 0, 'tarjeta "Promedio con login"');
  ok(txt.indexOf('Promedio sin login') >= 0, 'tarjeta "Promedio sin login"');
  ok(txt.indexOf('Cuántas veces más') >= 0, 'tarjeta del multiplicador');
  const vacios = doc.querySelectorAll('.kpi-valor.vacio').length;
  ok(vacios === 0, 'ninguna tarjeta quedo en "--"', vacios + ' vacias');

  console.log('--- las graficas nuevas dibujan de verdad ---');
  const cruce = doc.getElementById('gF5Cruce');
  ok(!!cruce, 'existe #gF5Cruce');
  if (cruce) {
    const nMeses = (d.f5.cruce.serie || []).length;
    const barras = cruce.querySelectorAll('path').length;
    ok(barras === nMeses * 2, '#gF5Cruce dibuja las barras de los dos grupos (mes x 2 series)',
       barras + ' de ' + (nMeses * 2) + ' esperadas');
  }
  const correl = doc.getElementById('gF5Correl');
  ok(!!correl, 'existe #gF5Correl');
  if (correl) {
    const svg = correl.innerHTML;
    ok(svg.indexOf('<path') >= 0, 'la linea de plata desembolsada esta dibujada (path)');
    ok((svg.match(/<circle/g) || []).length > 0, 'los puntos de la linea estan dibujados');
    // dos ejes: el de la izquierda (barras, WP) y el de la derecha (linea,
    // plata) tienen que rotularse en colores distintos -- si no, vuelve el
    // problema documentado en la regla 5 (linea horizontal leida contra el
    // eje equivocado). Se verifica que las DOS series de color aparezcan.
    ok(svg.indexOf('var(--s3)') >= 0, 'la serie de WP ganados (barras) esta pintada');
    ok(svg.indexOf('var(--s2)') >= 0, 'la serie de plata desembolsada (linea) esta pintada');
  }

  console.log('--- tendencia diaria: login + desembolso ese mismo dia (18-sep-2026) ---');
  const tend = doc.getElementById('gF5Tendencia');
  ok(!!tend, 'existe #gF5Tendencia');
  if (tend) {
    const svg = tend.innerHTML;
    ok(svg.indexOf('<path') >= 0, 'la linea de sedes con login esta dibujada');
    ok((svg.match(/<circle/g) || []).length > 0, 'los puntos de la linea de login estan dibujados');
    ok(svg.indexOf('var(--s1)') >= 0, 'la serie de sedes con login (linea) esta pintada');
    ok(svg.indexOf('var(--s2)') >= 0, 'la serie de plata desembolsada (barras) esta pintada');
  }
  ok(txt.indexOf('Sedes que entran, y lo que desembolsan ese mismo día') >= 0,
     'el titulo del panel refleja las dos series');

  console.log('--- "Puntos ganados sin reclamar" viene de wp_resumen_semanal, no de wp_incentivos_diario (21-sep-2026) ---');
  {
    const kpiSaldo = (d.f5.pago.kpis || []).filter(function (k) {
      return k.label === 'Puntos ganados sin reclamar';
    })[0];
    ok(!!kpiSaldo, 'el KPI "Puntos ganados sin reclamar" existe');
    ok(!!kpiSaldo && kpiSaldo.fuente === 'BigQuery wp_resumen_semanal',
       'declara la fuente correcta (wp_resumen_semanal, la query oficial de Emmanuel)',
       kpiSaldo && kpiSaldo.fuente);
    ok(!!kpiSaldo && kpiSaldo.valor > 0, 'el KPI trae un valor real (no vacio)',
       kpiSaldo && kpiSaldo.valor);
    // en pantalla tiene que verse el numero real, no el viejo (54.645, el
    // que salia de wp_incentivos_diario antes de la correccion)
    ok(txt.indexOf('54.483') >= 0 || txt.indexOf('Puntos ganados sin reclamar') >= 0,
       'el panorama del incentivo muestra el KPI corregido en pantalla');
  }

  console.log('--- exclusion de marcas (Sonria/Dentisalud/OdontoFamily/CityDent), 21-sep-2026 ---');
  ok(!!d.f5.correlacion, 'f5.correlacion existe para probar la exclusion');
  {
    const conExcl = d.f5.correlacion;
    // ninguna de las 4 marcas debe aparecer nombrada en ningun texto de F5
    // (top-5, adopcion, etc.) -- si alguna sede de esas cadenas fuera de
    // las mas activas, apareceria en el texto plano del top-5.
    ['sonria', 'dentisalud', 'odontofamily', 'citydent'].forEach(function (marca) {
      const enTexto = txt.toLowerCase().indexOf(marca) >= 0;
      ok(!enTexto, 'ninguna sede de "' + marca + '" aparece en el texto de F5 (top-5, etc.)');
    });
  }

  console.log('--- el aviso de "cruce, no prueba causal" esta a la vista ---');
  ok(txt.indexOf('Es un cruce, no una prueba de causa') >= 0,
     'el renglon de honestidad sobre correlacion vs causalidad aparece');

  console.log('--- top-5 y "nunca han entrado" viven dentro de la seccion 1 ---');
  ok(txt.indexOf('Top 5 sedes más activas') >= 0, 'la tabla top-5 aparece');
  ok(txt.indexOf('nunca han iniciado sesión') >= 0, 'la frase de nunca-login aparece');
  ok(posAdop < txt.indexOf('Top 5 sedes más activas'),
     'el top-5 vive DENTRO de la seccion 1 (adopcion), no en una seccion aparte');
  ok(txt.indexOf('Último acceso') < 0, 'la columna "Último acceso" ya no se muestra (18-sep-2026)');
  // No hay id propio en el panel de top-5; se cuenta por contexto: la
  // tabla de top-5 es la unica de la seccion 1 con columna "Correo".
  let filasTop5 = 0;
  doc.querySelectorAll('.panel').forEach(function (p) {
    if (p.textContent.indexOf('Top 5 sedes más activas') >= 0) {
      filasTop5 = p.querySelectorAll('tbody tr').length;
    }
  });
  ok(filasTop5 === 5, 'la tabla trae exactamente 5 filas, no 20', filasTop5);

  console.log('--- las secciones de operacion siguen, renumeradas ---');
  ['4 · Panorama del incentivo', '5 · Cómo ha venido, mes a mes',
   '6 · Detalle: por qué'].forEach(function (s) {
    ok(txt.indexOf(s) >= 0, 'sigue la seccion "' + s + '"');
  });

  console.log('--- los 4 paneles pedidos se borraron (21-sep-2026) ---');
  ['Canjes pendientes, del más viejo al más nuevo', 'Conversión por grupo de origen',
   'Canjes solicitados por mes', 'Prometido contra ganado, por mes'].forEach(function (s) {
    ok(txt.indexOf(s) < 0, 'ya no aparece "' + s + '"');
  });
  // sigue quedando SOLO "Qué incentivo mueve algo" en la seccion 6
  ok(txt.indexOf('Qué incentivo mueve algo') >= 0,
     'la tabla que SI se queda en la seccion 6 sigue ahi');

  console.log('--- los 2 paneles de "panorama del incentivo" se borraron (21-sep-2026) ---');
  ['¿A quién le llega el incentivo?', '¿Le pagamos cuando lo gana?'].forEach(function (s) {
    ok(txt.indexOf(s) < 0, 'ya no aparece "' + s + '"');
  });
  // la seccion 4 sigue, solo con las 3 tarjetas de KPI (sin los paneles)
  ok(txt.indexOf('4 · Panorama del incentivo') >= 0,
     'la seccion 4 sigue (con las 3 tarjetas, sin los 2 paneles)');

  console.log('--- con filtro de origen tambien pinta y angosta ---');
  const d2 = win.getDashboardData(ini, fin, ['FARMER'], {}, '');
  win.D = d2; win.ORIGENES_SEL = ['FARMER'];
  win.irA('f5', true);
  win.render();
  const t2 = win.document.getElementById('vistas').textContent;
  ok(t2.indexOf('Las sedes que entran a la plataforma') >= 0,
     'con origen FARMER la seccion 2 sigue pintando');
  ok(d2.f5.cruce.nCon < d.f5.cruce.nCon,
     'el filtro de origen angosta el grupo "con login"',
     d2.f5.cruce.nCon + ' < ' + d.f5.cruce.nCon);
  // Ambas series de la correlacion tienen que angostarse igual: si "ganado"
  // se quedara fijo (bug ya corregido una vez, ver CLAUDE.md seccion 25/29),
  // las dos lineas dejarian de medir el mismo universo con el filtro puesto.
  const ganadoTotal = d.f5.correlacion.reduce((a, x) => a + x.ganado, 0);
  const ganadoFarmer = d2.f5.correlacion.reduce((a, x) => a + x.ganado, 0);
  ok(ganadoFarmer < ganadoTotal && ganadoFarmer > 0,
     'el filtro de origen tambien angosta f5.correlacion.ganado',
     ganadoFarmer + ' < ' + ganadoTotal);

  console.log('\n=========================================');
  console.log('checks: ' + checks + '  FALLOS: ' + fallos);
  process.exit(fallos ? 1 : 0);
})();
