/**
 * Fuentes_MetaAds.gs — Pauta (Frente 1)
 * -------------------------------------
 * Escribe la hoja META_ADS con una fila por día × anuncio.
 *
 * Lecciones del ad account real (act_1373974740859060, COP):
 *  - Los leads son actions con action_type == 'lead'. NO sumar
 *    'lead_grouped' ni 'offsite_conversion.*_add_meta_leads': son el
 *    MISMO lead contado otra vez y duplican la cifra.
 *  - CPL no existe como campo nativo: se deriva gasto / leads.
 *  - ctr viene en porcentaje (2.07 significa 2,07%), no en fracción.
 *  - time_increment: 1 devuelve una fila por día; sin él, agrega todo
 *    el rango en una sola fila.
 */

function metaFetch_(path, params) {
  var token = prop_('META_ACCESS_TOKEN');
  if (!token) throw new Error('Falta META_ACCESS_TOKEN en Script Properties');
  params = params || {};
  params.access_token = token;
  var qs = Object.keys(params).map(function (k) {
    var v = params[k];
    if (typeof v === 'object') v = JSON.stringify(v);
    return encodeURIComponent(k) + '=' + encodeURIComponent(v);
  }).join('&');

  var url = 'https://graph.facebook.com/' + META_API_VERSION + path + '?' + qs;
  for (var i = 0; i < 4; i++) {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = res.getResponseCode();
    var txt = res.getContentText();
    if (code === 200) return JSON.parse(txt);
    // 17 y 80004 son límites de uso: reintentar con espera
    if (code === 429 || txt.indexOf('"code":17') >= 0 || txt.indexOf('80004') >= 0) {
      Utilities.sleep(5000 * (i + 1));
      continue;
    }
    throw new Error('Meta ' + code + ': ' + txt.substring(0, 300));
  }
  throw new Error('Meta: se agotaron los reintentos');
}

/** Suma solo los leads reales, sin las variantes que duplican. */
function metaLeads_(actions) {
  if (!actions || !actions.length) return 0;
  var total = 0;
  actions.forEach(function (a) {
    if (a.action_type === 'lead') total += Number(a.value || 0);
  });
  return total;
}

/**
 * @param {string} desde 'yyyy-MM-dd'  (por defecto: 1 de enero del año en curso)
 * @param {string} hasta 'yyyy-MM-dd'  (por defecto: hoy)
 */
function refreshMetaAds(desde, hasta) {
  try {
    if (!tieneCredencial_('META')) {
      log_('Meta Ads', 'ERROR', 0, 'Falta META_ACCESS_TOKEN en Script Properties');
      return 0;
    }
    hasta = hasta || hoyISO_();
    desde = desde || (hasta.substring(0, 4) + '-01-01');

    var filas = [['fecha', 'campana', 'adset', 'anuncio', 'leads', 'gasto', 'impresiones',
      'clics', 'ctr_pct', 'cpl']];

    var params = {
      level: 'ad',
      fields: 'campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,actions',
      time_range: { since: desde, until: hasta },
      time_increment: 1,
      limit: 500
    };
    var path = '/' + META_AD_ACCOUNT + '/insights';
    var d = metaFetch_(path, params);
    var vueltas = 0;

    while (d && vueltas < 200) {
      (d.data || []).forEach(function (r) {
        var leads = metaLeads_(r.actions);
        var gasto = Number(r.spend || 0);
        filas.push([
          String(r.date_start || '').substring(0, 10),
          r.campaign_name || '', r.adset_name || '', r.ad_name || '',
          leads, gasto, Number(r.impressions || 0), Number(r.clicks || 0),
          Number(r.ctr || 0),                       // ya viene en %
          leads ? Math.round(gasto / leads) : 0     // CPL derivado
        ]);
      });
      var next = d.paging && d.paging.next ? d.paging.next : null;
      if (!next) break;
      var res = UrlFetchApp.fetch(next, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) break;
      d = JSON.parse(res.getContentText());
      vueltas++;
    }

    escribirHoja_('META_ADS', filas);
    log_('Meta Ads', 'OK', filas.length - 1, desde + ' a ' + hasta);
    return filas.length - 1;
  } catch (e) {
    // No se borra la hoja: si falla, se conserva el último dato bueno
    // y el dashboard muestra el badge con este detalle.
    log_('Meta Ads', 'ERROR', 0, String(e).substring(0, 250));
    return 0;
  }
}

/** Diagnóstico rápido: confirma que el token ve la cuenta. */
function probarMetaAds() {
  try {
    var d = metaFetch_('/me/adaccounts', { fields: 'name,account_id,currency', limit: 25 });
    Logger.log(JSON.stringify(d.data, null, 2));
  } catch (e) {
    Logger.log('FALLO: ' + e);
    Logger.log('Si dice "API access blocked", el token o la app de Meta están ' +
      'bloqueados: hay que generar un System User Token nuevo en Business Manager.');
  }
}
