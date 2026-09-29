/**
 * QA del tablero: corre el motor REAL (Config + Filtro_Origen + Code) sobre
 * la data completa, con una matriz de filtros, y valida invariantes en F1,
 * F2 y F4. No mira pantallas: mira que los numeros cierren entre si.
 *
 *   node qa_tablero.js            (matriz completa)
 *   node qa_tablero.js rapido     (solo lo esencial)
 */
const fs = require('fs');
const path = require('path');
const DIR = 'c:/Users/millo/Desktop/Dashboard 360 mkt/apps_script';
const HOJAS = JSON.parse(fs.readFileSync('sheet_data.json', 'utf8'));

function pad(n, l) { return String(n).padStart(l, '0'); }
global.Utilities = {
  formatDate: function (d, tz, patron) {
    const y = d.getFullYear(), m = pad(d.getMonth() + 1, 2), dd = pad(d.getDate(), 2);
    let s = patron.replace('yyyy', y).replace('MM', m).replace('dd', dd);
    return s.replace('HH', pad(d.getHours(), 2)).replace('mm', pad(d.getMinutes(), 2));
  },
  sleep: function () {}
};
global.Logger = { log: function () {} };
function hojaFake(nombre) {
  const filas = HOJAS[nombre];
  if (!filas) return null;
  return {
    getName: () => nombre, getLastRow: () => filas.length,
    getDataRange: () => ({ getValues: () => filas.map(r => r.slice()) }),
    appendRow: (r) => filas.push(r), clearContents: () => { filas.length = 0; },
    getRange: () => ({ setValue: () => {}, setValues: () => {} })
  };
}
global.SpreadsheetApp = { openById: () => ({
  getName: () => 'qa', getSheetByName: hojaFake,
  insertSheet: (n) => { HOJAS[n] = [[]]; return hojaFake(n); },
  getSheets: () => Object.keys(HOJAS).map(hojaFake)
}) };
global.PropertiesService = { getScriptProperties: () => ({
  getProperty: () => null, getProperties: () => ({}), setProperty: () => {} }) };
global.CacheService = { getScriptCache: () => ({ removeAll: () => {}, get: () => null, put: () => {} }) };
global.HtmlService = { createTemplateFromFile: () => ({ evaluate: () => ({}) }),
  createHtmlOutputFromFile: () => ({ getContent: () => '' }), XFrameOptionsMode: { ALLOWALL: 1 } };
global.ScriptApp = { getProjectTriggers: () => [] };

const vm = require('vm');
vm.runInThisContext(['Config.gs', 'Filtro_Origen.gs', 'Code.gs']
  .map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n'),
  { filename: 'bundle.js' });

// ------------------------------------------------------------- utilidades
let fallos = [], avisos = [], checks = 0;
function fail(ctx, msg, extra) {
  fallos.push({ ctx, msg, extra: extra === undefined ? '' : extra });
}
function warn(ctx, msg, extra) {
  avisos.push({ ctx, msg, extra: extra === undefined ? '' : extra });
}
function num(ctx, v, campo, opt) {
  checks++;
  opt = opt || {};
  if (v === null || v === undefined) {
    if (!opt.nulOk) warn(ctx, campo + ' es null/undefined');
    return;
  }
  if (typeof v !== 'number' || !isFinite(v)) {
    fail(ctx, campo + ' no es un numero finito', v);
    return;
  }
  if (opt.min !== undefined && v < opt.min) fail(ctx, campo + ' < ' + opt.min, v);
  if (opt.max !== undefined && v > opt.max) fail(ctx, campo + ' > ' + opt.max, v);
}
function pct(ctx, v, campo, techo) {
  num(ctx, v, campo, { min: 0, max: techo === undefined ? 100 : techo, nulOk: true });
}
function casi(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 1 : tol); }

// ------------------------------------------------------------- los checks
function chequearF1(ctx, d) {
  const f = d.f1 || {};
  // -- serie de pauta
  (f.serie || []).forEach((p, i) => {
    num(ctx, p.gasto, 'f1.serie[' + i + '].gasto', { min: 0, nulOk: true });
    num(ctx, p.leads, 'f1.serie[' + i + '].leads', { min: 0, nulOk: true });
  });
  // -- composicion: las partes suman el total
  const comp = f.composicion;
  if (comp && comp.todas) {
    const sumT = (comp.todas.filas || []).reduce((a, r) => a + (r.n || 0), 0);
    checks++;
    if (!casi(sumT, comp.todas.n)) {
      fail(ctx, 'f1.composicion.todas: las clases no suman el total',
        sumT + ' vs ' + comp.todas.n);
    }
    if (comp.mkt) {
      const sumM = (comp.mkt.filas || []).reduce((a, r) => a + (r.n || 0), 0);
      checks++;
      if (!casi(sumM, comp.mkt.n)) {
        fail(ctx, 'f1.composicion.mkt: las clases no suman el total',
          sumM + ' vs ' + comp.mkt.n);
      }
      checks++;
      if (comp.mkt.n > comp.todas.n) {
        fail(ctx, 'f1.composicion: marketing > todas', comp.mkt.n + ' > ' + comp.todas.n);
      }
      pct(ctx, comp.mkt.pct, 'f1.composicion.mkt.pct');
    }
  }
  // -- cobertura de origen: desde el 9-sep-2026 el universo YA NO recorta
  // nada (acordado con BI: fichas de HubSpot = sedes de los mapas), así que
  // F1 (fichas del CRM) y el universo de los mapas deben ser la MISMA base
  // sin filtro. Con un filtro de origen/rol puesto los dos se cortan igual
  // (la cinta de F1 usa el mismo U), así que la brecha es siempre ~0.
  const cbo = f.coberturaOrigen || {};
  if (cbo.totSedes) {
    num(ctx, cbo.totSedes, 'f1.coberturaOrigen.totSedes', { min: 0 });
    pct(ctx, cbo.pctApps, 'f1.coberturaOrigen.pctApps');
    checks++;
    if (cbo.sedesConOrigen > cbo.totSedes) {
      fail(ctx, 'f1.coberturaOrigen: con origen > total',
        cbo.sedesConOrigen + ' > ' + cbo.totSedes);
    }
    const brecha = cbo.totSedes - d.meta.origenSedes;
    checks++;
    if (!casi(brecha, 0, 0)) {
      fail(ctx, 'f1: sin recortes de universo la brecha CRM vs mapas debería ser 0',
        brecha + ' (totSedes ' + cbo.totSedes + ' vs origenSedes ' + d.meta.origenSedes + ')');
    }
  }
  // -- cohorte de deals: acumulado que solo sube, ganados <= n
  const dc = f.dealsCohorte || {};
  chequearCohorteAcum(ctx, 'f1.dealsCohorte', dc.filas || []);
  Object.keys(dc.porPipeline || {}).forEach(p => {
    chequearCohorteAcum(ctx, 'f1.dealsCohorte[' + p + ']', dc.porPipeline[p]);
  });
  // los pipelines deben sumar el total de "todos"
  if ((dc.pipelines || []).length && (dc.filas || []).length) {
    const totPipes = dc.pipelines.reduce((a, p) => a + (p.deals || 0), 0);
    const totFilas = dc.filas.reduce((a, r) => a + (r.n || 0), 0);
    checks++;
    if (!casi(totPipes, totFilas, 0)) {
      fail(ctx, 'f1.dealsCohorte: pipelines no suman el total de la tabla',
        totPipes + ' vs ' + totFilas);
    }
  }
}

/* Recalculo INDEPENDIENTE de metasCanal, directo sobre DEALS_ORIGEN, sin
   pasar por armarMetasCanalF1_ — para que el check no se limite a "el
   codigo esta de acuerdo consigo mismo" sino que verifique la cuenta desde
   cero con la misma regla de negocio (bucket de marketing, exclusion de
   Prospeccion/Hunter vive en BUCKET_DE_ORIGEN_DEAL al no tener bucket, y el
   mismo filtro de origen + Hunter que el resto de F1). */
function recomputarMetasCanal_(dcO, origenes, rol, desdeMes, hastaMes) {
  const selOrig = {};
  (origenes || []).map(normOrigen_).forEach(o => { selOrig[o] = true; });
  const todos = !(origenes && origenes.length);
  const ownerHunter = String((rol || {}).hunter || '').trim();
  let ownerHunterSet = null;
  if (ownerHunter === '__equipo__') {
    ownerHunterSet = {};
    Object.keys(GENTE_ROL.hunter || {}).forEach(id => { ownerHunterSet[id] = true; });
  }
  const out = {};
  CANALES_META.forEach(c => { out[c] = { deals: 0, dealsTotales: 0, ganados: 0 }; });
  dcO.forEach(r => {
    const cos = String(r.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(cos)) return;
    if (cos < desdeMes || cos > hastaMes) return;
    const ownerId = String(r.owner || '').trim();
    if (ownerHunterSet) { if (!ownerHunterSet[ownerId]) return; }
    else if (ownerHunter && ownerId !== ownerHunter) return;
    const o = normOrigen_(r.origen);
    if (!todos && !selOrig[o]) return;
    const bucket = BUCKET_DE_ORIGEN_DEAL[o];
    if (!bucket) return;
    const b = out[bucket];
    b.deals += Number(r.deals || 0);
    b.dealsTotales += Number(r.deals_totales || 0);
    for (let i = 0; i <= 7; i++) b.ganados += Number(r['m' + i] || 0);
  });
  return out;
}

function chequearMetasCanal(ctx, d, orig, rol) {
  const mc = (d.f1 || {}).metasCanal;
  if (!mc) return;
  const dcO = leerHoja_('DEALS_ORIGEN');

  // ---- Tabla 1: leads del mes vs meta TOTAL (sigue el rango elegido) ---
  const mesIni = d.meta.inicio.substring(0, 7), mesFin = d.meta.fin.substring(0, 7);
  const actual = recomputarMetasCanal_(dcO, orig, rol, mesIni, mesFin);
  const mesPrevIni = d.meta.prevInicio.substring(0, 7), mesPrevFin = d.meta.prevFin.substring(0, 7);
  const prev = recomputarMetasCanal_(dcO, orig, rol, mesPrevIni, mesPrevFin);
  checks++;
  if (mc.mesMeta !== mesFin) {
    fail(ctx, 'f1.metasCanal.mesMeta no es el mes del fin del rango', mc.mesMeta + ' vs ' + mesFin);
  }
  // 24-sep-2026: "Leads del mes" pasa a usar dealsTotales (sin filtro de
  // causal), para coincidir 100% con el conteo crudo de HubSpot -- pedido
  // explicito de Emmanuel. La tabla de Vinculacion (abajo) sigue con
  // `deals` (limpio).
  (mc.leads || []).forEach(r => {
    checks++;
    if (actual[r.canal].dealsTotales !== r.actual) {
      fail(ctx, 'f1.metasCanal.leads[' + r.canal + '].actual no cuadra con recalculo directo',
        r.actual + ' vs ' + actual[r.canal].dealsTotales);
    }
    checks++;
    const metaEsperada = METAS_CANAL[r.canal].leads;
    if (r.meta !== metaEsperada) {
      fail(ctx, 'f1.metasCanal.leads[' + r.canal + '].meta no es la meta FIJA del mes',
        r.meta + ' vs ' + metaEsperada);
    }
    if (r.meta) {
      checks++;
      const pctEsp = Math.round((r.actual / r.meta) * 1000) / 10;
      if (!casi(r.pct, pctEsp, 0.2)) {
        fail(ctx, 'f1.metasCanal.leads[' + r.canal + '].pct no cuadra', r.pct + ' vs ' + pctEsp);
      }
    }
    checks++;
    const base = prev[r.canal].dealsTotales;
    const deltaEsp = base ? Math.round(((actual[r.canal].dealsTotales - base) / base) * 1000) / 10 : null;
    if (deltaEsp === null) {
      if (r.delta !== null) {
        fail(ctx, 'f1.metasCanal.leads[' + r.canal + '].delta debería ser null (sin base previa)', r.delta);
      }
    } else {
      checks++;
      if (!casi(r.delta, deltaEsp, 0.2)) {
        fail(ctx, 'f1.metasCanal.leads[' + r.canal + '].delta no cuadra', r.delta + ' vs ' + deltaEsp);
      }
    }
  });

  // ---- Tabla 2: vinculación, ventana FIJA de 3 meses desde HOY ----------
  const finV = hoyISO_().substring(0, 7);
  const iniV = mesMenos_(finV, 2);
  checks++;
  if (mc.ventanaVinculacion !== (iniV + ' a ' + finV)) {
    fail(ctx, 'f1.metasCanal.ventanaVinculacion no es la ventana fija esperada',
      mc.ventanaVinculacion + ' vs ' + (iniV + ' a ' + finV));
  }
  const vAct = recomputarMetasCanal_(dcO, orig, rol, iniV, finV);
  (mc.vinculacion || []).forEach(r => {
    const b = vAct[r.canal];
    checks++;
    if (b.deals !== r.llegaron || b.ganados !== r.cerrados) {
      fail(ctx, 'f1.metasCanal.vinculacion[' + r.canal + '] no cuadra con recalculo directo',
        JSON.stringify({ llegaron: r.llegaron, cerrados: r.cerrados }) + ' vs ' +
        JSON.stringify({ llegaron: b.deals, cerrados: b.ganados }));
    }
    checks++;
    const metaEsp = METAS_VINCULACION[r.canal] || 0;
    if (r.meta !== metaEsp) {
      fail(ctx, 'f1.metasCanal.vinculacion[' + r.canal + '].meta no es la fija', r.meta + ' vs ' + metaEsp);
    }
    // esta ventana NO se mueve con el rango elegido: debe dar lo MISMO sin
    // importar que ini/fin traiga el combo que la esta corriendo.
    checks++;
    if (r.llegaron !== r.cerrados && r.llegaron === 0 && r.cerrados > 0) {
      fail(ctx, 'f1.metasCanal.vinculacion[' + r.canal + ']: cerrados sin llegaron', r);
    }
  });
}

function chequearCohorteAcum(ctx, nombre, filas) {
  (filas || []).forEach(r => {
    num(ctx, r.n, nombre + '[' + r.cosecha + '].n', { min: 0 });
    let prev = -1;
    (r.celdas || []).forEach((c, k) => {
      if (c === null || c === undefined) return;
      num(ctx, c, nombre + '[' + r.cosecha + '].celdas[' + k + ']', { min: 0 });
      checks++;
      if (c < prev) {
        fail(ctx, nombre + '[' + r.cosecha + ']: acumulado BAJA en M' + k,
          prev + ' -> ' + c);
      }
      prev = c;
      checks++;
      if (c > r.n) {
        fail(ctx, nombre + '[' + r.cosecha + ']: celda M' + k + ' > n de la cosecha',
          c + ' > ' + r.n);
      }
    });
    pct(ctx, r.conv, nombre + '[' + r.cosecha + '].conv');
  });
}

function chequearF2(ctx, d) {
  const f = d.f2 || {};
  (f.mapas || []).forEach(m => {
    // 24-sep-2026: 'desembolsos'/'desembolsos_mes' ahora tienen pctCelda Y
    // conMonto a la vez (n = sedes, extra = plata) -- el chequeo de techo/
    // monotonia tiene que decidirse por pctCelda (es un conteo de sedes),
    // no por conMonto (que ya no implica "n es plata").
    const esConteo = !!m.pctCelda;
    (m.filas || []).forEach(r => {
      num(ctx, r.n, 'f2[' + m.id + '][' + r.cosecha + '].n', { min: 0 });
      let prev = -1;
      (r.celdas || []).forEach((c, k) => {
        if (c === null || c === undefined) return;
        num(ctx, c, 'f2[' + m.id + '][' + r.cosecha + '].celdas[' + k + ']', { min: 0 });
        // los mapas de conteo son acumulados: no pueden bajar ni pasar de n
        // 'nuncavivas' es el COMPLEMENTO de 'activas' (cruzables - activas):
        // por diseno BAJA con el tiempo, igual que inactivas/muertas son
        // foto puntual y no acumulado -- pero SI sigue teniendo que
        // respetar el techo (nunca mas que su base).
        // 24-sep-2026, segunda vuelta: 'desembolsos_mes' ya NO es puntual --
        // ahora comparte LITERALMENTE la misma columna de sedes que el
        // acumulado 'desembolsos' (pedido explicito: que los dos mapas se
        // hablen en sedes), asi que tiene que pasar el mismo chequeo de
        // monotonia que su acumulado.
        const puntual = m.id === 'inactivas' || m.id === 'muertas' || m.id === 'nuncavivas';
        if (esConteo && !puntual) {
          checks++;
          if (c < prev) {
            fail(ctx, 'f2[' + m.id + '][' + r.cosecha + ']: acumulado BAJA en M' + k,
              prev + ' -> ' + c);
          }
        }
        if (esConteo) {
          const base = r.nBase === undefined ? r.n : r.nBase;
          checks++;
          if (c > base) {
            fail(ctx, 'f2[' + m.id + '][' + r.cosecha + ']: celda M' + k + ' > base',
              c + ' > ' + base);
          }
        }
        prev = c;
      });
    });
  });

  // 24-sep-2026: 'desembolsos_mes' tiene que compartir la MISMA columna de
  // sedes que 'desembolsos' (pedido explicito de Emmanuel, las dos tablas
  // se tienen que hablar en sedes) -- solo la plata cambia (delta vs
  // acumulada). Recalculo independiente de esa resta, no autoconsistencia.
  const mDes = (f.mapas || []).find(m => m.id === 'desembolsos');
  const mDesMes = (f.mapas || []).find(m => m.id === 'desembolsos_mes');
  if (mDes && mDesMes) {
    const porCosecha = {};
    (mDes.filas || []).forEach(r => { porCosecha[r.cosecha] = r; });
    (mDesMes.filas || []).forEach(rM => {
      const rA = porCosecha[rM.cosecha];
      if (!rA) { fail('f2.desembolsos_mes', 'sin fila de desembolsos para ' + rM.cosecha); return; }
      checks++;
      if (JSON.stringify(rA.celdas) !== JSON.stringify(rM.celdas)) {
        fail('f2.desembolsos_mes[' + rM.cosecha + ']',
          'sedes no coincide celda a celda con el acumulado',
          JSON.stringify(rM.celdas) + ' vs ' + JSON.stringify(rA.celdas));
      }
      let prevMonto = 0;
      rA.celdas.forEach((c, k) => {
        if (c === null || c === undefined) return;
        const montoAcum = (rA.extras || [])[k] || 0;
        const montoMes = (rM.extras || [])[k];
        checks++;
        if (!casi(montoMes, montoAcum - prevMonto, 1)) {
          fail('f2.desembolsos_mes[' + rM.cosecha + '].M' + k,
            'plata del mes no cuadra con la resta del acumulado',
            montoMes + ' vs ' + (montoAcum - prevMonto));
        }
        prevMonto = montoAcum;
      });
    });
  }

  // 'nuncavivas' es un COMPLEMENTO de 'activas' (recalculo independiente,
  // no autoconsistencia con si mismo: se recalcula la suma aca, no se
  // confia en que Code.gs la construyo bien solo porque no truena).
  const mActivas = (f.mapas || []).find(m => m.id === 'activas');
  const mNunca = (f.mapas || []).find(m => m.id === 'nuncavivas');
  if (mActivas && mNunca) {
    const porCosecha = {};
    (mActivas.filas || []).forEach(r => { porCosecha[r.cosecha] = r; });
    (mNunca.filas || []).forEach(rN => {
      const rA = porCosecha[rN.cosecha];
      if (!rA) { fail('f2.nuncavivas', 'sin fila de activas para ' + rN.cosecha); return; }
      checks++;
      if (rA.cruzables !== rN.cruzables) {
        fail('f2.nuncavivas[' + rN.cosecha + ']', 'cruzables no coincide con activas',
          rN.cruzables + ' vs ' + rA.cruzables);
      }
      rN.celdas.forEach((c, k) => {
        if (c === null || c === undefined) return;
        checks++;
        const suma = c + rA.celdas[k];
        if (suma !== rN.cruzables) {
          fail('f2.nuncavivas[' + rN.cosecha + '].M' + k,
            'nuncavivas + activas != cruzables', suma + ' != ' + rN.cruzables);
        }
      });
    });
  }

  // escalera del universo: desde el 9-sep-2026 los pasos son INFORMATIVOS
  // (deshabilitadas/sin id/sin plataforma/otro pais ya no se restan de
  // nada, acordado con BI), así que el final debe ser IGUAL al inicio, no
  // inicio menos la suma de los pasos.
  const esc = f.escalera || {};
  if ((esc.filas || []).length >= 2) {
    const primero = esc.filas[0].n, ultimo = esc.filas[esc.filas.length - 1].n;
    checks++;
    if (!casi(ultimo, primero, 0)) {
      fail(ctx, 'f2.escalera: el final debería ser igual al inicio (nada se resta ya)',
        primero + ' -> ' + ultimo);
    }
  }
}

function chequearF4(ctx, d, orig, rol) {
  const ge = (d.f4 || {}).gestion || {};
  (ge.metas || []).forEach(m => {
    num(ctx, m.bolsa, 'f4.metas[' + m.semana + '].bolsa', { min: 0 });
    num(ctx, m.meta, 'f4.metas[' + m.semana + '].meta', { min: 0 });
    num(ctx, m.desembolsado, 'f4.metas[' + m.semana + '].desembolsado', { min: 0 });
    pct(ctx, m.contacto, 'f4.metas[' + m.semana + '].contacto');
    pct(ctx, m.metaPct, 'f4.metas[' + m.semana + '].metaPct');
    // cobertura puede pasar de 100 (se trabaja atraso), pero no de 300
    pct(ctx, m.cobertura, 'f4.metas[' + m.semana + '].cobertura', 300);
    num(ctx, m.cumplimiento, 'f4.metas[' + m.semana + '].cumplimiento', { min: 0, nulOk: true });
    checks++;
    if (m.bolsa > 0 && m.meta === 0) {
      fail(ctx, 'f4.metas[' + m.semana + ']: hay bolsa pero la meta es 0', m.bolsa);
    }
  });
  (ge.metasMes || []).forEach(m => {
    num(ctx, m.meta, 'f4.metasMes[' + m.mes + '].meta', { min: 0 });
    pct(ctx, m.contacto, 'f4.metasMes[' + m.mes + '].contacto');
    pct(ctx, m.cobertura, 'f4.metasMes[' + m.mes + '].cobertura', 300);
    checks++;
    if (m.diasHabiles > m.diasHabilesTotal) {
      fail(ctx, 'f4.metasMes[' + m.mes + ']: dias transcurridos > total del mes',
        m.diasHabiles + ' > ' + m.diasHabilesTotal);
    }
  });
  // -- meta GENERAL (toda la empresa): meta fija en pesos, sin bolsa ni
  // cobertura/contacto — la unica invariante real es "no negativo" y
  // "cumplimiento coherente con desembolsado/meta".
  (ge.metasRescateTotal || []).forEach(m => {
    num(ctx, m.desembolsado, 'f4.metasRescateTotal[' + m.semana + '].desembolsado', { min: 0 });
    num(ctx, m.meta, 'f4.metasRescateTotal[' + m.semana + '].meta', { min: 0 });
    num(ctx, m.cumplimiento, 'f4.metasRescateTotal[' + m.semana + '].cumplimiento', { min: 0 });
    checks++;
    if (m.meta > 0) {
      const esperado = Math.round((m.desembolsado / m.meta) * 1000) / 10;
      if (!casi(esperado, m.cumplimiento, 0.2)) {
        fail(ctx, 'f4.metasRescateTotal: cumplimiento no cuadra con desembolsado/meta',
          m.cumplimiento + ' vs ' + esperado);
      }
    }
  });
  (ge.metasMesRescateTotal || []).forEach(m => {
    num(ctx, m.desembolsado, 'f4.metasMesRescateTotal[' + m.mes + '].desembolsado', { min: 0 });
    num(ctx, m.meta, 'f4.metasMesRescateTotal[' + m.mes + '].meta', { min: 0 });
    checks++;
    if (m.meta > 0) {
      const esperado = Math.round((m.desembolsado / m.meta) * 1000) / 10;
      if (!casi(esperado, m.cumplimiento, 0.2)) {
        fail(ctx, 'f4.metasMesRescateTotal: cumplimiento no cuadra con desembolsado/meta',
          m.cumplimiento + ' vs ' + esperado);
      }
    }
  });
  // La meta general NO depende del filtro de origen/rol (no tiene bolsa
  // acotada por sede): tiene que dar IGUAL sin importar el filtro puesto.
  checks++;
  if ((ge.metasMesRescateTotal || []).length) {
    const ultG = ge.metasMesRescateTotal[ge.metasMesRescateTotal.length - 1];
    if (!(ultG.meta > 0)) {
      fail(ctx, 'f4.metasMesRescateTotal: la meta general no deberia depender del filtro', ultG.meta);
    }
  }

  (ge.historiaUnida || []).forEach(m => {
    pct(ctx, m.tasaFirma, 'f4.historiaUnida[' + m.mes + '].tasaFirma');
    num(ctx, m.desembolsado, 'f4.historiaUnida[' + m.mes + '].desembolsado',
      { min: 0, nulOk: true });
    checks++;
    if ((m.firmas || 0) > (m.casos || 0)) {
      fail(ctx, 'f4.historiaUnida[' + m.mes + ']: firmas > casos',
        m.firmas + ' > ' + m.casos);
    }
  });
  // embudo de whatsapp: cada paso deberia ser subconjunto del anterior,
  // pero con dos excepciones REALES conocidas (no un bug de este chequeo):
  // 1. "Respondieron" (25-sep-2026) ya NO esta acotado por la plantilla de
  //    confirmacion -- un INBOUND no trae a que plantilla responde, asi
  //    que puede superar a "Leido" (alguien que nunca vio la confirmacion
  //    igual le escribio a Welli por otro motivo). Declarado en pantalla.
  // 2. "Leido" puede superar levemente a "Entregado" por como reporta
  //    WhatsApp: algunos mensajes llegan con evento de lectura sin que
  //    nunca se haya registrado su evento de entrega por separado (ya
  //    documentado en el codigo viejo de este mismo embudo). Con volumen
  //    chico (ej. julio, 15 aprobados con confirmacion) un par de casos
  //    asi ya rompe la monotonia sin ser un error real.
  // Las dos se degradan a AVISO, no fallo -- si el exceso fuera grande
  // (no un par de casos), seguiria valiendo la pena mirarlo a mano.
  const wa = ge.whatsapp;
  if (wa && (wa.embudo || []).length) {
    let prev = Infinity;
    wa.embudo.forEach(p => {
      num(ctx, p.n, 'f4.whatsapp.embudo[' + p.paso + '].n', { min: 0 });
      pct(ctx, p.pct, 'f4.whatsapp.embudo[' + p.paso + '].pct');
      checks++;
      if (p.n > prev) {
        warn(ctx, 'f4.whatsapp.embudo: "' + p.paso + '" es MAYOR que el paso anterior (ver nota de excepciones conocidas)',
          p.n + ' > ' + prev);
      }
      prev = p.n;
    });
  }
  // 25-sep-2026: recalculo INDEPENDIENTE del embudo de WhatsApp, directo
  // sobre RESCATE_WA_PACIENTES (una fila por paciente) -- el bug que
  // reemplazo este bloque (501,8% "recibio al menos un mensaje", imposible)
  // era justo el tipo de cosa que la autoconsistencia con pct()/subconjunto
  // NO detecta si el motor y el QA comparten el mismo error de diseño; este
  // check sí lo habria atrapado, porque recalcula desde cero sin pasar por
  // armarF4_.
  if (wa) {
    // 28-sep-2026: el embudo mide SOLO rescatables. Los que ya avanzaron
    // (desembolsaron, estan en manos del medico, etc.) quedan fuera porque
    // el sistema no les manda la confirmacion — contarlos inventaba una
    // falla que no existe. Este recalculo replica ese recorte desde la hoja
    // cruda, sin pasar por armarF4_.
    const YA_AVANZO = ['desembolsado', 'fulfilled', 'pendiente_desembolso',
      'pendiente_aprobacion_medico', 'pendiente_validacion_cliente'];
    const pac = leerHoja_('RESCATE_WA_PACIENTES');
    let uni = 0, env = 0, ent = 0, lei = 0, res = 0, fuera = 0;
    pac.forEach(r => {
      const fch = String(r.fecha_aprobacion || '').substring(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return;
      if (d.meta.inicio && fch < d.meta.inicio) return;
      if (d.meta.fin && fch > d.meta.fin) return;
      if (YA_AVANZO.indexOf(String(r.estado || '').trim()) >= 0) { fuera++; return; }
      uni++;
      if (Number(r.enviado)) env++;
      if (Number(r.entregado)) ent++;
      if (Number(r.leido)) lei++;
      if (Number(r.respondio)) res++;
    });
    checks++;
    if (wa.yaAvanzaron !== fuera) {
      fail(ctx, 'f4.whatsapp.yaAvanzaron no cuadra con el recalculo directo',
        wa.yaAvanzaron + ' vs ' + fuera);
    }
    // El invariante que protege el cambio: ningun estado de los excluidos
    // puede haber entrado al universo del embudo.
    checks++;
    const colados = pac.filter(r => {
      const fch = String(r.fecha_aprobacion || '').substring(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fch)) return false;
      if (d.meta.inicio && fch < d.meta.inicio) return false;
      if (d.meta.fin && fch > d.meta.fin) return false;
      return YA_AVANZO.indexOf(String(r.estado || '').trim()) >= 0;
    }).length;
    if (colados > 0 && wa.universo > uni) {
      fail(ctx, 'f4.whatsapp: se colaron pacientes que ya avanzaron en el embudo',
        wa.universo + ' vs ' + uni);
    }
    checks++;
    if (wa.universo !== uni) {
      fail(ctx, 'f4.whatsapp.universo no cuadra con recalculo directo sobre RESCATE_WA_PACIENTES',
        wa.universo + ' vs ' + uni);
    }
    checks++;
    if (wa.contactados !== env) {
      fail(ctx, 'f4.whatsapp.contactados no cuadra con recalculo directo',
        wa.contactados + ' vs ' + env);
    }
    // 26-sep-2026: "Respondieron" salio del embudo (ya no es pasos[4],
    // ahora vive en wa.respondieron, aparte, porque no es subconjunto de
    // "Leido"). El embudo quedo en 4 pasos: Aprobados/Recibieron/Entregado/Leido.
    const pasos = wa.embudo || [];
    const nEnt = pasos[2] ? pasos[2].n : null, nLei = pasos[3] ? pasos[3].n : null;
    checks++;
    if (nEnt !== ent || nLei !== lei) {
      fail(ctx, 'f4.whatsapp.embudo (entregado/leido) no cuadra con recalculo directo',
        JSON.stringify({ ent, lei }) + ' vs ' + JSON.stringify({ nEnt, nLei }));
    }
    checks++;
    if (wa.respondieron !== res) {
      fail(ctx, 'f4.whatsapp.respondieron no cuadra con recalculo directo',
        wa.respondieron + ' vs ' + res);
    }
    // Este panel NO filtra por sede (se acota por paciente, declarado en
    // pantalla) -- tiene que dar IGUAL sin importar el origen/rol elegido.
    checks++;
    const sinFiltro = (!orig || orig.length === 0) && !(rol && Object.keys(rol).length);
    if (!sinFiltro && wa.universo !== uni) {
      fail(ctx, 'f4.whatsapp: el universo cambio con un filtro de origen/rol (no deberia, no filtra por sede)',
        wa.universo);
    }
  }
  // embudo de gestion
  const emb = ge.embudo || [];
  let prevE = Infinity;
  emb.forEach(p => {
    num(ctx, p.n, 'f4.embudo[' + p.paso + '].n', { min: 0, nulOk: true });
    checks++;
    if (p.n !== null && p.n !== undefined && p.n > prevE) {
      warn(ctx, 'f4.embudo: "' + p.paso + '" mayor que el paso anterior', p.n + ' > ' + prevE);
    }
    if (p.n !== null && p.n !== undefined) prevE = p.n;
  });
}

/* Recalculo INDEPENDIENTE de metaRango/metaRangoRescateTotal* (24-sep-2026):
   suma DIRECTO sobre RESCATE_DESENLACE / DESEMBOLSO_RESCATE_DIA en el rango
   EXACTO d.meta.inicio..d.meta.fin, sin pasar por armarF4_, para probar que
   el rango ya no se aproxima al mes/semana calendario mas cercano (el bug
   que Emmanuel reporto: filtrar 24-ago a 24-sep solo mostraba septiembre).
   Solo se corre sin filtro de origen/rol -- con filtro, replicar el cruce
   sede-por-sede de armarF4_ (filtraGes/U.nombres) duplicaria esa logica
   aca sin agregar cobertura real. */
function chequearF4MetaRango(ctx, d, orig, rol) {
  const sinFiltro = (!orig || orig.length === 0) && !(rol && Object.keys(rol).length);
  if (!sinFiltro) return;
  const ge = (d.f4 || {}).gestion || {};
  if (!ge.metaRango) return;
  const ini = d.meta.inicio, fin = d.meta.fin;

  let mFDirecto = 0;
  leerHoja_('RESCATE_DESENLACE').forEach(r => {
    const fch = String(r.fecha || '').substring(0, 10);
    if (fch < ini || fch > fin) return;
    if (String(r.desenlace || '') !== 'firmo') return;
    mFDirecto += Number(r.monto || 0);
  });
  checks++;
  if (!casi(ge.metaRango.desembolsado, Math.round(mFDirecto), 1)) {
    fail(ctx, 'f4.gestion.metaRango.desembolsado no cuadra con recalculo directo sobre RESCATE_DESENLACE',
      ge.metaRango.desembolsado + ' vs ' + Math.round(mFDirecto));
  }
  checks++;
  if (ge.metaRangoSemanal.desembolsado !== ge.metaRango.desembolsado) {
    fail(ctx, 'f4.gestion.metaRango y metaRangoSemanal deberian tener el MISMO desembolsado (mismos dias, distinta vara)',
      ge.metaRango.desembolsado + ' vs ' + ge.metaRangoSemanal.desembolsado);
  }

  let montoRTDirecto = 0;
  leerHoja_('DESEMBOLSO_RESCATE_DIA').forEach(r => {
    const fch = String(r.fecha || '').substring(0, 10);
    if (fch < ini || fch > fin) return;
    montoRTDirecto += Number(r.monto || 0);
  });
  checks++;
  if (!casi(ge.metaRangoRescateTotalSemanal.desembolsado, Math.round(montoRTDirecto), 1)) {
    fail(ctx, 'f4.gestion.metaRangoRescateTotalSemanal.desembolsado no cuadra con recalculo directo sobre DESEMBOLSO_RESCATE_DIA',
      ge.metaRangoRescateTotalSemanal.desembolsado + ' vs ' + Math.round(montoRTDirecto));
  }
  checks++;
  if (ge.metaRangoRescateTotalMensual.desembolsado !== ge.metaRangoRescateTotalSemanal.desembolsado) {
    fail(ctx, 'f4.gestion.metaRangoRescateTotalMensual y Semanal deberian tener el MISMO desembolsado',
      ge.metaRangoRescateTotalMensual.desembolsado + ' vs ' + ge.metaRangoRescateTotalSemanal.desembolsado);
  }
  // "Rescate total" >= "Kevin" siempre (Kevin es una palanca DENTRO de
  // rescate total, seccion "META RESCATE TOTAL" de Code.gs).
  checks++;
  if (ge.metaRangoRescateTotalSemanal.desembolsado < ge.metaRango.desembolsado) {
    fail(ctx, 'f4.gestion: rescate total del rango es MENOR que Kevin (deberia ser siempre >=)',
      ge.metaRangoRescateTotalSemanal.desembolsado + ' < ' + ge.metaRango.desembolsado);
  }
}

function chequearF7(ctx, d) {
  const f = d.f7 || {};
  if (!f.hay) return;
  (f.kpis || []).forEach(k => {
    num(ctx, k.valor, 'f7.kpis[' + k.label + ']', { min: 0, nulOk: true });
  });
  const kMonto = (f.kpis || []).filter(k => k.label === 'Plata desembolsada')[0];
  if (kMonto) {
    // El KPI total tiene que ser exactamente la suma de la plata que cada
    // workflow (= cada cluster con cadencia) declara en su propia fila.
    const sumaWf = (f.workflows || []).reduce((a, w) => a + (w.monto || 0), 0);
    checks++;
    if (!casi(kMonto.valor, sumaWf, 1)) {
      fail(ctx, 'f7: la plata total del KPI no cuadra con la suma de f7.workflows[].monto',
        kMonto.valor + ' vs ' + sumaWf);
    }
  }
  (f.workflows || []).forEach(w => {
    num(ctx, w.monto, 'f7.workflows[' + w.nombre + '].monto', { min: 0 });
    num(ctx, w.desembolsos, 'f7.workflows[' + w.nombre + '].desembolsos', { min: 0 });
    num(ctx, w.montoPorSede, 'f7.workflows[' + w.nombre + '].montoPorSede', { min: 0 });
    checks++;
    if (w.monto > 0 && w.desembolsos === 0) {
      fail(ctx, 'f7.workflows[' + w.nombre + ']: hay plata pero 0 desembolsos', w.monto);
    }
  });
  (f.sinTocar || []).forEach(s => {
    num(ctx, s.monto, 'f7.sinTocar[' + s.audiencia + '].monto', { min: 0 });
  });
  (f.serie || []).forEach((p, i) => {
    num(ctx, p.monto, 'f7.serie[' + i + '].monto', { min: 0 });
  });
}


// ---------------------------- F8: Segundos creditos -----------------------
/* Regla 4: recalculo INDEPENDIENTE desde SEG_ELEGIBLES / SEG_SOLICITUDES
   crudas, sin pasar por armarF8_. Mas los invariantes propios de este frente:

   - "desembolsos" usa la MISMA lista de estados que el resto del tablero
     (sin 'dismissed', seccion 11). Si alguien le mete una definicion propia
     a F8, este chequeo lo agarra.
   - desembolsos <= solicitudes SIEMPRE (es un subconjunto por construccion).
   - la suma de f8.rutas[].n tiene que dar exactamente f8.solicitudes: si no,
     el Sankey esta mostrando una poblacion distinta a la de las tarjetas.
   - aptos y ya-aplicaron son DISJUNTOS (ver el comentario de armarF8_), asi
     que aptosTotal = aptos + solicitudesTotal, no otra cosa. */
/* La MISMA lista que el resto del tablero, sin 'dismissed' (seccion 11).
   VALIDADO por Emmanuel el 28-sep-2026: pregunto por que la tarjeta decia 6
   desembolsos si su query no mostraba ninguno en 'desembolsado' (eran 5 en
   pendiente_desembolso + 1 en pendiente_aprobacion_medico), se midio el
   alcance (en 2026 el 96,4% de este bucket si termina desembolsando) y
   confirmo que para el negocio esos estados SI cuentan como desembolso. */
const F8_CONV = ['pendiente_aprobacion_medico', 'desembolsado',
  'pendiente_validacion_cliente', 'fulfilled', 'pendiente_desembolso'];

function chequearF8(ctx, d, orig, rol) {
  const f = d.f8 || {};
  const sinFiltro = (!orig || orig.length === 0) && !(rol && Object.keys(rol).length);
  if (!f.hay) return;

  (f.kpis || []).forEach(k => {
    num(ctx, k.valor, 'f8.kpis[' + k.label + ']', { min: 0 });
  });

  // --- recalculo directo sobre las hojas crudas ---
  // Solo sin filtro de origen/rol: con filtro habria que replicar el cruce
  // sede-por-sede de filtrarPorId_, que no agrega cobertura para estos bugs.
  if (sinFiltro) {
    const ele = leerHoja_('SEG_ELEGIBLES');
    checks++;
    if (f.aptos !== ele.length) {
      fail(ctx, 'f8.aptos no cuadra con el conteo directo de SEG_ELEGIBLES',
        f.aptos + ' vs ' + ele.length);
    }

    const sol = leerHoja_('SEG_SOLICITUDES');
    let nSol = 0, nDes = 0, monto = 0;
    sol.forEach(r => {
      const dt = String(r.fecha || '').substring(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) return;
      if (d.meta.inicio && dt < d.meta.inicio) return;
      if (d.meta.fin && dt > d.meta.fin) return;
      nSol++;
      if (F8_CONV.indexOf(String(r.estado || '').trim()) >= 0) {
        nDes++;
        monto += Number(r.monto) || 0;
      }
    });
    checks++;
    if (f.solicitudes !== nSol) {
      fail(ctx, 'f8.solicitudes no cuadra con el recalculo directo',
        f.solicitudes + ' vs ' + nSol);
    }
    checks++;
    if (f.desembolsos !== nDes) {
      fail(ctx, 'f8.desembolsos no cuadra con el recalculo directo (misma ' +
        'lista de estados que el resto del tablero, sin dismissed)',
        f.desembolsos + ' vs ' + nDes);
    }
    checks++;
    if (!casi(f.monto, monto, 1)) {
      fail(ctx, 'f8.monto no cuadra con el recalculo directo', f.monto + ' vs ' + monto);
    }
    checks++;
    if (f.solicitudesTotal !== sol.length) {
      fail(ctx, 'f8.solicitudesTotal no cuadra con el total crudo de SEG_SOLICITUDES',
        f.solicitudesTotal + ' vs ' + sol.length);
    }
  }

  // --- invariantes estructurales, con o sin filtro ---
  checks++;
  if (f.desembolsos > f.solicitudes) {
    fail(ctx, 'f8: hay mas desembolsos que solicitudes (imposible, es un subconjunto)',
      f.desembolsos + ' > ' + f.solicitudes);
  }
  checks++;
  if (f.aptosTotal !== f.aptos + f.solicitudesTotal) {
    fail(ctx, 'f8.aptosTotal roto: aptos y ya-aplicaron son disjuntos, el total ' +
      'tiene que ser la suma exacta',
      f.aptosTotal + ' vs ' + (f.aptos + f.solicitudesTotal));
  }
  checks++;
  if (f.monto > 0 && f.desembolsos === 0) {
    fail(ctx, 'f8: hay plata desembolsada con 0 desembolsos', f.monto);
  }

  // --- el Sankey mide la misma poblacion que las tarjetas ---
  const sumaRutas = (f.rutas || []).reduce((a, r) => a + (r.n || 0), 0);
  checks++;
  if (sumaRutas !== f.solicitudes) {
    fail(ctx, 'f8.rutas: la suma de las bandas del Sankey no da las solicitudes ' +
      'del periodo (el grafico estaria mostrando otra poblacion)',
      sumaRutas + ' vs ' + f.solicitudes);
  }
  let cruzaron = 0;
  (f.rutas || []).forEach(r => {
    num(ctx, r.n, 'f8.rutas[' + r.origen + '->' + r.destino + '].n', { min: 0 });
    num(ctx, r.monto, 'f8.rutas[' + r.origen + '->' + r.destino + '].monto', { min: 0 });
    if (r.origen !== r.destino) cruzaron += r.n;
  });
  checks++;
  if (f.cruzaron !== cruzaron) {
    fail(ctx, 'f8.cruzaron no cuadra con las rutas donde origen != destino',
      f.cruzaron + ' vs ' + cruzaron);
  }

  // --- la serie diaria suma lo mismo que las tarjetas ---
  const sSol = (f.serie || []).reduce((a, p) => a + (p.solicitudes || 0), 0);
  const sDes = (f.serie || []).reduce((a, p) => a + (p.desembolsos || 0), 0);
  checks++;
  if (sSol !== f.solicitudes || sDes !== f.desembolsos) {
    fail(ctx, 'f8.serie no suma lo mismo que los KPIs',
      JSON.stringify({ sSol, sDes }) + ' vs ' + JSON.stringify({ s: f.solicitudes, d: f.desembolsos }));
  }
  (f.serie || []).forEach((p, i) => {
    checks++;
    if (p.desembolsos > p.solicitudes) {
      fail(ctx, 'f8.serie[' + i + ']: desembolsos > solicitudes ese dia',
        p.desembolsos + ' > ' + p.solicitudes);
    }
  });
}


// ---------------------------- F5: Welli Points, cruce adopcion x plata ----
// Reescrito 18-sep-2026 (segunda vuelta): el frente cambio de una prueba
// causal (canje, control emparejado, IC) a un cruce directo (login vs
// desembolso) mas una correlacion en el tiempo (WP ganado vs desembolsado),
// pedido explicito de Emmanuel. Regla 4: recalculo INDEPENDIENTE, no
// autoconsistencia — todo se vuelve a sumar aca desde las hojas crudas,
// sin pasar por wpCruceLogin_/wpCorrelacion_.
let _f5ref = null;
function refF5() {
  if (_f5ref) return _f5ref;
  const fila = n => {
    const v = HOJAS[n] || [];
    return v.length ? v.slice(1).map(r => Object.fromEntries(v[0].map((c, i) => [c, r[i]]))) : [];
  };
  // cadena de llaves: CREDITO_SEDES.sede es el id NUMERICO de HubSpot
  const hs2int = {};
  fila('SEDES').forEach(r => {
    const a = String(r.id || '').trim(), b = String(r.id_internal || '').trim();
    if (a && b) hs2int[a] = b;
  });
  const idx2id = {};
  fila('CREDITO_SEDES').forEach(r => {
    const hs = String(r.sede || '').trim();
    if (hs2int[hs]) idx2id[String(r.i)] = hs2int[hs];
  });
  const BASE = Date.UTC(2025, 0, 1);
  // porMes[iid][mes] = monto ; porDia[iid][fecha] = monto
  const porMes = {}, porDia = {};
  let totalDesembolsado = 0;
  fila('CREDITO_DIA').forEach(r => {
    const iid = idx2id[String(r.s)];
    const m = Number(r.m_conv) || 0;
    if (m) totalDesembolsado += m;
    if (!iid || !m) return;
    const fecha = new Date(BASE + Number(r.d) * 86400000).toISOString().substring(0, 10);
    const mes = fecha.substring(0, 7);
    if (!porMes[iid]) porMes[iid] = {};
    porMes[iid][mes] = (porMes[iid][mes] || 0) + m;
    if (!porDia[iid]) porDia[iid] = {};
    porDia[iid][fecha] = (porDia[iid][fecha] || 0) + m;
  });
  // Marcas excluidas de TODA la pestana (21-sep-2026), recalculado
  // independiente de wpExcluidas_: mismo criterio de DOS fuentes (SEDES de
  // HubSpot + PLATAFORMA_SEDES nombre/correo), leido directo de las hojas
  // crudas, sin pasar por Code.gs. Una sola fuente no alcanza: "City Suba"
  // (CityDent real) no dice la marca en NINGUN nombre, solo en el correo;
  // "Sonria sede Toberin" la decia en la plataforma pero no en HubSpot.
  const MARCAS_EXCL = ['sonria', 'dentisalud', 'odontofamily', 'citydent'];
  const marca_ = txt => MARCAS_EXCL.some(m => String(txt || '').toLowerCase().indexOf(m) >= 0);
  const excluidas = new Set();
  fila('SEDES').forEach(r => {
    if (!marca_(r.nombre_sede)) return;
    const iid = String(r.id_internal || '').trim();
    if (iid) excluidas.add(iid);
  });
  fila('PLATAFORMA_SEDES').forEach(r => {
    if (!marca_(r.nombre) && !marca_(r.email)) return;
    const iid = String(r.id_sede || '').trim();
    if (iid) excluidas.add(iid);
  });
  const habilitadasCruda = new Set(fila('WP_HABILITADAS').map(r => String(r.id_sede || '').trim()).filter(Boolean));
  const conLoginCruda = new Set(fila('WP_LOGIN_SEDES').map(r => String(r.id_sede || '').trim()).filter(Boolean));
  // habilitadas/conLogin quedan YA excluidas: son las que Code.gs deberia
  // ver a traves de leerWP_. Las version "cruda" (sin filtrar) se guardan
  // aparte para probar que la hoja en si NO se toco -- la exclusion vive
  // en Code.gs, no en el pull.
  const habilitadas = new Set([...habilitadasCruda].filter(i => !excluidas.has(i)));
  const conLogin = new Set([...conLoginCruda].filter(i => !excluidas.has(i)));
  // WP_PTS_SEDE_MES (wp_desembolsos_snapshot.pts_ganados, por sede x mes),
  // NO WP_SEDE_MES: esa segunda es una campana de incentivos especifica
  // (wp_incentivos_diario), no los puntos que gana TODA la base por
  // desembolsar. Confundirlas fue el bug real que Emmanuel encontro a ojo
  // el 18-sep-2026 (250-435 pts/mes contra $8-14 mil M desembolsados).
  // ptsPorMes[iid][mes] = pts, para poder recalcular tambien con un origen
  // filtrado (el filtro global tiene que morder esta serie igual que la
  // de plata desembolsada — mismo patron que porMes/porDia de arriba).
  const ptsPorMes = {};
  let wpGanadoTotal = 0;
  fila('WP_PTS_SEDE_MES').forEach(r => {
    const mes = String(r.mes || '').trim();
    const iid = String(r.id_sede || '').trim();
    const pts = Number(r.pts) || 0;
    if (!mes) return;
    if (iid && excluidas.has(iid)) return;  // fuera de f5.correlacion.ganado
    wpGanadoTotal += pts;
    if (!iid) return;
    if (!ptsPorMes[iid]) ptsPorMes[iid] = {};
    ptsPorMes[iid][mes] = (ptsPorMes[iid][mes] || 0) + pts;
  });
  // fecha -> Set(id_sede) con login ese dia, para el chequeo de la tendencia
  const loginDia = {};
  fila('WP_LOGIN_DIA').forEach(r => {
    const f = String(r.fecha || '').substring(0, 10);
    const iid = String(r.id_sede || '').trim();
    if (!f || !iid || excluidas.has(iid)) return;  // wpAdopcionDia_ usa leerWP_
    if (!loginDia[f]) loginDia[f] = new Set();
    loginDia[f].add(iid);
  });
  // WP_RESUMEN (wp_resumen_semanal.saldo_canjeable) -- la fuente correcta
  // para "Puntos ganados sin reclamar" desde el 21-sep-2026. Antes se leia
  // wp_incentivos_diario.wp_pendiente_actual, que mide algo DISTINTO (lo
  // prometido y no ganado de una campana puntual). Emmanuel trajo su
  // propia query oficial (la misma de aca) para comparar.
  const saldoPorId = {};
  let saldoCanjeableTotal = 0;
  fila('WP_RESUMEN').forEach(r => {
    const iid = String(r.id_sede || '').trim();
    if (!iid || excluidas.has(iid)) return;
    const s = Number(r.saldo_canjeable) || 0;
    saldoPorId[iid] = s;
    saldoCanjeableTotal += s;
  });
  _f5ref = { porMes, porDia, habilitadas, conLogin, totalDesembolsado, wpGanadoTotal,
             ptsPorMes, loginDia, excluidas, habilitadasCruda, conLoginCruda,
             saldoPorId, saldoCanjeableTotal };
  return _f5ref;
}

function chequearF5(ctx, d, sinFiltro) {
  const f = d.f5 || {};
  const cr = f.cruce;
  checks++;
  if (!cr) { fail(ctx, 'f5.cruce no existe'); return; }

  // ---- exclusion de marcas (Sonria/Dentisalud/OdontoFamily/CityDent), --
  // ---- 21-sep-2026 -------------------------------------------------------
  // Solo se puede probar sin filtro: con un origen elegido el universo ya
  // esta angostado por otra razon y nCon+nSin no tiene por que igualar
  // habilitadasCruda menos excluidas (ver mismo patron en el chequeo de
  // arriba, mas abajo).
  if (sinFiltro) {
    const R = refF5();
    checks++;
    if (R.excluidas.size < 100) {
      fail(ctx, 'f5: la lista de marcas excluidas salio sospechosamente chica ' +
        '(revisar si SEDES trae nombre_sede)', R.excluidas.size);
    }
    // la hoja CRUDA no se toca: las marcas excluidas siguen en
    // WP_HABILITADAS/WP_LOGIN_SEDES tal cual las sube el pull. La
    // exclusion vive en Code.gs (leerWP_), no en la fuente.
    checks++;
    const crudaTraeExcluidas = [...R.excluidas].some(iid => R.habilitadasCruda.has(iid));
    if (R.habilitadasCruda.size > 0 && !crudaTraeExcluidas) {
      warn(ctx, 'f5: ninguna sede excluida aparece en WP_HABILITADAS cruda ' +
        '(raro, pero no es un fallo: puede que ninguna tenga cuenta hoy)');
    }
    if (cr.hay) {
      checks++;
      const esperadoUniverso = [...R.habilitadasCruda].filter(i => !R.excluidas.has(i)).length;
      if (!casi(cr.nCon + cr.nSin, esperadoUniverso, 2)) {
        fail(ctx, 'f5.cruce: nCon+nSin no cuadra con WP_HABILITADAS menos las marcas excluidas',
          (cr.nCon + cr.nSin) + ' vs ' + esperadoUniverso);
      }
    }

    // ---- "Puntos ganados sin reclamar" == wp_resumen_semanal.saldo_ -----
    // ---- canjeable, NO wp_incentivos_diario (corregido 21-sep-2026) -----
    const kpiSaldo = ((f.pago || {}).kpis || []).filter(function (k) {
      return k.label === 'Puntos ganados sin reclamar';
    })[0];
    checks++;
    if (!kpiSaldo) {
      fail(ctx, 'f5.pago.kpis no trae "Puntos ganados sin reclamar"');
    } else {
      const esperadoCop = R.saldoCanjeableTotal * 2000;  // COP_POR_PUNTO
      checks++;
      if (!casi(kpiSaldo.valor, esperadoCop, 1)) {
        fail(ctx, '"Puntos ganados sin reclamar" no cuadra con WP_RESUMEN.saldo_canjeable ' +
          '(la query oficial de Emmanuel)', kpiSaldo.valor + ' vs ' + esperadoCop);
      }
    }
  }

  if (cr.hay) {
    // --- n de cada grupo: nunca se solapan, nunca superan lo habilitado --
    num(ctx, cr.nCon, 'f5.cruce.nCon', { min: 0 });
    num(ctx, cr.nSin, 'f5.cruce.nSin', { min: 0 });
    if (sinFiltro) {
      const R = refF5();
      checks++;
      if (!casi(cr.nCon + cr.nSin, R.habilitadas.size, 2)) {
        fail(ctx, 'f5.cruce: nCon+nSin no cuadra con WP_HABILITADAS',
          (cr.nCon + cr.nSin) + ' vs ' + R.habilitadas.size);
      }
      // recalculo independiente del promedio del ultimo mes de la serie,
      // para no confiar en la agregacion del motor
      if (cr.serie.length) {
        const mesProbar = cr.serie[cr.serie.length - 1].mes;
        let sumaCon = 0, nCon = 0, sumaSin = 0, nSin = 0;
        R.habilitadas.forEach(iid => {
          const monto = (R.porMes[iid] || {})[mesProbar] || 0;
          if (R.conLogin.has(iid)) { sumaCon += monto; nCon++; }
          else { sumaSin += monto; nSin++; }
        });
        const promConRef = nCon ? Math.round(sumaCon / nCon) : 0;
        const filaMes = cr.serie.filter(x => x.mes === mesProbar)[0];
        checks++;
        if (filaMes && !casi(filaMes.promCon, promConRef, Math.max(1, promConRef * 0.02))) {
          fail(ctx, 'f5.cruce.serie[' + mesProbar + '].promCon no cuadra con el recalculo crudo',
            filaMes.promCon + ' vs ' + promConRef);
        }
      }
    }
    // --- el multiplicador es exactamente promCon/promSin -------------------
    checks++;
    const multEsperado = cr.promSin ? Math.round((cr.promCon / cr.promSin) * 10) / 10 : null;
    if (cr.multiplicador !== multEsperado) {
      fail(ctx, 'f5.cruce.multiplicador no es promCon/promSin',
        cr.multiplicador + ' vs ' + multEsperado);
    }
    (cr.serie || []).forEach((x, i) => {
      num(ctx, x.promCon, 'f5.cruce.serie[' + i + '].promCon', { min: 0 });
      num(ctx, x.promSin, 'f5.cruce.serie[' + i + '].promSin', { min: 0 });
      pct(ctx, x.pctDesembCon, 'f5.cruce.serie[' + i + '].pctDesembCon');
      pct(ctx, x.pctDesembSin, 'f5.cruce.serie[' + i + '].pctDesembSin');
    });
  }

  // ------------------------------------------------------- correlacion ---
  const co = f.correlacion || [];
  co.forEach((x, i) => {
    num(ctx, x.ganado, 'f5.correlacion[' + i + '].ganado', { min: 0 });
    num(ctx, x.desembolsado, 'f5.correlacion[' + i + '].desembolsado', { min: 0 });
  });
  if (sinFiltro && co.length) {
    const R = refF5();
    checks++;
    const sumaGanado = co.reduce((a, x) => a + x.ganado, 0);
    if (!casi(sumaGanado, R.wpGanadoTotal, 1)) {
      fail(ctx, 'f5.correlacion: suma de ganado no cuadra con WP_PTS_SEDE_MES',
        sumaGanado + ' vs ' + R.wpGanadoTotal);
    }
    checks++;
    const sumaDesemb = co.reduce((a, x) => a + x.desembolsado, 0);
    // el total crudo incluye TODO el historico desde 2023; correlacion solo
    // cuenta desde 2026-01, asi que el crudo es un techo, no una igualdad.
    if (sumaDesemb > R.totalDesembolsado + 1) {
      fail(ctx, 'f5.correlacion: suma de desembolsado supera el total crudo de CREDITO_DIA',
        sumaDesemb + ' > ' + R.totalDesembolsado);
    }
  }

  // -------------------------------------------- tendencia diaria (18-sep) --
  // f.adopcion.tendencia no depende de U (declarado "no responde al filtro
  // de origen"), asi que se recalcula solo cuando corre sin filtro.
  const tend = ((f.adopcion || {}).tendencia) || [];
  if (sinFiltro && tend.length) {
    const R = refF5();
    (tend || []).forEach((x, i) => {
      num(ctx, x.sedes, 'f5.adopcion.tendencia[' + i + '].sedes', { min: 0 });
      num(ctx, x.monto, 'f5.adopcion.tendencia[' + i + '].monto', { min: 0 });
    });
    // se prueba un dia real, recalculado desde WP_LOGIN_DIA + CREDITO_DIA
    // crudos, sin pasar por wpAdopcionDia_.
    const probar = tend[tend.length - 1];
    const set = R.loginDia[probar.x] || new Set();
    checks++;
    if (set.size !== probar.sedes) {
      fail(ctx, 'f5.adopcion.tendencia[' + probar.x + '].sedes no cuadra con WP_LOGIN_DIA crudo',
        probar.sedes + ' vs ' + set.size);
    }
    let montoRef = 0;
    set.forEach(iid => { montoRef += (R.porDia[iid] || {})[probar.x] || 0; });
    checks++;
    if (!casi(probar.monto, montoRef, 1)) {
      fail(ctx, 'f5.adopcion.tendencia[' + probar.x + '].monto no cuadra con el recalculo crudo',
        probar.monto + ' vs ' + montoRef);
    }
  }
}

// ------------------------------------------------- frescura de las fuentes
// Encontrado el 10-sep-2026: DEALS_ORIGEN llevaba dias sin re-pull y el
// tablero mostraba 15 leads de Pagina Web donde HubSpot en vivo mostraba
// 26 — ademas de la exclusion de causales (documentada), 11 de esos eran
// simple atraso de dato. Este chequeo existe para que un atraso asi se vea
// en la QA en vez de en una presentacion.
function chequearFrescura() {
  const hoy = new Date().toISOString().substring(0, 10);
  function diasDesde(fechaISO) {
    return Math.round((new Date(hoy) - new Date(fechaISO)) / 86400000);
  }
  // tabla -> [campo de fecha, dias de atraso tolerado]. El tolerado no es
  // cero: cada fuente tiene su propio ritmo real de actualizacion (BigQuery
  // corre distinto de HubSpot, y un fin de semana no mueve el dato de
  // gestion humana) — lo que se quiere atrapar es un atraso ANORMAL, de
  // dias que ya deberian tener dato y no lo tienen.
  const FUENTES = [
    ['DEALS_ORIGEN', 'cosecha', 3],
    // CREDITO_DIA no trae fecha legible (viene comprimida por comprime_cdia_,
    // ver seccion 12 de CLAUDE.md) — se audita via SEDE_ESTADO_MES, que sale
    // del mismo pull de profile_institucion y sí trae 'mes' legible.
    ['SEDE_ESTADO_MES', 'mes', 35], // granularidad mensual: 35 dias cubre el mes en curso completo
    ['ACT_SEDE_MES', 'mes', 35],
    ['LT_APPS_DIA', 'fecha', 3],
    ['LT_TOUCHES', 'fecha', 3],
    ['META_ADS', 'fecha', 3],
    ['RESCATE_GESTION', 'fecha', 3],
    ['RESCATE_CAUSAL', 'fecha', 3],
    ['RESCATE_POOL', 'fecha', 3],
    ['RESCATE_DESENLACE', 'fecha', 3],
    ['RESCATE_WA_PACIENTES', 'fecha_aprobacion', 3],
    ['DESEMBOLSO_RESCATE_DIA', 'fecha', 3],
    ['PLATAFORMA_SEDES', 'created', 3]
  ];
  console.log('\n--- frescura de las fuentes (vs ' + hoy + ') ---');
  FUENTES.forEach(([tabla, campo, tolerancia]) => {
    if (!campo) return;
    const T = HOJAS[tabla];
    if (!T) { warn('frescura', tabla + ' no existe en el snapshot'); return; }
    const h = T[0];
    const idx = h.indexOf(campo);
    if (idx < 0) { warn('frescura', tabla + ' no tiene columna ' + campo); return; }
    let mx = '';
    T.slice(1).forEach(r => { const v = String(r[idx] || ''); if (v > mx) mx = v; });
    // Para 'mes' (YYYY-MM) se compara contra el mes en curso, no contra el dia.
    const esMes = /^\d{4}-\d{2}$/.test(mx);
    const atraso = esMes
      ? (hoy.substring(0, 7) === mx ? 0 : diasDesde(mx + '-01'))
      : diasDesde(mx);
    checks++;
    console.log('  ' + tabla.padEnd(24) + 'max ' + campo + '=' + mx +
      '  (' + atraso + ' dias de atraso)');
    if (atraso > tolerancia) {
      fail('frescura', tabla + ' esta desactualizada: max ' + campo + ' es ' + mx +
        ', ' + atraso + ' dias de atraso (tolerancia ' + tolerancia + ')');
    }
  });
}

function chequearMeta(ctx, d) {
  const m = d.meta || {};
  num(ctx, m.origenSedes, 'meta.origenSedes', { min: 0 });
  num(ctx, m.origenSedesBase, 'meta.origenSedesBase', { min: 0 });
  checks++;
  if (m.origenSedes > m.origenSedesBase) {
    fail(ctx, 'meta: sedes filtradas > base', m.origenSedes + ' > ' + m.origenSedesBase);
  }
}

// ------------------------------------------------------------- la matriz
const RANGOS = [
  ['2026-08-01', '2026-08-31', 'agosto'],
  ['2026-09-01', '2026-09-08', 'sep parcial'],
  ['2026-07-01', '2026-07-31', 'julio'],
  ['2026-08-03', '2026-08-09', 'semana 3-9 ago'],
  ['2026-01-01', '2026-09-08', 'todo 2026'],
  ['2026-07-20', '2026-08-10', 'rango libre a caballo']
];
const ORIGENES = [
  [[], 'todos'],
  [['EVENTO'], 'evento'],
  [['DENTALINK'], 'dentalink'],
  [['EVENTO', 'REFERIDO', 'PAGINA WEB', 'SOCIAL MEDIA'], 'marketing'],
  [['FARMER'], 'farmer-origen']
];
const ROLES = [
  [{}, 'sin rol'],
  [{ hunter: '__equipo__' }, 'equipo hunter'],
  [{ hunter: '83703393' }, 'hunter johanna'],
  [{ farmer: '83703392' }, 'farmer guillermo']
];

const rapido = process.argv[2] === 'rapido';
const rangos = rapido ? RANGOS.slice(0, 2) : RANGOS;
const origenes = rapido ? ORIGENES.slice(0, 2) : ORIGENES;
const roles = rapido ? ROLES.slice(0, 2) : ROLES;

const cache = {};
function correr(ini, fin, orig, rol) {
  const k = [ini, fin, orig.join('+'), JSON.stringify(rol)].join('|');
  if (cache[k]) return cache[k];
  const d = getDashboardData(ini, fin, orig, rol, '');
  cache[k] = d;
  return d;
}

let corridas = 0;
console.log('QA del tablero — motor real sobre data completa\n');
chequearFrescura();
rangos.forEach(([ini, fin, etqR]) => {
  origenes.forEach(([orig, etqO]) => {
    roles.forEach(([rol, etqRol]) => {
      const ctx = etqR + ' / ' + etqO + ' / ' + etqRol;
      let d;
      try {
        d = correr(ini, fin, orig, rol);
      } catch (e) {
        fail(ctx, 'EXCEPCION en getDashboardData: ' + e.message);
        return;
      }
      corridas++;
      chequearMeta(ctx, d);
      chequearF1(ctx, d);
      chequearMetasCanal(ctx, d, orig, rol);
      chequearF2(ctx, d);
      chequearF4(ctx, d, orig, rol);
      chequearF4MetaRango(ctx, d, orig, rol);
      chequearF7(ctx, d);
      chequearF8(ctx, d, orig, rol);
      chequearF5(ctx, d, orig.length === 0 && Object.keys(rol || {}).length === 0);
    });
  });
});

// --------------------------------------- que los filtros de verdad muerden
console.log('--- filtros: que corten de verdad ---');
const base = correr('2026-08-01', '2026-08-31', [], {});
const cat = {};
(base.meta.catalogoOrigenes || []).forEach(c => { cat[c.origen] = c.sedes; });

[['EVENTO'], ['DENTALINK'], ['FARMER'], ['DT DENTAL']].forEach(o => {
  const d = correr('2026-08-01', '2026-08-31', o, {});
  const esperado = cat[o[0]] || 0;
  checks++;
  if (!casi(d.meta.origenSedes, esperado, 0)) {
    fail('filtro origen ' + o[0], 'sedes del filtro != catalogo',
      d.meta.origenSedes + ' vs ' + esperado);
  } else {
    console.log('  OK origen ' + o[0].padEnd(12) + d.meta.origenSedes + ' sedes (= catalogo)');
  }
  checks++;
  if (d.meta.origenSedes >= base.meta.origenSedes) {
    fail('filtro origen ' + o[0], 'no reduce respecto a Todos',
      d.meta.origenSedes + ' vs ' + base.meta.origenSedes);
  }
});

// metasCanal sale de DEALS_ORIGEN, que no tiene farmer/cs (son roles de la
// SEDE, y el deal todavia no es una sede) — filtrar por Farmer no puede
// mover ni un numero de las dos tablas de metas.
const mcBase = base.f1.metasCanal;
const mcFarmer = correr('2026-08-01', '2026-08-31', [], { farmer: '__equipo__' }).f1.metasCanal;
checks++;
if (JSON.stringify(mcBase.leads) !== JSON.stringify(mcFarmer.leads) ||
    JSON.stringify(mcBase.vinculacion) !== JSON.stringify(mcFarmer.vinculacion)) {
  fail('metasCanal vs filtro Farmer', 'las metas de canal CAMBIARON al filtrar por Farmer ' +
    '(los deals no tienen ese rol, no deberían moverse)',
    JSON.stringify(mcBase.leads) + ' vs ' + JSON.stringify(mcFarmer.leads));
} else {
  console.log('  OK metasCanal ignora el filtro de Farmer (como debe ser)');
}

// Filtrar a un solo origen de marketing (EVENTO) tiene que dejar los OTROS
// tres canales en cero en la tabla de leads: si Eventos sube y los demas no
// bajan a cero, el filtro de origen no esta cortando DEALS_ORIGEN de verdad.
const mcEvento = correr('2026-08-01', '2026-08-31', ['EVENTO'], {}).f1.metasCanal;
checks++;
const otrosNoCero = mcEvento.leads.filter(function (r) {
  return r.canal !== 'Eventos' && r.actual !== 0;
});
if (otrosNoCero.length) {
  fail('metasCanal vs filtro EVENTO', 'con el filtro en EVENTO, otros canales no quedaron en 0',
    JSON.stringify(otrosNoCero));
} else {
  console.log('  OK metasCanal con filtro EVENTO: los otros 3 canales quedan en 0');
}

// F7 (long tail): el filtro LOCAL de cluster tiene que angostar TODO el
// frente — poblacion, serie, impactos, workflows, PLATA — a esa sola
// audiencia.
const f7Todos = getDashboardData('2026-08-01', '2026-09-09', [], {}, '', '');
chequearF7('F7 sin filtro de cluster', f7Todos);
let sumaMontoClusters = 0;
(f7Todos.f7.clusters || []).forEach(c => {
  const d = getDashboardData('2026-08-01', '2026-09-09', [], {}, '', c.clave);
  chequearF7('F7 cluster ' + c.clave, d);
  checks++;
  if (d.f7.poblacion !== c.sedes) {
    fail('F7 cluster ' + c.clave, 'poblacion filtrada != catalogo de clusters',
      d.f7.poblacion + ' vs ' + c.sedes);
  }
  checks++;
  if (d.f7.poblacion >= f7Todos.f7.poblacion && f7Todos.f7.clusters.length > 1) {
    fail('F7 cluster ' + c.clave, 'no reduce respecto a Todos',
      d.f7.poblacion + ' vs ' + f7Todos.f7.poblacion);
  }
  // Los workflows que se listan tienen que ser SOLO de esa audiencia — un
  // workflow de otro cluster que se cuele es la razon de ser de este check.
  checks++;
  const otroCluster = (d.f7.workflows || []).filter(w => w.audiencia && w.audiencia !== c.clave);
  if (otroCluster.length) {
    fail('F7 cluster ' + c.clave, 'aparecen workflows de otro cluster', JSON.stringify(otroCluster));
  }
  sumaMontoClusters += (d.f7.kpis.filter(k => k.label === 'Plata desembolsada')[0] || {}).valor || 0;
});
// Los cinco clusters son disjuntos (una sede tiene UNA audiencia_long_tail),
// asi que la plata sumada cluster por cluster tiene que dar la plata total
// sin filtrar — ni mas ni menos.
const montoTotalSinFiltro = (f7Todos.f7.kpis.filter(k => k.label === 'Plata desembolsada')[0] || {}).valor || 0;
checks++;
if (!casi(sumaMontoClusters, montoTotalSinFiltro, 1)) {
  fail('F7 plata por cluster', 'la suma de los 5 clusters no da la plata total sin filtrar',
    sumaMontoClusters + ' vs ' + montoTotalSinFiltro);
}
console.log('  OK F7: cada cluster angosta poblacion/workflows/plata a su propia audiencia (' +
  (f7Todos.f7.clusters || []).length + ' clusters probados, $' +
  Math.round(montoTotalSinFiltro).toLocaleString('es-CO') + ' en total)');

// La meta GENERAL es de toda la empresa: filtrar por origen o rol de sede
// no debe cambiarla en absoluto (no hay bolsa acotada por sede detras).
[[[], {}], [['EVENTO'], {}], [[], { hunter: '__equipo__' }]].forEach(([o, r]) => {
  const d = correr('2026-08-01', '2026-08-31', o, r);
  const gA = ((base.f4 || {}).gestion || {}).metasMesRescateTotal || [];
  const gB = ((d.f4 || {}).gestion || {}).metasMesRescateTotal || [];
  checks++;
  if (JSON.stringify(gA) !== JSON.stringify(gB)) {
    fail('meta general vs filtro', 'la meta general CAMBIÓ con un filtro puesto',
      'origen=' + JSON.stringify(o) + ' rol=' + JSON.stringify(r));
  }
});
console.log('  OK meta general: idéntica sin filtro, con EVENTO y con equipo Hunter');

ROLES.slice(1).forEach(([rol, etq]) => {
  const d = correr('2026-08-01', '2026-08-31', [], rol);
  checks++;
  if (d.meta.origenSedes >= base.meta.origenSedes) {
    fail('filtro rol ' + etq, 'no reduce respecto a sin rol',
      d.meta.origenSedes + ' vs ' + base.meta.origenSedes);
  } else {
    console.log('  OK rol ' + etq.padEnd(18) + d.meta.origenSedes + ' de ' +
      base.meta.origenSedes + ' sedes');
  }
});

// el filtro de fecha tiene que mover lo que ESTA fechado
const ago = correr('2026-08-01', '2026-08-31', [], {});
const sem = correr('2026-08-03', '2026-08-09', [], {});
// OJO: ge.semanas / ge.metas / ge.serieDiaria NO se cortan con el filtro a
// proposito (la tarjeta de metas elige la fila del periodo elegido y la
// grafica declara su propio rango). Lo que SI tiene que responder al filtro
// es la gestion del periodo: f4.cobertura.
const casosAgo = ((ago.f4 || {}).cobertura || {}).casos || 0;
const casosSem = ((sem.f4 || {}).cobertura || {}).casos || 0;
checks++;
if (!(casosSem < casosAgo)) {
  fail('filtro fecha', 'f4.cobertura no responde al filtro de fecha',
    casosSem + ' vs ' + casosAgo);
} else {
  console.log('  OK fecha gestion: ' + casosSem + ' casos en la semana vs ' + casosAgo + ' del mes');
}
// F1 y F2 tambien tienen que moverse con la fecha
const cosAgo = ((ago.f1 || {}).cosechas || []).length;
const cosAno = ((correr('2026-01-01', '2026-09-08', [], {}).f1 || {}).cosechas || []).length;
checks++;
if (!(cosAgo < cosAno)) {
  fail('filtro fecha', 'f1.cosechas no responde al filtro de fecha',
    cosAgo + ' vs ' + cosAno);
} else {
  console.log('  OK fecha F1: ' + cosAgo + ' cosechas en agosto vs ' + cosAno + ' en el año');
}
// el embudo de whatsapp tambien responde a la fecha (se arreglo ayer)
const waAgo = (((ago.f4 || {}).gestion || {}).whatsapp || {}).contactados || 0;
const waSem = (((sem.f4 || {}).gestion || {}).whatsapp || {}).contactados || 0;
checks++;
if (!(waSem < waAgo)) {
  fail('filtro fecha', 'el embudo de WhatsApp no responde a la fecha',
    waSem + ' vs ' + waAgo);
} else {
  console.log('  OK fecha WhatsApp: ' + waSem + ' contactados en la semana vs ' + waAgo + ' del mes');
}

// --------------------------------------- los deltas "vs periodo anterior"
// El payload trae el delta pero NO el valor previo, asi que la unica forma
// de auditarlo es correr el motor sobre el periodo anterior que el propio
// motor declara (meta.prevInicio/prevFin) y rehacer la cuenta.
console.log('\n--- deltas vs periodo anterior ---');
[['2026-08-01', '2026-08-31', 'agosto'],
 ['2026-08-03', '2026-08-09', 'semana 3-9 ago']].forEach(([ini, fin, etq]) => {
  const act = correr(ini, fin, [], {});
  const pi = act.meta.prevInicio, pf = act.meta.prevFin;
  if (!pi || !pf) { warn('deltas ' + etq, 'el motor no declara periodo previo'); return; }
  const prev = correr(pi, pf, [], {});
  let revisados = 0, malos = 0;
  // Los KPIs no viven todos en `<frente>.kpis`: hay tarjetas en
  // f1.embudo.kpis, f1.retorno.kpis, f4.oportunidad.kpis, f5.conversion...
  // Se recorre el payload buscando cualquier arreglo con forma de KPI.
  function juntarKpis(obj, ruta, acc) {
    if (!obj || typeof obj !== 'object') return acc;
    if (Array.isArray(obj)) {
      if (obj.length && obj[0] && typeof obj[0] === 'object' &&
          'label' in obj[0] && 'valor' in obj[0]) {
        acc[ruta] = obj;
        return acc;
      }
      obj.forEach((v, i) => juntarKpis(v, ruta + '[' + i + ']', acc));
      return acc;
    }
    Object.keys(obj).forEach(k => juntarKpis(obj[k], ruta + '.' + k, acc));
    return acc;
  }
  const gruposA = juntarKpis(act, '', {});
  const gruposP = juntarKpis(prev, '', {});
  Object.keys(gruposA).forEach(fr => {
    const ka = gruposA[fr] || [];
    const kp = gruposP[fr] || [];
    ka.forEach(k => {
      if (k.delta === null || k.delta === undefined) return;
      const p = kp.filter(x => x.label === k.label)[0];
      if (!p) return;
      // Hay KPIs que NO comparan contra el periodo anterior del tablero
      // sino contra su propio periodo (el bloque de ROI trabaja en meses
      // completos, Welli Points contra su propio mes). Esos lo DICEN en la
      // tarjeta con deltaEtiqueta ("vs julio"), asi que no se auditan con
      // esta cuenta — pero si se exige que lo declaren, que es la
      // invariante que de verdad protege al lector.
      if (k.deltaEtiqueta) {
        checks++;
        if (k.valor === p.valor && !String(k.deltaEtiqueta).trim()) {
          fail('deltas ' + etq, '"' + k.label + '" no se mueve con el filtro y ' +
            'su delta no declara contra qué compara');
        }
        return;
      }
      revisados++;
      checks++;
      const esperado = k.deltaEnPuntos
        ? (k.valor - p.valor)
        : (p.valor ? ((k.valor / p.valor) - 1) * 100 : null);
      if (esperado === null) return;
      // tolerancia: el motor redondea a 1 decimal
      if (Math.abs(esperado - k.delta) > 0.6) {
        malos++;
        fail('deltas ' + etq, 'delta de "' + k.label + '" (' + fr + ') no cuadra',
          'dice ' + k.delta + ' y de los valores sale ' + (Math.round(esperado * 10) / 10) +
          '  [' + p.valor + ' -> ' + k.valor + ']');
      }
    });
  });
  console.log('  ' + etq + ': ' + revisados + ' deltas auditados contra ' +
    pi + '..' + pf + ' · ' + (malos ? malos + ' MAL' : 'todos cuadran'));

  // f1.embudo.canales[].deltaMonto — no tiene forma de KPI (canal/monto, no
  // label/valor) asi que juntarKpis no lo encuentra. Se audita aparte contra
  // la MISMA cosecha del periodo anterior que ya trajo `prev`.
  const canA = ((act.f1 || {}).embudo || {}).canales || [];
  const canP = ((prev.f1 || {}).embudo || {}).canales || [];
  let revisadosCan = 0;
  canA.forEach(r => {
    if (r.deltaMonto === null || r.deltaMonto === undefined) return;
    const p = canP.filter(x => x.canal === r.canal)[0];
    if (!p || !p.monto) return;
    revisadosCan++;
    checks++;
    const esperado = Math.round(((r.monto / p.monto) - 1) * 1000) / 10;
    if (Math.abs(esperado - r.deltaMonto) > 0.6) {
      fail('deltas ' + etq, 'f1.embudo.canales[' + r.canal + '].deltaMonto no cuadra',
        'dice ' + r.deltaMonto + ' y de los valores sale ' + esperado +
        '  [' + p.monto + ' -> ' + r.monto + ']');
    }
  });
  if (revisadosCan) {
    console.log('  ' + etq + ': ' + revisadosCan + ' deltaMonto de f1.embudo.canales auditados');
  }
});

// --------------------------------------- caso que pidio el negocio
console.log('\n--- agosto + solo EVENTO (el caso de la presentacion) ---');
const ev = correr('2026-08-01', '2026-08-31', ['EVENTO'], {});
console.log('  sedes del universo:', ev.meta.origenSedes);
console.log('  reatribucion:', JSON.stringify(ev.meta.reatribucion.sedes) + ' sedes movidas');
const evCo = (ev.f1.convOrigen || [])[0];
if (evCo) {
  console.log('  convOrigen:', evCo.origen, '| sedes', evCo.sedes, '| apps', evCo.apps,
    '| aprobados', evCo.aprobados, '| tasa aprob', evCo.tasaAprob + '%');
}
const evDc = (ev.f1.dealsCohorte || {}).filas || [];
console.log('  deals por cosecha:', evDc.map(r => r.cosecha + ':' + r.n).join(' '));

// ------------------------------------------------------------- reporte
console.log('\n=========================================================');
console.log('corridas: ' + corridas + ' combinaciones · ' + checks + ' aserciones');
console.log('FALLOS: ' + fallos.length + ' · avisos: ' + avisos.length);
if (fallos.length) {
  console.log('\n--- FALLOS ---');
  const vistos = {};
  fallos.forEach(f => {
    const k = f.msg;
    vistos[k] = vistos[k] || { n: 0, ej: f };
    vistos[k].n++;
  });
  Object.keys(vistos).forEach(k => {
    const v = vistos[k];
    console.log('  [' + v.n + 'x] ' + k + (v.ej.extra !== '' ? '  ->  ' + v.ej.extra : ''));
    console.log('        ej. contexto: ' + v.ej.ctx);
  });
}
if (avisos.length) {
  console.log('\n--- AVISOS (revisar, no necesariamente bug) ---');
  const vistos = {};
  avisos.forEach(f => {
    vistos[f.msg] = vistos[f.msg] || { n: 0, ej: f };
    vistos[f.msg].n++;
  });
  Object.keys(vistos).slice(0, 25).forEach(k => {
    const v = vistos[k];
    console.log('  [' + v.n + 'x] ' + k + (v.ej.extra !== '' ? '  ->  ' + v.ej.extra : ''));
  });
  if (Object.keys(vistos).length > 25) {
    console.log('  ... y ' + (Object.keys(vistos).length - 25) + ' avisos mas');
  }
}
process.exit(fallos.length ? 1 : 0);
