/**
 * Arma la vista previa autocontenida.
 *
 * CAMBIO IMPORTANTE: ya no precalcula payloads por rango de fecha. Embebe
 * las tablas y el motor real (Config + Filtro_Origen + Code) con shims de
 * las APIs de Google, asi que la previa corre getDashboardData() en vivo
 * igual que desplegado. Antes, con solo 6 rangos precalculados y un
 * calendario libre, cualquier fecha elegida a mano caia al payload de
 * respaldo y el filtro de origen parecia no funcionar.
 *
 *   node build_previa.js
 */
const fs = require('fs');
const path = require('path');

const DIR = 'c:/Users/millo/Desktop/Dashboard 360 mkt/apps_script';
const HOJAS = JSON.parse(fs.readFileSync('sheet_data.json', 'utf8'));

// ---- que tablas viajan, y con que columnas ---------------------------
// Solo lo que el tablero lee de verdad. Las pre-agregadas viejas
// (RESCATE_BQ, WP_SERIE, WP_CANJES, PLATA_SOBRE_MESA) son respaldo del
// refresh de produccion y no hacen falta en la previa.
const USADAS = [
  'CONFIG', '_LOG', 'SEDES', 'SEDES_EVENTOS', 'PLATAFORMA_SEDES',
  'META_ADS', 'RESCATE_BQ2',
  'WP_SEDE_MES', 'WP_SEDE_INC', 'WP_CANJES2', 'HILOS_BROADCAST', 'NOVEDADES', 'AAA', 'DEALS_COHORTE',
  'WP_ADOPCION_KPI', 'WP_ADOPCION_MUNDO', 'WP_ADOPCION_TENDENCIA', 'WP_ADOPCION_TOP',
  'WP_LOGIN_SEDES', 'WP_HABILITADAS', 'WP_LOGIN_DIA', 'WP_PTS_SEDE_MES', 'WP_RESUMEN',
  'ACT_SEDE_MES', 'DEALS_ORIGEN', 'SEDE_ESTADO_MES', 'SEDE_ROLES', 'OWNERS', 'CREDITO_DIA', 'CREDITO_SEDES', 'LT_APPS_DIA', 'LT_TOUCHES', 'LT_CADENCIA', 'LT_PIEZAS', 'LT_WA_FRANJA', 'LT_TEL_SEDES', 'LT_WA_EVENTOS',
  'RESCATE_GESTION', 'RESCATE_CAUSAL', 'RESCATE_POOL', 'RESCATE_WA',
  'RESCATE_DESENLACE', 'RESCATE_HIST', 'RESCATE_APROB_MSJ', 'RESCATE_WA_PACIENTES', 'RESCATE_HIST_PLATA', 'DESEMBOLSO_RESCATE_DIA',
  'SEG_ELEGIBLES', 'SEG_SOLICITUDES'
];

// Columnas que se pueden botar sin que el tablero las extrañe. Son las que
// mas pesan por ser texto largo y repetido.
const SOBRAN = {
  SEDES_EVENTOS: ['categoria', 'sede_id', 'origen'],
  RESCATE_BQ2: ['sede'],
  SEDES: ['etapa', 'ranking', 'grupo_long_tail', 'auto_bucket', 'alert_level',
          'fecha_entrada_pipeline_actual', 'fecha_ultima_app', 'aprob_no_firmados_60d',
          'aprobados_60d', 'desembolsos_60d', 'ticket_promedio_4m', 'valor_puntos',
          'aplica_wp_raw', 'resu_apps', 'resu_desembolsos', 'resu_aprobados',
          'monto_aprobado_post_resu', 'cs_apps_bq', 'cs_firmas_bq', 'cs_hizo_1app',
          'cs_exitosa', 'cs_dias_a_1app']
};

/* La previa embebe las tablas en el HTML y corre el motor en el navegador.
   Con todo el historico el archivo llego a 12,7 MB y el visor del artefacto
   se queda pensando: descarga 12 MB y despues agrega 117 mil filas en el
   cliente. El /exec real lee las hojas en vivo y no tiene este problema, asi
   que el recorte es SOLO de la previa.

   Se corta por fecha en las tablas pesadas y fechadas. El piso es 2025-11
   porque los mapas de cohortes arrancan en 2026-01 y necesitan dos meses de
   contexto previo para el mes anterior comparativo. */
const PISO = '2025-11';
const DIA_BASE = Date.UTC(2025, 0, 1);
const pisoDia = Math.round((Date.UTC(2025, 10, 1) - DIA_BASE) / 86400000);
const FECHADAS = {
  SEDES_EVENTOS: r => String(r[0] || '') >= PISO,
  SEDE_ESTADO_MES: r => String(r[1] || '') >= PISO,
  ACT_SEDE_MES: r => String(r[1] || '') >= PISO,
  RESCATE_BQ2: r => String(r[0] || '') >= PISO,
  // CREDITO_DIA guarda el dia como offset desde 2025-01-01, no como fecha.
  CREDITO_DIA: r => Number(r[1]) >= pisoDia
};

function porFecha(nombre, filas) {
  const f = FECHADAS[nombre];
  if (!f || filas.length < 2) return filas;
  return [filas[0]].concat(filas.slice(1).filter(f));
}

function recortar(nombre, filas) {
  const fuera = SOBRAN[nombre];
  if (!fuera || !filas.length) return filas;
  const head = filas[0];
  const quedan = head.map((c, i) => i).filter(i => fuera.indexOf(head[i]) < 0);
  return filas.map(r => quedan.map(i => (r[i] === undefined ? '' : r[i])));
}

const bundle = {};
let bytes = 0;
USADAS.forEach(n => {
  if (!HOJAS[n]) { console.log('  OJO: falta la hoja ' + n); return; }
  const antes = HOJAS[n].length - 1;
  bundle[n] = recortar(n, porFecha(n, HOJAS[n]));
  const quitadas = antes - (bundle[n].length - 1);
  const b = JSON.stringify(bundle[n]).length;
  bytes += b;
  console.log('  ' + n.padEnd(18) + String(bundle[n].length - 1).padStart(7) +
    (quitadas ? ' (-' + quitadas + ')' : '') +
    ' filas  ' + (b / 1048576).toFixed(2) + ' MB');
});
console.log('  ' + 'TOTAL TABLAS'.padEnd(18) + ' '.repeat(14) + (bytes / 1048576).toFixed(2) + ' MB');

// ------------------------- ensamblar el HTML -------------------------
const logo = fs.readFileSync('logo_b64.txt', 'utf8').trim();
const estilos = fs.readFileSync(path.join(DIR, 'styles.html'), 'utf8');
const scripts = fs.readFileSync(path.join(DIR, 'scripts.html'), 'utf8');
const shims = fs.readFileSync('motor_shims.js', 'utf8');
const motor = ['Config.gs', 'Filtro_Origen.gs', 'Code.gs']
  .map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
let html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');

// OJO: replace con un string de reemplazo interpreta $&, $' y $` como
// patrones. Los formateadores de COP contienen '$', o sea la secuencia $' —
// sin la funcion de reemplazo el JS sale corrupto y en silencio: el
// navegador no ejecuta el bloque y el spinner gira eterno.
const bloqueMotor =
  '<script>\nwindow.HOJAS = ' + JSON.stringify(bundle) + ';\n</script>\n' +
  '<script>\n' + shims + '\n</script>\n' +
  '<script>\n' + motor + '\n</script>\n';

html = html.replace("<?!= include('styles'); ?>", () => estilos);
html = html.replace("<?!= include('scripts'); ?>", () => bloqueMotor + scripts);
html = html.replace('__LOGO_B64__', () => logo);

// El archivo local se queda como documento completo (se abre con doble clic
// en el navegador). El del artefacto va SIN <!doctype>, <html>, <head> ni
// <body>: el visor envuelve el contenido en su propio esqueleto, y publicar
// un documento anidado dentro de su <body> deja dos <head> y un
// <base target="_top"> donde no va. Venia funcionando de milagro.
function paraArtefacto(doc) {
  var mh = doc.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  var mb = doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  var head = mh ? mh[1] : '';
  var body = mb ? mb[1] : doc;
  // Del <head> se conserva lo que si hace falta: el titulo, la fuente y los
  // estilos. El resto del andamiaje se descarta.
  var util = (head.match(/<title[\s\S]*?<\/title>|<link[^>]*fonts[^>]*>|<style[\s\S]*?<\/style>/gi) || []).join('\n');
  // El tema se declaraba en <html data-tema="claro">. Sin ese atributo el
  // CSS de tema claro no aplica, asi que se reinyecta sobre el root.
  var tema = '<script>\ntry { document.documentElement.setAttribute("data-tema", "claro"); } catch (e) {}\n<' + '/script>';
  return util + '\n' + tema + '\n' + body;
}

const salidas = [['Dashboard_360_WELLI_previa.html', html],
                 ['artifact_tablero.html', paraArtefacto(html)]];
salidas.forEach(function (par) {
  const f = par[0], contenido = par[1];
  fs.writeFileSync(f, contenido, 'utf8');
  console.log('escrito ' + f + '  ' + Math.round(contenido.length / 1024) + 'KB');
});
