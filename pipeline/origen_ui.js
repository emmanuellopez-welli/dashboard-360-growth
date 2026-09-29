/* =====================================================================
   Filtro global de origen de sede
   Aplica a Profundizacion, Rescate y Welli Points. Adquisicion no se
   filtra: por definicion mide lo que trae marketing.
   La lista de origenes NO esta escrita a mano: sale del catalogo que
   devuelve el servidor, asi que si HubSpot gana un origen nuevo aparece
   solo en el selector.
   ===================================================================== */
var ORIGENES_SEL = [];      // vacio = todos
var CATALOGO_ORIG = [];
var PRESETS_ORIG = {};
var ETIQ_PRESET = {};

var ORDEN_GRUPO = ['marketing', 'comercial', 'alianzas', 'otros', 'sin_origen'];
var NOMBRE_GRUPO = {
  marketing: 'Marketing', comercial: 'Equipo comercial',
  alianzas: 'Alianzas y marcas', otros: 'Otros', sin_origen: 'Sin origen'
};

function mismosOrigenes(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) < 0) return false;
  return true;
}

function etiquetaOrigen() {
  if (!ORIGENES_SEL.length) return 'Todos los orígenes';
  var claves = Object.keys(PRESETS_ORIG);
  for (var i = 0; i < claves.length; i++) {
    var k = claves[i];
    if (k === 'todos') continue;
    if (mismosOrigenes(PRESETS_ORIG[k] || [], ORIGENES_SEL)) {
      return ETIQ_PRESET[k] || k;
    }
  }
  if (ORIGENES_SEL.length === 1) return ORIGENES_SEL[0];
  return ORIGENES_SEL.length + ' orígenes';
}

/** Clave de payload para la vista previa estatica. */
function clavePreset(orig) {
  if (!orig || !orig.length) return 'todos';
  var claves = Object.keys(PRESETS_ORIG);
  for (var i = 0; i < claves.length; i++) {
    var k = claves[i];
    if (k === 'todos') continue;
    if (mismosOrigenes(PRESETS_ORIG[k] || [], orig)) return k;
  }
  return 'libre';
}

/** Pinta el panel. Se llama cada vez que llegan datos nuevos. */
function pintarPanelOrigen() {
  var pres = document.getElementById('poPresets');
  var lista = document.getElementById('poLista');
  if (!pres || !lista) return;

  pres.innerHTML = Object.keys(PRESETS_ORIG).map(function (k) {
    var sel = (k === 'todos')
      ? ORIGENES_SEL.length === 0
      : mismosOrigenes(PRESETS_ORIG[k] || [], ORIGENES_SEL);
    return '<button class="po-preset" type="button" data-preset="' + esc(k) + '"' +
      ' aria-pressed="' + (sel ? 'true' : 'false') + '">' +
      esc(ETIQ_PRESET[k] || k) + '</button>';
  }).join('');

  var porGrupo = {};
  CATALOGO_ORIG.forEach(function (o) {
    var g = o.grupo || 'otros';
    if (!porGrupo[g]) porGrupo[g] = [];
    porGrupo[g].push(o);
  });
  var h = '';
  ORDEN_GRUPO.forEach(function (g) {
    var arr = porGrupo[g];
    if (!arr || !arr.length) return;
    h += '<div class="po-grupo">' + esc(NOMBRE_GRUPO[g] || g) + '</div>';
    arr.forEach(function (o) {
      var marcado = ORIGENES_SEL.indexOf(o.origen) >= 0;
      h += '<label class="po-item"><input type="checkbox" value="' + esc(o.origen) + '"' +
        (marcado ? ' checked' : '') + '>' +
        '<span>' + esc(o.origen) + '</span>' +
        '<span class="po-n">' + fNum(o.sedes) + '</span></label>';
    });
  });
  lista.innerHTML = h;

  var txt = document.getElementById('btnOrigenTxt');
  if (txt) txt.textContent = etiquetaOrigen();
}

function leerChecksOrigen() {
  var ins = document.querySelectorAll('#poLista input[type=checkbox]');
  var out = [];
  for (var i = 0; i < ins.length; i++) if (ins[i].checked) out.push(ins[i].value);
  // Si estan todos marcados es lo mismo que "todos": se guarda vacio para
  // que el servidor no compare 24 cadenas en cada fila.
  if (out.length === CATALOGO_ORIG.length) return [];
  return out;
}

function abrirPanelOrigen(abrir) {
  var p = document.getElementById('panelOrigen');
  var b = document.getElementById('btnOrigen');
  if (!p || !b) return;
  var visible = !p.classList.contains('oculto');
  var q = (abrir === undefined) ? !visible : abrir;
  p.classList.toggle('oculto', !q);
  b.setAttribute('aria-expanded', q ? 'true' : 'false');
}

function montarFiltroOrigen() {
  var btn = document.getElementById('btnOrigen');
  var panel = document.getElementById('panelOrigen');
  if (!btn || !panel) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    abrirPanelOrigen();
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { abrirPanelOrigen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') abrirPanelOrigen(false);
  });

  document.getElementById('poPresets').addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== panel && !t.getAttribute('data-preset')) t = t.parentNode;
    if (!t || t === panel) return;
    var k = t.getAttribute('data-preset');
    ORIGENES_SEL = (k === 'todos') ? [] : (PRESETS_ORIG[k] || []).slice();
    pintarPanelOrigen();
  });
  document.getElementById('poLista').addEventListener('change', function () {
    ORIGENES_SEL = leerChecksOrigen();
    var txt = document.getElementById('btnOrigenTxt');
    if (txt) txt.textContent = etiquetaOrigen();
  });
  document.getElementById('poNada').addEventListener('click', function () {
    ORIGENES_SEL = [];
    pintarPanelOrigen();
  });
  document.getElementById('poListo').addEventListener('click', function () {
    ORIGENES_SEL = leerChecksOrigen();
    abrirPanelOrigen(false);
    cargar();
  });
}

/** Cinta que recuerda el universo activo. Solo en los frentes filtrables. */
function cintaOrigen() {
  var m = (D && D.meta) || {};
  if (m.origenTodos) {
    return '<div class="cinta-origen">Todos los orígenes · <b>' +
      fNum(m.origenSedes || 0) + '</b> sedes</div>';
  }
  return '<div class="cinta-origen">' + esc(m.origenEtiqueta || '') + ' · <b>' +
    fNum(m.origenSedes || 0) + '</b> de ' + fNum(m.origenSedesBase || 0) + ' sedes</div>';
}
