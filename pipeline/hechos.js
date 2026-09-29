/* =====================================================================
   LA TABLA DE HECHOS
   CREDITO_DIA trae los creditos por sede y por dia. Todo lo que antes venia
   pre-agregado por origen o por owner sale de aca, y el filtro se aplica
   sobre los ATRIBUTOS DE LA SEDE. Asi cualquier filtro nuevo — un rol mas,
   una ventana, una clase — funciona sin volver a agregar nada.

   La sede viene como indice compacto y la fecha como dias desde 2025-01-01:
   sobre 116 mil filas eso son 2 MB menos de artefacto. CREDITO_SEDES trae el
   indice, y sale de la misma pasada que los hechos, asi que no se desincroniza.
   ===================================================================== */
var DIA_BASE = Date.UTC(2025, 0, 1);
var _HECHOS = null;

/** Los hechos con la sede ya resuelta a su llave de HubSpot y la fecha a ISO.
    Se cachea por ejecucion: son 116 mil filas y se recorren varias veces. */
function hechos_() {
  if (_HECHOS) return _HECHOS;
  var idx = [];
  leerHoja_('CREDITO_SEDES').forEach(function (r) {
    idx[num_(r.i)] = String(r.sede || '').trim();
  });
  _HECHOS = leerHoja_('CREDITO_DIA').map(function (r) {
    var d = num_(r.d);
    return {
      sede: idx[num_(r.s)] || '',
      fecha: new Date(DIA_BASE + d * 86400000).toISOString().substring(0, 10),
      sol: num_(r.sol), apr: num_(r.apr), conv: num_(r.conv),
      mApr: num_(r.m_apr), mConv: num_(r.m_conv)
    };
  });
  return _HECHOS;
}

/** Los atributos de cada sede que sirven para cortar los hechos: cosecha,
    origen y ventana de decision. Se arma una vez desde la hoja SEDES. */
var _ATRIB = null;
function atribSede_(U) {
  if (_ATRIB) return _ATRIB;
  _ATRIB = {};
  leerHoja_('SEDES').forEach(function (s) {
    var hs = String(s.id || '').trim();
    if (!hs) return;
    var interno = String(s.id_internal || '').trim();
    _ATRIB[hs] = {
      cosecha: String(s.cosecha || '').substring(0, 7),
      origen: normOrigen_(s.origen),
      ventana: ventanaDeEsp_((U.especialidadDe || {})[interno] || '').id
    };
  });
  return _ATRIB;
}

/** Recorre los hechos aplicando el filtro global y el rango, y agrega con la
    funcion que se le pase. El filtro es un lookup por sede — se evalua una
    vez por sede en universoSedes_, no una vez por fila. */
function recorrerHechos_(U, desde, hasta, cb) {
  var permitido = U.idsHS;
  var libre = U.sinFiltro;
  hechos_().forEach(function (r) {
    if (r.fecha < desde || r.fecha > hasta) return;
    if (!libre && !permitido[r.sede]) return;
    cb(r);
  });
}
