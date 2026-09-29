/* =====================================================================
   FRENTE 2 · PROFUNDIZACION
   Cinco mapas de cohorte y nada mas. La historia, en este orden:

     1. ACTIVAS     ¿arrancan?            >= 1 solicitud
     2. EXITOSAS    ¿arrancan de verdad?  >= 3 solicitudes o >= 1 desembolso
     3. INACTIVAS   ¿se enfrian?          30+ dias sin radicar
     4. DESEMBOLSOS ¿cuanta plata dejan?  numero y COP
     5. MUERTAS     ¿cuantas se pierden?  mas de 90 dias sin radicar

   Los tres primeros y el quinto son ACUMULADOS de estado al cierre del mes
   N despues de la cosecha. Activas y exitosas solo suben (una sede que ya
   radico no puede des-radicar). Inactivas y muertas NO son acumuladas: son
   una foto del estado a ese mes, asi que pueden bajar si la sede vuelve.

   Denominador de todos: las sedes de la cosecha que se pueden cruzar por
   id_internal contra la plataforma. Las de HubSpot sin id_internal no
   entran porque no hay llave para saber si aplicaron; van declaradas.

   Inactiva y muerta se miden SOLO sobre las que alguna vez radicaron: una
   sede que nunca radico no se "enfrio", nunca arranco, y eso ya lo dice el
   mapa 1. Si se contaran ahi, inactivas seria casi igual al total y el mapa
   no diria nada.
   ===================================================================== */
function armarF2_(R, ev, cfg, U) {
  var f = {};
  var MAXM = 7;
  var hoyMes = hoyISO_().substring(0, 7);

  function mesMasF2_(c, k) {
    if (!/^\d{4}-\d{2}$/.test(String(c || ''))) return '';
    var t = Number(c.substring(0, 4)) * 12 + (Number(c.substring(5, 7)) - 1) + k;
    return ('0000' + Math.floor(t / 12)).slice(-4) + '-' + ('0' + (t % 12 + 1)).slice(-2);
  }

  // ---- Cosechas del universo elegido -------------------------------
  // U.filas ya viene cortado por el filtro global de origen y por la regla
  // del universo acordada con BI.
  var cos = {};                       // cosecha -> { ids:[], total, sinId }
  var sinIdTot = 0;
  U.filas.forEach(function (s) {
    var c = String(s.cosecha || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(c) || esCargaInicial_(c)) return;
    if (!cos[c]) cos[c] = { cosecha: c, ids: [], total: 0, sinId: 0 };
    var b = cos[c];
    b.total++;
    var id = String(s.id_internal || '').trim();
    if (id) b.ids.push(id);
    else { b.sinId++; sinIdTot++; }
  });

  // ---- Estado de cada sede al cierre de cada mes --------------------
  var em = leerHoja_('SEDE_ESTADO_MES');
  var estado = {};                    // mes -> id -> fila
  em.forEach(function (r) {
    var m = String(r.mes || '').substring(0, 7);
    if (!estado[m]) estado[m] = {};
    estado[m][String(r.id_sede || '').trim()] = r;
  });

  var cosechas = Object.keys(cos).sort();

  /** Construye un mapa: para cada cosecha, el valor en M0..M7.
      medir(fila, ids) recibe el estado del mes y devuelve {n, extra}. */
  function mapa_(medir) {
    return cosechas.map(function (c) {
      var b = cos[c];
      var celdas = [], extras = [];
      for (var k = 0; k <= MAXM; k++) {
        var m = mesMasF2_(c, k);
        if (!m || m > hoyMes) { celdas.push(null); extras.push(null); continue; }
        var idx = estado[m] || {};
        var v = medir(idx, b.ids);
        celdas.push(v.n);
        extras.push(v.extra === undefined ? null : v.extra);
      }
      return { cosecha: c, n: b.total, sinId: b.sinId,
               cruzables: b.ids.length, celdas: celdas, extras: extras };
    }).filter(function (r) { return r.n > 0; });
  }

  function contar_(idx, ids, cond) {
    var n = 0;
    ids.forEach(function (id) {
      var r = idx[id];
      if (r && cond(r)) n++;
    });
    return { n: n };
  }

  // 1 · ACTIVAS -------------------------------------------------------
  var mActivas = mapa_(function (idx, ids) {
    return contar_(idx, ids, function (r) { return num_(r.apps_acum) >= 1; });
  });

  // 2 · EXITOSAS ------------------------------------------------------
  var mExitosas = mapa_(function (idx, ids) {
    return contar_(idx, ids, function (r) {
      return num_(r.apps_acum) >= 3 || num_(r.des_acum) >= 1;
    });
  });

  // 3 · INACTIVAS -----------------------------------------------------
  var mInactivas = mapa_(function (idx, ids) {
    return contar_(idx, ids, function (r) {
      var d = num_(r.dias_sin_app);
      return num_(r.apps_acum) >= 1 && d >= 30 && d <= 90;
    });
  });

  // 4 · DESEMBOLSOS ---------------------------------------------------
  // Dos numeros por celda: cuantos desembolsos y cuanta plata. El % no
  // aplica aca, la plata es la unidad.
  var mDesembolsos = mapa_(function (idx, ids) {
    var n = 0, monto = 0;
    ids.forEach(function (id) {
      var r = idx[id];
      if (!r) return;
      n += num_(r.des_acum);
      monto += num_(r.monto_acum);
    });
    return { n: n, extra: monto };
  });

  // 5 · MUERTAS -------------------------------------------------------
  var mMuertas = mapa_(function (idx, ids) {
    return contar_(idx, ids, function (r) {
      return num_(r.apps_acum) >= 1 && num_(r.dias_sin_app) > 90;
    });
  });

  /** Titular de un mapa: la ultima celda cerrada de la cosecha mas madura
      con al menos 20 sedes, para no titular con una muestra de 3. */
  function ultimo_(filas) {
    var mejor = null;
    filas.forEach(function (r) {
      if (r.n < 20) return;
      for (var k = r.celdas.length - 1; k >= 0; k--) {
        if (r.celdas[k] !== null) {
          if (!mejor || k > mejor.k) mejor = { cosecha: r.cosecha, k: k, n: r.celdas[k], de: r.n };
          break;
        }
      }
    });
    return mejor;
  }

  f.mapas = [
    { id: 'activas', orden: 1,
      titulo: 'Las que arrancan',
      pregunta: '¿Cuántas de la cosecha llegaron a radicar al menos una solicitud?',
      sub: 'Acumulado: al mes N después de entrar, cuántas ya habían radicado. Solo sube.',
      def: 'activa = al menos 1 solicitud de crédito',
      formato: 'num', clase: 'acum', escala: '% de la cosecha ya activa',
      colN: 'Sedes', pctCelda: true, filas: mActivas, ultimo: ultimo_(mActivas) },

    { id: 'exitosas', orden: 2,
      titulo: 'Las que arrancan de verdad',
      pregunta: '¿Cuántas pasaron de probar el sistema a usarlo?',
      sub: 'Acumulado. Con una sola solicitud no se distingue una sede que arrancó ' +
        'de una que probó una vez.',
      def: 'exitosa = 3 o más solicitudes, o al menos 1 desembolso',
      formato: 'num', clase: 'acum', escala: '% de la cosecha ya exitosa',
      colN: 'Sedes', pctCelda: true, filas: mExitosas, ultimo: ultimo_(mExitosas) },

    { id: 'inactivas', orden: 3,
      titulo: 'Las que se enfrían',
      pregunta: '¿Cuántas dejaron de radicar y todavía se pueden recuperar?',
      sub: 'Foto del estado a ese mes, NO acumulado: puede bajar si la sede vuelve. ' +
        'Solo cuenta sedes que alguna vez radicaron.',
      def: 'inactiva = entre 30 y 90 días sin radicar',
      formato: 'num', clase: 'riesgo', escala: '% de la cosecha inactiva',
      colN: 'Sedes', pctCelda: true, filas: mInactivas, ultimo: ultimo_(mInactivas) },

    { id: 'desembolsos', orden: 4,
      titulo: 'La plata que deja cada cosecha',
      pregunta: '¿Cuánto crédito ha originado la cosecha al mes N?',
      sub: 'Acumulado de desembolsos y de COP. Es el argumento de por qué una cosecha ' +
        'vale más que su mes de entrada.',
      def: 'desembolsos y plata acumulados de todas las sedes de la cosecha',
      formato: 'num', clase: 'acum', escala: 'desembolsos acumulados',
      colN: 'Sedes', pctCelda: false, conMonto: true,
      filas: mDesembolsos, ultimo: ultimo_(mDesembolsos) },

    { id: 'muertas', orden: 5,
      titulo: 'Las que se pierden',
      pregunta: '¿Cuántas ya no vuelven?',
      sub: 'Foto del estado a ese mes. Más de 90 días sin radicar es el umbral de la ' +
        'casa para dar una sede por perdida.',
      def: 'muerta = más de 90 días sin radicar',
      formato: 'num', clase: 'muerte', escala: '% de la cosecha muerta',
      colN: 'Sedes', pctCelda: true, filas: mMuertas, ultimo: ultimo_(mMuertas) }
  ];

  f.hay = cosechas.length > 0;
  f.universo = U.etiqueta;
  f.sinId = sinIdTot;
  f.cosechas = cosechas.length;
  f.offsets = MAXM;
  f.notaCarga = 'Se excluye la cosecha ' + COSECHA_CARGA_INICIAL +
    ': ahí se cargó la base histórica a HubSpot de un golpe.';

  f.textos = { funcionando: cfg.f2_funcionando || '', cuello: cfg.f2_cuello || '',
               atencion: cfg.f2_atencion || '', fecha: cfg.textos_fecha || '' };
  return f;
}
