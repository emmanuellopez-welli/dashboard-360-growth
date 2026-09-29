# Tablero 360 Growth — WELLI · Guía de despliegue

Objetivo: dejar el tablero publicado como una **web app con un link fijo** que
puedas pasarle a tu jefa y al equipo, y que se actualice sola todos los días a
las 6:00 AM hora Colombia.

Tiempo estimado: **35–45 minutos** la primera vez.

---

## Lo que ya está hecho

| Pieza | Estado |
|---|---|
| Google Sheet de datos, 26 hojas | ✅ creado y poblado |
| Datos de HubSpot (3.601 sedes, 19.772 eventos fechados) | ✅ cargados |
| Datos de Hilos (850 broadcasts, 17 flows, 2023-06 → 2026-08) | ✅ cargados |
| Código de Apps Script (11 archivos) | ✅ escrito y probado |
| Queries de BigQuery (conversión, revenue, rescate, Welli Points) | ✅ escritas |
| Vista previa navegable | ✅ publicada |
| Credenciales en el proyecto de Apps Script | ⏳ **te toca** |
| Despliegue de la web app | ⏳ **te toca** |
| Token de Meta Ads | ⏳ **te toca** (está bloqueado) |
| Acceso de lectura a BigQuery | ⏳ **te toca** |

**Google Sheet:**
`https://docs.google.com/spreadsheets/d/1RaBqmQvA2szRI0Nd6qPvKE8VGNsq6O7jS3lKCdERqIo/edit`

---

## Paso 1 · Crear el proyecto de Apps Script (3 min)

1. Abre el Google Sheet del link de arriba con tu cuenta
   `emmanuel.lopez@welli.com.co`.
2. Menú **Extensiones → Apps Script**. Se abre un proyecto vacío vinculado al
   Sheet.
3. Arriba a la izquierda, cámbiale el nombre a **Tablero 360 Growth WELLI**.

> Vincularlo al Sheet no es obligatorio (el código abre el Sheet por ID), pero
> hace que los permisos de Drive se resuelvan solos.

---

## Paso 2 · Pegar los archivos (10 min)

En el editor, el archivo `Código.gs` que viene por defecto se puede borrar al
final. Crea los archivos en este orden:

### Archivos de script (botón `+` → Secuencia de comandos)

Nombra cada uno **exactamente así** (sin la extensión `.gs`, el editor la pone):

| Nombre en el editor | Archivo de esta carpeta |
|---|---|
| `Config` | `Config.gs` |
| `Filtro_Origen` | `Filtro_Origen.gs` |
| `Code` | `Code.gs` |
| `Fuentes_HubSpot` | `Fuentes_HubSpot.gs` |
| `Fuentes_MetaAds` | `Fuentes_MetaAds.gs` |
| `Fuentes_BigQuery` | `Fuentes_BigQuery.gs` |
| `Fuentes_Hilos` | `Fuentes_Hilos.gs` |
| `Refresh` | `Refresh.gs` |
| `Alertas_Sedes` | `Alertas_Sedes.gs` |

### Archivos HTML (botón `+` → HTML)

| Nombre en el editor | Archivo de esta carpeta |
|---|---|
| `dashboard` | `dashboard.html` |
| `styles` | `styles.html` |
| `scripts` | `scripts.html` |

Copia y pega el contenido completo de cada archivo. Borra lo que el editor
ponga por defecto en los HTML antes de pegar.

### El logo

En `dashboard.html` hay un marcador `__LOGO_B64__`. Reemplázalo por el
contenido de **`logo_base64.txt`** (está en esta misma carpeta): es el logo de
WELLI en base64, así el tablero no depende de ninguna imagen externa.

Busca esta línea:

```html
<img src="data:image/png;base64,__LOGO_B64__" alt="WELLI">
```

y deja el base64 pegado en lugar de `__LOGO_B64__`.

---

## Paso 3 · Activar el servicio de BigQuery (1 min)

En el panel izquierdo, junto a **Servicios**, dale al `+`:

1. Busca **BigQuery API**.
2. Identificador: déjalo en `BigQuery`.
3. **Agregar**.

Sin esto, las funciones de BigQuery fallan con "BigQuery is not defined".

---

## Paso 4 · Guardar las credenciales (5 min)

1. Corre la función **`setupPropiedades`** una vez (selecciónala arriba y dale
   *Ejecutar*). Te va a pedir autorizar el proyecto: acepta.
2. Ve a **⚙ Configuración del proyecto → Propiedades del script → Editar
   propiedades**. Vas a ver tres llaves vacías. Llénalas:

| Propiedad | De dónde sale |
|---|---|
| `HUBSPOT_TOKEN` | HubSpot → Configuración → Integraciones → **Private Apps** → crear app con los scopes de abajo → copiar el token |
| `HILOS_API_KEY` | está en el archivo `.env` de la carpeta del proyecto, como `HILOS_API_KEY` |
| `META_ACCESS_TOKEN` | ver **Paso 8**, hoy está bloqueado |

**Scopes que necesita la Private App de HubSpot:**

- `crm.objects.custom.read` ← el importante, es el objeto Sedes
- `crm.schemas.custom.read`
- `crm.objects.contacts.read`
- `crm.objects.deals.read`

> Nunca pegues estos tokens en el código ni en el Sheet. Solo en Propiedades
> del script.

---

## Paso 5 · Diagnóstico (2 min)

Corre la función **`diagnostico`** y abre el registro de ejecución
(*Ver → Registros*). Te dice, fuente por fuente, qué está listo:

```
-- Credenciales en Script Properties --
  META_ACCESS_TOKEN: FALTA
  HUBSPOT_TOKEN: configurada
  HILOS_API_KEY: configurada
-- Fuentes --
  HubSpot: OK, 3601 sedes
  Hilos: OK, 850 broadcasts
  Meta Ads: FALLO API access blocked
  BigQuery welli-tecnologia: OK
  BigQuery welli-growth: OK, tablas: wp_incentivos_diario, ...
```

Arregla lo que salga en FALLO y vuelve a correrlo hasta que estés conforme.
**No hace falta que todo esté en OK para desplegar**: el tablero muestra un
badge explicando qué falta en cada tarjeta sin fuente.

---

## Paso 6 · Desplegar la web app y sacar el link (5 min)

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. Icono de engranaje → tipo **Aplicación web**.
3. Configura:
   - **Descripción:** `Tablero 360 Growth v1`
   - **Ejecutar como:** *Yo* (`emmanuel.lopez@welli.com.co`)
   - **Quién tiene acceso:** *Cualquier usuario de WELLI* — así tu jefa y el
     equipo entran con su cuenta corporativa sin que tú tengas que compartirles
     el Sheet.
4. **Implementar** → copia la **URL de la aplicación web**. Ese es el link que
   compartes. Termina en `/exec`.

### Importante sobre "Ejecutar como: Yo"

El tablero corre con **tus** permisos, así que quien abra el link ve los datos
sin necesitar acceso a HubSpot, a BigQuery ni al Sheet. La contraparte es que
cualquiera con el link (dentro de WELLI) ve todo: no hay permisos por frente.

### Cuando cambies el código

**Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva →
Implementar.** Si en vez de eso creas una implementación nueva, el link cambia
y tu equipo se queda con el viejo.

Se puede compartir un frente directo agregando el ancla al final:
`.../exec#f4` abre en Rescate. Anclas válidas: `#resumen`, `#f1`, `#f2`, `#f4`,
`#f5`, `#f6`.

---

## Paso 7 · Programar la actualización diaria (1 min)

Corre la función **`crearTriggerDiario`** una vez. Deja programado
`refreshAll` todos los días a las 6:00 AM hora Colombia.

Para verificar: **⏰ Activadores** en el panel izquierdo.

Si quieres refrescar ya mismo, corre **`refreshAll`** a mano. Tarda entre 2 y 4
minutos (las 3.601 sedes de HubSpot son 37 páginas de API). Cada fuente corre
aislada: si Meta falla, HubSpot igual se actualiza, y lo que pasó queda en la
hoja `_LOG` del Sheet — que es de donde el tablero saca los semáforos del panel
"Estado".

---

## Paso 8 · Arreglar Meta Ads (10 min)

Hoy la API responde:

```
{"error":{"message":"API access blocked","type":"OAuthException","code":200}}
```

Eso no es un token vencido, es acceso bloqueado a nivel de app o de cuenta
publicitaria. Ruta para resolverlo:

1. Entra a **business.facebook.com** con el usuario admin del Business Manager
   de WELLI.
2. Revisa si hay alguna restricción activa en **Calidad de la cuenta**
   (`business.facebook.com/accountquality`). Si la cuenta publicitaria está
   restringida, hay que apelar ahí primero: ningún token va a funcionar hasta
   que se levante.
3. Si la cuenta está sana, genera un **System User Token**:
   - **Configuración del negocio → Usuarios → Usuarios del sistema**
   - Crea o elige un usuario del sistema con rol de administrador
   - **Agregar activos** → la cuenta publicitaria `act_1373974740859060`
   - **Generar token nuevo** → app de WELLI → permisos `ads_read` y
     `business_management`
   - Marca **sin caducidad** (los System User Tokens no expiran; los de usuario
     sí, a los 60 días)
4. Pega el token en la propiedad `META_ACCESS_TOKEN`.
5. Corre **`probarMetaAds`** y mira los registros. Si ves el nombre de la
   cuenta y `COP`, ya está.
6. Corre **`refreshMetaAds`** y luego recarga el tablero: las cinco tarjetas de
   F1 se llenan.

**Ojo con los leads.** El código suma solo `action_type == 'lead'`. No sumes
`lead_grouped` ni `offsite_conversion.*_add_meta_leads`: son el mismo lead
contado otra vez y duplican la cifra. El CPL es derivado (`gasto / leads`),
Meta no lo entrega. Y `ctr` viene ya en porcentaje: `2.07` significa 2,07%.

---

## Paso 9 · Arreglar BigQuery (5 min)

Son **tres** proyectos distintos:

| Proyecto | Dataset | Para qué | Job se crea en |
|---|---|---|---|
| `welli-tecnologia` | `public` | conversión, revenue, rescate | sí mismo |
| `welli-data` | `data_ops` | cosechas, plata firmada, embudo | sí mismo |
| `welli-growth` | `wp_data` | Welli Points (F5) | **`welli-data`** |

El servicio avanzado de BigQuery corre con **tu** cuenta de Google, no con una
cuenta de servicio. Y ahí está la trampa de `welli-growth`: la cuenta **sí puede
leer** el dataset `wp_data`, pero **no tiene `bigquery.jobs.create` en el
proyecto**. Crear el job ahí devuelve:

```
403 Access Denied: Project welli-growth:
User does not have bigquery.jobs.create permission in project welli-growth.
```

Eso NO es falta de acceso a los datos. La solución no es pedir permisos: es
crear el job en un proyecto donde sí se puede (`welli-data`) y dejar el `FROM`
totalmente calificado (`welli-growth.wp_data.tabla`). Es lo que hace
`refreshWelliPoints()`, que pasa `BQ_PROJECT_DATA` a `bq_()` aunque consulte
tablas de `welli-growth`.

Si algún día alguien otorga `roles/bigquery.jobUser` en `welli-growth`, el
código sigue funcionando igual — no hay que cambiar nada.

Corre **`probarBigQuery`**: te lista las tablas de `welli-growth.wp_data`.

### F5 (Welli Points) — ya está cerrado

`refreshWelliPoints()` escribe cuatro hojas desde `welli-growth.wp_data`:

| Hoja | De dónde | Qué contiene |
|---|---|---|
| `WP_SERIE` | `wp_incentivos_diario` | por mes: sedes, WP ofrecidos, WP ganados, conversión |
| `WP_INCENTIVO` | `wp_incentivos_diario` | por incentivo: sedes, ganadores, vigentes, vencidos |
| `WP_CANJES` | `wp_canjeos_solicitados` | cada solicitud de canje con su estado y días de espera |
| `WP_KPI2` | las tres anteriores + `wellipoints_snapshot` | los números de una sola fila |

Dos cosas del dato que hay que respetar al tocar esas queries:

1. **`wp_ofrecido_mes` y `wp_ganado_mes` son acumulados DEL MES.** La tabla es un
   snapshot diario, así que sumar los días multiplica todo. Hay que tomar el
   último snapshot de cada mes por sede — eso es lo que hacen las CTE `WP_ULT_MES`
   y `WP_ULT_HOY`.
2. **`WP_ULT_HOY` cuenta sedes que ya salieron del programa.** Da 2.077 contra las
   1.909 del cierre de agosto. El tablero muestra la del mes y menciona la otra
   en el sublabel, porque dos totales distintos sin explicación se leen como error.

`inspeccionarWP()` sigue ahí para listar esquemas si aparecen tablas nuevas.

---

## El filtro global de origen

El tablero es **360**: por defecto muestra las 3.603 sedes de todos los
orígenes. El selector "Origen de la sede" del encabezado corta
**Profundización, Rescate y Welli Points** por cualquier combinación de los 24
orígenes que trae HubSpot.

**Los cuatro frentes filtran**, incluido Adquisición. La única excepción es la
**pauta de Meta**: un anuncio no pertenece a un origen de sede, así que leads,
CPL, gasto, impresiones y CTR se quedan globales y el subtítulo lo dice. Todo
lo demás de Adquisición (participación en sedes nuevas, cosechas, los tres
mapas de calor y el embudo de crédito) sí responde al filtro.

Los presets salen de `PRESETS_ORIGEN` en `Filtro_Origen.gs`:

| Preset | Orígenes | Sedes |
|---|---|---|
| Todos los orígenes | — | 3.603 |
| Marketing | EVENTO, REFERIDO, PAGINA WEB, SOCIAL MEDIA | 596 |
| Equipo comercial | FARMER, HUNTER, HUNTER EXT, PROSPECCION, FREELANCE, EMPLEADO | 827 |
| Alianzas y marcas | DT DENTAL, DENTALINK, OK VET, STARKEY, BOSTON, INVISALIGN, ESSILOR, NOVO NORDISK, CREDITOP, PAGUI, ANDREC, PREMIUM | 486 |
| Sin origen registrado | (SIN ORIGEN) | 1.693 |

**La lista de orígenes no está escrita a mano en el frontend**: sale de
`catalogoOrigenes_()`, que la deriva de la hoja SEDES. Si HubSpot gana un
origen nuevo aparece solo en el selector, sin tocar código. Lo único que hay
que mantener a mano es a qué preset pertenece, en `PRESETS_ORIGEN`.

El preset **Marketing** es exactamente los cuatro orígenes que usa Adquisición
(`ORIGENES_MKT`). Si se le agrega otro (INFLUENCER, por ejemplo), F1 y F2
dejan de cuadrar entre sí. INFLUENCER va en "Otros" por eso.

### Cómo se filtra cada tabla

Hay tres casos, según qué llave trae la tabla:

| Llave | Tablas | Cómo | Cobertura |
|---|---|---|---|
| `origen` directo | `SEDES` | filtro directo | 100% |
| `id_sede` | `PLATA_SEDE_ANT`, `RESCATE_BQ2`, `WP_SEDE_MES`, `WP_SEDE_INC`, `WP_CANJES2` | `filtrarPorId_()` | 97,5% – 100% |
| `origen` pre-agregado | `EMBUDO_ORIGEN` | filtro directo | 98,9% |
| nombre de sede | `SEDES_EVENTOS` | `filtrarPorNombre_()` | 98,4% |
| calculado desde `SEDES` | cosechas, cohortes, conversión por canal, audiencias | filtro directo | 100% |

**`EMBUDO_ORIGEN` va pre-agregado por (fecha × origen), no por sede, a
propósito.** Por sede son 135.393 filas (~8 MB); por origen son 5.246 (0,23 MB)
y sirve exactamente igual, porque el filtro opera sobre orígenes y no necesita
bajar a la sede. Reemplaza a `EMBUDO_MKT`, que venía ya filtrada a los cuatro
canales de marketing y no se podía reusar para otro universo.

La llave de cruce es **`id_internal`** de HubSpot, que en BigQuery se llama
`medico_id` (profile_institucion), `id_internal` (wp_incentivos_diario) y
`sede_id` (wp_canjeos_solicitados).

Las tablas pre-agregadas viejas (`PLATA_SOBRE_MESA`, `WP_SERIE`,
`WP_INCENTIVO`, `WP_KPI2`) se siguen escribiendo como respaldo pero el tablero
ya no las lee: no tienen llave de sede y el filtro no las podía cortar.
`refreshAll()` escribe las dos versiones.

Dos trampas ya resueltas que conviene no volver a pisar:

1. **La definición de "plata sobre la mesa" es `estado IN ('approved',
   'not_taken', 'firma_contrato')` y el monto es
   `COALESCE(monto_aprobado, monto)`.** Con `estado != 'desembolsado'` y `monto`
   el total daba $316,75 mil M contra los $208,22 mil M reales.
2. **`FORMAT_DATE` lleva UN solo `%`**, no `%%`. Con `%%Y-%%m` la función
   devuelve el literal `%Y-%m` y la columna `mes` sale con ese texto en todas
   las filas.

---

## La vista previa corre el motor real

El archivo `Dashboard_360_WELLI_previa.html` que genera `build_previa.js` **no
trae payloads pre-calculados**. Embebe las tablas y el motor completo
(`Config.gs` + `Filtro_Origen.gs` + `Code.gs`) con shims de las APIs de Google,
así que corre el mismo `getDashboardData()` en el navegador.

Antes traía 6 rangos de fecha pre-calculados. Como el tablero solo tiene
calendario libre (sin botones de atajo), **cualquier fecha elegida a mano no
existía en el diccionario, la búsqueda caía al payload de respaldo y el filtro
de origen parecía no hacer nada.** Era un artefacto de la previa, no del motor:
desplegado en Apps Script siempre funcionó. Con el motor local las dos versiones
se comportan igual.

Peso: ~6,6 MB de tablas embebidas. Para que quepa, `build_previa.js` recorta
columnas que el tablero no lee (ver `SOBRAN`) y deja fuera las hojas
pre-agregadas viejas, que solo son respaldo del refresh de producción.

---

## Cómo editar los textos del comité

En el Sheet, hoja **`CONFIG`**, columna `valor`. Estas seis claves son las que
el tablero muestra en las cajas de "Lectura del frente":

`f1_funcionando`, `f1_cuello`, `f1_atencion`,
`f2_funcionando`, `f2_cuello`, `f2_atencion`,
`f4_funcionando`, `f4_cuello`, `f4_atencion`

Los cambias, recargas el tablero y ya. No hace falta tocar código ni esperar el
refresh diario.

El **Frente 6** se llena en la hoja **`NOVEDADES`**: una fila por producto, con
hasta cuatro métricas con nombre y valor, más inversión y acciones.

---

## Qué hoja alimenta qué frente

| Frente | Hojas del Sheet | Fuente |
|---|---|---|
| F1 Adquisición | `META_ADS`, `SEDES` (cosechas, deals), `DEALS_ORIGEN` | Meta Ads + HubSpot |
| F2 Profundización | `SEDES`, `SEDES_EVENTOS`, `F2_AUDIENCIA` | HubSpot |
| F4 Rescate | `RESCATE_INV`, `RESCATE_SEDES`, `RESCATE_PIEZAS`, `RESCATE_BQ`, `HILOS_BROADCAST`, `HILOS_FLOWS` | HubSpot + Hilos + BigQuery |
| F5 Welli Points | `WP_SERIE`, `WP_INCENTIVO`, `WP_CANJES`, `WP_KPI2`, `HILOS_BROADCAST` | BigQuery `welli-growth.wp_data` |
| F6 Novedades | `NOVEDADES` | manual |

| F7 Long tail | `LT_APPS_DIA`, `LT_TOUCHES`, `LT_CADENCIA` | BigQuery + HubSpot |

## La fecha de las cosechas — acordada con BI el 7-sep-2026

Las cohortes de F2 se agrupan por **una sola fecha** y ya no hay selector.
Es la **más temprana** entre la creación de la ficha en HubSpot
(`hs_createdate`) y la vinculación en la plataforma
(`institucion_medica.created`). En BigQuery vive como
`fecha_minima_admin_hubspot`, en la vista
`welli-data.data_ops.v_datos_hubspot`.

El tablero la **recalcula** desde las dos fuentes en vez de leer la vista.
No es un atajo, son dos razones:

1. Se validó llave por llave: **3.743 de 3.743 fechas idénticas**, cero
   diferencias. El recálculo no introduce discrepancia.
2. El lado de HubSpot de esa vista es una tabla **EXTERNAL sobre un CSV
   estático del 4-sep**. Para una sede creada después, la vista se queda
   vieja y el recálculo no. Además, consultar esa vista exige scope de
   Drive, que la cuenta de servicio del tablero no tiene.

Si algún día BI materializa la vista como tabla nativa (por ejemplo
`dim_sede_cosecha`), conviene leerla directo y borrar el recálculo: el
objetivo es que ninguno de los dos equipos aplique la regla por su lado.

**El universo también es uno solo**, y tampoco es elegible: país `COL`, sin
las sedes deshabilitadas y sin lo que no existe en HubSpot. Lo que descarta
queda contado y visible en la escalera de la propia pestaña.

Se quitaron dos selectores que existían para poder discutir con BI — el del
reloj (creación / vinculación / unificada) y el del universo (Growth / BI).
La discusión se cerró, así que dejarlos puestos invitaba a leer el mapa con
una regla que el otro equipo ya no usa. Por eso `getDashboardData()` bajó de
siete parámetros a cinco: `(inicio, fin, origenes, roles, compararF2)`.

## La salida de Customer Success

El mapa 5 de F2 se mide con la propiedad de HubSpot
**`fecha_salida_pipeline_cs`**, que llega a la hoja `SEDES` en la columna
`salida_cs`. Se eligió sobre dos candidatas que suenan igual, y la razón
está medida sobre las 1.969 sedes que alguna vez entraron a CS:

| propiedad | llena en sedes que **nunca** entraron a CS | salida anterior a la entrada |
|---|---|---|
| **`fecha_salida_pipeline_cs`** | **0,9%** | **0,1%** |
| `fecha_salida_cs` | 81,3% | 0,6% |
| `fecha_entrada_farmer` | 92,9% | 2,9% |

Que las otras dos estén llenas para sedes que nunca pasaron por CS significa
que miden otra cosa. La acordada es la única limpia.

**Dos límites del dato que el mapa declara en pantalla** y que hay que
mantener si se toca ese bloque:

- Se escribe **por lotes**: 574 de las 865 salidas caen en 8 fechas, 168 de
  ellas el 5-ago-2026. El *hecho* de haber salido es confiable; el *día*, y
  por lo tanto el mes, no. El aviso se calcula en caliente (día de lote = 20
  salidas o más en la misma fecha), así que no hay que actualizarlo a mano.
- La **cobertura no es uniforme**: 95% en las sedes que entraron a CS en
  abril y mayo, 25% en las 969 de febrero. Por eso las cosechas de enero a
  marzo se ven casi planas.

## Todos los filtros tienen que filtrar todo (7-sep-2026)

Auditoría pedida por el negocio: que el filtro global de origen y los tres
de rol corten **todo** lo que tiene sentido que corten, sin excepciones
silenciosas. Se revisó `leerHoja_()` uno por uno en los siete frentes.

**Se encontró un hueco real: F7 Long tail no filtraba.** `LT_APPS_DIA` y
`LT_TOUCHES` venían agregadas solo por `(fecha, audiencia)`, sin llave de
sede — así que la población de arriba (`f.poblacion`) sí respondía al
filtro y la serie de solicitudes y los impactos de abajo, en la misma
pantalla, no. Se corrigió agregando **`id_sede`** a las dos tablas
(`pull_lt.py`, funciones `apps()` y `touches()`) y filtrando con
`filtrarPorId_()` en `armarF7_`, igual que el resto del tablero. Verificado
con el harness: con origen `HUNTER` la serie cae de 657 a 15 solicitudes.

`LT_CADENCIA` sigue sin filtrar y es correcto que así sea: es la ficha
técnica del workflow (qué día, qué canal, qué pieza), no tiene sede detrás.
Se declaró en pantalla, junto a la tabla de workflows.

**Si se vuelve a refrescar `LT_APPS_DIA` o `LT_TOUCHES`**, usar la versión
de `pull_lt.py` que escribe la columna `id_sede` — una versión vieja del
script rompe el filtro otra vez, en silencio.

**Se confirmó que ya filtraban bien** (verificado con el harness pasando
un origen y comparando el resultado): F1 (`dealsCohorte`, `convOrigen`,
`activacion`, cosechas), F2 (todos los mapas), F4 (oportunidad, gestión,
embudo, calendario), F5 (`WP_SEDE_MES`, `WP_SEDE_INC`, `WP_CANJES2`).

Y se quitó un bloque de código muerto en `armarF4_` (~3.000 caracteres)
que recorría `HILOS_BROADCAST` dos veces calculando `bcA`/`serieWA`/`hi`/
`ventanas`/`diasApagado` sin que ninguno llegara a `f.*` — quedó huérfano
desde que el frente se reenfocó en la gestión humana.

La hoja **`DICCIONARIO`** documenta cada hoja con su granularidad y su caveat.
La hoja **`_LOG`** guarda la bitácora de cada refresh.

---

## Cosas que conviene saber antes del comité

Están todas señalizadas dentro del tablero, pero para que no te tomen por
sorpresa:

1. **El filtro de fechas solo corta lo que está fechado.** Los contadores de
   estado de HubSpot (`aplicaciones`, `aprobados_no_firmados`,
   `total_aprobados_ultimos_30_dias`) son foto de hoy: salen marcados
   "foto de hoy · sin comparativo" y no traen delta. La tabla
   `SEDES_EVENTOS` es la única de sedes que sí responde al filtro.

2. **Hay campos de HubSpot que dejaron de sincronizarse.** El tablero los
   detecta solo y suprime el delta con una explicación, en vez de mostrar una
   caída falsa:
   - `fecha_ultimo_desembolso` pasó de ~300 sedes/mes en abril y mayo a menos
     de 30 desde junio
   - `fecha_ultima_aplicacion` no escribe nada desde diciembre de 2025
   - `fecha_de_reactivacion` no escribe nada desde noviembre de 2025
   - `fecha_de_visita` solo tiene 23 sedes de 3.601

   Vale la pena revisar con quien mantiene esas automatizaciones en HubSpot.

3. **Las cosechas arrastran histórico.** Las columnas apps / desembolsos /
   monto son el acumulado de por vida de esas sedes, no lo que generaron en el
   mes. Las sedes grandes (Sonria, GRUPO GO) entraron al pipeline en marzo de
   2026 y meten $140 mil millones a esa cosecha. El tablero lo advierte encima
   de la tabla.

4. **El origen cubre poco volumen.** Solo 1.907 de 3.601 sedes tienen origen
   registrado, y concentran el 11,8% de las aplicaciones. La conversión por
   canal aplica a esa fracción.

5. **`no_aplica_wp` significa lo contrario de lo que suena.** Su etiqueta en
   HubSpot es "Aplica WP": `true` = habilitada. Además hay 501 sedes sin
   marcar, 113 de ellas con puntos, así que "sedes habilitadas" está
   subregistrado.

6. **Los 80 canjes de Welli Points están todos en estado `pendiente`.** Ninguno
   marcado pagado, $16.032.000 comprometidos, el más viejo lleva 60 días, y a los
   80 ya se les descontó el saldo (`descontado_wp = true`). Puede ser que el pago
   no se esté registrando en la tabla en vez de que no se haya pagado — el campo
   `estado` nunca ha tomado otro valor, así que probablemente nadie lo actualiza.
   Cualquiera de las dos es un problema y el tablero lo dice así.

7. **`wellipoints_historico` tiene un solo `fecha_snapshot` (2026-08-04).** No
   sirve como serie histórica pese al nombre. La serie real está en
   `wp_incentivos_diario`, que sí tiene un snapshot por día desde el 3 de junio
   de 2026.

---

## Si algo se rompe

| Síntoma | Causa probable |
|---|---|
| "No se pudo leer el Sheet" | `SHEET_ID` en `Config.gs` mal, o no tienes acceso al Sheet |
| Spinner infinito | error de JS; el manejador lo muestra en pantalla, revisa la consola del navegador |
| "BigQuery is not defined" | falta activar el servicio avanzado (Paso 3) |
| Todo en `--` | nunca corriste `refreshAll`, o el Sheet quedó vacío |
| "API access blocked" en Meta | Paso 8 |
| El link dejó de funcionar tras editar | creaste una implementación nueva en vez de una versión nueva (Paso 6) |
| HubSpot devuelve 0 sedes | el token no tiene `crm.objects.custom.read` |
| Hilos da 404 | alguien le puso slash final a una ruta; las rutas de Hilos van **sin** slash |

Los errores de cada refresh quedan en la hoja `_LOG` con timestamp, fuente y
detalle. Ese es el primer lugar donde mirar.

## Alerta de sedes desalineadas

`Alertas_Sedes.gs` manda un correo cuando una sede aparece en HubSpot y no en
la plataforma, o al revés. Es independiente del tablero: se puede instalar sin
tocar nada más.

**Instalación** — correr una vez, desde el editor:

1. `probarAlertaSedes()` primero. No envía nada: escribe en el log cuántos
   casos hay y los primeros quince. Sirve para ver el volumen antes de que
   empiece a llegar correo.
2. `instalarAlertaSedes()` después. Deja un trigger diario a las 7:00 (hora
   Colombia, después del refresh de las 6:00) y **fija la fecha de arranque**
   en la Script Property `ALERTA_DESDE` con 30 días de mirada atrás.

**Script Properties**

| Property | Para qué | Si falta |
|---|---|---|
| `ALERTA_TO` | Destinatarios, separados por coma | Usa el dueño del script |
| `ALERTA_DESDE` | Solo vigila sedes creadas desde esta fecha (`yyyy-MM-dd`) | La estampa `instalarAlertaSedes()` |

**Por qué existe la fecha de arranque.** Sin ella el primer correo trae el
backlog histórico completo: 198 casos, algunos de más de mil días. Eso no es
una alerta, es un inventario — y está en
`Conciliacion_cosechas_BI_vs_Growth.xlsx`. Con 30 días de ventana el primer
correo trae ~22 casos, que sí se pueden trabajar.

**Por qué espera tres días.** Los dos sistemas no estampan el mismo día
siempre. Medido sobre 1.124 sedes de marzo-2026 en adelante: 77,4% el mismo
día, 85,6% en uno, 88,8% en tres, 94,4% en siete. Alertar de inmediato sería
casi todo falso positivo. Se ajusta en `AL_DIAS_GRACIA`.

**No repite.** Cada caso se avisa una vez y no vuelve a salir hasta siete días
después si sigue abierto (`AL_DIAS_REAVISO`). El estado y la bitácora viven en
la hoja `ALERTAS_SEDES`, que guarda cuándo se detectó cada caso, cuándo se
resolvió y cuántos días tomó.

**Se protege del dato viejo.** Si `PLATAFORMA_SEDES` no se refrescó en los
últimos dos días, la alerta **no corre** y lo deja anotado en `_LOG`.
Comparar contra un extracto viejo inventaría huérfanos de tipo B por decenas.
Por eso el trigger va después del refresh y no antes.
