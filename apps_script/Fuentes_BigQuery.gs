/**
 * Fuentes_BigQuery.gs — Conversión, Revenue, Rescate y Welli Points
 * -----------------------------------------------------------------
 * Usa el servicio avanzado de BigQuery de Apps Script (no un service
 * account): Servicios → + → BigQuery API. Corre con el OAuth del dueño
 * del script, así que ese usuario necesita permiso de lectura en los
 * proyectos welli-tecnologia y welli-growth.
 *
 * Hojas que escribe:
 *   CONVERSION  — embudo de solicitudes de crédito (welli-tecnologia)
 *   REVENUE     — desembolsos por fecha de OTP validado (welli-tecnologia)
 *   RESCATE_BQ  — rescatados con ventana de firma (welli-tecnologia)
 *   WP_BQ       — Welli Points real (welli-growth.wp_data)
 */

/** Corre una query y devuelve {campos:[], filas:[[]]}. */
function bq_(sql, projectId) {
  projectId = projectId || BQ_PROJECT_CREDITO;
  var req = { query: sql, useLegacySql: false, timeoutMs: 120000,
              location: BQ_LOCATION };
  var res = BigQuery.Jobs.query(req, projectId);
  var jobId = res.jobReference.jobId;
  var location = res.jobReference.location || BQ_LOCATION;

  // Un job puede venir ya fallado: hay que mirar errorResult, porque
  // jobComplete se queda en false y el sintoma parece un cuelgue.
  if (res.status && res.status.errorResult) {
    throw new Error('BigQuery: ' + res.status.errorResult.message);
  }

  var vueltas = 0;
  while (!res.jobComplete && vueltas < 60) {
    Utilities.sleep(2000);
    res = BigQuery.Jobs.getQueryResults(projectId, jobId,
      { location: location, timeoutMs: 120000 });
    if (res.errors && res.errors.length) {
      throw new Error('BigQuery: ' + res.errors[0].message);
    }
    vueltas++;
  }
  if (!res.jobComplete) throw new Error('BigQuery: la query no terminó en 2 minutos');

  var campos = (res.schema && res.schema.fields || []).map(function (f) { return f.name; });
  var filas = [];
  var pagina = res;
  while (pagina) {
    (pagina.rows || []).forEach(function (r) {
      filas.push((r.f || []).map(function (c) { return c.v; }));
    });
    if (!pagina.pageToken) break;
    pagina = BigQuery.Jobs.getQueryResults(projectId, jobId,
      { pageToken: pagina.pageToken, location: location });
  }
  return { campos: campos, filas: filas };
}

// =====================================================================
// CONVERSIÓN — embudo de solicitudes (query del usuario, agregada por día)
// =====================================================================

var SQL_CONVERSION =
  'WITH base AS (\n' +
  '  SELECT\n' +
  '    id,\n' +
  '    DATE(created_on) AS fecha_solicitud,\n' +
  '    CASE\n' +
  "      WHEN estado IN ('on_hold_rejected','rejected_validation','risk_in_process',\n" +
  "                      'rejected','fraud','creada','on_hold_approved','on_hold_docs')\n" +
  "        THEN 'Rechazado'\n" +
  "      WHEN estado IN ('firma_contrato','approved','not_taken')\n" +
  "        THEN 'Aprobado'\n" +
  "      WHEN estado IN ('pendiente_aprobacion_medico','desembolsado',\n" +
  "                      'pendiente_validacion_cliente','fulfilled',\n" +
  "                      'pendiente_desembolso','dismissed')\n" +
  "        THEN 'Convertido'\n" +
  "      ELSE 'Otro'\n" +
  '    END AS estado_final\n' +
  '  FROM `welli-tecnologia.public.profile_institucion`\n' +
  '  WHERE medico_id IS NOT NULL\n' +
  '    AND DATE(created_on) >= @desde\n' +
  '),\n' +
  'flags AS (\n' +
  '  SELECT *,\n' +
  "    CASE WHEN estado_final IN ('Aprobado','Convertido') THEN 1 ELSE 0 END AS flag_aprobado,\n" +
  "    CASE WHEN estado_final = 'Convertido' THEN 1 ELSE 0 END AS flag_convertido\n" +
  '  FROM base\n' +
  ')\n' +
  'SELECT\n' +
  '  fecha_solicitud,\n' +
  '  COUNT(*) AS solicitudes,\n' +
  '  SUM(flag_aprobado) AS aprobados,\n' +
  '  SUM(flag_convertido) AS convertidos\n' +
  'FROM flags\n' +
  'GROUP BY fecha_solicitud\n' +
  'ORDER BY fecha_solicitud';

function refreshConversion(desde) {
  desde = desde || (hoyISO_().substring(0, 4) + '-01-01');
  try {
    var sql = SQL_CONVERSION.replace(/@desde/g, "'" + desde + "'");
    var r = bq_(sql, BQ_PROJECT_CREDITO);
    var filas = [['fecha_solicitud', 'solicitudes', 'aprobados', 'convertidos']];
    r.filas.forEach(function (f) {
      filas.push([String(f[0] || '').substring(0, 10), Number(f[1] || 0),
                  Number(f[2] || 0), Number(f[3] || 0)]);
    });
    escribirHoja_('CONVERSION', filas);
    log_('BigQuery Conversion', 'OK', filas.length - 1, 'desde ' + desde);
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery Conversion', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

// =====================================================================
// REVENUE — la fecha de ingreso es validated_on del OTP, no created_on
// =====================================================================

var SQL_REVENUE =
  'WITH otp AS (\n' +
  '  SELECT application_id, MAX(validated_on) AS validated_on\n' +
  '  FROM `welli-tecnologia.public.otp_log`\n' +
  '  GROUP BY application_id\n' +
  ')\n' +
  'SELECT\n' +
  '  DATE(otp.validated_on) AS validated_on,\n' +
  '  COUNT(*) AS creditos,\n' +
  '  SUM(pi.monto) AS monto_credito\n' +
  'FROM `welli-tecnologia.public.profile_institucion` AS pi\n' +
  'LEFT JOIN otp ON otp.application_id = pi.id\n' +
  'WHERE pi.estado IN (\n' +
  "    'firma_contrato','pendiente_validacion_cliente','in_progress_validation_client',\n" +
  "    'pendiente_aprobacion_medico','pendiente_desembolso','pendiente_validacion',\n" +
  "    'approved','on_hold_approved','on_hold_rejected','desembolsado')\n" +
  '  AND DATE(otp.validated_on) >= @desde\n' +
  'GROUP BY validated_on\n' +
  'ORDER BY validated_on';

function refreshRevenue(desde) {
  desde = desde || (hoyISO_().substring(0, 4) + '-01-01');
  try {
    var sql = SQL_REVENUE.replace(/@desde/g, "'" + desde + "'");
    var r = bq_(sql, BQ_PROJECT_CREDITO);
    var filas = [['validated_on', 'creditos', 'monto_credito']];
    r.filas.forEach(function (f) {
      filas.push([String(f[0] || '').substring(0, 10), Number(f[1] || 0), Number(f[2] || 0)]);
    });
    escribirHoja_('REVENUE', filas);
    log_('BigQuery Revenue', 'OK', filas.length - 1, 'desde ' + desde);
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery Revenue', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

// =====================================================================
// RESCATE — aprobado que no firmó a tiempo y luego sí desembolsó
// =====================================================================
// La fecha de aprobación no es una columna: vive dentro del JSON de la
// columna `cambios` (historial de estado + timestamp). De ahí se saca el
// primer momento en que la solicitud pasó a 'approved'.
//
// POR QUÉ ESTOS BALDES Y NO "corta/media/larga":
// medido sobre 2026, el 96,4% de los desembolsos ocurre en 15 días o menos
// desde la aprobación y otro 2,2% entre 16 y 30. O sea que una "ventana
// corta" contada desde la aprobación NO es rescate, es el flujo normal.
// Rescate es la cola: el paciente dejó pasar la ventana normal (>30 días)
// y aun así terminó desembolsando — 256 casos y $1.360 millones en 2026.
//
// Las ventanas corta/media que pide el prompt original se miden desde el
// CONTACTO de rescate, no desde la aprobación. Eso exige cruzar los
// contactos de Hilos con BigQuery por teléfono, que no está resuelto: se
// deja marcado como pendiente en vez de rellenarlo con este dato, que
// mide algo distinto.

var SQL_RESCATE =
  'WITH aprob AS (\n' +
  '  SELECT\n' +
  '    id,\n' +
  '    medico AS sede,\n' +
  '    medico_id,\n' +
  '    monto,\n' +
  '    fecha_solicitud_desembolso,\n' +
  '    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))\n' +
  '     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c\n' +
  '     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado\n' +
  '  FROM `welli-tecnologia.public.profile_institucion`\n' +
  "  WHERE estado = 'desembolsado'\n" +
  '    AND fecha_solicitud_desembolso IS NOT NULL\n' +
  '    AND DATE(fecha_solicitud_desembolso) >= @desde\n' +
  ')\n' +
  'SELECT\n' +
  '  DATE(fecha_solicitud_desembolso) AS fecha_desembolso,\n' +
  '  sede,\n' +
  '  monto,\n' +
  '  DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) AS dias,\n' +
  '  CASE\n' +
  '    WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 15\n' +
  "      THEN 'normal_0_15'\n" +
  '    WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 30\n' +
  "      THEN 'normal_16_30'\n" +
  '    WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 60\n' +
  "      THEN 'rescate_31_60'\n" +
  "    ELSE 'rescate_60_mas'\n" +
  '  END AS balde\n' +
  'FROM aprob\n' +
  'WHERE fecha_aprobado IS NOT NULL\n' +
  'ORDER BY fecha_desembolso';

function refreshRescate(desde) {
  desde = desde || (hoyISO_().substring(0, 4) + '-01-01');
  try {
    var sql = SQL_RESCATE.replace(/@desde/g, "'" + desde + "'");
    var r = bq_(sql, BQ_PROJECT_CREDITO);
    var filas = [['fecha_desembolso', 'sede', 'monto', 'dias_aprobado_a_desembolso', 'balde']];
    r.filas.forEach(function (f) {
      filas.push([String(f[0] || '').substring(0, 10), f[1] || '', Number(f[2] || 0),
                  Number(f[3] || 0), f[4] || '']);
    });
    escribirHoja_('RESCATE_BQ', filas);
    log_('BigQuery Rescate', 'OK', filas.length - 1, 'desde ' + desde);
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery Rescate', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

// =====================================================================
// COHORTES — plata firmada por sede y por mes (proyecto welli-data)
// =====================================================================
// Fuente: welli-data.data_ops.t_solicitudes. Es un TERCER proyecto,
// distinto de welli-tecnologia y welli-growth.
//
// Reglas de la cosecha:
//  - la cosecha de una sede es el mes de hs_createdate en HubSpot y NO
//    cambia nunca, sin importar a qué pipeline se mueva después
//  - el mes de la plata es la FECHA DE FIRMA (fecha_firma_contrato), no
//    la de radicación
//  - el monto es monto_aprobado
//  - la llave de sede es id_sede, que en HubSpot es la propiedad
//    id_internal (un UUID)
//
// Escribe la hoja PLATA_SEDE_MES (sede × mes). El cruce con la cosecha y
// el armado de las matrices M0..M7 lo hace Code.gs al momento de servir,
// para no tener que reescribir la matriz cada vez que entra una sede.

var BQ_TABLA_SOLICITUDES = 'welli-data.data_ops.t_solicitudes';

/** Lista los valores de estado_final. Corre esto para fijar el filtro. */
function inspeccionarSolicitudes() {
  try {
    var c = bq_('SELECT column_name, data_type FROM ' +
      '`welli-data.data_ops.INFORMATION_SCHEMA.COLUMNS` ' +
      "WHERE table_name = 't_solicitudes' ORDER BY ordinal_position", BQ_PROJECT_DATA);
    Logger.log('--- columnas ---');
    c.filas.forEach(function (f) { Logger.log('  ' + f[0] + '  ' + f[1]); });

    var e = bq_('SELECT estado_final, COUNT(*) AS n FROM `' + BQ_TABLA_SOLICITUDES +
      '` WHERE fecha_firma_contrato IS NOT NULL GROUP BY estado_final ORDER BY n DESC',
      BQ_PROJECT_DATA);
    Logger.log('--- estado_final (solo firmados) ---');
    e.filas.forEach(function (f) { Logger.log('  ' + f[0] + '  ' + f[1]); });
    return e.filas;
  } catch (err) {
    Logger.log('No hay acceso a welli-data todavía: ' + err);
    return [];
  }
}

// Estados que cuentan como desembolso efectivo. Se dejan explícitos en vez
// de adivinar: si inspeccionarSolicitudes() muestra otros nombres, se
// ajusta esta lista y nada más.
var ESTADOS_DESEMBOLSO = ['desembolsado', 'fulfilled', 'pendiente_desembolso',
  'pendiente_aprobacion_medico', 'pendiente_validacion_cliente', 'dismissed'];

function refreshCohortes() {
  try {
    var lista = ESTADOS_DESEMBOLSO.map(function (e) { return "'" + e + "'"; }).join(', ');
    var sql =
      'SELECT id_sede,\n' +
      "       FORMAT_DATE('%Y-%m', DATE_TRUNC(fecha_firma_contrato, MONTH)) AS mes,\n" +
      '       COUNT(*) AS desembolsos,\n' +
      '       SUM(monto_aprobado) AS monto\n' +
      'FROM `' + BQ_TABLA_SOLICITUDES + '`\n' +
      'WHERE fecha_firma_contrato IS NOT NULL\n' +
      '  AND id_sede IS NOT NULL\n' +
      '  AND estado_final IN (' + lista + ')\n' +
      'GROUP BY 1, 2';
    var r = bq_(sql, BQ_PROJECT_DATA);
    var filas = [['id_sede', 'mes', 'desembolsos', 'monto']];
    r.filas.forEach(function (f) {
      filas.push([f[0] || '', String(f[1] || '').substring(0, 7),
                  Number(f[2] || 0), Number(f[3] || 0)]);
    });
    escribirHoja_('PLATA_SEDE_MES', filas);
    log_('BigQuery Cohortes', 'OK', filas.length - 1, 'sede x mes por fecha de firma');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery Cohortes', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

// =====================================================================
// PLATA SOBRE LA MESA — el inventario que el rescate ataca
// =====================================================================
// Crédito aprobado que el paciente NO tomó, vivo hoy, en COP. Es la
// materia prima del Frente 4 y el número que el comité necesita ver:
// a 2026-08-31 son $208.220 millones en 43.199 créditos, 2,3 veces todo
// lo desembolsado en 2026.
//
// Se agrupa por antigüedad de la aprobación porque eso es lo que decide
// si es accionable: lo de 0-30 días se rescata, lo de más de 180 casi no.
// Ojo: HubSpot reporta 15.845 aprobados sin firmar con su propio contador.
// La cifra de acá es la buena — BigQuery es la fuente del crédito.

var SQL_PLATA_APROB =
  'WITH aprob AS (\n' +
  '  SELECT\n' +
  '    id, medico AS sede, medico_id,\n' +
  '    COALESCE(monto_aprobado, monto) AS monto_aprobado,\n' +
  '    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))\n' +
  '     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c\n' +
  '     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado\n' +
  '  FROM `welli-tecnologia.public.profile_institucion`\n' +
  "  WHERE estado IN ('approved', 'not_taken', 'firma_contrato')\n" +
  ')\n';

var SQL_PLATA =
  SQL_PLATA_APROB +
  'SELECT\n' +
  '  CASE\n' +
  "    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 15  THEN '1. 0-15 dias'\n" +
  "    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30  THEN '2. 16-30 dias'\n" +
  "    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 60  THEN '3. 31-60 dias'\n" +
  "    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 180 THEN '4. 61-180 dias'\n" +
  "    ELSE '5. mas de 180 dias'\n" +
  '  END AS antiguedad,\n' +
  '  COUNT(*) AS creditos,\n' +
  '  SUM(monto_aprobado) AS monto,\n' +
  '  COUNT(DISTINCT medico_id) AS sedes\n' +
  'FROM aprob\n' +
  'WHERE fecha_aprobado IS NOT NULL\n' +
  'GROUP BY antiguedad\n' +
  'ORDER BY antiguedad';

var SQL_PLATA_SEDES =
  SQL_PLATA_APROB +
  'SELECT\n' +
  '  sede,\n' +
  '  COUNT(*) AS creditos,\n' +
  '  SUM(monto_aprobado) AS monto,\n' +
  '  SUM(CASE WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30\n' +
  '           THEN 1 ELSE 0 END) AS creditos_30d,\n' +
  '  SUM(CASE WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30\n' +
  '           THEN monto_aprobado ELSE 0 END) AS monto_30d\n' +
  'FROM aprob\n' +
  'WHERE fecha_aprobado IS NOT NULL AND sede IS NOT NULL\n' +
  'GROUP BY sede\n' +
  'ORDER BY monto DESC\n' +
  'LIMIT 300';

function refreshPlataSobreMesa() {
  try {
    var r = bq_(SQL_PLATA, BQ_PROJECT_CREDITO);
    var filas = [['antiguedad', 'creditos', 'monto', 'sedes']];
    r.filas.forEach(function (f) {
      filas.push([f[0] || '', Number(f[1] || 0), Number(f[2] || 0), Number(f[3] || 0)]);
    });
    escribirHoja_('PLATA_SOBRE_MESA', filas);

    var s = bq_(SQL_PLATA_SEDES, BQ_PROJECT_CREDITO);
    var fs = [['sede', 'creditos', 'monto', 'creditos_30d', 'monto_30d']];
    s.filas.forEach(function (f) {
      fs.push([f[0] || '', Number(f[1] || 0), Number(f[2] || 0),
               Number(f[3] || 0), Number(f[4] || 0)]);
    });
    escribirHoja_('PLATA_SEDES', fs);

    log_('BigQuery PlataSobreMesa', 'OK', filas.length - 1,
         (fs.length - 1) + ' sedes en PLATA_SEDES');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery PlataSobreMesa', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

// =====================================================================
// WELLI POINTS — proyecto welli-growth, dataset wp_data
// =====================================================================
// Tablas confirmadas en la consola: wellipoints_snapshot,
// wellipoints_historico, wp_canjeos_solicitados,
// wellipoints_concursos_snapshot, wp_ajustes_manuales.
// Los nombres de COLUMNA todavía no están confirmados, así que la query
// se arma tras introspeccionar el esquema y se cae con gracia si no
// encuentra las columnas que espera.

/** Lista las columnas de una tabla. Útil para cerrar F5. */
function inspeccionarWP() {
  try {
    var r = bq_(
      'SELECT table_name, column_name, data_type ' +
      'FROM `welli-growth.wp_data.INFORMATION_SCHEMA.COLUMNS` ' +
      // El job se crea en welli-data: no hay jobs.create en welli-growth.
      'ORDER BY table_name, ordinal_position', BQ_PROJECT_DATA);
    r.filas.forEach(function (f) { Logger.log(f.join(' | ')); });
    return r.filas;
  } catch (e) {
    Logger.log('No hay acceso a welli-growth todavía: ' + e);
    return [];
  }
}

/** Primera columna cuyo nombre coincide con alguno de los candidatos. */
function elegirCol_(cols, candidatos) {
  for (var i = 0; i < candidatos.length; i++) {
    for (var j = 0; j < cols.length; j++) {
      if (cols[j].toLowerCase() === candidatos[i]) return cols[j];
    }
  }
  for (var k = 0; k < candidatos.length; k++) {
    for (var m = 0; m < cols.length; m++) {
      if (cols[m].toLowerCase().indexOf(candidatos[k]) >= 0) return cols[m];
    }
  }
  return null;
}

/**
 * Welli Points — welli-growth.wp_data.
 *
 * El job se crea en BQ_PROJECT_DATA, NO en welli-growth. La cuenta tiene
 * lectura sobre el dataset wp_data pero no bigquery.jobs.create en el
 * proyecto welli-growth: crear el job ahí devuelve 403 aunque los datos
 * se puedan leer. Con el job en welli-data y el FROM totalmente
 * calificado, entra todo. Si algún día se otorga jobUser en welli-growth
 * esto sigue funcionando igual.
 *
 * wp_ofrecido_mes y wp_ganado_mes son acumulados DEL MES: se toma el
 * último snapshot de cada mes por sede, nunca la suma de los días.
 */
var WP_ULT_MES =
  'WITH ult AS (\n' +
  '  SELECT * EXCEPT(rn) FROM (\n' +
  '    SELECT *, FORMAT_DATE("%Y-%m", snapshot_date) AS mes,\n' +
  '           ROW_NUMBER() OVER (PARTITION BY id_internal,\n' +
  '                              FORMAT_DATE("%Y-%m", snapshot_date)\n' +
  '                              ORDER BY snapshot_date DESC) rn\n' +
  '    FROM `welli-growth.wp_data.wp_incentivos_diario`) WHERE rn = 1)\n';

var WP_ULT_HOY =
  'WITH ult AS (\n' +
  '  SELECT * EXCEPT(rn) FROM (\n' +
  '    SELECT *, ROW_NUMBER() OVER (PARTITION BY id_internal\n' +
  '                                 ORDER BY snapshot_date DESC) rn\n' +
  '    FROM `welli-growth.wp_data.wp_incentivos_diario`) WHERE rn = 1)\n';

function refreshWelliPoints() {
  var escritas = 0;

  // ---- serie mensual: ¿el incentivo convierte? ----------------------
  try {
    var s = bq_(WP_ULT_MES +
      'SELECT mes, COUNT(*) AS sedes,\n' +
      '       COUNTIF(incentivo_ofrecido) AS con_oferta,\n' +
      '       COUNTIF(wp_ganado_mes > 0) AS ganaron,\n' +
      '       SUM(wp_ofrecido_mes) AS wp_ofrecido,\n' +
      '       SUM(wp_ganado_mes) AS wp_ganado,\n' +
      '       SUM(wp_pendiente_actual) AS wp_pendiente\n' +
      'FROM ult GROUP BY mes ORDER BY mes', BQ_PROJECT_DATA);
    var fs = [['mes', 'sedes', 'con_oferta', 'ganaron', 'wp_ofrecido', 'wp_ganado',
               'wp_pendiente']];
    s.filas.forEach(function (f) {
      fs.push([f[0], n_(f[1]), n_(f[2]), n_(f[3]), n_(f[4]), n_(f[5]), n_(f[6])]);
    });
    escribirHoja_('WP_SERIE', fs);
    escritas += fs.length - 1;
    log_('BigQuery WP serie', 'OK', fs.length - 1, '');
  } catch (e) {
    log_('BigQuery WP serie', 'ERROR', 0, String(e).substring(0, 250));
  }

  // ---- por incentivo: cuál mueve y cuál está vencido ----------------
  try {
    var i = bq_(WP_ULT_HOY +
      'SELECT IFNULL(incentivo_principal, "(sin incentivo)") AS incentivo,\n' +
      '       COUNT(*) AS sedes,\n' +
      '       COUNTIF(wp_ganado_mes > 0) AS ganaron,\n' +
      '       SUM(wp_ofrecido_mes) AS wp_ofrecido,\n' +
      '       SUM(wp_ganado_mes) AS wp_ganado,\n' +
      '       COUNTIF(incentivo_expira IS NOT NULL\n' +
      '               AND incentivo_expira >= CURRENT_DATE()) AS vigentes,\n' +
      '       COUNTIF(incentivo_expira IS NOT NULL\n' +
      '               AND incentivo_expira <  CURRENT_DATE()) AS vencidos\n' +
      'FROM ult GROUP BY incentivo ORDER BY sedes DESC', BQ_PROJECT_DATA);
    var fi = [['incentivo', 'sedes', 'ganaron', 'wp_ofrecido', 'wp_ganado',
               'vigentes', 'vencidos']];
    i.filas.forEach(function (f) {
      fi.push([f[0], n_(f[1]), n_(f[2]), n_(f[3]), n_(f[4]), n_(f[5]), n_(f[6])]);
    });
    escribirHoja_('WP_INCENTIVO', fi);
    escritas += fi.length - 1;
    log_('BigQuery WP incentivos', 'OK', fi.length - 1, '');
  } catch (e2) {
    log_('BigQuery WP incentivos', 'ERROR', 0, String(e2).substring(0, 250));
  }

  // ---- canjes: la promesa del programa ------------------------------
  try {
    var c = bq_(
      'SELECT CAST(DATE(fecha_solicitud) AS STRING) AS fecha, sede_nombre,\n' +
      '       IFNULL(pipeline, "") AS pipeline, pts_solicitados, cop_solicitados,\n' +
      '       IFNULL(formato, "") AS formato, IFNULL(estado, "") AS estado,\n' +
      '       descontado_wp,\n' +
      '       DATE_DIFF(CURRENT_DATE(), DATE(fecha_solicitud), DAY) AS dias\n' +
      'FROM `welli-growth.wp_data.wp_canjeos_solicitados`\n' +
      'ORDER BY fecha_solicitud DESC', BQ_PROJECT_DATA);
    var fc = [['fecha', 'sede_nombre', 'pipeline', 'pts_solicitados', 'cop_solicitados',
               'formato', 'estado', 'descontado_wp', 'dias']];
    c.filas.forEach(function (f) {
      fc.push([f[0], f[1], f[2], n_(f[3]), n_(f[4]), f[5], f[6], f[7], n_(f[8])]);
    });
    escribirHoja_('WP_CANJES', fc);
    escritas += fc.length - 1;
    log_('BigQuery WP canjes', 'OK', fc.length - 1, '');
  } catch (e3) {
    log_('BigQuery WP canjes', 'ERROR', 0, String(e3).substring(0, 250));
  }

  // ---- KPIs de una sola fila ----------------------------------------
  try {
    var v = bq_(WP_ULT_HOY +
      'SELECT COUNT(*) AS sedes,\n' +
      '       COUNTIF(incentivo_expira IS NOT NULL) AS con_fecha,\n' +
      '       COUNTIF(incentivo_expira IS NOT NULL\n' +
      '               AND incentivo_expira >= CURRENT_DATE()) AS vigentes,\n' +
      '       COUNTIF(incentivo_expira IS NOT NULL\n' +
      '               AND incentivo_expira <  CURRENT_DATE()) AS vencidos\n' +
      'FROM ult', BQ_PROJECT_DATA).filas[0];
    var sa = bq_(
      'SELECT COUNT(*) AS sedes, COUNTIF(wp_total > 0) AS con_saldo,\n' +
      '       SUM(wp_total) AS wp_total, SUM(valor_cop) AS valor_cop,\n' +
      '       MAX(periodo) AS periodo\n' +
      'FROM `welli-growth.wp_data.wellipoints_snapshot`', BQ_PROJECT_DATA).filas[0];
    var cj = bq_(
      'SELECT COUNT(*) AS n, SUM(pts_solicitados) AS pts,\n' +
      '       SUM(cop_solicitados) AS cop,\n' +
      '       COUNTIF(LOWER(IFNULL(estado, "")) IN ("pagado", "entregado", "aprobado"))\n' +
      '         AS pagados,\n' +
      '       MAX(DATE_DIFF(CURRENT_DATE(), DATE(fecha_solicitud), DAY)) AS dias_max\n' +
      'FROM `welli-growth.wp_data.wp_canjeos_solicitados`', BQ_PROJECT_DATA).filas[0];
    var rf = bq_(
      'SELECT COUNT(*) AS n, COUNTIF(id_sede_creada IS NOT NULL) AS vinculados\n' +
      'FROM `welli-growth.wp_data.wp_referidos`', BQ_PROJECT_DATA).filas[0];

    var fk = [['metrica', 'valor', 'fuente', 'nota'],
      ['Sedes en el programa', n_(v[0]), 'BigQuery wp_incentivos_diario',
       'último snapshot diario'],
      ['Sedes con saldo de puntos', n_(sa[1]), 'BigQuery wellipoints_snapshot',
       'periodo ' + sa[4]],
      ['Puntos del periodo', n_(sa[2]), 'BigQuery wellipoints_snapshot', ''],
      ['Valor de esos puntos', n_(sa[3]), 'BigQuery wellipoints_snapshot',
       'a 2.000 COP por punto'],
      ['Incentivos con fecha de vencimiento', n_(v[1]), 'BigQuery wp_incentivos_diario', ''],
      ['Incentivos vigentes', n_(v[2]), 'BigQuery wp_incentivos_diario', ''],
      ['Incentivos vencidos', n_(v[3]), 'BigQuery wp_incentivos_diario', ''],
      ['Canjes solicitados', n_(cj[0]), 'BigQuery wp_canjeos_solicitados', ''],
      ['Puntos canjeados', n_(cj[1]), 'BigQuery wp_canjeos_solicitados', ''],
      ['Plata comprometida en canjes', n_(cj[2]), 'BigQuery wp_canjeos_solicitados',
       'cop_solicitados'],
      ['Canjes pagados', n_(cj[3]), 'BigQuery wp_canjeos_solicitados',
       'estados que cuentan como pagado: pagado / entregado / aprobado'],
      ['Dias del canje mas viejo sin pagar', n_(cj[4]),
       'BigQuery wp_canjeos_solicitados', ''],
      ['Referidos registrados por WP', n_(rf[0]), 'BigQuery wp_referidos', ''],
      ['Referidos vinculados', n_(rf[1]), 'BigQuery wp_referidos', '']];
    escribirHoja_('WP_KPI2', fk);
    escritas += fk.length - 1;
    log_('BigQuery WP kpis', 'OK', fk.length - 1, '');
  } catch (e4) {
    log_('BigQuery WP kpis', 'ERROR', 0, String(e4).substring(0, 250));
  }

  return escritas;
}

/** Diagnóstico: confirma que el servicio avanzado de BigQuery responde. */
function probarBigQuery() {
  try {
    var r = bq_('SELECT COUNT(*) AS n FROM `welli-tecnologia.public.profile_institucion`',
                BQ_PROJECT_CREDITO);
    Logger.log('profile_institucion: ' + r.filas[0][0] + ' filas');
  } catch (e) {
    Logger.log('FALLO welli-tecnologia: ' + e);
  }
  try {
    // Ojo: el job va en welli-data. Con BQ_PROJECT_WP esto da 403 porque
    // la cuenta lee el dataset pero no puede crear jobs en ese proyecto.
    var r2 = bq_('SELECT table_name FROM `welli-growth.wp_data.INFORMATION_SCHEMA.TABLES`',
                 BQ_PROJECT_DATA);
    Logger.log('welli-growth.wp_data: ' + r2.filas.map(function (f) { return f[0]; }).join(', '));
  } catch (e2) {
    Logger.log('FALLO welli-growth: ' + e2);
  }
}
// =====================================================================
// Variantes POR SEDE de las queries pre-agregadas.
//
// El filtro global de origen necesita la llave de sede para poder cortar.
// Estas devuelven exactamente lo mismo que SQL_PLATA / SQL_RESCATE y las de
// Welli Points, pero con id_sede: en profile_institucion la columna es
// medico_id, en wp_data es id_internal / sede_id, y en HubSpot es la
// propiedad id_internal del objeto Sedes. El cruce calza 97,5% a 100%.
//
// Las hojas viejas (PLATA_SOBRE_MESA, WP_SERIE, WP_INCENTIVO, WP_KPI2) se
// siguen escribiendo como respaldo, pero el tablero ya lee estas.
// =====================================================================

var NL = '\n';

var SQL_PLATA_SEDE_ANT =
  SQL_PLATA_APROB +
  'SELECT' + NL +
  "  IFNULL(medico_id, '') AS id_sede," + NL +
  '  CASE' + NL +
  "    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 15  THEN '1. 0-15 dias'" + NL +
  "    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30  THEN '2. 16-30 dias'" + NL +
  "    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 60  THEN '3. 31-60 dias'" + NL +
  "    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 180 THEN '4. 61-180 dias'" + NL +
  "    ELSE '5. mas de 180 dias'" + NL +
  '  END AS antiguedad,' + NL +
  '  COUNT(*) AS creditos,' + NL +
  '  SUM(monto_aprobado) AS monto' + NL +
  'FROM aprob' + NL +
  'WHERE fecha_aprobado IS NOT NULL' + NL +
  'GROUP BY 1, 2';

function refreshPlataSedeAnt() {
  try {
    var r = bq_(SQL_PLATA_SEDE_ANT, BQ_PROJECT_CREDITO);
    var filas = [['id_sede', 'antiguedad', 'creditos', 'monto']];
    r.filas.forEach(function (f) {
      filas.push([f[0] || '', f[1] || '', Number(f[2] || 0), Number(f[3] || 0)]);
    });
    escribirHoja_('PLATA_SEDE_ANT', filas);
    log_('BigQuery PlataSedeAnt', 'OK', filas.length - 1, 'sede x antiguedad');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery PlataSedeAnt', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

// RESCATE_BQ2 = RESCATE_BQ + id_sede. Se deja el balde por compatibilidad
// aunque el tablero ya calcula los tramos desde dias_aprobado_a_desembolso.
var SQL_RESCATE_SEDE =
  'WITH aprob AS (' + NL +
  '  SELECT' + NL +
  '    medico AS sede,' + NL +
  "    IFNULL(medico_id, '') AS id_sede," + NL +
  '    monto,' + NL +
  '    fecha_solicitud_desembolso,' + NL +
  '    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))' + NL +
  '     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c' + NL +
  '     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado' + NL +
  '  FROM `welli-tecnologia.public.profile_institucion`' + NL +
  "  WHERE estado = 'desembolsado'" + NL +
  '    AND fecha_solicitud_desembolso IS NOT NULL' + NL +
  '    AND DATE(fecha_solicitud_desembolso) >= @desde' + NL +
  ')' + NL +
  'SELECT' + NL +
  '  CAST(DATE(fecha_solicitud_desembolso) AS STRING) AS fecha_desembolso,' + NL +
  '  sede,' + NL +
  '  id_sede,' + NL +
  '  monto,' + NL +
  '  DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) AS dias' + NL +
  'FROM aprob' + NL +
  'WHERE fecha_aprobado IS NOT NULL' + NL +
  'ORDER BY fecha_desembolso';

function refreshRescateSede(desde) {
  desde = desde || (hoyISO_().substring(0, 4) + '-01-01');
  try {
    var sql = SQL_RESCATE_SEDE.replace(/@desde/g, "'" + desde + "'");
    var r = bq_(sql, BQ_PROJECT_CREDITO);
    var filas = [['fecha_desembolso', 'sede', 'id_sede', 'monto',
                  'dias_aprobado_a_desembolso']];
    r.filas.forEach(function (f) {
      filas.push([f[0] || '', f[1] || '', f[2] || '', Number(f[3] || 0),
                  Number(f[4] || 0)]);
    });
    escribirHoja_('RESCATE_BQ2', filas);
    log_('BigQuery RescateSede', 'OK', filas.length - 1, 'desde ' + desde);
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery RescateSede', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

// ------------------------------------------------ Welli Points por sede
// Ojo con FORMAT_DATE: el patron va con UN solo %, no con %%. Con %% la
// funcion devuelve el literal "%Y-%m" y la columna mes sale con ese texto
// en todas las filas.
var WP_ULT_MES_SEDE =
  'WITH ult AS (' + NL +
  '  SELECT * EXCEPT(rn) FROM (' + NL +
  '    SELECT *, FORMAT_DATE("%Y-%m", snapshot_date) AS mes,' + NL +
  '           ROW_NUMBER() OVER (PARTITION BY id_internal,' + NL +
  '                              FORMAT_DATE("%Y-%m", snapshot_date)' + NL +
  '                              ORDER BY snapshot_date DESC) rn' + NL +
  '    FROM `welli-growth.wp_data.wp_incentivos_diario`) WHERE rn = 1)' + NL;

function refreshWpPorSede() {
  var total = 0;

  try {
    var r = bq_(WP_ULT_MES_SEDE +
      'SELECT mes,' + NL +
      "       IFNULL(id_internal, '') AS id_sede," + NL +
      '       IF(incentivo_ofrecido, 1, 0) AS con_oferta,' + NL +
      '       IFNULL(wp_ofrecido_mes, 0) AS wp_ofrecido,' + NL +
      '       IFNULL(wp_ganado_mes, 0) AS wp_ganado,' + NL +
      '       IFNULL(wp_pendiente_actual, 0) AS wp_pendiente' + NL +
      'FROM ult ORDER BY mes, id_sede', BQ_PROJECT_DATA);
    var f1 = [['mes', 'id_sede', 'con_oferta', 'wp_ofrecido', 'wp_ganado',
               'wp_pendiente']];
    r.filas.forEach(function (f) {
      f1.push([f[0] || '', f[1] || '', Number(f[2] || 0), Number(f[3] || 0),
               Number(f[4] || 0), Number(f[5] || 0)]);
    });
    escribirHoja_('WP_SEDE_MES', f1);
    total += f1.length - 1;
    log_('BigQuery WP sede/mes', 'OK', f1.length - 1, '');
  } catch (e) {
    log_('BigQuery WP sede/mes', 'ERROR', 0, String(e).substring(0, 250));
  }

  try {
    var r2 = bq_(
      'WITH ult AS (' + NL +
      '  SELECT * EXCEPT(rn) FROM (' + NL +
      '    SELECT *, ROW_NUMBER() OVER (PARTITION BY id_internal' + NL +
      '                                 ORDER BY snapshot_date DESC) rn' + NL +
      '    FROM `welli-growth.wp_data.wp_incentivos_diario`) WHERE rn = 1)' + NL +
      "SELECT IFNULL(id_internal, '') AS id_sede," + NL +
      "       IFNULL(incentivo_principal, '(sin incentivo)') AS incentivo," + NL +
      '       IFNULL(wp_ofrecido_mes, 0) AS wp_ofrecido,' + NL +
      '       IFNULL(wp_ganado_mes, 0) AS wp_ganado,' + NL +
      "       IF(incentivo_expira IS NULL, '', CAST(incentivo_expira AS STRING)) AS expira" + NL +
      'FROM ult', BQ_PROJECT_DATA);
    var f2 = [['id_sede', 'incentivo', 'wp_ofrecido', 'wp_ganado', 'expira']];
    r2.filas.forEach(function (f) {
      f2.push([f[0] || '', f[1] || '', Number(f[2] || 0), Number(f[3] || 0), f[4] || '']);
    });
    escribirHoja_('WP_SEDE_INC', f2);
    total += f2.length - 1;
    log_('BigQuery WP sede/incentivo', 'OK', f2.length - 1, '');
  } catch (e2) {
    log_('BigQuery WP sede/incentivo', 'ERROR', 0, String(e2).substring(0, 250));
  }

  try {
    var r3 = bq_(
      'SELECT CAST(DATE(fecha_solicitud) AS STRING) AS fecha,' + NL +
      "       IFNULL(sede_id, '') AS id_sede," + NL +
      "       sede_nombre, IFNULL(pipeline, '') AS pipeline," + NL +
      '       pts_solicitados, cop_solicitados,' + NL +
      "       IFNULL(formato, '') AS formato, IFNULL(estado, '') AS estado," + NL +
      '       descontado_wp,' + NL +
      '       DATE_DIFF(CURRENT_DATE(), DATE(fecha_solicitud), DAY) AS dias' + NL +
      'FROM `welli-growth.wp_data.wp_canjeos_solicitados`' + NL +
      'ORDER BY fecha_solicitud DESC', BQ_PROJECT_DATA);
    var f3 = [['fecha', 'id_sede', 'sede_nombre', 'pipeline', 'pts_solicitados',
               'cop_solicitados', 'formato', 'estado', 'descontado_wp', 'dias']];
    r3.filas.forEach(function (f) {
      f3.push([f[0] || '', f[1] || '', f[2] || '', f[3] || '', Number(f[4] || 0),
               Number(f[5] || 0), f[6] || '', f[7] || '', f[8], Number(f[9] || 0)]);
    });
    escribirHoja_('WP_CANJES2', f3);
    total += f3.length - 1;
    log_('BigQuery WP canjes/sede', 'OK', f3.length - 1, '');
  } catch (e3) {
    log_('BigQuery WP canjes/sede', 'ERROR', 0, String(e3).substring(0, 250));
  }

  return total;
}
// =====================================================================
// FUENTES ACORDADAS CON BI  (contrato de datos, 1 sep 2026)
//
//   solicitudes         -> welli-data.comercial_ops.t_sol_v2 / fecha_solicitud
//   desembolsos y plata -> welli-data.comercial_ops.t_des_v2 / fecha_firma_contrato
//   universo de sedes   -> institucion_medica (existencia + country_code COL)
//
// SIN filtro de estado: es_desembolso es true en las 44.106 filas de
// t_des_v2, o sea que la tabla YA es el universo de desembolsos. Desembolso
// es desembolso, girado o no. Eso elimina de raiz la interpretacion de
// estado_final, que cambio de vocabulario el 1 de abril de 2026
// (desembolsado -> Convertido Total) y venia vaciando reportes en silencio.
//
// La columna Origen de las tablas v2 NO se usa: es un tercer vocabulario
// ("Ref. Farmer", "Pagina Web") y viene vacia en 58% de las filas. El origen
// manda desde HubSpot, que es donde el negocio lo clasifica.
// =====================================================================

var V2_COL = "IFNULL(country_code, 'COL') = 'COL'";

/** El universo: quien existe en la plataforma y de que pais. */
function refreshPlataformaSedes() {
  try {
    var r = bq_(
      'SELECT id,' + NL +
      "       IFNULL(country_code, 'COL') AS pais," + NL +
      '       CAST(DATE(created) AS STRING) AS created' + NL +
      'FROM `welli-tecnologia.public.institucion_medica`', BQ_PROJECT_CREDITO);
    var filas = [['id_sede', 'pais', 'created']];
    r.filas.forEach(function (f) {
      filas.push([f[0] || '', f[1] || 'COL', f[2] || '']);
    });
    escribirHoja_('PLATAFORMA_SEDES', filas);
    log_('BigQuery PlataformaSedes', 'OK', filas.length - 1, 'universo de cosechas');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery PlataformaSedes', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

/** Plata firmada por sede y mes, desde t_des_v2. */
function refreshPlataSedeMes() {
  try {
    var r = bq_(
      'SELECT id_clinica AS id_sede,' + NL +
      '       FORMAT_DATE("%Y-%m", DATE(fecha_firma_contrato)) AS mes,' + NL +
      '       COUNT(*) AS desembolsos,' + NL +
      '       SUM(monto_aprobado) AS monto' + NL +
      'FROM `welli-data.comercial_ops.t_des_v2`' + NL +
      'WHERE ' + V2_COL + ' AND id_clinica IS NOT NULL' + NL +
      'GROUP BY 1, 2', BQ_PROJECT_DATA);
    var filas = [['id_sede', 'mes', 'desembolsos', 'monto']];
    r.filas.forEach(function (f) {
      filas.push([f[0] || '', f[1] || '', Number(f[2] || 0), Number(f[3] || 0)]);
    });
    escribirHoja_('PLATA_SEDE_MES', filas);
    log_('BigQuery PlataSedeMes', 'OK', filas.length - 1, 't_des_v2 sin filtro de estado');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery PlataSedeMes', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

/**
 * Embudo por dia y origen.
 *
 * Se agrupa por ORIGEN y no por sede a proposito: por sede son 135.552 filas
 * (~8 MB) y por origen son ~5.300, y el filtro global opera sobre origenes,
 * asi que no necesita bajar a la sede. El origen se toma de HubSpot cruzando
 * por id_internal.
 */
function refreshEmbudoOrigen() {
  try {
    var origenDe = {};
    leerHoja_('SEDES').forEach(function (s) {
      var id = String(s.id_internal || '').trim();
      if (id) origenDe[id] = normOrigen_(s.origen);
    });
    var NO_HS = '(NO ESTA EN HUBSPOT)';
    var ag = {};
    function bolsa(fecha, origen) {
      var k = fecha + '|' + origen;
      if (!ag[k]) ag[k] = { fecha: fecha, origen: origen, sol: 0, des: 0, monto: 0 };
      return ag[k];
    }

    var s = bq_(
      'SELECT CAST(DATE(fecha_solicitud) AS STRING) AS fecha, id_clinica,' + NL +
      '       COUNT(*) AS n' + NL +
      'FROM `welli-data.comercial_ops.t_sol_v2`' + NL +
      'WHERE ' + V2_COL + ' AND id_clinica IS NOT NULL' + NL +
      'GROUP BY 1, 2', BQ_PROJECT_DATA);
    s.filas.forEach(function (f) {
      var o = origenDe[String(f[1])] || NO_HS;
      bolsa(f[0], o).sol += Number(f[2] || 0);
    });

    var d = bq_(
      'SELECT CAST(DATE(fecha_firma_contrato) AS STRING) AS fecha, id_clinica,' + NL +
      '       COUNT(*) AS n, SUM(monto_aprobado) AS monto' + NL +
      'FROM `welli-data.comercial_ops.t_des_v2`' + NL +
      'WHERE ' + V2_COL + ' AND id_clinica IS NOT NULL' + NL +
      'GROUP BY 1, 2', BQ_PROJECT_DATA);
    d.filas.forEach(function (f) {
      var o = origenDe[String(f[1])] || NO_HS;
      var b = bolsa(f[0], o);
      b.des += Number(f[2] || 0);
      b.monto += Number(f[3] || 0);
    });

    var filas = [['fecha', 'origen', 'solicitudes', 'desembolsados', 'monto']];
    Object.keys(ag).sort().forEach(function (k) {
      var b = ag[k];
      filas.push([b.fecha, b.origen, b.sol, b.des, Math.round(b.monto)]);
    });
    escribirHoja_('EMBUDO_ORIGEN', filas);
    log_('BigQuery EmbudoOrigen', 'OK', filas.length - 1,
         't_sol_v2 + t_des_v2, agrupado por origen de HubSpot');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery EmbudoOrigen', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

// ---------------------------------------------------------------------
// EMBUDO_CONV — el paso de APROBADOS.
//
// t_sol_v2 no expone el estado de aprobacion, asi que el unico lugar donde
// vive es profile_institucion. El mapeo de estados es el que definio el
// equipo; se deja literal para que se pueda auditar contra su query.
//
// OJO con "Convertido": incluye dismissed (53% sin fecha de desembolso),
// pendiente_aprobacion_medico (2%) y pendiente_validacion_cliente (0%). Son
// creditos en camino, no firmados, y por eso da 5,7% mas que t_des_v2. El
// tablero usa de aca SOLO solicitudes y aprobados; los desembolsos y la
// plata siguen saliendo de t_des_v2, que es la fuente acordada con BI.
// ---------------------------------------------------------------------
var SQL_EMBUDO_CONV =
  'WITH base AS (' + NL +
  '  SELECT id, medico_id, DATE(created_on) AS fecha_solicitud,' + NL +
  '    CASE' + NL +
  "      WHEN estado IN ('on_hold_rejected','rejected_validation','risk_in_process'," + NL +
  "        'rejected','fraud','creada','on_hold_approved','on_hold_docs') THEN 'Rechazado'" + NL +
  "      WHEN estado IN ('firma_contrato','approved','not_taken') THEN 'Aprobado'" + NL +
  "      WHEN estado IN ('pendiente_aprobacion_medico','desembolsado'," + NL +
  "        'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'," + NL +
  "        'dismissed') THEN 'Convertido'" + NL +
  "      ELSE 'Otro' END AS estado_final," + NL +
  '    COALESCE(monto_aprobado, monto) AS monto' + NL +
  '  FROM `welli-tecnologia.public.profile_institucion`' + NL +
  '  WHERE medico_id IS NOT NULL' + NL +
  '),' + NL +
  'flags AS (' + NL +
  '  SELECT *,' + NL +
  "    IF(estado_final IN ('Aprobado','Convertido'), 1, 0) AS flag_aprobado," + NL +
  "    IF(estado_final = 'Convertido', 1, 0) AS flag_convertido" + NL +
  '  FROM base' + NL +
  ')' + NL +
  'SELECT CAST(fecha_solicitud AS STRING) AS fecha, medico_id,' + NL +
  '       COUNT(*) AS solicitudes,' + NL +
  '       SUM(flag_aprobado) AS aprobados,' + NL +
  '       SUM(flag_convertido) AS convertidos,' + NL +
  '       SUM(IF(flag_convertido = 1, monto, 0)) AS monto' + NL +
  'FROM flags GROUP BY 1, 2';

function refreshEmbudoConv() {
  try {
    var origenDe = {};
    leerHoja_('SEDES').forEach(function (s) {
      var id = String(s.id_internal || '').trim();
      if (id) origenDe[id] = normOrigen_(s.origen);
    });
    var r = bq_(SQL_EMBUDO_CONV, BQ_PROJECT_CREDITO);
    var ag = {};
    r.filas.forEach(function (f) {
      var o = origenDe[String(f[1])] || '(NO ESTA EN HUBSPOT)';
      var k = f[0] + '|' + o;
      if (!ag[k]) ag[k] = { fecha: f[0], origen: o, sol: 0, apr: 0, conv: 0, monto: 0 };
      var b = ag[k];
      b.sol += Number(f[2] || 0);
      b.apr += Number(f[3] || 0);
      b.conv += Number(f[4] || 0);
      b.monto += Number(f[5] || 0);
    });
    var filas = [['fecha', 'origen', 'solicitudes', 'aprobados', 'convertidos', 'monto']];
    Object.keys(ag).sort().forEach(function (k) {
      var b = ag[k];
      filas.push([b.fecha, b.origen, b.sol, b.apr, b.conv, Math.round(b.monto)]);
    });
    escribirHoja_('EMBUDO_CONV', filas);
    log_('BigQuery EmbudoConv', 'OK', filas.length - 1, 'aprobados por dia x origen');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery EmbudoConv', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

/* ACT_SEDE_MES: solicitudes / aprobados / desembolsos por sede y por mes.
   Misma fuente y mismo mapeo de estados que EMBUDO_CONV, para que el panel de
   activacion cuadre con el embudo que esta arriba de el. Con t_sol_v2 daria un
   numero parecido pero no identico, y se veria en la misma pantalla. */
var SQL_ACT_SEDE_MES =
  'WITH base AS (' + NL +
  '  SELECT medico_id,' + NL +
  "    FORMAT_DATE('%Y-%m', DATE(created_on)) AS mes," + NL +
  '    CASE' + NL +
  "      WHEN estado IN ('on_hold_rejected','rejected_validation','risk_in_process'," + NL +
  "        'rejected','fraud','creada','on_hold_approved','on_hold_docs') THEN 'Rechazado'" + NL +
  "      WHEN estado IN ('firma_contrato','approved','not_taken') THEN 'Aprobado'" + NL +
  "      WHEN estado IN ('pendiente_aprobacion_medico','desembolsado'," + NL +
  "        'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'," + NL +
  "        'dismissed') THEN 'Convertido'" + NL +
  "      ELSE 'Otro' END AS estado_final," + NL +
  '    COALESCE(monto_aprobado, monto) AS monto' + NL +
  '  FROM `welli-tecnologia.public.profile_institucion`' + NL +
  '  WHERE medico_id IS NOT NULL' + NL +
  ')' + NL +
  'SELECT medico_id, mes, COUNT(*) AS solicitudes,' + NL +
  "       SUM(IF(estado_final IN ('Aprobado','Convertido'), 1, 0)) AS aprobados," + NL +
  "       SUM(IF(estado_final = 'Convertido', 1, 0)) AS desembolsos," + NL +
  "       SUM(IF(estado_final = 'Convertido', monto, 0)) AS monto" + NL +
  'FROM base GROUP BY 1, 2 ORDER BY 2, 1';

function refreshActSedeMes() {
  try {
    var r = bq_(SQL_ACT_SEDE_MES, BQ_PROJECT_CREDITO);
    var filas = [['id_sede', 'mes', 'solicitudes', 'aprobados', 'desembolsos', 'monto']];
    r.filas.forEach(function (f) {
      filas.push([f[0], f[1], Number(f[2] || 0), Number(f[3] || 0), Number(f[4] || 0),
                  Math.round(Number(f[5] || 0))]);
    });
    escribirHoja_('ACT_SEDE_MES', filas);
    log_('BigQuery ActSedeMes', 'OK', filas.length - 1, 'actividad por sede x mes');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery ActSedeMes', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

/* COSECHA_DIA: cosecha x fecha x canal, solo creditos radicados DENTRO del mes
   de la cosecha. Es lo que permite que la seccion 5 hable de la cosecha y no
   del universo entero: de aca sale el monto diario de las sedes que entraron
   ese mes y el share de esa plata por canal.
   Reusa SQL_EMBUDO_CONV (misma consulta, otra agregacion) para no pagar dos
   veces el mismo escaneo. */
function refreshCosechaDia() {
  try {
    var sedes = leerHoja_('SEDES');
    var CAN = { 'EVENTO': 'Eventos', 'REFERIDO': 'Referidos',
                'PAGINA WEB': 'Pagina web', 'SOCIAL MEDIA': 'Social media' };
    var info = {};
    sedes.forEach(function (s) {
      var k = String(s.id_internal || '').trim();
      var c = String(s.cosecha || '').substring(0, 7);
      var canal = CAN[normOrigen_(s.origen)];
      if (k && canal && /^\d{4}-\d{2}$/.test(c)) info[k] = { cos: c, canal: canal };
    });

    var r = bq_(SQL_EMBUDO_CONV, BQ_PROJECT_CREDITO);
    var ag = {};
    r.filas.forEach(function (f) {
      var i = info[String(f[1])];
      if (!i) return;
      var fecha = String(f[0]);
      if (fecha.substring(0, 7) !== i.cos) return;   // solo el mes de la cosecha
      var k = i.cos + '|' + fecha + '|' + i.canal;
      if (!ag[k]) {
        ag[k] = { cos: i.cos, fecha: fecha, canal: i.canal,
                  sol: 0, apr: 0, des: 0, monto: 0 };
      }
      var b = ag[k];
      b.sol += Number(f[2] || 0);
      b.apr += Number(f[3] || 0);
      b.des += Number(f[4] || 0);
      b.monto += Number(f[5] || 0);
    });
    var filas = [['cosecha', 'fecha', 'canal', 'solicitudes', 'aprobados',
                  'desembolsos', 'monto']];
    Object.keys(ag).sort().forEach(function (k) {
      var b = ag[k];
      filas.push([b.cos, b.fecha, b.canal, b.sol, b.apr, b.des, Math.round(b.monto)]);
    });
    escribirHoja_('COSECHA_DIA', filas);
    log_('BigQuery CosechaDia', 'OK', filas.length - 1, 'cosecha x dia x canal');
    return filas.length - 1;
  } catch (e) {
    log_('BigQuery CosechaDia', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}
