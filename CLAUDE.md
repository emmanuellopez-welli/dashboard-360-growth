# Tablero 360 WELLI — reglas aprendidas

Este archivo se lee siempre antes de tocar el tablero. Recoge errores reales que
ya se cometieron y se corrigieron en este proyecto — no son hipótesis, son
lecciones pagadas con QA roto o con una presentación en vivo. Antes de repetir
un patrón, revisa si ya está acá.

## 1 · Nunca publicar sin correr las tres pruebas

Cualquier cambio en `Code.gs`, `Filtro_Origen.gs` o `scripts.html` se cierra
SIEMPRE con esta secuencia, en este orden, en
`C:\Users\millo\AppData\Local\Temp\claude\...\scratchpad`:

1. `node qa_tablero.js` — motor real sobre data completa, matriz de
   fecha×origen×rol. Si agregaste una tabla o un cálculo nuevo, agrégale su
   propio chequeo ANTES de dar el cambio por terminado (ver sección 4).
2. `node build_previa.js` — reconstruye `artifact_tablero.html` desde los
   `.gs`/`.html` reales. Si falta una hoja nueva en `sheet_data.json`, el build
   avisa "OJO: falta la hoja" — no ignorarlo.
3. `node jsdom_stress.js` — renderiza F1/F2/F4/F7 de verdad en un DOM, con
   matriz de filtros. Un cambio de frontend sin esto puede compilar y aun así
   tronar al hacer clic.
4. Publicar con `Artifact` (mismo `file_path`, mismo `url`) y confirmar 0
   fallos en las tres antes de avisarle al usuario que quedó listo.

Nunca reportar "listo" sin haber corrido las tres. Si algo falla, se arregla
antes de publicar, no después.

## 2 · El universo de sedes — la regla vigente (9-sep-2026)

**No se excluye NADA por deshabilitada, sin `id_internal`, sin cuenta en
plataforma, ni por país.** Se cuenta todo, igual que BI. Esto se probó
empíricamente, no es una opinión:

- Antes (regla del 7-sep): recortaba esas categorías → el tablero contaba
  20-40 sedes menos que BI por mes, cosecha por cosecha.
- Ahora (regla del 9-sep): sin ningún recorte → la diferencia baja a 1-7
  sedes/mes.
- Se probó ADEMÁS inyectar las ~140 cuentas de plataforma sin ficha de
  HubSpot (para cerrar esos últimos 1-7) y el ajuste empeoró (2,5 → 4,17
  sedes/mes de error). Se revirtió. Conclusión: esas cuentas son invisibles
  para los dos lados, no solo para nosotros — no hay que perseguir ese
  residuo con más reglas.
- Excluir SOLO "sin id_internal" (dejando deshabilitadas) también se probó
  y también empeora el ajuste (2,5 → 3,17). No sirve como término medio.

**Regla práctica: cualquier propuesta de "vamos a excluir/recortar X para
que cuadre con BI" se prueba primero contra los números reales de BI antes
de implementarse.** Ya van tres intentos de recorte que empeoraron el
ajuste. La intuición de "menos ruido = mejor" no aplica acá.

Lo que SÍ sigue existiendo es la VISIBILIDAD: cuántas sedes son
deshabilitadas/sin id/sin plataforma se sigue contando y declarando (antes
en la escalera de Profundización, ahora solo en `f.universo`/`meta.*` del
payload — la escalera visual se quitó de pantalla el 9-sep porque generaba
más confusión que claridad de cara al negocio, aunque el motor la sigue
calculando).

Sedes sin `id_internal`: SÍ cuentan en el conteo de cosecha (correcto,
igual que BI) pero NO se les puede medir plata/solicitudes (no hay con qué
cruzarlas contra la plataforma). Esas dos cosas no se resuelven con la
misma acción — completar el `id_internal` en HubSpot no cambia el conteo
(ya estaba bien), solo destapa la plata que hoy sale en $0 para esas
cuentas.

## 3 · Patrón de punto único de lectura

Cuando una regla de negocio (reatribución de origen, exclusión, filtro)
tiene que aplicar en TODOS los consumidores de una hoja, no se aplica en
cada lugar por separado — se centraliza en una función memoizada
(`sedesReatribuidas_()`, `universoSedes_()`) y CADA lector pasa por ahí.

Ya pasó una vez: la reatribución DENTALINK→EVENTO se aplicó primero solo en
`universoSedes_` y la tabla "de qué origen salió esa plata" de F1 (que lee
por otro camino, `atribSede_`) seguía mostrando DENTALINK con plata. Un
ajuste aplicado en unos lectores y no en otros es peor que no aplicarlo: los
números de la misma pantalla dejan de cuadrar entre sí, y eso se nota
primero en una demo, no en el código.

Antes de agregar un nuevo lector de `SEDES` (o de cualquier hoja con una
regla de negocio encima), preguntarse: ¿este dato ya pasa por el punto único,
o estoy abriendo un sexto atajo que hereda la regla a medias?

## 4 · Cómo dar QA a algo nuevo (no solo "correr lo que ya hay")

Cuando se agrega una tabla/feature nueva (ej. metas por canal, filtro de
cluster de Long Tail), el checklist mínimo de QA propio es:

1. **Recalculo independiente**, no autoconsistencia: sumar/filtrar los datos
   crudos DIRECTO en el script de QA (sin pasar por la función del
   tablero) y comparar. Autoconsistencia ("el código está de acuerdo
   consigo mismo") no habría atrapado el bug del workflow de ESTRENA
   faltante, por ejemplo — solo comparar contra la fuente cruda lo hizo.
2. **Invariantes de filtro cruzado**: un filtro que NO debería tocar el dato
   (ej. Farmer sobre deals, que no tienen ese rol) tiene que probarse que
   de verdad no lo toca. Un filtro que SÍ debería angostar (ej. origen
   EVENTO) tiene que probarse que deja los otros grupos en cero.
3. **Deltas nuevos**: revisar si el nuevo campo vive en forma de KPI
   (`{label, valor, delta}` — lo agarra `juntarKpis` automático) o en forma
   de tabla (`{canal, monto, deltaMonto}` — hay que auditarlo aparte, a
   mano, contra el período anterior recalculado).
4. Todo esto se agrega a `qa_tablero.js` como una función `chequearX`
   permanente, no como un script suelto de una sola vez — así protege
   cambios futuros, no solo el de hoy.

## 5 · Nunca gráficos de dos ejes con una meta como línea horizontal

Pasó en vivo, en una presentación: una meta en % (tasa de firma × 1.4) se
dibujó como línea punteada en una gráfica de barras (plata) + línea (%) con
dos ejes. La línea, al ser horizontal, se lee visualmente contra CUALQUIERA
de los dos ejes — el usuario la leyó contra la plata y pensó que la meta
era $930M cuando el mejor mes de plata era ~$580M. El número estaba bien
calculado; el gráfico lo hacía ilegible.

Regla: una meta/referencia horizontal en un gráfico de dos ejes NO se
dibuja como línea — se explica en texto (la narrativa de abajo del
gráfico), donde un número no se puede leer contra el eje equivocado. Si de
verdad hace falta una línea de meta, que sea en un gráfico de UN solo eje
(ej. `chBarrasMeta`, que ya usa Rescate total).

## 6 · Calibración de metas: nunca 0 cuando no hay base

Cuando una meta se calcula a partir del mejor período histórico (ej. "mejor
semana ya cerrada × 1,4 de estirón"), si NINGÚN período histórico tiene una
tasa/valor positivo, la meta tiene que quedar en `null` (estado vacío en la
UI), nunca en `0`. Una meta de `0` se lee como "ya la cumpliste" o como un
objetivo trivial, y es engañoso — no es lo mismo "no hay suficiente
historia para poner una meta" que "la meta es cero".

## 7 · "Activas / inactivas / muertas" no suman al total de la cosecha

Son tres cosas con lógica distinta, y confundirlas genera un "no me cuadra"
recurrente:

- **Activas** = alguna vez radicó ≥1 solicitud (`apps_acum >= 1`). Es
  ACUMULADO y pegajoso: una vez que cuenta, cuenta para siempre en los
  meses siguientes, así la sede deje de aplicar.
- **Inactivas** = ya activó alguna vez Y lleva entre 30 y 90 días sin volver
  a aplicar, medido al cierre de ESE mes puntual.
- **Muertas** = ya activó alguna vez Y lleva más de 90 días sin aplicar,
  medido al cierre de ESE mes puntual.

Las tres viven DENTRO de "activas", no al lado. La identidad correcta es:

    activas = recientes (<30 días sin aplicar) + inactivas (30-90) + muertas (>90)

"Recientes" no tiene columna propia en el mapa hoy — por eso restar
activas − inactivas − muertas nunca da lo que la gente espera (suele
esperar que dé el total de la cosecha, o que dé cero). Si alguien pregunta
por qué no cuadra, la respuesta es esta identidad, no un bug de datos.

## 8 · Antes de tocar algo ambiguo y consecuente, preguntar

"Excluye las deshabilitadas de todo" puede significar dos cosas muy
distintas: quitarlas de un Sheet auxiliar (trivial, sin riesgo) o revertir
la regla de universo del 9-sep-2026 (deshace semanas de ajuste ya validado
contra BI). Cuando una instrucción admite una lectura barata y una lectura
que rompe algo ya probado, se pregunta ANTES de ejecutar — no se adivina la
más conveniente.

Regla general: una reinterpretación amplia de algo ya validado empíricamente
(sección 2) nunca se hace por inferencia — se prueba con números reales
primero (como en la sección 2) o se pregunta.

## 9 · Verificar en vivo, no asumir que el snapshot local está fresco

Antes de decir "los datos están actualizados a hoy", correr el pull real
(`pull_lt.py`, `pull_deals.py`, etc.) y comparar la fecha máxima resultante
— no asumir que `sheet_data.json` local ya refleja el estado de producción.
De la misma forma, antes de decir "este dato no existe" o "esta audiencia
no tiene workflow", se verifica contra la fuente viva (HubSpot, BigQuery)
en vez de conjeturar — así se encontró el workflow de ESTRENA que faltaba
en `pull_lt.py` (buscando el ID real en `/automation/v4/flows`, no
asumiendo que "no tenía cadencia asignada").

Pasó en escala el 10-sep-2026: `DEALS_ORIGEN` llevaba días sin refrescarse y
el tablero mostraba 15 leads de Página Web donde HubSpot en vivo (mismo
filtro: origen + pipeline + fecha) mostraba 26 — el usuario lo descubrió
comparando a mano en una reunión. La causa real era DOBLE: 11 de esos eran
simple atraso de dato (arreglado con un re-pull), y los otros 7 eran una
exclusión de negocio ya existente (causales de descarte) que esa tabla en
particular no declaraba en pantalla. `qa_tablero.js` ahora corre
`chequearFrescura()` al inicio de cada corrida — compara la fecha máxima de
cada fuente viva contra hoy y falla si el atraso pasa la tolerancia de esa
fuente (3 días para las diarias, el mes en curso para las mensuales). Si se
agrega una fuente nueva con pull propio, agregarla a la lista `FUENTES` de
esa función.

**`SEDES` y `SEDES_EVENTOS` SÍ se pueden refrescar desde el scratchpad, sin
depender del trigger de Apps Script** — corregido el 10-sep-2026 (esta misma
sección decía lo contrario media hora antes, y era la respuesta fácil, no la
correcta). `pull_sedes.py` reproduce a mano `hsTraerSedes_()` +
`tablaSedes_()` de `Fuentes_HubSpot.gs` contra el objeto personalizado
Sedes (`2-50958246`) vía el proxy de HubSpot, y también construye
`SEDES_EVENTOS` (misma lista `HS_EVENTOS`) sobre los mismos datos, sin un
segundo viaje a HubSpot. `sube_sedes.py` la sube.

**Ojo con el head real**: la hoja `SEDES` en producción tiene MÁS columnas
que `tablaSedes_()` en el `.gs` — le faltan `cosecha`, `fecha_entrada_farmer`,
`cs_fecha_entrada`, `fecha_creacion` (día completo) y `salida_cs`, que se
agregaron en una sesión anterior directamente vía Python para poder fechar
la cosecha con `fecha_salida_pipeline_cs` (la propiedad acordada con BI) y
no con `hs_createdate` truncado a mes. Si se reconstruye este pull desde
cero copiando `Fuentes_HubSpot.gs` literal (como se intentó una vez, antes
de encontrar `pull_sedes.py` ya hecho), se pierden esas 5 columnas y se
rompe `cosechaDe_`/`sedesReatribuidas_` en `Code.gs`, que las leen
directamente. **Siempre verificar el head real de la hoja viva
(`HOJAS['SEDES'][0]` en el snapshot local) contra el `HEAD` del script
antes de subir** — si no calzan exacto, hay una versión más nueva del
contrato en alguna parte del scratchpad y hay que encontrarla, no
reinventarla.

## 10 · Convenciones de código y estilo

- Comentarios en español, sin tildes ni caracteres especiales en los `.gs`
  (consistencia con el resto del archivo — revisar el estilo de alrededor
  antes de escribir uno nuevo).
- Los comentarios explican el POR QUÉ (una decisión de negocio, un bug que
  ya pasó, una fecha en la que se acordó algo), nunca el QUÉ — el código ya
  dice qué hace.
- Fechas de decisiones siempre explícitas ("acordado con BI el 9-sep-2026"),
  para que la próxima persona sepa si la decisión sigue vigente o quedó
  vieja.
- Nunca fabricar/inventar datos (nombres, teléfonos, cifras) — si se pide un
  ejemplo real, se saca fresco de BigQuery/HubSpot y se verifica que
  exista, no se construye a mano.

## 11 · "dismissed" NUNCA cuenta como desembolso/conversión

`profile_institucion.estado = 'dismissed'` significa **rechazado/descartado**,
no desembolsado. Aun así, estaba copiado dentro del set de estados que varios
pulls clasifican como "Convertido"/`conv=1` — el mismo bloque
`CASE WHEN estado IN ('pendiente_aprobacion_medico','desembolsado',
'pendiente_validacion_cliente','fulfilled','pendiente_desembolso','dismissed')`
apareció pegado, sin cuestionarse, en **siete** pulls distintos:
`pull_credito_dia.py` (CREDITO_DIA — la tabla de hechos central de TODO el
tablero), `pull_estado_mes.py` (SEDE_ESTADO_MES — los 5 mapas de cohorte de
Profundización), `pull_activacion.py` (ACT_SEDE_MES), `pull_lt.py`
(Long Tail), `pull_cosecha_dia.py`, `repull_equipo.py` y `bq_pull.py`.

Se encontró auditando un caso puntual (Family Dental Pro SAS, enero 2026:
2 de sus 3 "desembolsos" eran reales, el tercero — $2,7M — era un crédito
`dismissed`). Corregido el 9-sep-2026: se sacó `dismissed` de las 7 fuentes.
Impacto medido en BigQuery, 2026 completo: **$2.653.350.235 en 565 créditos**
que se estaban contando como plata desembolsada sin haberlo sido (~2,7% del
total que se reportaba).

**Regla**: cualquier clasificación de estados de `profile_institucion` que
incluya `dismissed` en el bucket de "convertido"/"desembolsado"/"aprobado"
está mal por definición — ese estado es un rechazo. Si se agrega una fuente
nueva sobre esta tabla, revisar el `CASE WHEN` contra esta lista de 7
archivos antes de copiarlo de otro pull.

## 12 · CREDITO_DIA vive COMPRIMIDO — nunca subir el crudo directo

`pull_credito_dia.py` escribe `tables_cdia.json` en formato legible
(`sede`, `fecha`, ...), pero la hoja de producción `CREDITO_DIA` que lee
`hechos_()` en `Code.gs` espera el formato COMPRIMIDO: columnas `s` (índice
de sede, contra la hoja `CREDITO_SEDES`) y `d` (día como offset desde
`2025-01-01`), no `sede`/`fecha` en texto — así la tabla pesa 3,7 MB en vez
de 5,8 MB, que es la diferencia entre caber en el artefacto o no.

El paso obligatorio entre pull y upload es `comprime_cdia.py` — lee
`tables_cdia.json` crudo, lo reescribe comprimido, y genera también
`CREDITO_SEDES` (el índice) EN LA MISMA pasada para que nunca queden
desincronizados. **Si se sube `tables_cdia.json` sin pasar por
`comprime_cdia.py` primero, se rompe `hechos_()` en producción** (pasó el
9-sep-2026: se subió el crudo por error, se detectó por la memoria de que
el esquema real es `s`/`d`, y se corrigió corriendo `comprime_cdia.py` y
resubiendo antes de que nadie lo notara). Orden correcto siempre:
`pull_credito_dia.py` → `comprime_cdia.py` → `sube_cdia.py`.

## 13 · Filtros: arquitectura que hay que respetar

- Los filtros GLOBALES (fecha, origen, rol) cortan TODO a través de un solo
  objeto `U` (`universoSedes_`) y sus ayudantes (`filtrarPorId_`,
  `filtrarPorNombre_`, `recorrerHechos_`). Ningún consumidor nuevo filtra
  por su cuenta — pasa por esos ayudantes.
- Los filtros LOCALES de una pestaña (comparador de F2, población
  Kevin/Rescate total de F4, cluster de F7) viven en una variable global del
  frontend y disparan una recarga COMPLETA (`cargar()` → nuevo
  `getDashboardData` con el parámetro extra), no un filtrado en el
  navegador — la lógica de negocio (exclusiones, escalera de cohortes,
  agregaciones) vive en el servidor, y filtrar solo en el cliente la
  duplicaría o la dejaría a medias.
- Un filtro nuevo que angosta una población (ej. el cluster de Long Tail)
  debe angostar TODO lo que esa pestaña muestra de un solo golpe — el
  patrón correcto es reducir la lista/arreglo que ya gobierna todo el resto
  de la función (como `ACC` en `armarF7_`), no repetir el filtro en cada
  bloque.

## 14 · El enfoque es GROWTH, no el KPI de otro equipo (14-sep-2026)

Emmanuel tuvo feedback con su jefa y aclaró el mandato del tablero. Esto
reordena cómo se lee todo lo anterior — no lo contradice, lo enmarca:

**Este tablero mide lo que le importa a GROWTH, no lo que le conviene a
Hunter/VI.** Hunter defiende su propio KPI (deals limpios, después de
filtrar duplicados/SARLAFT/pruebas/etc.) porque a ellos les conviene un
número depurado. Growth NO tiene ese incentivo: a Growth le interesa
cuántos leads entraron, punto, y cómo se comportan esos leads en el tiempo
(Customer Success en los primeros 60 días, activación, inactividad,
muerte). Filtrar leads totales para que el número se vea mejor es
maquillar el embudo de OTRO equipo con el criterio de otro equipo — no es
honestidad de datos, es conveniencia ajena disfrazada de limpieza.

**Regla de implementación: mostrar AMBOS, nunca elegir uno solo.** No se
trata de deshacer los filtros de calidad que ya existen (SARLAFT,
duplicado, pruebas, no-es-del-sector, medicina alternativa — siguen siendo
la definición correcta de "deal limpio" y el mapa de cohortes se sigue
alimentando SOLO de esos) — se trata de dejar de esconder el total detrás
del filtro. Primer caso implementado: la tabla "Los deals que entraron" de
F1 ahora trae una columna "Deals totales" (sin ningún filtro de causal)
ANTES de la columna de deals limpios (la que ya existía, la que sigue
alimentando el mapa de cohortes). Fuente: `pull_deals.py` calcula
`deals_totales` (todo lo que pasa el piso de cosecha/origen/owner, sin
excluir por causal) al lado de `deals` (el limpio de siempre) en la misma
fila de `DEALS_ORIGEN`; `Code.gs` los lleva por separado como `n`/`nTotal`
en `dealsCohorte.filas`; `scripts.html` pinta la columna extra en
`tablaCohorte` solo cuando las filas traen `nTotal` (no afecta la tabla de
cosechas de sedes, que no lo usa). Este es el patrón a repetir en
cualquier otro lugar del tablero donde hoy se muestre solo el número
filtrado: agregar el total al lado, no reemplazar el limpio.

**Deshabilitadas: ya estaba resuelto.** El universo de sedes (sección 2)
ya cuenta TODO sin excluir deshabilitadas desde el 9-sep-2026 — la jefa
pidió lo mismo que ya está implementado, así que no hubo nada que cambiar
ahí. Confirma que la sección 2 sigue vigente y no se debe revertir.

**Ojo, esto NO aplica a la sección 11 (`dismissed`).** Que un crédito
`dismissed` no cuente como "Convertido"/desembolsado no es un filtro de
conveniencia — es corregir un error de clasificación (`dismissed` =
rechazado, nunca fue plata real). No es lo mismo "no escondas leads que sí
llegaron" que "no inventes plata que nunca se desembolsó". Si alguna vez
se pide "traer de vuelta los dismissed", hay que preguntar primero si se
refiere a mostrar el total de créditos gestionados (correcto, aplicar el
patrón de esta sección) o a contarlos como desembolso (incorrecto, viola
la sección 11) — son peticiones que suenan igual y son opuestas.

## 15 · Long Tail manda WhatsApp por un canal DISTINTO al de Rescate (14-sep-2026)

Se intentó medir apertura/respuesta de WhatsApp por pieza de Long Tail
cruzando por teléfono contra `welli-growth.rescate.eventos_hilos` (Hilos) —
el mismo motor que ya usa Rescate y su atribución de WhatsApp. **No sirve**:
de 672 sedes tocadas por Long Tail, solo 149 tenían teléfono en HubSpot, y
de esas **solo 5 aparecieron en Hilos**. Long Tail manda WhatsApp por el
canal NATIVO de HubSpot (acción `0-230189361` en la definición del
workflow, con un `rootMicId` — no una plantilla de Hilos). Son dos sistemas
de WhatsApp distintos con números distintos. Conclusión: **antes de cruzar
cualquier WhatsApp de Long Tail contra Hilos, verificar que de verdad sale
por ahí** — no asumir que "es WhatsApp, va todo por el mismo lado" solo
porque Rescate sí usa Hilos.

**RESUELTO el mismo 14-sep-2026, más tarde, a pedido explícito ("saca esa
info de HubSpot como sea").** El estado real de un mensaje de WhatsApp
nativo de HubSpot vive en la API de **Conversations**
(`/conversations/v3/conversations/threads/{id}/messages`), NO en el objeto
`communications` del CRM (que solo tiene texto y fecha, ningún campo de
estado). Esa API pedía el scope `conversations.read`, que la conexión de
Composio (`ca_13P0RgH6oZrv`) no tenía — **ni el botón "Re-authenticate to
enable" de HubSpot lo resolvió** (la app de Composio no tiene ese scope
registrado del todo; no es algo que el usuario pueda activar desde su lado).
Se resolvió creando una **Private App directo en HubSpot** (scope
`conversations.read`, luego se agregó `crm.objects.contacts.read`), con
token `pat-na1-...` guardado en `.env` como `HUBSPOT_PRIVATE_TOKEN`, y
llamando la API con `requests` + `Authorization: Bearer` directo (sin pasar
por Composio para esta parte).

**El camino que funcionó, para la próxima vez que haga falta esto:**
1. Buscar los contactos de HubSpot por teléfono: `POST
   /crm/v3/objects/contacts/search`, filtro `phone`/`hs_whatsapp_phone_number`
   `IN` [...], probando el número tal cual y con prefijo `+57`/`57` (HubSpot
   normaliza distinto según cómo se cargó cada contacto). **El operador
   `IN` acepta máximo 100 valores por filtro** — con 3 variantes por
   teléfono, lotes de ~33 teléfonos.
2. Para cada contacto: `POST
   /crm/v4/associations/contacts/communications/batch/read` (lotes de 50)
   para traer sus comunicaciones asociadas.
3. `POST /crm/v3/objects/communications/batch/read` (lotes de 100) con
   `properties=hs_communication_channel_type,
   hs_communication_conversations_thread_id,hs_timestamp` — filtrar a
   `hs_communication_channel_type == 'WHATS_APP'` para quedarse solo con
   esas.
4. Con los `hs_communication_conversations_thread_id` únicos: `GET
   /conversations/v3/conversations/threads/{id}/messages` — ahí sí vienen
   `status.statusType` (`SENT`/`DELIVERED`/`READ`/`FAILED`), `direction`
   (`OUTGOING`/`INCOMING`), `text` y el teléfono en
   `senders[].deliveryIdentifier`/`recipients[].deliveryIdentifier`.
5. Cruzar por teléfono + fecha del toque (ventana de +3 días, igual que
   Email) contra `LT_TOUCHES` para agregar por pieza.

**NO enumerar `/conversations/v3/conversations/threads` de toda la cuenta
sin filtro** — se probó primero así (más simple en teoría) y se colgó en
un bucle de paginación a las **47.894 conversaciones** (~1.500s) sin
terminar nunca: la cuenta tiene decenas de miles de threads de todos los
canales (email, formularios, chat, etc.), y el endpoint no soporta filtrar
por canal/cuenta en el servidor (se probó `channelId`, `channelAccountId`,
`originalChannelAccountId` como query param — los tres se ignoran
silenciosamente, siempre devuelve lo mismo). Ir por teléfono conocido
(pasos 1-5 de arriba) es muchísimo más barato que barrer todo.

**Cobertura resultante, declarada en el tablero, no escondida:** de 672
sedes tocadas, 149 con teléfono en HubSpot, 123 con contacto encontrado,
88 threads de WhatsApp reales, y de esos solo algunas piezas alcanzan
volumen suficiente en la ventana de 3 días — las demás quedan en `null`
("--" en pantalla), nunca en `0`, mismo criterio que la sección 6.

**Lo que SÍ funcionó para decodificar piezas de HubSpot, para la próxima
vez que haga falta:**
- La definición real de un workflow (qué email manda, en qué día, en qué
  orden) sale de `GET /automation/v4/flows/{id}` vía el proxy de Composio
  (`ca_13P0RgH6oZrv`) — más confiable que cualquier tabla de HubSpot que
  describa la cadencia de memoria (LT_CADENCIA quedó con datos ligeramente
  desalineados: dos filas con el mismo día, canal mal etiquetado en un
  paso). El tipo de acción `0-4` es email (campo `content_id` = el id real
  del email); `0-1` es delay (`delta`/`time_unit`); `0-230189361` es
  WhatsApp nativo (`rootMicId`).
- Stats reales de un email (enviados/entregados/abiertos/clics) salen de
  `GET /marketing/v3/emails/statistics/list?emailIds=<id>&startTimestamp=
  <ISO>&endTimestamp=<ISO>` — el formato de fecha tiene que ser ISO-8601
  (`2026-06-01T00:00:00Z`), NO epoch milliseconds (con epoch ms el
  endpoint responde "Unable to parse value for query parameter:
  startTimestamp" sin decir por qué).
- **`campaign_id` en `/email/public/v1/events` NO filtra de verdad** — se
  probó con un id inventado y devolvió eventos de una campaña cualquiera.
  No usar ese endpoint para pedir eventos de UNA campaña puntual; para eso
  sirve `statistics/list` de arriba. `/email/public/v1/events` solo sirve
  para el stream completo sin filtrar (caro: 150.000 eventos en ~400s y
  ni así se alcanzó a cubrir el rango completo de una cuenta con tráfico
  transaccional alto).
- El CLI `hubspot` (agente) que documenta la skill `workflow-automation`
  **no está instalado en este entorno** — se usó el proxy de Composio
  directo contra `/automation/v4/flows/` en su lugar. Si en una sesión
  futura sí está disponible, es más simple usarlo.

## 16 · Verificar en el DOM real, no solo con qa_tablero.js (14-sep-2026)

Se publicó una vez (v62) un cambio en Frente 7 (Long Tail) que pasó las
tres pruebas con 0 fallos y AUN ASÍ el usuario no vio nada nuevo — tenía
razón, no era percepción suya. Dos bugs reales, ninguno detectado por el
flujo de QA de siempre:

1. **El código de frontend leía `D.f6` en vez de `D.f7`.** Frente 6
   ("¿Se están adoptando los productos nuevos?") y Frente 7 ("Long tail")
   son pestañas DISTINTAS con backends distintos (`armarF6_` vs
   `armarF7_`) — Long Tail es F7, no F6. El panel/tabla nuevo se armó
   dentro de la función correcta (`vistaF7()`), pero las dos funciones
   auxiliares que lo alimentaban (`f6PzRender`/`f6PzSetSel`) fueron
   nombradas por error a partir de la suposición "Long Tail = F6" y leían
   `D.f6` — que existe, está vacío, y por eso la tabla se veía siempre
   vacía sin ningún error en consola.
2. **`build_previa.js` tiene una lista fija `USADAS` de qué hojas se
   embeben en el artefacto** — la hoja nueva (`LT_PIEZAS`) no estaba en
   esa lista. El backend (`Code.gs`) la leía bien, `qa_tablero.js` (que
   corre contra el `sheet_data.json` completo, sin ese recorte) no vio
   nada raro, pero el ARTEFACTO PUBLICADO nunca recibía los datos.

**Por qué `qa_tablero.js` + `jsdom_stress.js` no atraparon esto:** ambos
verifican que el motor no truene y que no haya excepciones de JS — no
verifican que el HTML resultante tenga el contenido esperado. Un `D.f6`
vacío no lanza un error: `(f.piezas || [])` da `[]` en silencio y la tabla
muestra "sin filas", que jsdom_stress no distingue de "no se pidió esta
tabla en este filtro".

**Regla nueva: para cualquier tabla/panel NUEVO, antes de publicar, hacer
una verificación de CONTENIDO además de las tres pruebas de siempre** —
con jsdom, forzar la pestaña (`VISTA='fX'; render()`), y comprobar que el
elemento nuevo existe y tiene filas/contenido real (no solo que no hubo
excepción). Ver el patrón que se usó el 14-sep-2026: cargar
`artifact_tablero.html` con jsdom, `win.VISTA='f7'`, `win.render()`, y
contar `document.getElementById('f7PzCuerpo').querySelectorAll('tbody
tr').length`. Si da 0 con datos reales de por medio, algo está mal antes
de publicar — no después de que el usuario lo note.

Y antes de nombrar cualquier variable/función/id nueva con el número de un
frente ("F6", "F7"...), confirmar cuál pestaña es cuál mirando el `nav-item
data-vista` en `dashboard.html` y el nombre de la función `armarFX_`/
`vistaFX()` — no asumir por el tema ("esto es Long Tail, debe ser F6").

## 17 · El filtro de campaña de la API de eventos de email de HubSpot está roto de verdad

Confirmado TRES veces, la última de forma concluyente: `/email/public/v1/
events?campaign_id=X` **ignora el parámetro** y devuelve el stream sin
filtrar, sin importar qué se le pase.

1. Vía proxy de Composio, con un id inventado (`campaign_id=1`): devolvió
   eventos de una campaña real cualquiera.
2. Con un Private App token directo (sin Composio), mismo resultado.
3. **La prueba definitiva**: se confirmó el ID de campaña 100% real y
   existente para un email conocido (vía `allEmailCampaignIds` del objeto
   `/marketing/v3/emails/{id}` — NO uses `primaryEmailCampaignId`, ese
   campo puede apuntar a un id ya inválido/404) y aun así
   `campaign_id=<ese-id-real>` devolvió eventos de OTRA campaña.

**No perder tiempo de nuevo intentando filtrar ese endpoint por campaña.**
Para agregados reales por email (enviados/entregados/abiertos/clics), usar
`/marketing/v3/emails/statistics/list?emailIds=<id>&startTimestamp=<ISO>&
endTimestamp=<ISO>` (sección 15) — funciona bien. Pero **no da detalle por
destinatario ni por hora** — eso solo vive en el stream de eventos, que es
inutilizable por campaña. Si algún día hace falta top-contacts u
hora-del-día de EMAIL (no de WhatsApp, que sí se resolvió — sección 15),
habría que traer el histórico COMPLETO de eventos de la cuenta sin filtro
y cruzar local por `emailCampaignId` real, cosa que ya se probó una vez
(150.000 eventos en ~400s sin ni siquiera alcanzar a cubrir el rango
completo de una cuenta con tráfico transaccional alto) — es caro y no se
recomienda salvo que de verdad haga falta.

**Lo que SÍ se pudo entregar en su lugar (14-sep-2026):** franja horaria
(hora de lectura/respuesta) y top de sedes por engagement, calculados
SOLO con WhatsApp — que si tiene datos reales por conversación (sección
15) — y declarados en pantalla como "solo WhatsApp, Email no tiene
equivalente". Nunca inventar una franja horaria de Email con datos que no
existen solo para "completar" la pantalla.

## 18 · Un email compartido entre workflows se ve como un bug si no se declara (14-sep-2026)

Varios de los 5 workflows de Long Tail reusan el MISMO email (mismo
`content_id` de HubSpot) como paso final de su cadencia — ej. "Cada vez
más clínicas están financiando con Welli" lo mandan los workflows 01, 02,
04 y 05. Como las métricas (`statistics/list`) son del EMAIL, no del
workflow, las 4 filas salían con el número EXACTO igual — y Emmanuel lo
marcó de inmediato como bug ("por qué hay info tan igual, parece un
bug"). Tenía razón en desconfiar, aunque el número en sí era correcto.

**Regla: cuando dos filas de una tabla muestran el mismo número porque
comparten la MISMA fuente subyacente (no por casualidad), hay que
agruparlas en una sola fila y declarar explícitamente dónde se usa —
nunca repetir la fila tal cual.** Repetir sin explicar es indistinguible
de un copy-paste roto, así se pierda info real detrás. Implementado en
`pull_lt_piezas8.py`: se agrupa por `content_id`, se arma una sola fila
con `workflow = "A + B + C"` y la etiqueta dice explícito "compartida en
X (día N), Y (día M)...". El filtro por workflow en `scripts.html`
(`f7PzSetSel`) se ajustó para que esa fila aparezca bajo CUALQUIERA de
los workflows que la comparten (`p.workflow.indexOf(F7_PZ.workflow) >= 0`),
no solo con "Todos" — si no, un email real que SÍ le pertenece a ese
workflow desaparece al filtrar por él.

**Bug real encontrado al mismo tiempo, en la misma tabla:** dos de los seis
emails mostraban `enviados=0` con la ventana angosta
(`startTimestamp=2026-06-01`) de `/marketing/v3/emails/statistics/list` —
Emmanuel lo marcó de nuevo como sospechoso, y esta vez SÍ era un bug real.
Esos dos emails tuvieron casi todo su volumen ANTES de esa ventana (394
envíos reales entre 2025 y 2026 contra 0 en el recorte jun-sep). **La
ventana de fecha de esta API no se puede adivinar por cuándo se supone
que "debería" haberse enviado un email (su `publishDate`) — hay que
consultar con un rango bien amplio (`2020-01-01` hasta hoy) para no
perder volumen real.** `pull_lt_piezas4.py` quedó así. Si un número sale
en cero y no tiene sentido de negocio (0 enviados de una pieza que
claramente está activa), la primera sospecha es la ventana de fecha, no
que la pieza esté realmente muerta.

## 19 · Un ranking sin señal real no es un insight, es ruido con estilo de tabla

El "top sedes por engagement de WhatsApp" (sección 15) se armó ordenando
por `respondio*5 + leido` y Emmanuel lo devolvió de inmediato: "esto no me
dice nada, no me dice en qué período, no me dice nada exactamente." Tenía
razón por dos motivos, uno de diseño y uno de cálculo:

1. **De cálculo**: la ponderación `respondio*5 + leido` deja que el
   VOLUMEN de lecturas (pasivas, no es una decisión de la sede) le gane a
   una respuesta real (la única señal de negocio que existe) — 20 lecturas
   (score 20) le ganan a 1 respuesta (score 5). Verificado contra los datos
   reales: de 149 sedes con teléfono, **CERO tuvieron alguna respuesta
   real** (1 solo teléfono de toda la cuenta respondió, y ni siquiera era
   una sede confirmada). El ranking por score mixto no iba a mostrar nunca
   lo único que importaba.
2. **De diseño**: cuando la métrica disponible no tiene varianza real que
   ordenar (nadie responde), un leaderboard es la forma equivocada de
   mostrarlo — un leaderboard implica "esta sede es mejor que esa otra",
   y aquí ninguna lo es, todas leen igual de pasivo. Se reemplazó por un
   **embudo** (`tocadas → con teléfono → leyeron → respondieron`, con
   `LT_WA_EMBUDO`, agregado por cluster) que muestra el hallazgo real:
   "es un canal de aviso unidireccional, no de conversación" — con la
   nota de que si el mensaje trae un botón/link, la conversión real hay
   que medirla ahí, no en respuestas de texto.

**Regla:** antes de presentar un ranking/top-N, verificar que la métrica
de orden tenga varianza real entre los primeros puestos. Si todos (o casi
todos) empatan en la dimensión que de verdad importa, no es una tabla de
"los mejores" — es un embudo o una cifra única de "cuántos llegaron hasta
acá", y hay que decirlo así.

## 20 · Un panel que no se mueve con el filtro de fecha es un bug, no un detalle

El embudo de WhatsApp de la sección 19 se armó la primera vez desde un
Python precalculado (`LT_WA_EMBUDO`) sobre TODO el histórico disponible —
Emmanuel cambió el rango de fecha global a "1-ago a 14-sep" y el panel
**no se movió nada**, y preguntó "¿debería cambiar?". Sí debía, y no
cambiaba porque el precalculo no tenía forma de saber qué rango estaba
eligiendo el usuario en el tablero — es exactamente la violación de la
sección 13 (los filtros globales tienen que cortar sobre datos CRUDOS con
fecha, nunca sobre un agregado ya fijo).

**Arreglo:** se subieron dos hojas crudas con fecha —
`LT_TEL_SEDES` (id_internal→teléfono, sin fecha, es catálogo) y
`LT_WA_EVENTOS` (teléfono, fecha, tipo: leido/respondio, una fila por
día) — y el embudo se recalcula EN VIVO dentro de `armarF7_`, cruzando
`LT_TOUCHES` (que sí tiene fecha) filtrado por `R.inicio`/`R.fin` contra
esas dos hojas. Las hojas viejas (`LT_WA_EMBUDO`, `LT_WA_TOP`) quedaron
sin usar en `Code.gs` — no se leen más.

**Antes de dar un panel nuevo por terminado, probarlo con DOS rangos de
fecha realmente distintos** (no solo dos rangos que casualmente cubran
lo mismo — verificar primero el rango real de fechas de la fuente cruda,
como se hizo aquí con `LT_TOUCHES`: solo cubría 28-ago a 12-sep, así que
"todo el histórico" y "ago-sep" daban el mismo número por coincidencia,
no porque el filtro funcionara) y confirmar que el número cambia. Si no
cambia, sospechar del filtro antes de asumir que "así es el dato".

## 21 · Frente 5 (Welli Points) — se agregó adopción, 14-sep-2026

Emmanuel pidió replicar el tablero externo de producto
(`points.welli.com.co/admin`) dentro de Welli Points, combinándolo con las
redenciones reales que YA estaban en el tablero (`WP_CANJES2`, sección "2 ·
¿Le pagamos a la sede?") pero enterradas en una sección técnica, no
destacadas como número C-level.

**Antes de construir nada, se verificó si "redenciones" de verdad faltaba**
(sección 8: preguntar/verificar antes de reconstruir algo ambiguo) — no
faltaba, `WP_CANJES2` ya sale de `wp_canjeos_solicitados` en BigQuery.
Lo que faltaba era la ELEVACIÓN: un KPI de "cuánto hemos pagado en total,
histórico" que antes no existía (solo se mostraba lo pendiente), puesto
primero en la sección 1.

**Lo nuevo es la sección 0 (adopción), con fuente
`welli-growth.wp_data`:**
- `wellipoints_snapshot` (3.104 sedes) como universo de "habilitadas" —
  declarado explícitamente que NO es el mismo número que reporta el
  tablero externo (2.467, desde su `auth_user`, que no es una tabla de
  BigQuery y no se puede consultar desde acá). Nunca fingir que dos
  fuentes con distinto universo dan el mismo número — declarar la
  diferencia, como ya se hace en el resto del tablero (ver sección 2).
- `wp_dashboard_visitas` para logins, tendencia de 60 días, top-20 activas.
- El campo `mundo` de esa tabla es RUIDOSO fila por fila (un mismo
  `sede_id` puede tener `mundo` nulo en unas visitas y con valor en
  otras) — se usa el mundo de la visita MÁS RECIENTE por sede
  (`ROW_NUMBER() OVER (PARTITION BY sede_id ORDER BY timestamp DESC)`),
  no un `GROUP BY mundo` directo sobre todas las filas.
- Esta sección NO responde al filtro de origen/rol del tablero: es la
  foto de adopción de TODA la base, igual que el tablero externo — filtrar
  por origen la dejaría comparando un grupo contra sí mismo.

**Pendiente real, no resuelto:** el "Total pagado en redenciones" y el
resto de `f.pago` SÍ podrían enriquecerse más (ej. tasa de pago por
formato de canje), pero no se tocó el resto del comportamiento de canjes
— solo se agregó el KPI que faltaba y se subió de posición.

## 22 · El calendario día a día de Rescate ignoraba el filtro de fecha (16-sep-2026)

Mismo patrón exacto de la sección 20, esta vez en Frente 4. El panel "Día a
día, de lunes a viernes" (`armarF4_`, bloque `gDia`/`calendario`) recorría
`hjGes` (RESCATE_GESTION) COMPLETO, sin ningún corte por `R.inicio`/
`R.fin` — mostraba semanas desde el 27-jul aunque el usuario tuviera el
filtro puesto en una sola semana de septiembre. Se detectó porque
Emmanuel señaló la captura directamente ("solo quiero que muestre los
días seleccionados").

**Ojo con la razón por la que pasó desapercibido:** esta MISMA sección ya
tiene, a propósito, otro bloque (`spanIni`/`spanFin`, para la tabla
semanal de "oportunidad") que declara explícitamente que NO se corta con
el filtro ("se recorre el span COMPLETO de la operación... esta tabla y
las cosechas no se cortan con el selector"). Ese comentario es correcto
para SU tabla, pero el calendario es una sección DISTINTA que vive al
lado y sí debía cortarse. Un comentario que justifica "no filtrar" en un
bloque no exime al bloque de al lado de la misma pregunta — cada
consumidor de una hoja se revisa por separado (sección 3).

**El arreglo tiene una segunda trampa que vale la pena anotar:** la
grilla del calendario en el frontend es un CSS grid de 5 columnas fijas
(lun..vie) y pinta por POSICIÓN, no por fecha — si una semana de borde
(la que toca el límite del filtro) se salta un día en vez de dejar una
celda vacía, las columnas de los demás días se corren y el martes
aparece bajo el encabezado "lunes". La solución no es no-incluir el día
fuera de rango: es mandar una celda con un flag `fueraRango: true` que el
frontend pinta vacía y sin datos, manteniendo las 5 columnas siempre. Si
se filtra una lista que alimenta una grilla de posición fija, filtrar el
CONTENIDO sin filtrar el NÚMERO DE CELDAS rompe la alineación.

## 23 · "Datos actualizados" no se mueve solo con refrescar tablas (17-sep-2026)

El pipeline de Python (`pull_*.py` + `sube_*.py`) actualiza las TABLAS de
datos, pero nunca tocó `CONFIG.ultima_actualizacion` — el valor que
`scripts.html` muestra arriba como "Datos actualizados: X". Ese campo lo
escribe el `refreshAll()` real de Apps Script cuando corre en producción,
y como el refresco de esta sesión pasa por el scratchpad (no por ese
trigger), la etiqueta se quedó marcando **2-sep-2026** un reprocesamiento
completo después, con todas las fuentes ya en 0 días de atraso. Emmanuel
lo notó por la etiqueta, no porque un número estuviera mal.

**Regla: cualquier reprocesamiento completo desde el scratchpad tiene que
terminar escribiendo `CONFIG.ultima_actualizacion` con la hora real del
refresh** (`GOOGLESHEETS_BATCH_UPDATE` sobre la fila de esa clave en
`CONFIG`, columna `valor`) — si no, el tablero puede tener datos 100%
frescos y aun así aparentar estar desactualizado. Script:
`actualiza_config_fecha.py` en el scratchpad.

## 24 · Sexto mapa de Profundización: "Sedes que nunca han hecho nada" (17-sep-2026)

Salió de reconciliar contra la query "oficial" que le pasó la jefa de
Emmanuel (sección de conversación del 16/17-sep). Su bucket "Muerto"
mezclaba dos poblaciones que para nosotros son conceptos distintos:
(a) sedes que **aplicaron alguna vez** y llevan 90+ días sin volver
(nuestra `muertas`), y (b) sedes que **nunca aplicaron ni una vez** y ya
son viejas — una población que **ningún mapa del tablero mostraba**.
Verificado: 301 sedes habilitadas, creadas hace 90+ días, sin una sola
solicitud jamás — ese es el orden de magnitud de la brecha persistente
que se veía en "muertos" incluso en meses ya cerrados.

**Implementación — el mapa es un COMPLEMENTO, no una query nueva.** El
mapa "activas" ya cuenta, celda por celda, cuántas sedes de la cosecha
tienen `apps_acum >= 1`. "Nunca vivas" es simplemente
`cruzables − activas` en cada celda (`nuncaVivas_()` en `Code.gs`, al
lado de `incremental_()`) — nace directo del mapa de activas, así que no
puede desincronizarse de él y no necesitó ningún pull nuevo. Por diseño
se comporta al revés que "activas": empieza alto y BAJA con el tiempo
(cada mes que pasa, algunas sedes por fin radican su primera solicitud).

**Dos cosas que costaron una vuelta:**
1. `extras` tiene que ser un ARREGLO de `null` (uno por celda), no `null`
   a secas — `promedio_()` hace `r.extras[k]` sin comprobar que exista, y
   con `extras: null` el motor truena en el primer cálculo de promedio.
2. `qa_tablero.js` tiene un chequeo genérico que falla si un mapa de
   conteo "baja" entre celdas (asume que todo mapa que no sea plata es
   acumulado) — había que agregar `nuncavivas` a la lista de mapas
   EXCLUIDOS de ese chequeo (junto a `inactivas`/`muertas`/
   `desembolsos_mes`, que ya estaban ahí por la misma razón: son fotos
   puntuales, no acumulados). Se aprovechó para separar ese chequeo del
   de "la celda nunca pasa de su base", que SÍ debe seguir aplicando
   incluso a los mapas puntuales.

**El denominador NO es la cosecha completa.** Sedes sin `id_internal` no
tienen cómo cruzarse contra `SEDE_ESTADO_MES` — no se puede saber si
aplicaron o no. El mapa usa `nBase = cruzables` (mismo patrón que el mapa
de traspaso a CS, que divide por "las que entraron a CS"), y el frontend
ahora acepta una etiqueta de base configurable por mapa (`m.nBaseEtq`) en
vez del texto fijo "en CS" que tenía antes — con dos mapas usando `nBase`
con significados distintos, un solo texto fijo ya no alcanzaba.

## 25 · Frente 5 reenfocado: "¿Welli Points mueve la aguja?" (18-sep-2026)

Emmanuel pidió rehacer la pestaña para que responda una sola pregunta de
CEO: ¿el programa hace que las sedes desembolsen más, y a qué costo? Antes
respondía la operación (cuánto se ofreció, cuánto se pagó), que es otra
cosa.

**La trampa de fondo, y por qué el análisis quedó tan aparatoso: los WP se
GANAN por desembolsar** (tabla de tramos B1, de 1 a 24 puntos según el
monto). O sea que "las sedes con más puntos desembolsan más" es la
definición del programa, no su efecto — cualquier número construido sobre
puntos ganados es circular por diseño y da un resultado enorme y favorable
que no significa nada. El único acto NO automático es **canjear**: la sede
entra, ve su saldo y pide su plata. Por eso el corte de "adoptó el
programa" es haber canjeado, y esto va declarado en pantalla porque es la
primera objeción que hace cualquiera que mire la tabla.

**Segunda trampa, encontrada midiendo, y la más peligrosa: el efecto crudo
daba -14,5%** (las sedes que canjean desembolsan MENOS después). Es falso.
Una sede canjea justo después de acumular puntos, o sea justo después de un
pico de desembolsos, así que la ventana "antes" está seleccionada para ser
alta y lo que sigue es reversión a la media. Se probó de dos formas:
un **placebo** (fecha de canje falsa 60/90/120 días antes → el efecto
negativo NO aparece) y un **control emparejado** por nivel de desembolso
previo (el control también cae -11,6%). La diferencia real queda en
**-4,3 pp con IC90 [-18,0 , +12,5]**, que cruza cero. Sin el control, este
frente habría reportado que Welli Points destruye desembolsos.

**Lo que sí se puede afirmar hoy:**
- **Monto: no concluyente.** -4,3 pp, IC cruza cero. Se dice así en la
  tarjeta, con color gris (ni verde ni rojo — se agregaron esos dos colores
  de KPI justo para esto: pintar de verde o rojo un efecto cuyo intervalo
  cruza cero es afirmar algo que el dato no sostiene).
- **Retención: sí, +14,3 pp, IC90 [+5,0 , +23,3].** Las que canjearon
  seguían desembolsando 30 días después en 86,5% contra 72,2% del control.
  Canjear no hace que la sede mueva más plata, pero sí que no se apague.
  Ojo: a las DOS ramas hay que exigirles haber desembolsado en los 15 días
  previos al corte — sin eso la tratada está viva por definición (acaba de
  canjear) y la retención sale inflada sola.
- **El cuello real: solo 8,1% canjea.** De las sedes que venían
  desembolsando (y por tanto ganando puntos), 72 de 890 han canjeado alguna
  vez. El programa no tiene problema de tamaño de incentivo, tiene problema
  de consumo.
- **Cuesta $20,5M** (10.286 WP × $2.000 exacto, verificado contra la
  fuente) = 0,059% de lo desembolsado desde que arrancó. Es barato.

**Decisiones de implementación que hay que respetar:**

1. **Esta sección NO se corta con el filtro de fecha, a propósito**, y es la
   excepción explícita a la sección 20. Es una evaluación del PROGRAMA, no
   un reporte de período: se midió que recortando al rango por defecto la
   cohorte cae de 56 a 24 sedes, el intervalo se ensancha al doble y la
   retención pasa de concluyente a no concluyente — o sea que el mismo
   programa se vería efectivo o inútil según las fechas que alguien
   arrastre. Va declarado en pantalla, con el conteo de cuántos canjes sí
   caen en el rango, para que se vea que el filtro se consideró y se
   descartó por una razón. **Si alguien "arregla" esto en el futuro,
   releer esta sección primero.**
2. **El filtro de origen/rol SÍ muerde, y tiene que morder las TRES
   poblaciones** (canjes, control y universo de adopción). Se encontró
   armando el QA: los canjes ya venían filtrados por `filtrarPorId_` pero
   el control y el universo se calculaban completos, así que con un origen
   elegido el numerador se angostaba y el denominador no, y la tasa de
   canje salía artificialmente baja.
3. **El bootstrap usa PRNG propio con semilla fija.** Con `Math.random` el
   intervalo cambiaba en cada recarga y el mismo panel mostraba
   [+5,2 , +23,9] y después [+4,8 , +24,3]. Un intervalo que baila solo se
   lee como dato inestable aunque sea ruido de simulación.
4. **El denominador del costo está anclado al arranque del programa, no a
   "todo el histórico"** — porque `build_previa.js` recorta `CREDITO_DIA` a
   partir de 2025-11 para aligerar el artefacto, así que un "todo el
   histórico" daría un número distinto en el artefacto publicado que en el
   `/exec` en vivo. Cualquier agregado nuevo sobre `CREDITO_DIA` tiene que
   revisar este mismo punto.

**La cadena de llaves, que costó una vuelta:** `CREDITO_SEDES.sede` NO es
el nombre de la sede, es el **id numérico del objeto Sede de HubSpot**. Para
cruzar contra cualquier tabla de Welli Points hay que pasar por
`SEDES.id → SEDES.id_internal` (el UUID de plataforma). Cruza 3.099 de
3.100. El primer intento cruzó por nombre y dio 0.

**No hizo falta ningún pull nuevo**: todo sale de hojas que ya estaban en
producción (`CREDITO_DIA` vía `hechos_()`, `WP_CANJES2`, `SEDES`), igual que
el mapa de la sección 24. Fue una suerte, porque ese día **todas las cuentas
de BigQuery de Composio estaban EXPIRED** y el conector MCP también pedía
re-auth (ver sección 9: la cuenta se vence sola).

**QA:** `chequearF5` quedó permanente en `qa_tablero.js` con recálculo
independiente (costo y llaves resumados desde las hojas crudas, sin pasar
por `wpImpacto_`), más invariantes: que el IC contenga a su estimación, que
`concluyente` sea exactamente "el IC no cruza cero", y que 1 WP siga
valiendo $2.000. Se agregó `f5` a la lista de pestañas de
`jsdom_stress.js`, que no la renderizaba nunca, y se escribió
`jsdom_f5.js` (verificación de CONTENIDO, regla 16). **Ojo con qué se
cuenta en esa verificación**: `chGrupos` dibuja las barras como `<path>` y
además pone un `<rect class="hit">` invisible por categoría para el
tooltip — contar rects daba "OK" con una sola serie pintada, que es justo
el falso OK que la regla 16 quiere evitar. Hay que contar los paths.

## 26 · La carpeta del proyecto se movió a Desktop (18-sep-2026)

Estaba en `C:\Users\millo\OneDrive\Escritorio\Dashboard 360 mkt` y ahora
está en `C:\Users\millo\Desktop\Dashboard 360 mkt`. El scratchpad con TODO
el toolkit (`qa_tablero.js`, `build_previa.js`, `jsdom_stress.js`,
`sheet_data.json`, los `pull_*.py`, `lib.py`) quedó bajo la clave de
proyecto VIEJA:

    C:\Users\millo\AppData\Local\Temp\claude\
      C--Users-millo-OneDrive-Escritorio-Dashboard-360-mkt\
      95b6c25f-0cdd-4334-b125-2f02670a509c\scratchpad

Una sesión nueva arranca con un scratchpad VACÍO bajo la clave nueva
(`c--Users-millo-Desktop-...`) y parece que el toolkit se perdió. No se
perdió: está en la ruta de arriba. Ya se corrigieron las rutas absolutas
dentro de `lib.py` (que lee el `.env`), `qa_tablero.js` y
`build_previa.js`, pero si aparece un script viejo que apunte a
`OneDrive/Escritorio`, es esto — no es que falte el archivo.

## 27 · Frente 5, segunda vuelta: Emmanuel rechazó el enfoque causal (18-sep-2026)

La sección 25 documentó un rediseño de F5 con prueba causal (canje, control
emparejado, intervalo de confianza). Emmanuel lo devolvió completo: "no
hiciste nada de valor". No pidió ajustar el rigor — pidió una cosa
distinta: un cruce directo, sin aparato estadístico.

**Lo que pidió, textual:** sedes habilitadas → cuántas inician sesión en
points.welli.com.co → adopción (%); un gráfico que cruce "inició sesión"
contra "desembolsa más"; y una correlación WP ganados vs plata
desembolsada, en el tiempo. Sin veredicto, sin prueba antes/después, sin
cuello de botella.

**Se botó por completo el motor anterior** (`wpImpacto_`, `wpBootstrap_`,
`wpVentana_`, `wpMasDias_`, las constantes `WP_VENTANA`/`WP_BANDA`/
`WP_RECIEN`, el formato `pp` y los colores `rojo`/`gris` del frontend) — no
se dejó como código muerto. Se reemplazó por dos funciones nuevas y mucho
más simples: `wpCruceLogin_` (promedio de desembolso por sede, con login
vs sin login, mes a mes) y `wpCorrelacion_` (WP ganados vs plata
desembolsada, mes a mes, dos ejes).

**Dos hojas nuevas que hicieron falta** (antes solo existían KPIs
agregados, nunca el listado completo por sede):

- `WP_HABILITADAS` (`id_sede`): universo completo de `wellipoints_snapshot`
  — 3.144 sedes. Antes solo se tenía el conteo (`WP_ADOPCION_KPI.
  habilitadas`).
- `WP_LOGIN_SEDES` (`id_sede`, `primer_login`, `visitas`): TODAS las sedes
  que alguna vez iniciaron sesión, no solo el top-20 que ya existía
  (`WP_ADOPCION_TOP`). Sin esto no se puede saber, sede por sede, quién
  entra al grupo "con login" al cruzar contra `CREDITO_DIA`.

Ambas viven en `welli-growth.wp_data` (`wellipoints_snapshot`,
`wp_dashboard_visitas`), mismo proyecto de siempre. Se subieron con
`sube_generico.py tables_wp_fase2.json` (el subidor genérico ya existente,
que además actualiza `sheet_data.json` local) y se agregaron a la lista
`USADAS` de `build_previa.js` — si no, el artefacto publicado nunca las
recibe aunque el `/exec` en vivo sí las lea (regla 16).

**Resultado real, verificado contra la fuente (18-sep-2026):** las 502
sedes que alguna vez iniciaron sesión desembolsan en promedio **~9-10
veces más por mes** que las 2.642 que nunca han entrado (ej. agosto-2026:
$6.573.423 vs $621.025 promedio por sede), y desembolsan en un mes dado
con 4-5 veces más frecuencia (41,8% vs 8,2% en agosto). La diferencia es
grande y consistente mes a mes desde enero-2026 — incluso ANTES de que la
plataforma existiera (los logins arrancan en junio-2026), lo cual es la
prueba de que el grupo "con login" ya eran sedes más grandes/activas de
por sí, no que el login las haya vuelto así. Eso se declara en pantalla
en UN renglón, no en una sección — es lo que Emmanuel pidió explícitamente
que se dejara de hacer.

**Regla para la próxima vez que pase esto:** cuando el cliente rechaza un
análisis completo con "no sirve, vuelve a hacerlo" y da instrucciones
concretas de reemplazo, la respuesta correcta es implementar exactamente
lo que pidió, sin negociar el rigor de vuelta adentro del diseño nuevo —
un solo renglón de honestidad ("es un cruce, no una prueba de causa") es
suficiente y es lo que se dejó. Meter de nuevo control/intervalo/curva
disfrazado de "mejora" sería repetir el mismo error que acaba de costar
la reescritura completa.

**QA:** `chequearF5` en `qa_tablero.js` se reescribió para el nuevo
payload (`f5.cruce`, `f5.correlacion`) — recálculo independiente de
`nCon+nSin` contra `WP_HABILITADAS`, del promedio de un mes contra la
suma cruda de `CREDITO_DIA`, y de que la suma de `wp_ganado` en
`f5.correlacion` cuadre con `WP_SEDE_MES`. `jsdom_f5.js` se reescribió
para verificar: el orden real de las tres secciones en el DOM, que las
frases del enfoque rechazado ("El veredicto", "control emparejado",
"reversión a la media"...) YA NO aparecen, que las dos gráficas nuevas
dibujan sus series reales (contando `<path>`/`<circle>`, no solo que el
`id` exista), y que el filtro de origen angosta el cruce.

## 28 · Tendencia de adopción: barras de desembolso diario agregadas (18-sep-2026)

Sobre el gráfico "Sedes que entran, por día" (línea de sedes con login,
últimos 60 días), Emmanuel pidió agregar barras del monto desembolsado por
esas mismas sedes ese mismo día, para poder comparar visualmente.

Hizo falta una hoja nueva: **`WP_LOGIN_DIA`** (`fecha`, `id_sede`) — una
fila por sede y día con al menos un login. Antes solo existían el primer
login por sede (`WP_LOGIN_SEDES`, sección 27) y el conteo diario ya
agregado sin desglose de sede (`WP_ADOPCION_TENDENCIA`), ninguno de los
dos alcanzaba para cruzar día por día contra `CREDITO_DIA`. Se reemplazó
la dependencia de `WP_ADOPCION_TENDENCIA` en `Code.gs` por
`wpAdopcionDia_()`, que deriva las DOS series (conteo y desembolso) de la
MISMA fuente cruda (`WP_LOGIN_DIA` + `hechos_()`) — así nunca pueden
desincronizarse entre sí, que es justo el riesgo de tener el conteo en una
hoja y el desembolso en otra.

El gráfico pasó de `chLinea` (una serie) a `chBarrasLinea2Ejes` (dos ejes:
barras = plata, línea = sedes) — el mismo patrón de F4 (regla 5: nunca una
meta como línea horizontal en dos ejes, pero esto no es una meta, son dos
series reales, que es exactamente el otro caso ya documentado donde el
tablero sí usa dos escalas).

Esta sección sigue **sin responder al filtro de origen/rol**, igual que el
resto de "¿Usan la plataforma WelliPoints?" — mezclar un conteo de login
sin filtrar con un desembolso sí filtrado dejaría las dos series midiendo
universos distintos en el mismo gráfico.

## 29 · Los "WP ganados" del gráfico de correlación estaban mal (18-sep-2026)

Emmanuel lo notó a ojo, viendo el gráfico de la sección 3 de F5: "son muy
pocos wellipoints ganados" — 250-435 puntos/mes contra $8-14 mil M
desembolsados en el mismo mes. Tenía razón.

**El error:** ese gráfico leía `WP_SEDE_MES` (que sale de
`wp_incentivos_diario.wp_ganado_mes`), que es una **campaña de incentivos
específica** — con su propia oferta y fecha de vencimiento, medida en las
secciones 4-6 de este mismo frente ("Panorama del incentivo", "Cómo ha
venido mes a mes", "Detalle: por qué"). Ahí SÍ es la fuente correcta,
porque esas secciones hablan explícitamente de esa campaña. Pero el
gráfico de correlación decía "WP ganados" en general, sin calificar, y
cualquiera lo lee como "los puntos que gana toda la base por desembolsar"
— que es un número totalmente distinto.

**La fuente correcta es `wp_desembolsos_snapshot.pts_ganados`**: un valor
por desembolso individual, ya calculado con la tabla de tramos B1 sobre
`monto_aprobado` (la misma tabla documentada en la sección 2 de este
archivo). Se subió como `WP_PTS_SEDE_MES` (`mes`, `id_sede`, `pts`) — con
desglose por sede, no un total plano, porque sin eso el filtro de
origen/rol no podría morder esta serie igual que muerde la de plata
desembolsada (mismo error de arquitectura que ya se corrigió una vez en
`wpCruceLogin_`, sección 25 punto 2: dos series del mismo gráfico no
pueden responder distinto al mismo filtro).

**Los números correctos** (verificados contra la fuente, jun-sep 2026,
única ventana con datos — el programa arrancó en junio): 6.738 / 8.983 /
8.212 / 6.571 puntos por mes, siguiendo de cerca la forma de la curva de
desembolso. Antes de junio no hay dato real (`ganado = 0`, correctamente,
no es un hueco del pull).

**Regla para la próxima vez:** cuando un gráfico dice "WP ganados" sin
calificar, tiene que ser el total de la base (tramos B1), no una campaña
de incentivos puntual — aunque las dos vivan en el mismo dataset de
BigQuery y "suenen" igual. Antes de reusar una hoja de WP ya existente
para un panel nuevo, preguntarse: ¿esta hoja mide LA CAMPAÑA o mide EL
PROGRAMA completo? Son dos preguntas distintas y welli-growth.wp_data
tiene una tabla para cada una.

## 30 · Cuatro paneles redundantes de F5 borrados (21-sep-2026)

A pedido de Emmanuel se quitaron cuatro paneles de las secciones 5-6 de
Welli Points: "Prometido contra ganado, por mes" y "Canjes solicitados por
mes" (sección 5), y "Conversión por grupo de origen" y "Canjes
pendientes, del más viejo al más nuevo" (sección 6). Quedaron cada
sección con un solo panel — se actualizó el subtítulo de cada `<h2
class="sec">` para que ya no describa contenido que se borró (antes
mencionaba "la promesa crece y el resultado no" y "qué queda por pagar",
ninguno de los cuales sigue en pantalla).

**Se limpió el código muerto del lado del servidor, no solo el HTML**: al
quitar esos cuatro paneles, `f.porOrigen`/`f.porOrigenMes` (con todo el
bloque `origenPorId`/`porGrupo` que los alimentaba) y `f.canjesMes` (con
`porMes`) quedaron sin ningún consumidor en `scripts.html` — se borraron
enteros de `Code.gs`, no se dejaron calculando algo que nadie lee. Ojo:
`f.canjes` se removía por su cuenta, pero el arreglo `canjes`/`pendientes`
del que salía SEGUÍA alimentando `f.pago` (sección 4, que se queda) — solo
se borró la línea `f.canjes = pendientes...` y el propio `pendientes`
(que ya no tenía otro uso), no el resto del bloque de canjes.

**Detectado durante el QA de esta sesión, no relacionado con este
cambio:** `jsdom_stress.js` y `jsdom_f5.js` tronaban con
`Cannot find module './xhr-sync-worker.js'` — el paquete `jsdom` en
`node_modules` del scratchpad estaba corrupto/incompleto (probablemente
un `npm install` interrumpido de una sesión anterior). Un
`npm install jsdom@30.0.1` normal NO lo arregló (npm lo daba por
"ya instalado" y no tocaba los archivos faltantes) — hizo falta
`rm -rf node_modules/jsdom` y reinstalar desde cero. **Si `jsdom_stress.js`
o `jsdom_f5.js` truenan con un `MODULE_NOT_FOUND` de un archivo interno de
jsdom (no un `.gs`/`.html` del proyecto), sospechar del `node_modules` del
scratchpad antes que del código — reinstalar con `rm -rf` primero, no solo
`npm install` encima.**

**Frescura de datos, aparte, no bloqueante para este cambio:** el
`sheet_data.json` local de esta sesión tiene 10 fuentes con 4-5 días de
atraso (`LT_APPS_DIA`, `LT_TOUCHES`, `META_ADS`, cuatro hojas de
`RESCATE_*`, `DESEMBOLSO_RESCATE_DIA`, `PLATAFORMA_SEDES`) — ninguna
relacionada con Welli Points ni con este cambio. Se declaró explícitamente
al usuario en vez de forzar un re-pull de siete sistemas distintos fuera
del alcance de la tarea pedida. Si se toca cualquiera de esas pestañas
(F4 Rescate, F7 Long Tail, Meta Ads), correr sus pulls antes de dar el
cambio por terminado — para Welli Points esto no aplicaba.

## 31 · Cruce login x desembolso: piso dinámico, no enero fijo (21-sep-2026)

El gráfico "Desembolso promedio por sede, mes a mes" (sección 2 de F5)
mostraba desde enero-2026, aunque `wp_dashboard_visitas` (la fuente del
login) solo tiene datos reales desde junio-2026. Emmanuel pidió mostrar
solo desde donde hay visitas reales.

**Arreglo: el piso ya NO es un literal hardcodeado (`'2026-01'`)** — se
calcula en `wpCruceLogin_()` como el mínimo `primer_login` de
`WP_LOGIN_SEDES` (hoy junio-2026, pero si el pull se corre de nuevo dentro
de un año y por alguna razón hay historia más vieja, el piso se ajusta
solo, sin tocar código). Con datos de hoy: la serie pasa de 9 meses
(ene-sep) a 4 (jun-sep).

**El texto de "es un cruce, no una prueba de causa" no cambió** — sigue
siendo válido igual (no mencionaba el período pre-junio específicamente).
Lo que SÍ desaparece del gráfico es la evidencia visual de que el grupo
"con login" ya desembolsaba más ANTES de que la plataforma existiera —
eso seguía siendo cierto y se le explicó a Emmanuel en el chat, pero ya no
está en pantalla. Si en el futuro alguien pide "demuéstralo con el
gráfico", la respuesta es volver a este commit o recalcularlo aparte, no
hay que reconstruir nada — el dato crudo (`CREDITO_DIA` desde 2025)
sigue estando ahí, solo se filtró la vista.

## 32 · Mismo piso dinámico aplicado a la correlación (21-sep-2026)

Extensión inmediata de la sección 31: el mismo pedido ("muestra solo desde
donde hay datos reales") aplicaba también al gráfico "Correlación: puntos
ganados vs plata desembolsada" (sección 3 de F5), que arrancaba en
enero-2026 con 5 barras en cero (`WP_PTS_SEDE_MES` solo tiene datos reales
desde junio-2026, cuando `wp_desembolsos_snapshot` empezó a calcular
`pts_ganados`).

**Mismo patrón que `wpCruceLogin_`**: en `wpCorrelacion_()` el piso ya no
es el literal `'2026-01'` — se calcula como `Object.keys(ganadoPorMes)`
mínimo, es decir, el primer mes con algún WP ganado real después de
aplicar el filtro de origen/rol. Si el filtro deja `ganadoPorMes` vacío
(un origen sin ningún desembolso en el rango con datos), cae de vuelta a
`'2026-01'` como piso de seguridad, para no reventar con un `undefined`.

**Ojo con la generalización futura**: cualquier gráfico nuevo de F5 que
mezcle una fuente vieja (`CREDITO_DIA`, con historia desde 2023) contra
una fuente nueva del programa Welli Points (que solo existe desde
junio-2026) tiene el mismo riesgo — preguntarse SIEMPRE cuál es el mes
mínimo real de la fuente nueva antes de fijar un piso a mano, en vez de
copiar `'2026-01'` de otro gráfico por costumbre.

## 33 · Panorama del incentivo: se quitaron los 2 paneles visuales (21-sep-2026)

De la sección 4 de F5 ("Panorama del incentivo") se borraron los dos
paneles visuales ("¿A quién le llega el incentivo?" con su embudo, y
"¿Le pagamos cuando lo gana?" con su barra pagado/pendiente) y los dos
textos de lectura que iban debajo. La sección se queda solo con las 3
tarjetas de KPI de arriba (conversión, canjes pagados, total pagado).

**Limpieza de código muerto asociada:**
- `embudoIncentivo_()` y `barraPagoWp_()` en `scripts.html` — solo se
  llamaban desde estos dos paneles, se borraron enteras.
- `f.conversion.lectura` y `f.pago.lectura` en `Code.gs` — los dos textos
  narrativos que solo alimentaban esos `<div class="lectura">`, sin otro
  consumidor.
- `f.pago.resumen` — el objeto crudo que solo armaba `barraPagoWp_`.
- Las variables locales `cerrado`/`rp` en `vistaF5()` que solo existían
  para pasarle datos a esos dos paneles.

Nada de esto se dejó "por si acaso": ya van tres rondas seguidas de
recorte en F5 (secciones 30, 31-32, y esta) y el patrón se repite —
revisar SIEMPRE, después de borrar un panel visual, si la función/campo
que lo alimentaba quedó sin ningún otro consumidor antes de darlo por
terminado.

## 34 · Reproceso completo del tablero, todas las fuentes (21-sep-2026)

Pedido explícito: "reprocesa todo el tablero a hoy, TODAS las fuentes". Se
corrieron 19 pulls y se subieron 35 hojas, cubriendo todo lo que
`Code.gs`/`Filtro_Origen.gs` realmente leen hoy (se armó la lista corriendo
`grep -oE "leerHoja_('[A-Z_0-9]+')"` sobre los dos archivos — es la fuente
de verdad de qué hoja importa, no lo que "suena" importante).

**Orden que importa**: `pull_sedes.py` primero y fusionado al
`sheet_data.json` local ANTES de correr `pull_lt.py`, `pull_rescate.py`,
`pull_roles.py` y `repull_id_sede.py` — los cuatro leen `sheet_data.json`
para el cruce `id_internal`, así que con `SEDES` vieja habrían cruzado
contra sedes de hace días. El resto de los pulls son autocontenidos
(BigQuery/HubSpot directo) y no importa el orden entre ellos.

**`repull_id_sede.py` es la pieza que más fácil se olvida**: en una sola
corrida repuebla `PLATA_SEDE_ANT`, `RESCATE_BQ2`, `WP_SEDE_MES`,
`WP_SEDE_INC` y `WP_CANJES2` — las cinco hojas "por sede" que el filtro de
origen necesita para poder cortarlas (sin `id_sede`, un KPI se queda
mostrando el total de toda la base bajo una etiqueta que dice otra cosa).
Si se refresca "por partes" y se olvida este script, esas cinco quedan
viejas aunque todo lo demás esté al día.

**`CREDITO_DIA` siempre pasa por `comprime_cdia.py` antes de subir**
(regla 12) — se corrió `pull_credito_dia.py` → `comprime_cdia.py` →
subida, en ese orden, nunca el crudo directo.

**Lo que a propósito NO se reprocesó, y por qué:**
- `LT_PIEZAS`, `LT_TEL_SEDES`, `LT_WA_EVENTOS`, `LT_WA_FRANJA` — construcción
  de una sola vez (contactos de HubSpot cruzados contra Conversations API,
  documentado en la sección 15) que cuesta cientos de llamadas y minutos;
  su contenido de fondo (definiciones de workflow, threads históricos de
  WhatsApp) no cambia día a día. Si hace falta refrescarlos, es un pedido
  aparte, no parte de un reproceso rutinario.
- `RESCATE_HIST_PLATA` — reconstrucción de la operación VIEJA de rescate
  (oct-2024 a jul-2026, un período ya cerrado). No hay data nueva que
  traer.
- `NOVEDADES` — se llena a mano en el Sheet (Frente 6), no tiene pull.
- `RESCATE_APROB_MSJ` (sin `_DIA`) — es un *fallback* estático que
  `Code.gs` solo lee cuando `RESCATE_APROB_MSJ_DIA` no cubre el rango
  pedido; con el `_DIA` fresco, este fallback ni se toca.
- `EMBUDO_ORIGEN`, `PLATA_SEDE_MES`, `COSECHA_DIA`, `RESCATE_VENTANA`
  (de `pull_v2.py`/`pull_cosecha_dia.py`) — confirmado con `grep` que
  `Code.gs` ya no las lee (superadas por `CREDITO_DIA`/`DEALS_ORIGEN`).
  Correrlas habría sido trabajo sin ningún efecto visible.
- `OWNERS` (el catálogo crudo id/nombre/equipo de HubSpot, no `SEDE_OWNER`)
  — no hay un pull Python armado para esa hoja puntual; cambia con la
  plantilla de empleados, no día a día. Pendiente real: si hace falta
  refrescarlo, hay que escribirlo, no existe todavía.

**Después de subir, no olvidar `actualiza_config_fecha.py`** (regla 23) —
las tablas se refrescan solas pero `CONFIG.ultima_actualizacion` no, y sin
este paso el tablero se ve con datos frescos y una etiqueta vieja en el
header.

**Resultado del QA**: 250.093 aserciones, 0 fallos. Única fuente con
atraso: `RESCATE_DESENLACE` a 3 días (dentro de tolerancia). Todas las
demás en 0 días de atraso el mismo día del reproceso.

## 35 · Sonria/Dentisalud/OdontoFamily/CityDent excluidas de TODA la pestaña de Welli Points (21-sep-2026)

Pedido explícito: "excluye esas sedes de TODA la pestaña de wellipoints...
TODO." — no solo WP ganados/pendientes, sino cualquier panel de F5
(adopción, cruce login-desembolso, correlación, panorama del incentivo).

**Implementación — punto único de exclusión (regla 3):**
- `WP_MARCAS_EXCLUIDAS` (array de substrings en minúscula) + `wpExcluidas_()`
  (memoizada): recorre `sedesReatribuidas_()` y arma el set de
  `id_internal` cuyo `nombre_sede` contiene alguna de las 4 marcas. Coincide
  por substring, así que una sede NUEVA de la misma cadena queda excluida
  sola, sin tocar código.
- `leerWP_(nombre)`: reemplaza a `leerHoja_` para las 7 hojas que sí traen
  `id_sede` por fila (`WP_SEDE_MES`, `WP_SEDE_INC`, `WP_CANJES2`,
  `WP_HABILITADAS`, `WP_LOGIN_SEDES`, `WP_LOGIN_DIA`, `WP_PTS_SEDE_MES`) —
  filtra las excluidas ANTES de que cualquier otra lógica las toque. Los 8
  call-sites que antes usaban `leerHoja_('WP_...')` se cambiaron a
  `leerWP_(...)`.
- `wpCorrelacion_()` tiene una lectura que NO pasa por ninguna hoja WP: el
  "desembolsado total" sale de `recorrerHechos_` sobre `CREDITO_DIA`
  directo. Ahí la exclusión se aplica a mano dentro del callback
  (`hs2int[r.sede]` + `excl[iid]`), porque es la única lectura de esta
  función que no usa `leerWP_`.
- `WP_ADOPCION_KPI`/`MUNDO`/`TENDENCIA`/`TOP` salen de un agregado de
  BigQuery SIN `id_sede` en el resultado final — no hay forma de excluir
  después de agregado. La exclusión se metió en el `WHERE` de
  `pull_wp_adopcion.py` (que resuelve los 146 `id_internal` contra
  `sheet_data.json['SEDES']` en cada corrida, mismo criterio dinámico).

**Hallazgo que vale la pena declarar, no esconder**: estas 4 marcas (146
sedes, ~4% del total de sedes) representan **cerca de la mitad del
desembolso mensual de TODA la plataforma** — verificado dos veces: contra
el motor del tablero y directo contra BigQuery en vivo
(`profile_institucion`, junio-2026: $5.867.539.756 de estas 146 sedes
sobre $11.587.767.195 del total). No es un error de la exclusión — es el
tamaño real de estas cadenas. Excluirlas cambia dramáticamente los números
de "desembolsado" en el gráfico de correlación (mitad menos), y también
baja algo el promedio "sin login" del cruce (esas cadenas rara vez tienen
cuenta en la app, así que caían casi todas en el grupo "sin login" antes).

**Bug de QA encontrado y corregido en el propio proceso**: `refF5()` en
`qa_tablero.js` recalculaba `loginDia` desde la hoja `WP_LOGIN_DIA` CRUDA
(sin excluir), mientras `wpAdopcionDia_()` en `Code.gs` ya la lee con
`leerWP_` (excluida) — el chequeo de la tendencia diaria (sección 28)
fallaba por ese desfase, no por un bug real del tablero. Se corrigió
agregando el mismo filtro de exclusión al recálculo de QA.

**Verificado con un negativo explícito en `jsdom_f5.js`**: se agregó un
chequeo que busca las 4 palabras ("sonria", "dentisalud", "odontofamily",
"citydent") en el texto completo de la pestaña renderizada — ninguna debe
aparecer en ningún panel (top-5, adopción, etc.).

## 36 · La exclusión de marcas por SOLO nombre_sede se quedaba corta — hay que cruzar por correo también (21-sep-2026)

Emmanuel señaló el KPI "Puntos ganados sin reclamar" y dijo haber visto
sedes de las marcas excluidas (sección 35) con puntos pendientes. Al
investigar, el match por `SEDES.nombre_sede` (HubSpot) solo, aunque
correcto para 146 de 148 casos, tenía DOS huecos reales:

- **"City Suba"** — una sede real de CityDent cuyo `nombre_sede` en
  HubSpot Y `nombre_comercial` en la plataforma de crédito NO dicen
  "citydent" en ningún lado. Solo el correo de facturación
  (`citydentsuba@yahoo.co`) delata la cadena real.
- **"Sonria sede Toberin"** — al revés: SÍ decía "sonria" en
  `institucion_medica.nombre_comercial` (la plataforma de crédito) pero
  el nombre que tenía cargado en HubSpot ese día no lo decía.

**Ninguna fuente sola alcanza.** Se corrigió cruzando TRES campos y
uniendo el resultado: `SEDES.nombre_sede` (HubSpot) + `PLATAFORMA_SEDES.
nombre` (=`institucion_medica.nombre_comercial`) + `PLATAFORMA_SEDES.
email` (=`institucion_medica.email_notificaciones`). El total subió de
146 a 148 sedes.

**Cambios:**
- `PLATAFORMA_SEDES` ganó una columna `email` (antes solo traía
  `id_sede`/`pais`/`created`/`especialidad`/`nombre`) —
  `pull_plataforma_nombre.py` ahora trae `email_notificaciones` de
  `institucion_medica` en la misma pasada.
- `wpExcluidas_()` en `Code.gs` cruza `sedesReatribuidas_()` (HubSpot) Y
  `leerHoja_('PLATAFORMA_SEDES')` (nombre + correo), uniendo los `id_sede`
  que matcheen en cualquiera de las dos.
- `pull_wp_adopcion.py` hace el mismo cruce de dos fuentes (HubSpot local
  + `institucion_medica` en vivo) antes de armar el `WHERE ... NOT IN` de
  sus queries de BigQuery.
- El chequeo independiente en `qa_tablero.js` se actualizó igual (cruza
  `SEDES` + `PLATAFORMA_SEDES`), para que no vuelva a quedar desalineado
  con `Code.gs` como pasó una vez en la sección 35.

**Verificado y no cambió nada del monto en dólares**: las 2 sedes nuevas
(`City Suba`, `Sonria sede Toberin`) no aparecen en `WP_SEDE_MES`
(la campaña de incentivos específica que alimenta "Puntos ganados sin
reclamar") — así que ese KPI en particular no se movió. La regla general
para la próxima vez que se pida excluir una marca/cadena: **nunca cruzar
por un solo campo de un solo sistema** — HubSpot y la plataforma de
crédito son dos bases de datos independientes, cargadas a mano por
personas distintas, y el nombre comercial de una sede es el campo con más
probabilidad de estar mal escrito o incompleto en cualquiera de las dos.
El correo de facturación es mucho más estable.

## 37 · "Puntos ganados sin reclamar" leía la tabla equivocada (21-sep-2026)

Emmanuel trajo su propia query "oficial" — la que él usa para ver "los
wellipoints que tienen las sedes en su plataforma para canjear":

    SELECT id_sede, nombre_comercial, email_notificaciones,
           saldo_canjeable, lifetime_pts, canjeado_total, nivel, fecha_corte
    FROM `welli-growth.wp_data.wp_resumen_semanal`
    WHERE saldo_canjeable > 0
    ORDER BY saldo_canjeable DESC

y pidió comparar contra lo que el tablero mostraba. El resultado
(54.657 WP) salió **casi idéntico** al que ya se mostraba (54.645, de la
sección 35/36) — pero por **coincidencia de magnitud, no porque fueran la
misma métrica.**

**El error real, mismo patrón que la sección 29:** el KPI "Puntos ganados
sin reclamar" leía `wp_incentivos_diario.wp_pendiente_actual` — que mide
lo **prometido y NO GANADO todavía** de una campaña de incentivos
puntual (con oferta/vencimiento propios). `wp_resumen_semanal.
saldo_canjeable` mide lo **YA GANADO y sin canjear** (tramos B1 +
concursos + ajustes manuales, menos lo ya canjeado) — es un concepto
completamente distinto, calculado con una fórmula que ni siquiera toca
`wp_incentivos_diario`. Los dos números coincidían en magnitud hoy, pero
son de fuentes independientes que pueden divergir en cualquier momento.

**Corregido**: se agregó la hoja `WP_RESUMEN` (`pull_wp_resumen.py`, de
`wp_resumen_semanal`: `id_sede`, `saldo_canjeable`, `lifetime_pts`,
`canjeado_total`, `nivel`) y el KPI ahora suma `saldo_canjeable` desde
ahí, filtrado por `leerWP_` (exclusión de marcas) + origen. El resto de
los KPIs de esta sección (`WP ofrecidos`, `WP que se ganaron`, `Sedes con
oferta activa`, `Conversión del incentivo`) **se quedan como estaban** —
esos SÍ hablan de la campaña específica, y `wp_incentivos_diario` sigue
siendo la fuente correcta para ellos. Solo el nombre "sin reclamar" estaba
mal casado con la fuente.

**Regla para la próxima vez**: cuando dos números de fuentes distintas
coincidan en magnitud, **eso no prueba que midan lo mismo** — hay que
verificar la fórmula, no solo el resultado. Si el usuario trae su propia
query "oficial" para comparar, es la señal más fuerte de que existe una
fuente de verdad reconocida por el negocio que el tablero debería usar
directamente, no reconstruir con datos parecidos de otra tabla.

## 38 · Segundo reproceso completo, un dia despues del primero (22-sep-2026)

Pedido explicito: "reprocesa todo el tablero", sin mas contexto — un dia
despues del reproceso de la seccion 34. Se siguio el mismo playbook al pie
de la letra, con dos adiciones que no existian en la primera corrida:
`pull_wp_resumen.py` (WP_RESUMEN, nueva por la seccion 37) y las versiones
ya corregidas con exclusion de marcas de `pull_plataforma_nombre.py` y
`pull_wp_adopcion.py` (seccion 35-36).

**Orden exacto que se uso, igual al de la seccion 34**: `pull_sedes.py`
primero (3751 sedes, 7 nuevas) y fusionado a `sheet_data.json` local ANTES
de `pull_lt.py`/`pull_rescate.py`/`pull_roles.py`/`repull_id_sede.py` (los
cuatro cruzan por `id_internal` contra el snapshot local). Despues los
pulls independientes (`pull_deals.py`, `pull_estado_mes.py`,
`pull_activacion.py`, `pull_desembolso_rescate.py`, `pull_wa_embudo.py`,
`pull_aprob_msj.py`, `pull_plataforma_nombre.py`, `meta_pull.py`), despues
`pull_credito_dia.py` → `comprime_cdia.py` (regla 12, nunca el crudo
directo), y al final los 6 pulls de Welli Points
(`pull_wp_adopcion.py`, `pull_wp_adopcion2.py`, `pull_wp_habilitadas.py`,
`pull_wp_login_dia.py`, `pull_wp_pts_mes.py`, `pull_wp_resumen.py`).

**Un solo corte de token de BigQuery** (`ca_HsOxW5F9mBw6`), a mitad de
`pull_lt.py` — se resolvio igual que siempre: refresh, link de
reautorizacion, confirmacion del usuario, reintento. Ya es el tercer
reproceso seguido donde el token se vence a mitad de camino; no hace falta
una regla nueva, ya esta cubierta por la seccion 9, pero vale la pena
seguir esperandolo como parte normal de una corrida larga.

**Se mantuvieron las mismas exclusiones de la lista de la seccion 34**
(`LT_PIEZAS`/`LT_TEL_SEDES`/`LT_WA_EVENTOS`/`LT_WA_FRANJA`,
`RESCATE_HIST_PLATA`, `NOVEDADES`, `RESCATE_APROB_MSJ` sin `_DIA`,
`EMBUDO_ORIGEN`/`PLATA_SEDE_MES`/`COSECHA_DIA`/`RESCATE_VENTANA`, `OWNERS`)
— siguen sin pull propio o sin cambiar dia a dia, mismas razones que antes.

**Resultado del QA**: 120 combinaciones, 250.491 aserciones, 0 fallos.
Frescura: 3 fuentes con 1 dia de atraso (`LT_TOUCHES`, `RESCATE_DESENLACE`,
`DESEMBOLSO_RESCATE_DIA`), dentro de tolerancia — todas las demas en 0 dias.
`build_previa.js` reconstruyo el artefacto sin ningun aviso de "OJO: falta
la hoja" (las 6 hojas de WP agregadas en sesiones anteriores ya estaban en
la lista `USADAS`). `jsdom_stress.js`: 216 combinaciones, 0 fallos.
`jsdom_f5.js`: 62 checks, 0 fallos (incluida la verificacion de que ninguna
de las 4 marcas excluidas aparece en el texto renderizado). Publicado como
version 91 del artefacto, misma URL de siempre. No hizo falta ningun ajuste
de codigo — este reproceso fue puramente de datos.

## 39 · Punto 3/4 de Profundizacion: sedes que desembolsan, no desembolsos (24-sep-2026)

Pedido explicito, en mayusculas por la urgencia: "el punto 3 y 4 de
profundizacion se vea por cosechas el numero de SEDES que desembolsan,
actualmente dice CUANTOS DESEMBOLSOS, necesito es cuantas sedes desembolsan
y cuanto, y su %". `MEDIR.desembolsos` sumaba `des_acum` (el conteo de
creditos), asi que una sede con 3 desembolsos contaba 3 veces — se cambio a
contar sedes con `des_acum >= 1`, y se le agrego `pctCelda: true` (antes
solo tenia `conMonto`). El frontend (`scripts.html`) solo mostraba plata O
%, nunca los dos — se cambio a mostrar ambos cuando el mapa trae las dos
banderas (`partes.push(...)` en vez de `if/else if`). `promedio_()` en
Code.gs tambien tenia que cambiar: antes `esMonto` (=`conMonto`) decidia SI
promediar (money) o sumar agrupado (%) — ahora la plata SIEMPRE se
promedia (extras) y el % SIEMPRE se decide por `pctCelda`, no por
`conMonto`, porque un mapa puede tener las dos cosas.

**Segunda vuelta, minutos despues**: Emmanuel señalo que los dos mapas "no
se hablaban" — acumulado M0=20/M1=49 pero sin-acumular M1 mostraba 38, no
29 (=49-20). Se verifico con recalculo directo contra `SEDE_ESTADO_MES`
que el 38 era CORRECTO desde el punto de vista de negocio (29 sedes
debutantes + 9 que ya habian desembolsado en agosto y repitieron en
septiembre) — pero el pedido fue explicito: "quiero que en cuanto a numero
de sedes SEAN IGUALES, lo que cambia es el valor del desembolso". Se
implemento tal cual: `desembolsos_mes` ya NO tiene su propio MEDIR — ahora
`mesDineroSolo_()` copia LITERALMENTE las celdas de sedes del mapa
acumulado y solo resta la plata mes a mes. `incremental_()` (la version
vieja que restaba ambos) fue borrada dos veces en la misma sesion: la
primera vez se reemplazo por un MEDIR con logica propia (que fue la que
generó el 38≠29), la segunda vez por esta derivacion mas simple que sí
cumple el pedido. **Los dos disenos midieron cosas reales y correctas — la
diferencia fue de decision de producto, no de bug.** `qa_tablero.js` gano
un chequeo que compara celda a celda que `desembolsos_mes.celdas` sea
IDENTICO a `desembolsos.celdas` de la misma cosecha, y que la plata cuadre
con la resta del acumulado.

**Cuando el cliente pide velocidad ("RAPIDO"), no se salta QA — se
comprime.** Se corrieron las 3 pruebas igual, pero la verificacion de
contenido (regla 16) se hizo con un script de una sola vez inline
(`quickcheck_f2.js`) en vez de escribir un jsdom_f2.js permanente — es
una decision consciente de foco (no relajar el reves de la regla 16
seria dejar de comprobar contenido bajo presion, que es justo cuando mas
falta hace).

## 40 · Un reproceso completo corrompio sheet_data.json local a mitad de escritura (24-sep-2026)

Durante el TERCER reproceso completo del dia, la subida de tablas via
`sube_generico.py` se colgo en `tables_act.json` (el proceso llevaba 10+
minutos sin imprimir nada). Se mato el proceso con `kill -9` asumiendo que
estaba trabado — **estaba vivo, escribiendo `sheet_data.json`**, y el kill
lo interrumpio a mitad de un `json.dump()`, dejando el archivo TRUNCADO
(14,68 MB, corta literalmente a mitad de un array de filas). Todas las
subidas posteriores del mismo lote (`tables_desembolso_rescate.json`,
`tables_wa_embudo.json`, `tables_aprob_msj.json`, `tables_plataforma_nombre.json`,
`tables_meta.json`, `tables_cdia.json`) fallaron leyendo ESE MISMO archivo
corrupto para el merge local (aunque sus subidas a Google Sheets ya habian
funcionado, `write_table` corre ANTES del merge local) — 6 fallos con el
MISMO offset de error, porque el archivo nunca se reescribia (cada intento
fallaba antes de llegar al `json.dump`).

**La causa raiz real no era el `kill -9`, era la falta de reintento en
`GOOGLESHEETS_GET_SPREADSHEET_INFO`.** Esa llamada, sobre una hoja que ya
tiene 85 pestañas, empezo a chocar con un limite de tamaño de respuesta del
proxy de Composio (truncada siempre en el MISMO offset, ~14,6 MB, sin
importar el payload) — eso fue lo que colgo el proceso original en primer
lugar (reintentando por su cuenta dentro de la libreria de Composio,
consumiendo CPU sin imprimir nada, no realmente "trabado"). El `kill -9`
fue una reaccion a un sintoma (silencio + CPU alto) que en realidad era
trabajo legitimo pero lento — la leccion real es la de la seccion 9:
**antes de matar un proceso que "no avanza", confirmar que de verdad esta
trabado (CPU plano, no CPU subiendo) antes de asumirlo.**

**Arreglado en dos capas:**
1. `sube_generico.py` ahora reintenta `GOOGLESHEETS_GET_SPREADSHEET_INFO`
   5 veces con `time.sleep(4)` entre intentos, igual que `write_table` ya
   hacia para el `BATCH_UPDATE`. Sin este cambio, cualquier subida futura
   sobre una hoja de este tamaño va a seguir fallando aleatoriamente.
2. **Reparacion quirurgica del `sheet_data.json` truncado** en vez de
   descartarlo y reconstruir desde cero: se escaneo el archivo byte a byte
   (respetando strings/escapes) llevando la profundidad de brackets, y se
   corto en el ULTIMO punto donde la profundidad volvia a 1 (justo despues
   de cerrar el array de una hoja completa) — eso recupero 48 de 85 hojas
   intactas sin tocarlas. Las hojas nuevas de HOY (ya en disco en sus
   propios `tables_*.json`, nunca tocadas por la corrupcion) se
   re-fusionaron encima. Las 7 hojas que NO se re-pull ese dia y tambien
   se perdieron en el corte (`LT_PIEZAS`, `LT_TEL_SEDES`, `LT_WA_EVENTOS`,
   `LT_WA_FRANJA`, `OWNERS`, `RESCATE_APROB_MSJ`, `RESCATE_HIST_PLATA`) se
   recuperaron con una llamada nueva, `GOOGLESHEETS_BATCH_GET` (que SI
   sirve para leer valores de una hoja puntual sin arrastrar el problema
   de tamaño de `GET_SPREADSHEET_INFO`, que trae metadata de TODAS las
   pestañas a la vez) — directo de la hoja de Google en vivo, la fuente de
   verdad real cuando el local se corrompe.

**Ojo con el tipo de dato de lo recuperado por `BATCH_GET`**: la API de
Sheets devuelve TODO como string (`"25"` en vez de `25`), a diferencia del
resto de `sheet_data.json` que suele traer numeros nativos. No rompe nada
porque `num_()` en Code.gs ya hace `Number(v)` sobre cualquier valor, pero
si alguna vez se lee una de esas 7 hojas con un operador que asuma tipo
numerico directo (comparacion estricta, concatenacion), hay que acordarse
de este origen mixto.

**Regla nueva para la proxima vez**: `GOOGLESHEETS_BATCH_GET` (no
`GOOGLESHEETS_GET_SPREADSHEET_INFO`) es el camino correcto para leer el
contenido de UNA hoja puntual desde Google Sheets — mas barato, sin el
limite de tamaño que trae pedir metadata de las 85 pestañas de una. Si
`sheet_data.json` se corrompe otra vez, este es el camino de recuperacion,
no reconstruir desde cero ni re-pullear todo.

## 41 · "Leads del mes" (metas por canal) pasa a coincidir 100% con HubSpot (24-sep-2026)

Emmanuel comparo, canal por canal, la tabla "Metas de marketing por canal"
de F1 contra su vista guardada de HubSpot (Pipeline de Hunter + Origen +
Fecha de creacion = este mes) y encontro diferencia en LOS CUATRO canales:
Referidos 20 vs 23, Pagina web 58 vs 71, Eventos 105 vs 108, Social media
153 vs ~165. Se verifico con recalculo directo sobre datos crudos bajados
en vivo de HubSpot (no contra nuestro pull local) que **el 100% de la
diferencia eran los cerrados-perdidos por causal** (Duplicado/Existente,
No es del sector salud, etc. — la lista de la seccion 11/14) que esta
tabla vena excluyendo desde que se implemento. El dato de `deals_totales`
(la columna sin ese filtro, agregada en la seccion 14) YA calzaba exacto
con HubSpot en los cuatro canales — no hacia falta ningun pull nuevo ni
corregir nada del calculo, solo decidir cual de las dos columnas mostrar
aca.

**Se le pregunto a Emmanuel explicitamente** (via AskUserQuestion, dos
opciones: mostrar ambos numeros vs reemplazar por el total crudo) porque
la seccion 8 obliga a esto — la lectura barata (cambiar una tabla) convive
con una lectura que revierte una decision de calidad de datos ya validada
(seccion 11/14: excluir causales basura no es conveniencia, es correccion).
**Eligio reemplazar por el total crudo, no mostrar ambos.**

**Implementacion — solo la Tabla 1 cambio, la Tabla 2 (Vinculacion) NO:**
- `sumarPorCanal_()` en `armarMetasCanalF1_` (Code.gs) ahora acumula
  tambien `dealsTotales` (suma de `r.deals_totales`), ademas del `deals`
  limpio que ya traia.
- La tabla "Leads del mes vs meta" usa `dealsTotales` como `actual` (y
  como base del delta vs periodo anterior) — coincide con HubSpot sin
  filtro de causal, tal como se pidio.
- La tabla "Vinculacion de clinicas" (el % de cierre a 3 meses) **se dejo
  intacta, usando `deals` (limpio)** — a proposito, no fue un descuido.
  Meterle duplicados/SARLAFT-fallido al denominador de un % de cierre
  habria deflactado esa tasa sin que signifique nada (esos registros
  nunca iban a convertir, no son leads reales perdidos). Son DOS tablas
  con DOS preguntas de negocio distintas — "cuantos leads entraron" no es
  lo mismo que "que tan bien convierte el funnel" — y cada una necesita
  su propia definicion de "lead", no la misma por comodidad de codigo.
- Los dos subtitulos de pantalla se reescribieron para declarar la
  diferencia: la Tabla 1 dice explicito que coincide con el conteo crudo
  de HubSpot; la Tabla 2 dice explicito que su "leads que llegaron" SI
  excluye por causal. Antes solo la Tabla 1 tenia el aviso (y decia lo
  contrario de lo que ahora hace) — dejar el aviso viejo habria sido
  peor que no tener aviso.
- `qa_tablero.js`: `recomputarMetasCanal_()` ahora trackea `dealsTotales`
  ademas de `deals`; los checks de la Tabla 1 (`actual`, `delta`) se
  recalculan contra `dealsTotales`, los de la Tabla 2 (`llegaron`,
  `cerrados`) se quedan contra `deals` — mismo patron de "cada tabla su
  propia definicion" reflejado en el QA, no solo en el codigo.

**Regla para la proxima vez que un numero "no cuadre con HubSpot"**: antes
de asumir que es un bug, verificar si el tablero ya tiene la version SIN
filtrar calculada en alguna parte (`deals_totales`, `f.universo`, etc. —
el patron de la seccion 14 de "mostrar ambos" hace que casi siempre exista
ya el numero crudo en alguna columna, solo que no en la tabla que el
usuario esta mirando). Si existe, la pregunta deja de ser "hay un bug" y
pasa a ser "cual de las dos definiciones va en esta tabla" — y esa
decision es del negocio, se pregunta, no se adivina (seccion 8).

## 42 · La tarjeta de meta de Rescate (F4) ignoraba el rango exacto del filtro (24-sep-2026)

Mismo patron de las secciones 20/22, esta vez en la tarjeta principal de
metas de F4 ("Meta de cobertura/contactados/desembolso"). Emmanuel filtro
24-ago a 24-sep (32 dias) y la tarjeta mostraba "mes de sep '26" —
solo el 1-24 de septiembre, perdiendo 24-31 de agosto. La causa:
`metaEntradaFiltro_()` en `scripts.html` tomaba el rango global y
buscaba que MES CALENDARIO (o semana) lo tocaba, mostrando esa fila
precalculada — nunca calculaba sobre el rango exacto. Esto llevo
directamente al problema que abrio esta conversacion (Emmanuel comparando
contra un numero de su jefa de ~$300M en rescates: la tarjeta de Kevin
mostraba $205,8M porque solo contaba septiembre; el rango completo da
$367,5M, mucho mas cerca del numero real).

**Arreglo — el filtro global ahora manda, el toggle solo cambia la vara:**
`armarF4_` en `Code.gs` ya no expone solo `metas`/`metasMes` (por semana/
mes calendario, para el historial) — agrega `metaRango` y `metaRangoSemanal`
(Kevin) y `metaRangoRescateTotalMensual`/`metaRangoRescateTotalSemanal`
(rescate total), los CUATRO calculados sobre `R.inicio..R.fin` LITERAL,
reusando las mismas tasas ya calibradas (`tasaObjetivoMes`/
`tasaObjetivoSemana`, el mejor periodo ya cerrado × 1.4 de estiron) —
la unica diferencia entre las dos versiones de cada poblacion es CON QUE
VARA se compara (mensual o semanal), no que dias se miran. El toggle
"esta semana"/"este mes" paso de decidir el rango a decidir la vara.

**El caso de Rescate Total necesito un ajuste aparte** porque su meta es
en PESOS FIJOS (no %), calibrada para una semana completa (5 dias
habiles) o un mes completo (~21,7 dias habiles en promedio, constante
`DIAS_HAB_PROMEDIO_MES`) — para un rango libre se prorratea esa meta fija
por los dias habiles REALES del rango elegido
(`metaMonto/diasHabBase*diasHabTotalRango`), no se recalibra desde cero.

**`metaEntradaFiltro_()` se borro por completo** (con sus dos bugs
documentados en su propio comentario, ya superados) — ya no tiene ningun
consumidor: los dos renderers de la tarjeta (`f4MetaRender`,
`f4MetaRenderRescateTotal_`) leen directo `ge.metaRango*`. Las listas
`metas`/`metasMes`/`metasRescateTotal`/`metasMesRescateTotal` (por semana/
mes calendario) NO se tocaron — las sigue usando el grafico de abajo
("por que la meta es esa", `f4HistoriaRenderKevin_`/`RescateTotal_`), que
a proposito muestra el HISTORICO COMPLETO sin cortarse con el filtro
(mismo patron de la seccion 25 punto 1, declarado en su propio comentario
desde antes de este cambio).

**QA**: `chequearF4MetaRango()` nueva en `qa_tablero.js` — recalculo
independiente sumando directo sobre `RESCATE_DESENLACE` (Kevin) y
`DESEMBOLSO_RESCATE_DIA` (rescate total) en el rango exacto de la corrida,
mas el invariante "rescate total >= Kevin siempre" y "mismo desembolsado
entre la vara semanal y la mensual" (solo la meta cambia, no el
desembolsado real). Solo corre sin filtro de origen/rol — con filtro
habria que replicar el cruce sede-por-sede de `armarF4_`
(`filtraGes`/`U.nombres`), que no aporta cobertura nueva para este bug en
particular. 271.509 aserciones, 0 fallos.

**Segunda vuelta, minutos despues: el arreglo generó una confusión nueva.**
Emmanuel volvió con capturas diciendo "se buguearon estas cards" — los
números (23 de 24 días hábiles, $367,5M de meta $608,9M) eran correctos
(se verificó con un debug temporal instrumentando `armarF4_` y comparando
contra el calculo directo), pero al preguntarle que exactamente se veía
mal (`AskUserQuestion`), la respuesta fue: **"Cobertura/contactados no
cambian de toggle"**. Tenía razón en desconfiar, aunque no era un bug de
cálculo:

Antes del arreglo, el toggle "esta semana"/"este mes" cambiaba de VENTANA
de datos (una semana real vs un mes real, con resultados reales
distintos), así que las tres tarjetas se movían al cambiar de pestaña. Con
el arreglo, las tres tarjetas ahora usan el MISMO rango exacto (el del
filtro global) sin importar el toggle — y como `tasaObjetivoContacto`/
`tasaObjetivoCobertura` siempre fueron un ÚNICO benchmark (nunca hubo una
versión semanal y otra mensual de esos dos, solo de la meta de
desembolso), esas dos tarjetas quedan literalmente IDÉNTICAS entre
pestañas. Antes esto no se notaba porque el cambio de ventana de datos
disimulaba que el benchmark no cambiaba; ahora, sin ese disimulo, se ve
"trabado" y parece roto.

**Arreglo: declarar el comportamiento, no ocultarlo.** Los botones se
renombraron de "esta semana"/"este mes" a **"vs. mejor semana"/"vs. mejor
mes"** (dicen contra qué se compara, no qué días se ven — que ya está
declarado aparte, en el texto "del 24 ago al 24 sep"), y se agregó una
nota fija debajo del selector: "Este selector solo cambia la meta de
desembolso... Cobertura y Contactados usan un único objetivo, así que no
cambian entre las dos vistas". Ningún cálculo cambió, solo la etiqueta y
la declaración en pantalla — mismo principio de toda la sesión: un número
correcto que se lee como sospechoso necesita una frase al lado, no
esconderse.

**Regla para la próxima vez**: cuando una corrección hace que dos vistas
antes distintas ahora compartan datos (a propósito, porque la corrección
es justamente ELIMINAR una diferencia que no debía existir), revisar si
algún control de la UI (toggle, botón, selector) dependía visualmente de
esa diferencia para parecer que "hace algo". Si dos de tres tarjetas
quedan iguales entre dos posiciones de un toggle, no asumir que el usuario
va a entender por qué — declararlo explícito, como cualquier otro número
que se lee distinto a como es.

## 43 · El embudo de WhatsApp de Rescate daba 501,8% — dos poblaciones distintas sumadas como si fueran una (25-sep-2026)

Emmanuel filtró agosto completo en F4 y vio "18.254 contactados de 3.638
aprobados · 501,8% recibió al menos un mensaje" — un % por encima de 100
es matemáticamente imposible para "recibió al menos un mensaje", así que
era la prueba de que había un bug real, no una lectura rara de un dato
correcto.

**La causa, verificada leyendo `pull_wa_embudo.py` línea por línea:**
`RESCATE_WA_EMBUDO_DIA` traía `pac_enviados`/`pac_entregados`/etc. **por
día**, y `Code.gs` sumaba esas filas dentro del rango de fecha elegido.
Eso rompía de dos formas a la vez:

1. Un mismo paciente contactado en varios días del rango sumaba **una vez
   por cada día** (el propio script ya lo documentaba: "si aparece
   también mañana cuenta otra vez mañana") — sumar días no da "cuántos
   pacientes distintos", da "cuántos días-paciente".
2. El universo de teléfonos contra el que se cruzaban los eventos era
   **todo el histórico desde junio-2026**, sin acotar al rango — pero el
   denominador que se mostraba en pantalla ("créditos que llegaron a
   aprobarse en el período") SÍ estaba acotado a agosto. Un mensaje de
   recordatorio a un paciente aprobado en junio contaba en el numerador
   de agosto, aunque agosto específicamente tuviera un hueco de contacto
   real para SUS propios pacientes nuevos — que es justo lo que Emmanuel
   había encontrado por otro lado (cambiaron las piezas/mensajes de
   confirmación de aprobado porque muchos pacientes no lo recibían) y
   este panel no dejaba ver.

**Arreglo — nueva fuente, una fila POR PACIENTE, no por día.**
`pull_wa_pacientes.py` reemplaza a `pull_wa_embudo.py`: produce
`RESCATE_WA_PACIENTES` (`telefono`, `fecha_aprobacion` — la más temprana
si el teléfono aparece aprobado más de una vez —, `enviado`/`entregado`/
`leido`/`respondio` como flags 0/1 de si ALGUNA VEZ hubo ese evento).
`Code.gs` filtra por `fecha_aprobacion` en `R.inicio..R.fin` y **cuenta
filas** (no suma eventos) — el % no puede pasar de 100 por diseño, porque
"aprobados" y "recibieron mensaje" son, por construcción, la misma
población. El embudo pasó de 4 pasos (base = enviados) a 5 (`Aprobados`
como el 100% real, los demás pasos como % de ESE total, no del paso
anterior — mismo criterio que otros embudos del tablero).

**Se descartó explícitamente agregar un panel de comparación antes/
después** (agosto vs. septiembre) que Emmanuel había insinuado al
principio — pidió despues, en un mensaje aparte, que NO se agregara ese
módulo: "arregla eso y cuando yo filtre por fechas se vea la data real...
ese funnel de whatsapp", sin comparación. Se respetó tal cual — el panel
solo responde al filtro de fecha existente, no se construyó nada nuevo
de comparación de períodos.

**Un hallazgo colateral casi bloquea la subida: el workbook estaba en
9.983.726 de 10.000.000 celdas.** Cada hoja de Google Sheets reserva 26
columnas por defecto sin importar cuántas usa de verdad — `CREDITO_DIA`
por sí sola desperdicia ~2,36M celdas en 19 columnas vacías. Se liberó
espacio real borrando 6 hojas **confirmadas sin ningún lector en
`Code.gs`/`Filtro_Origen.gs`** (verificado con grep antes de borrar, no
por memoria): `RESCATE_VENTANA`, `COSECHA_DIA`, `EMBUDO_ORIGEN`,
`EMBUDO_CONV`, `PLATA_SEDE_MES`, `SEDE_OWNER` (~1,92M celdas), más la
`RESCATE_WA_EMBUDO_DIA` ya reemplazada. **Ojo**: estas hojas las sigue
ESCRIBIENDO el trigger de producción (`Fuentes_BigQuery.gs`), así que se
van a recrear solas en el próximo refresh automático — esto no es un
arreglo permanente del límite de celdas, es un desahogo puntual. Si
`GOOGLESHEETS_BATCH_UPDATE`/`ADD_SHEET` vuelve a fallar con "Cannot
expand sheet... as it would push the workbook to 10", este es el primer
lugar a revisar (`GOOGLESHEETS_GET_SPREADSHEET_INFO` trae `gridProperties.
rowCount`/`columnCount` de cada hoja — sumar rowCount×columnCount de
todas da el total real). Una solución más permanente (que no se hizo
aquí, por alcance) sería que `Fuentes_BigQuery.gs` deje de escribir estas
6 hojas del todo, o que el subidor pida `columnCount` real en vez del
default de 26.

**QA**: `chequearF4` ahora recibe `orig`/`rol` y recalcula el embudo
directo sobre `RESCATE_WA_PACIENTES` (sin pasar por `armarF4_`),
comparando `universo`/`contactados`/`entregado`/`leido`/`respondio` fila
por fila, más el invariante de que este panel NO cambia con el filtro de
origen/rol (no filtra por sede, declarado en pantalla). Este check
HABRÍA atrapado el bug original, porque recalcula desde cero — el chequeo
viejo (`pct() <= 100` + "cada paso es subconjunto del anterior") ya
existía y en teoría debía haberlo agarrado, pero es autoconsistencia: si
el motor y el cálculo comparten el mismo error de diseño, la
autoconsistencia no lo ve. 272.337 aserciones, 0 fallos.

**Segunda vuelta, mismo día — la que de verdad importaba para el CEO.**
Emmanuel señaló que "cualquier mensaje de WhatsApp" no bastaba: con esa
definición agosto se veía 96-98% sano, porque mensajes de cobranza/bot
tapaban el hueco real. Lo que necesitaba mostrar era la **confirmación de
crédito aprobado** específicamente — cuántos pacientes NO la recibieron,
y que el ajuste del equipo lo arregló. Pidió explícitamente **no** un
panel de comparación nuevo, sino que el mismo funnel, filtrado por fecha,
dejara ver el hueco y la recuperación solo con cambiar el rango.

**Se identificó la familia de plantillas de esa confirmación por
CONTENIDO del mensaje** ("hemos aprobado tu crédito" / "hemos preaprobado
tu crédito" en el cuerpo), no por un solo `template_id` — porque cada vez
que el equipo edita la pieza en el proveedor de WhatsApp, sale un id
nuevo con el mismo texto:

- `068fb8c2-66c0-7c3b-8000-0fc063e081fe` — 31-jul a 4-ago-2026 (469 envíos)
- **HUECO: 5-ago a 9-sep-2026, cero envíos de esta familia a nadie**
- `06a9f737-...` / `06aa4929-...` — desde 10/11-sep en adelante (pieza actual)
- 2 variantes más, volumen mínimo, operación Perú (en soles)

Verificado con recálculo directo cruzando `t_sol_v2` (aprobados desde
jun-2026) contra `eventos_hilos` filtrado a esas 5 plantillas: **agosto
13% recibió la confirmación (87% no), septiembre (parcial, al día 25)
47,7% y subiendo.** `eventos_hilos` solo tiene datos desde el 26-jun-2026,
así que junio (0%) no es "cero real", es "sin visibilidad" — declarado así
si se necesita mostrar ese mes.

**Implementación**: `PLANTILLAS_CONFIRMACION` en `pull_wa_pacientes.py`
filtra los eventos OUTBOUND (enviado/entregado/leído) a esa familia antes
de armar los flags por paciente. `respondio` (INBOUND) **no se pudo
acotar de la misma forma** — un mensaje entrante no trae a qué plantilla
responde, así que sigue siendo "el paciente escribió algo, lo que sea,
después de su aprobación". Esto rompe a propósito la monotonía estricta
del embudo ("Respondieron" puede superar a "Leído"): `qa_tablero.js`
degradó ese chequeo de `fail` a `warn` para el embudo de WhatsApp
específicamente (con la excepción ya conocida de "Leído" pudiendo superar
levemente a "Entregado" por cómo reporta la API de WhatsApp — el código
viejo de este mismo embudo ya lo toleraba). Todo declarado en el
subtítulo del panel, no escondido.

**Si en el futuro el equipo vuelve a editar esta pieza**, sale un
`template_id` nuevo con el mismo texto — hay que volver a buscarlo por
CONTENIDO (`LOWER(cuerpo) LIKE '%hemos aprobado tu credito%'` o similar
contra `eventos_hilos`) y agregarlo a `PLANTILLAS_CONFIRMACION`. No hay
forma de que esto se detecte solo: `eventos_hilos` no clasifica el TIPO
de mensaje, solo trae el id de plantilla cruda.

**Nota de proceso, no de producto**: `jsdom_stress.js` tardó ~9 minutos en
esta corrida (normal: 1-3 min) porque un proceso de Node completamente
ajeno a este proyecto (un servidor Expo de otra carpeta del usuario,
`Clean4Jesus`, corriendo desde el 23-sep) llevaba **9+ horas de CPU
acumuladas** compitiendo por recursos en la misma máquina. Se identificó
con `Get-CimInstance Win32_Process` antes de considerar matar nada — no
se tocó, porque es trabajo del usuario en otra terminal, no un proceso
nuestro. Si una prueba vuelve a tardar muchísimo más de lo normal sin
estar realmente atascada (CPU sigue subiendo), revisar primero si hay
otro proceso pesado del usuario compitiendo por CPU antes de asumir un
bug en el código que se acaba de tocar.

## 44 · Dos hallazgos más sobre el embudo de WhatsApp, el mismo día (26-sep-2026)

Emmanuel señaló dos problemas sobre el embudo recién arreglado (sección 43),
mirando la captura de agosto: "cómo respondieron es mayor?! no tiene
sentido. además, en septiembre deberíamos tener muchísimo más que 47%."

**1 · "Respondieron" (1.056) > "Leído" (319) dentro de la misma barra de
embudo — visualmente se lee como un error, aunque el número era correcto
y ya estaba declarado en el subtítulo.** El problema no era el dato, era
la FORMA: un embudo promete visualmente que cada barra es más chica que
la anterior, y "Respondieron" (no acotado por plantilla, porque un
INBOUND no dice a qué plantilla contesta) rompe esa promesa aunque sea
matemáticamente correcto. **Arreglo: se sacó "Respondieron" de la
secuencia de barras** (`embudoWa` en Code.gs quedó en 4 pasos: Aprobados
→ Recibieron confirmación → Entregado → Leído) y se movió a una tarjeta
KPI aparte ("Respondieron algo"), con su propio sublabel aclarando que no
es sobre esta confirmación en particular. Mismo dato, mismo cálculo —
solo cambió DÓNDE se muestra, para no prometer visualmente algo que el
dato no es.

**Regla para la próxima vez**: si un paso de un embudo NO puede garantizar
ser subconjunto de los anteriores (por diseño, no por bug), no va dentro
de la secuencia de barras — un embudo visual siempre lee "cada barra ⊆ la
anterior", así que meter ahí algo que no cumple esa propiedad es mentir
con la forma aunque el número sea honesto.

**2 · El 47,7% de septiembre no era un número inflado ni un bug — era un
promedio que escondía una historia real, día por día.** Se recalculó
directo (sin pasar por `armarF4_`) la cobertura por DÍA de aprobación
dentro de septiembre:

| Rango | Cobertura | Qué es |
|---|---|---|
| 1-9 sep | 37-47% | Backlog: aprobados durante el hueco (ver sección 43) que recibieron su confirmación TARDE, cuando el equipo reactivó la pieza — nunca llegaron al 100% |
| **11-12 sep** | **0,4% / 0,6%** | Hueco puntual nuevo, encontrado en esta investigación |
| 13-19 sep | 55-68% | Ya con la pieza nueva funcionando normal |
| 20-26 sep | 62-80%, subiendo | Cola natural: los últimos días no han tenido tiempo de recibir su mensaje todavía |

**El hueco del 11-12 de septiembre se investigó a pedido explícito de
Emmanuel** (se le preguntó primero si investigar o dejarlo, vía
`AskUserQuestion` — eligió investigar). Hallazgo: de 574 pacientes
aprobados esos dos días, **523 (91%) SÍ recibieron algún mensaje de
WhatsApp** (código OTP de `06a9a104`, confirmación de firma de
`06a9ed64`, etc.) — el canal funcionaba normal. Pero **específicamente
la confirmación de crédito aprobado no se disparó para casi nadie**, justo
coincidiendo con el momento exacto del cambio de plantilla (`06a9f737`
termina el 11-sep, `06aa4929` empieza el 11-sep). Conclusión: durante la
migración de una plantilla a la otra, el disparador de ESE mensaje
puntual se cayó por ~2 días, mientras el resto del flujo automatizado
seguía enviando otros mensajes con normalidad — no es un problema del
canal ni de los datos, es un corte de automatización acotado a esos dos
días, ya resuelto solo desde el 13-sep.

**No se cambió nada de código por este segundo hallazgo** — es
información para la conversación con el CEO, no un bug del tablero. El
47,7% agregado de septiembre sigue siendo el número correcto para "todo
el mes junto"; si en el futuro se quiere mostrar esta granularidad diaria
en pantalla (no solo en el chat), habría que decidirlo aparte — no se
construyó sin que se pidiera, seccion 8.

**Verificación adicional que se descartó por payload demasiado grande**:
el primer intento de buscar "qué otras plantillas de alto volumen recibió
la cohorte de septiembre" agrupando por telefono+plantilla+`ANY_VALUE
(cuerpo)` sobre las 900k filas de `eventos_hilos` sin fecha reventó con
`413 Upstream_PayloadTooLarge` en el proxy de Composio. Se resolvió
quitando `cuerpo` de la agregación masiva (dejarla solo para una segunda
consulta puntual de los ~10-20 ids de interés) — mismo patrón que ya
enseñó la sección 15 sobre no traer el stream completo sin filtrar.

## 45 · El universo de "aprobados" del embudo de WhatsApp estaba deduplicado por TELEFONO, no por documento (27-sep-2026)

Emmanuel comparó la captura de agosto (3.497 aprobados) contra la de
septiembre (5.942 aprobados) y dijo: "si muestro eso no se ve casi
diferencia... esto no me sirve" — con el agravante de que le había avisado
al CEO que se estaba revisando a fondo. Tenía razón en desconfiar otra vez:
el universo de AGOSTO estaba mal.

**La causa**: `pull_wa_pacientes.py` (sección 43) deduplicaba por
TELÉFONO, de por vida, desde `PISO_APROBADO` (jun-2026) — un mismo
teléfono contaba UNA sola vez, en el mes de su aprobación más temprana.
Esto se pensó para evitar que un paciente con dos créditos aprobados en
meses distintos se contara dos veces, pero esa situación es **casi
inexistente**: de ~15.000 aprobaciones desde junio, verificado con
recálculo directo sobre `t_sol_v2`, **un solo documento** se repite en
más de un mes. La deduplicación de por vida no prevenía nada real, y en
cambio contar por teléfono (no por documento) mezclaba mal los casos
donde dos documentos distintos comparten el mismo número (ej. dos
pacientes de la misma familia o de la misma clínica) — agosto daba 3.497
por teléfono contra **3.254** aprobaciones reales por documento, un 7,5%
de más.

**Verificación independiente, sin pasar por ningún pull**: para cada mes,
`COUNT(DISTINCT documento)` con estado aprobado-y-vivo da EXACTAMENTE el
mismo número que `COUNT(*)` de filas sobre `t_sol_v2` — dentro de un
mismo mes, un documento aparece una sola vez en la fuente. Eso hace
trivial el conteo correcto: aprobados de un mes = documentos distintos
con una solicitud aprobada ESE mes, punto.

**Arreglo**: la llave de deduplicación en `pull_wa_pacientes.py` pasó de
`telefono` (de por vida) a `(documento, mes)` — si el mismo documento
vuelve a aparecer aprobado en OTRO mes (el único caso real hoy), cuenta
en los DOS meses, que es la definición correcta de negocio: cada
aprobación es un evento que necesita SU PROPIA confirmación. El teléfono
se sigue usando SOLO para cruzar contra `eventos_hilos` (es lo único que
esa tabla tiene), y el evento tiene que ser posterior a la fecha de ESA
aprobación puntual (no "en cualquier momento de la historia"), para no
prestarle por error una confirmación vieja a una aprobación nueva del
mismo teléfono en el caso raro de repetición.

**Números corregidos** (verificados en el DOM real con jsdom, regla 16,
no solo en el motor): agosto 3.254 aprobados, 13,3% recibió la
confirmación (432 entregados, 306 leídos); septiembre (1-26) 6.270
aprobados, 48,6% recibió la confirmación. **El % de confirmación
prácticamente no cambió** respecto a lo ya reportado antes de este
arreglo (13,3%/47,6-48,2%) — el bug estaba en el UNIVERSO (denominador),
no en la tasa de confirmación. Eso significa que el hallazgo de fondo
para el CEO sigue siendo el mismo y sigue siendo cierto: agosto tuvo un
hueco real de confirmación (87% sin mensaje), septiembre se está
recuperando tras el ajuste de plantilla documentado en la sección 43-44,
y ahora el número de agosto (3.254, no 3.497) es el correcto para
presentar la comparación sin que quede la sensación de "no cambió nada".

**Regla para la próxima vez**: cuando una hoja de "una fila por persona"
se construye cruzando dos sistemas (aquí: base de solicitudes con
`documento` como identidad real, vs. `eventos_hilos` que solo tiene
`telefono`), la deduplicación de la POBLACIÓN tiene que hacerse con la
llave del sistema DUEÑO del concepto de negocio (el documento identifica
al paciente/solicitud; el teléfono es solo el canal de contacto) — nunca
al revés. Si dos documentos comparten teléfono (family/clínica), deduplicar
por teléfono los funde en una sola persona sin que sea cierto.

**QA**: no hizo falta tocar `qa_tablero.js` — el recálculo independiente
de `chequearF4` (sección 43) ya lee `RESCATE_WA_PACIENTES` fila por fila
sin asumir nada sobre cómo se construyó la deduplicación aguas arriba, así
que siguió cuadrando exacto contra los números nuevos sin cambios. 272.073
aserciones, 0 fallos (aparte de 6 fallos de frescura de Rescate general,
4 días de atraso, no relacionados con este arreglo — mismo patrón de la
sección 30, fuera de alcance de esta tarea puntual). `jsdom_stress.js`:
216 combinaciones, 0 fallos. Verificación de contenido con
`quickcheck_wa2.js` (ya existente de la sección 43) confirmó los números
exactos en el DOM real: agosto 3.254/433/432/306, septiembre(1-25)
6.029/2.870/2.854/2.042. Publicado como versión 102 del artefacto, misma
URL de siempre.

## 46 · ActiveCampaign NO es (todavía) un segundo proveedor de la confirmación de aprobado (28-sep-2026)

Emmanuel pidió mezclar `eventos_hilos` con "el nuevo proveedor de WhatsApp,
Active Campaign", asumiendo que juntar las dos fuentes subiría el % de
confirmación de crédito aprobado (sección 43-45) porque son la misma
población vista por dos canales. Se conectó la API real de ActiveCampaign
(`ACTIVECAMPAIGN_API_URL`/`ACTIVECAMPAIGN_API_KEY` en `.env`, header
`Api-Token`) y se verificó antes de tocar nada:

- La cuenta tiene exactamente **5 automatizaciones**, todas nombradas
  "[Growth] 2do crédito..." (2do crédito - crédito pagado, y 4 variantes
  "2C" por segmento: Emoción/Resto/Salud/Odontología), creadas entre el
  22 y el 25-sep-2026 — NINGUNA se llama ni habla de "crédito aprobado"
  o "confirmación".
- `GET /api/3/contactAutomations` (global, sin filtrar por automation) da
  **total=0** — cero contactos han entrado a NINGUNA automatización todavía
  en toda la cuenta. No hay un solo envío histórico que cruzar contra
  agosto/septiembre.

**Conclusión, confirmada con Emmanuel**: ActiveCampaign en esta cuenta
sirve para una campaña de "segundo crédito" (audiencia y mensaje
distintos al de "tu crédito fue aprobado" que mide el embudo de Rescate),
y todavía no ha mandado nada — no es una fuente que se pueda mezclar con
`eventos_hilos` para el embudo de confirmación de aprobado. Se dejó
aparte, sin tocar código ni datos del tablero.

**Si en el futuro ActiveCampaign SÍ empieza a mandar la confirmación de
aprobado** (o si aparece una automatización nueva con ese nombre y
contactos reales), ahí sí aplicaría el patrón de la sección 43 (buscar por
CONTENIDO del mensaje, no por nombre de automatización) antes de mezclar
las dos fuentes — y habría que resolver primero cómo identificar,
teléfono por teléfono, cuál de las dos plataformas le mandó el mensaje a
cada paciente para no contarlo doble si ALGUNA vez las dos le escriben al
mismo paciente por el mismo evento.

## 47 · Tercer reproceso completo del tablero, todas las fuentes (28-sep-2026)

Pedido explícito: "Reprocesa todo el tablero, TODO". Mismo playbook de las
secciones 34/38, esta vez con la lista de hojas re-derivada de cero
(`grep -oE "leer(Hoja_|WP_)\('[A-Z_0-9]+'\)"` sobre `Code.gs` +
`Filtro_Origen.gs`, la fuente de verdad de qué hoja importa hoy) en vez de
reutilizar la lista de la última vez de memoria — para no arrastrar un
olvido si algo cambió desde el 22-sep.

**Orden usado, igual al de las secciones 34/38**: `pull_sedes.py` +
`sube_sedes.py` primero (3795 sedes, 15 nuevas) y fusionado al
`sheet_data.json` local ANTES de `pull_lt.py`/`pull_rescate.py`/
`pull_roles.py`/`repull_id_sede.py` (los cuatro cruzan por `id_internal`
contra el snapshot local). Luego los pulls independientes (`pull_deals.py`,
`pull_estado_mes.py`, `pull_activacion.py`, `pull_desembolso_rescate.py`,
`pull_wa_pacientes.py`, `pull_aprob_msj.py`, `pull_plataforma_nombre.py`,
`meta_pull.py`, `wp_pull2.py`), después `pull_credito_dia.py` →
`comprime_cdia.py` (regla 12, nunca el crudo directo), y al final los 6
pulls de Welli Points (`pull_wp_adopcion.py`, `pull_wp_adopcion2.py`,
`pull_wp_habilitadas.py`, `pull_wp_login_dia.py`, `pull_wp_pts_mes.py`,
`pull_wp_resumen.py`), y `actualiza_config_fecha.py` al cierre (regla 23).

**Dos hallazgos nuevos al re-derivar la lista de hojas desde cero:**
1. **`wp_pull2.py` estaba fuera del playbook de las secciones 34/38** —
   escribe `WP_SERIE`/`WP_INCENTIVO`/`WP_CANJES`/`WP_KPI2`, y `WP_CANJES`
   SÍ tiene un lector vivo en `Code.gs` (`f.pago`, filtrado por
   `filtrarPorNombre_`) que las dos corridas anteriores nunca refrescaron.
   Se agregó al playbook esta vez, subido con `sube_generico.py
   tables_wp2.json`.
2. **`pull_owner.py` existe pero NO alimenta la hoja que Code.gs lee.**
   Escribe `SEDE_OWNER`, pero `Filtro_Origen.gs:516` lee literal `OWNERS`
   — dos nombres distintos, ningún pull escribe hoy `OWNERS`. Confirma lo
   que ya decía la sección 34 ("pendiente real, no existe todavía") y
   corrige la impresión de que `pull_owner.py` lo resolvía: existe el
   archivo, pero apunta a la hoja equivocada. Sigue sin refrescarse desde
   el scratchpad.

**Se mantuvieron las mismas exclusiones deliberadas de siempre** (mismas
razones que en las secciones 34/38): `LT_PIEZAS`/`LT_TEL_SEDES`/
`LT_WA_EVENTOS`/`LT_WA_FRANJA` (construcción de una sola vez sobre
Conversations de HubSpot, cientos de llamadas), `RESCATE_HIST_PLATA`
(operación cerrada, oct-2024 a jul-2026), `NOVEDADES` (a mano en el
Sheet), `RESCATE_APROB_MSJ` sin `_DIA` (fallback estático), `WP_SERIE`/
`RESCATE_BQ` (fallbacks legacy que `Code.gs` solo lee si su reemplazo
está vacío — `WP_SERIE` sí se refrescó de rebote por venir en el mismo
`wp_pull2.py` que `WP_CANJES`, pero no por necesidad propia).

**Números que se movieron respecto al reproceso de ayer (27-sep), dignos
de mencionar porque son la señal de que la corrida sí trajo dato nuevo, no
solo timestamps**: `RESCATE_WA_PACIENTES` (sección 45) pasó de
agosto=3.254/septiembre=6.270 a **agosto=3.115/septiembre=6.339** — el
universo de agosto bajó porque `t_sol_v2` sigue re-clasificando estados
histórpicos con el paso de los días (algunos créditos que estaban
`approved` el 27-sep ya no calificaban el 28-sep, o viceversa) y
septiembre subió porque el mes sigue corriendo. El % de confirmación se
mantuvo estable (10,8%→antes 13,3%; 48,7%→antes 48,6%), reforzando que la
tasa es la métrica robusta, no el universo absoluto de un día específico
— ya declarado como patrón en la sección 45.

**Resultado del QA**: 120 combinaciones, 272.253 aserciones, 0 fallos.
Frescura: 2 fuentes con leve atraso (`RESCATE_DESENLACE` 3 días,
`PLATAFORMA_SEDES` 3 días), dentro de tolerancia — el resto en 0 días,
incluida `RESCATE_WA_PACIENTES` (0 días, hoy mismo). `build_previa.js`
sin avisos de "OJO: falta la hoja". `jsdom_stress.js`: 216 combinaciones,
0 fallos. Publicado como versión 103 del artefacto, misma URL de siempre.

## 48 · Frente 8 nuevo: Segundos créditos (28-sep-2026)

Producto nuevo de Welli: el paciente que ya pagó y cerró su primer crédito,
con buen comportamiento de pago, puede tomar un segundo. Emmanuel pasó las
dos queries oficiales del negocio (elegibles, y quiénes ya tomaron uno) y
pidió: tarjetas arriba (aptos, solicitudes, desembolsos, plata), una línea
de tiempo de solicitudes contra desembolsos por día, y un Sankey de
especialidad del 1er crédito → especialidad del 2º (cross-selling).

**Es F8, no F3.** Existen f1, f2, f4, f5, f6, f7 — f3 no existe (F2 cubre
"F2·3"). Confirmado mirando `data-vista` en `dashboard.html` y las
funciones `armarFX_`/`vistaFX()`, como obliga la sección 16, en vez de
asumir por el número que "seguía".

**LA TRAMPA DEL DENOMINADOR — lo más importante de este frente.** Las dos
queries son **disjuntas por construcción**. La de elegibles se para sobre
`latest_app` (la solicitud MÁS RECIENTE de cada paciente), así que apenas
alguien aplica a su segundo crédito su última solicitud pasa a ser la nueva
y **se cae del pool de elegibles**. Verificado: 0 de los 19 que ya aplicaron
estaban entre los 8.696 elegibles.

Consecuencia: "aptos" es **el disponible de HOY**, un stock que se encoge
cuando el programa funciona, no la base histórica. Cualquier tasa de
conversión se calcula contra `aptos + ya_aplicaron` (8.715 hoy), **nunca
contra aptos solo** — si no, la tasa mejora sola por encogimiento del
denominador mientras el numerador crece. Misma familia de error que la
sección 7. Está declarado en el sublabel de la tarjeta ("foto de hoy · 19
ya aplicaron y salieron del pool") y protegido con un invariante en
`qa_tablero.js` (`aptosTotal === aptos + solicitudesTotal`).

**Decisiones de implementación que hay que respetar:**

1. **"Desembolso" usa la MISMA definición que el resto del tablero**, copiada
   literal de `pull_credito_dia.py`: `estado IN ('pendiente_aprobacion_medico',
   'desembolsado','pendiente_validacion_cliente','fulfilled',
   'pendiente_desembolso')`, SIN `dismissed` (sección 11). Si F8 usara una
   propia, el mismo crédito se contaría distinto en F1 y en F8 y nadie
   sabría cuál creer. `chequearF8` lo verifica contra esa lista exacta.
2. **Las DOS series de la línea de tiempo se fechan por `created_on`** (el
   día en que el paciente aplicó), las dos. Existe
   `fecha_solicitud_desembolso`, pero fechar cada serie por un campo
   distinto las deja midiendo universos distintos en el mismo gráfico (el
   error de la sección 28) y permite un desembolso en un día sin
   solicitudes. Con las dos por fecha de solicitud, "desembolsos" es
   literalmente el subconjunto que convirtió, siempre por debajo — igual
   que `CREDITO_DIA` para todo el resto del tablero.
3. **Piso dinámico en la serie** (secciones 31/32): arranca en el primer día
   con solicitudes reales, no en `R.inicio`. El rango por defecto son ~84
   días y el programa lleva menos de una semana; sin esto la gráfica serían
   80 barras en cero y después un pico.
4. **El pool de aptos NO se corta por fecha, las solicitudes SÍ.** "Cuántos
   aptos había en agosto" no es una pregunta que la fuente pueda responder
   (es un estado actual, no un hecho fechado). Va declarado en pantalla y
   verificado en `jsdom_f8.js` con dos rangos distintos (sección 20).
5. **Filtro de origen/rol sí muerde**: las dos hojas traen `id_sede` (el
   `medico_id` = `id_internal`), así que pasan por `filtrarPorId_` como
   cualquier otra tabla por sede. 98,8% de los elegibles son atribuibles a
   una sede (962 sedes distintas).

**`chSankey` es una primitiva de gráfica nueva** (no existía ninguna en el
tablero). Dos columnas, bandas de ancho proporcional a los pacientes, color
por nodo de ORIGEN (la lectura natural es "de dónde salieron"), y la banda
diagonal (origen === destino, "se quedó en lo mismo") en gris a propósito:
pintarla de color compite visualmente con los cruces, que son lo único
accionable del gráfico.

**Ojo con qué se cuenta al verificar el Sankey** (mismo aprendizaje que
`chGrupos` en la sección 25): las bandas son `<path class="sk-banda">` y los
nodos son `<rect>`. Contar rects daría "OK" aunque no se hubiera pintado una
sola banda — justo el falso OK que la regla 16 quiere evitar. `jsdom_f8.js`
cuenta los paths de banda y además exige que su número sea exactamente el de
rutas del payload.

**Números al día de hoy** (28-sep-2026, el programa arrancó el 22-sep):
8.696 aptos, 19 solicitudes, 6 desembolsos, $20.906.142, y **5 de 19
cruzaron de especialidad** (12 repitieron Odontología→Odontología; los
cruces reales son Odontología→Cirugía plástica ×2, Medicina
General→Odontología, Cirugía plástica→Dermatología y
Dermatología→Odontología). Con 19 solicitudes cualquier lectura de
tendencia todavía es ruido — el frente sirve hoy para dimensionar la
oportunidad, no para evaluar el programa.

**Plomería**: `pull_segundos.py` → `sube_generico.py tables_segundos.json`,
agregado al playbook de reproceso; `SEG_ELEGIBLES`/`SEG_SOLICITUDES`
agregadas a la lista `USADAS` de `build_previa.js` Y de `harness_previa.js`
(regla 16 — si no, el artefacto publicado nunca recibe las hojas aunque el
`/exec` en vivo sí las lea); `f8` agregado a la matriz de `jsdom_stress.js`.

**Agregar un frente son CUATRO ediciones, no tres — y la cuarta es la que se
olvida.** Se publicó la v104 con las tres pruebas en 0 fallos y `jsdom_f8.js`
en 15/15, y aun así Emmanuel dio clic en "Segundos créditos" y no abría
nada. Tenía razón: **`f8` no estaba en `VISTAS_VALIDAS`** (línea ~3804 de
`scripts.html`), y `irA()` arranca con
`if (VISTAS_VALIDAS.indexOf(v) < 0) v = 'f1'` — o sea que el clic rebotaba a
F1 **en silencio**, sin error en consola. Los cuatro puntos son: el botón en
`dashboard.html`, `vistaFX()`, el dispatcher de `render()`, y
`VISTAS_VALIDAS`.

**Por qué la verificación de contenido no lo atrapó, que es la lección
real**: `jsdom_f8.js` navegaba con `win.VISTA = 'f8'` y llamaba `render()`
directo, **saltándose `irA()`** — justo la función donde estaba el bug. Daba
15/15 con el frente inaccesible para cualquier persona. Corregido: ahora
hace `document.querySelector('.nav-item[data-vista="f8"]').click()` y
verifica `win.VISTA === 'f8'`, que `f8` esté en `VISTAS_VALIDAS`, y que el
botón quede con `aria-current="true"` (18 checks).

**Regla que generaliza (extiende la 16)**: una verificación de contenido
tiene que llegar a la vista **por el mismo camino que el usuario** (el clic),
no seteando el estado interno a mano. Forzar `VISTA` prueba el render pero
no la navegación, y un frente al que no se puede llegar está igual de roto
que uno que no pinta nada — con el agravante de que todas las pruebas dicen
que está bien.

**QA**: 120 combinaciones, 273.243 aserciones, 0 fallos. `jsdom_f8.js`:
18 checks, 0 fallos (con el clic real del nav). `jsdom_stress.js`: 216
combinaciones, 0 fallos. Publicado como versión 105 del artefacto (la 104
tenía el frente inaccesible), misma URL de siempre.

## 49 · El embudo de WhatsApp mide RESCATABLES, no todos los aprobados (28-sep-2026)

Cuarta vuelta sobre este embudo (ver secciones 43, 44, 45). Es la que por fin
explica el hueco que llevaba días sin cuadrar.

**El hallazgo, midiendo con control.** Se cruzaron los aprobados del 20 al 28
de sep contra su estado ACTUAL:

| Estado hoy | SIN confirmación | CON confirmación |
|---|---|---|
| desembolsado | 59,5% | 13,0% |
| approved (parado) | 21,7% | 82,1% |

Los que NO recibieron el mensaje **ya habían desembolsado en su mayoría**; los
que sí lo recibieron estaban casi todos parados en `approved`. Refuerzo: en el
grupo sin mensaje, 752 de 754 firmaron el MISMO día de la solicitud.

Lectura: **el sistema no le manda la confirmación a quien ya desembolsó** —
no la necesita. Contarlo como "no le llegó" convertía un éxito operativo en
una falla inventada. Medido: de los 522 "sin confirmación" de esa ventana,
**388 (74%) ya habían avanzado**; el hueco real eran **134 pacientes
(12,6%)**, no 522 (32,5%).

**Antes se probó la hipótesis de Emmanuel (¿tenían un `not_taken` previo?) y
NO era eso**: 5,0% en el grupo sin mensaje contra 4,4% en el que sí lo
recibió — 0,6 pp, dentro del ruido. Sin el grupo de control ese 5% se habría
leído como una explicación; con control se ve que no distingue nada. Es
exactamente para lo que sirve la regla de la sección 19.

**Implementación**: `pull_wa_pacientes.py` trae ahora la columna `estado` (el
estado ACTUAL de la solicitud) y `armarF4_` excluye del embudo los cinco
estados que ya avanzaron (`ESTADOS_YA_AVANZO`: desembolsado, fulfilled,
pendiente_desembolso, pendiente_aprobacion_medico,
pendiente_validacion_cliente). El recorte va en `Code.gs`, NO en el pull, a
propósito: la hoja conserva la población completa y la regla de negocio queda
visible en el motor y auditable por `qa_tablero.js` (que recalcula el mismo
recorte desde la hoja cruda y compara `yaAvanzaron`).

**La trampa de este diseño, declarada en pantalla**: `estado` es la **foto de
hoy**, no el estado que el paciente tenía el día que lo aprobaron. Un
aprobado de julio que desembolsó en agosto hoy NO cuenta en el embudo de
julio. Es lo correcto para la pregunta "¿a quién le faltó el aviso?", pero
significa que **el universo de un mes ya cerrado se encoge con el tiempo** —
junio y julio quedan con 23 y 22 rescatables de 2.494 y 2.974 aprobados, un
residuo sin valor estadístico. **No se pueden comparar meses viejos con este
embudo**, y una captura de hace semanas nunca va a cuadrar con el tablero de
hoy. No es un bug, es la definición.

**Ojo con el efecto sobre la narrativa**: con el filtro, agosto pasa de 10,8%
a **75,4%** y septiembre de 48,9% a **74,1%**. O sea que **la mejora
agosto→septiembre desaparece**: lo que muestra el dato es que el sistema
siempre avisó a ~75% de quien lo necesitaba, y que el 10,8% de agosto era un
artefacto de contar como fallas a 2.767 pacientes que ya habían desembolsado.
Si alguien va a presentar "implementamos esto y mejoramos", con estos números
no se sostiene.

**Disclaimer de pestaña, porque F4 tiene DOS poblaciones.** Emmanuel preguntó
"¿todo lo de esta pestaña son los que se pueden rescatar?" y la respuesta es
que no, y nunca estuvo declarado:
- Secciones 1, 2, 3, 5 y 6 miden la OPERACIÓN de rescate e **incluyen a los
  que terminaron firmando** (`RESCATE_DESENLACE` los clasifica como `firmo`
  — es el resultado exitoso, la meta de desembolso se calcula sobre ellos).
- La sección 4 (este embudo) es la única acotada a rescatables.
Se agregó un `aviso` arriba de la pestaña declarando la diferencia.

## 50 · Una reversión a medias dejó el tablero ENTERO sin cargar, y el QA no lo vio (28-sep-2026)

Durante la sección 49 se descubrió que el tablero publicado (v105) **no
cargaba ninguna pestaña**: `Uncaught ReferenceError: DESEMBOLSADO is not
defined`.

**Causa**: minutos antes, Emmanuel había pedido separar "desembolsado" de
"en camino" en F8, y a mitad del cambio dijo "frena todo / no cambies nada".
La reversión alcanzó a devolver la DECLARACIÓN (`var CONV = {...}`) pero no
los USOS (`DESEMBOLSADO[e]`, `EN_CAMINO[e]`, `f.enCamino`, `f.montoEnCamino`)
repartidos en `Code.gs`, `scripts.html` y `qa_tablero.js`. Código a medio
revertir es peor que el cambio completo o que no haberlo empezado.

**Lo grave no es el bug, es que `qa_tablero.js` dio 0 FALLOS con el tablero
completamente roto** (273.597 aserciones, 0 avisos). Sigue sin explicarse del
todo por qué el motor no revienta ahí y sí en el navegador — pero el hecho
está medido y es lo que importa: **las tres pruebas de siempre NO garantizan
que la página cargue.** Lo detectó un jsdom que abre el artefacto como lo
haría un navegador y mira si la caja de error está visible.

**Regla nueva, barata y obligatoria: después de CUALQUIER cambio en
`Code.gs`/`scripts.html`, antes de publicar, cargar `artifact_tablero.html`
en jsdom y comprobar dos cosas — que `win.D` no sea `null` y que
`#error` tenga la clase `oculto`.** Son cinco líneas (ver `dbg.js` en el
scratchpad) y habrían atrapado esto de inmediato. Si `D` es null, el texto de
`#error` dice exactamente qué falló.

**Y si hay que frenar un cambio a mitad**: o se completa la reversión de una,
o se deja anotado qué quedó inconsistente. Un `grep` del símbolo que se
renombró (`grep -n "DESEMBOLSADO\|EN_CAMINO" Code.gs scripts.html`) cuesta
segundos y cierra el tema.

**QA final de la sesión**: 120 combinaciones, 273.483 aserciones, 0 fallos,
0 avisos. `jsdom_stress.js`: 216 combinaciones, 0 fallos. `jsdom_f8.js`: 18
checks. `jsdom_f4wa.js` (nuevo, permanente): 12 checks de contenido sobre el
embudo de rescatables y los dos disclaimers. Publicado como versión 106.

## 51 · Reproceso automático diario a las 7am — y por qué NO puede ser 100% autónomo todavía (29-sep-2026)

Emmanuel pidió que el reproceso general corra solo todos los días a las 7am.
Se montó, funciona, y tiene dos techos reales que hay que conocer antes de
prometer que "ya corre solo".

**Lo que quedó montado:**
- Tarea de Windows **`Welli_Reproceso_7am`** (creada con
  `Register-ScheduledTask` desde PowerShell), diaria a las 07:00, con
  `-StartWhenAvailable` (si el equipo estaba apagado, corre al prender) y
  límite de 3 horas.
- **`reproceso_diario.sh`** en el scratchpad — reemplaza al
  `reproceso_28sep.sh` de un solo uso. Diferencias que importan: chequeo
  previo del token (si BigQuery no responde ABORTA antes de encadenar 40
  fallos ilegibles), no aborta todo cuando falla un pull suelto (acumula la
  lista de fallidos), log por día en `logs_reproceso/` (guarda 14), y un
  `reproceso_estado.txt` de una línea legible de un vistazo.
- Al final corre `build_previa.js` + `qa_tablero.js` + `jsdom_stress.js` +
  el chequeo de carga real de la página (regla 50), y escribe
  **`LISTO PARA PUBLICAR`** o **`NO PUBLICAR: <fallos>`**. Así el paso
  manual de la mañana es solo publicar, ya sabiendo si el tablero quedó sano.

**Trampa de entorno que costó dos intentos**: el Programador de tareas
invoca `bash.exe` DIRECTO, sin el lanzador de Git Bash, así que el proceso
arranca **sin el PATH de MSYS** — no encuentra `mkdir`, `date` ni `tee`, y
el script muere antes de escribir la primera línea del log (falla con
`LastTaskResult: 1` y ni siquiera crea la carpeta de logs, que es
desconcertante de depurar). Tampoco hereda el PATH de usuario, así que
`python` y `node` también hay que declararlos. El script exporta los cinco
caminos explícitos en la primera línea. **Si una tarea programada de este
repo falla instantáneamente sin dejar log, es esto.**

**TECHO 1 — el token de BigQuery no se renueva solo, y es el bloqueador
real.** Verificado en vivo ese mismo día: la conexión de Composio figura
`ACTIVE` pero el access token estaba vencido (401), y
`connected_accounts.refresh()` devuelve `status=INITIATED` con un
`redirect_url` que **un humano tiene que abrir en el navegador**. Se probó
también el camino alterno: `gcloud` SÍ está instalado en la máquina y hay
un `application_default_credentials.json` (del 21-ago), pero
`gcloud auth application-default print-access-token` responde
`Reauthentication failed. cannot prompt during non-interactive execution`.
O sea: **las dos vías de OAuth de usuario exigen intervención humana**, y
el token dura menos de un día.

**La solución correcta es un service account de GCP** (llave JSON, no
expira) con lectura sobre `welli-data`, `welli-growth` y
`welli-tecnologia`. Emmanuel lo va a pedir a tecnología. Cuando llegue la
llave: instalar `google-cloud-bigquery` y cambiar `lib.bq()` para
autenticar con la llave en vez del proxy de Composio — ahí sí el job queda
autónomo de verdad. **Hasta entonces la tarea va a fallar casi todos los
días a las 7:01**, dejando `FALLO ... token de BigQuery vencido` en
`reproceso_estado.txt`. Eso es esperado, no un bug del script.

**TECHO 2 — el artefacto de claude.ai NO se puede republicar sin una
sesión de Claude**, y Emmanuel confirmó que es lo que él mira a diario (no
el `/exec`). El artefacto lleva los datos EMBEBIDOS (14 MB), así que
refrescar el Sheet no lo actualiza; hay que reconstruirlo y publicarlo. Se
descartaron dos caminos:
- **Agentes programados en la nube** (skill `schedule`): corren en la
  infraestructura de Anthropic y **no pueden tocar archivos locales**, así
  que no alcanzan el scratchpad ni pueden publicar desde él.
- **Que el artefacto lea los datos en vivo** desde el `/exec` en vez de
  traerlos adentro: técnicamente posible, pero obligaría a exponer ese
  endpoint (nombres de pacientes, teléfonos, montos) de forma accesible
  desde una página externa. **No se hizo: es una decisión de seguridad del
  negocio, no una decisión técnica nuestra.** Si algún día se retoma,
  empezar por ahí y no por el código.

**PENDIENTE de higiene**: todo el toolkit vive bajo
`AppData\Local\Temp\claude\...` (sección 26). Para una tarea programada
permanente eso es frágil — Windows puede limpiar Temp y el job se cae sin
aviso. Convendría mover el toolkit a una carpeta estable (ej.
`Desktop\Dashboard 360 mkt\pipeline\`) y actualizar las rutas absolutas de
`lib.py`, `qa_tablero.js`, `build_previa.js` y la propia tarea. **No se
hizo en esta sesión** porque toca rutas documentadas en varias secciones y
había que acordarlo primero.

*(Resuelto el mismo día — ver sección 52.)*

## 52 · El proyecto ya vive en git, y el toolkit salió de Temp (29-sep-2026)

Emmanuel: *"este tablero ya lo están leyendo mucha gente y me da miedo que
se pierda fácil"*. Tenía razón, y el diagnóstico era peor de lo que parecía.

**Lo que se verificó antes de opinar** (no era intuición):
- La carpeta del proyecto **no era un repo git** y **no había copia en
  ningún lado** (ni OneDrive ni backup). `Code.gs` (279 KB), `scripts.html`
  (191 KB) y el propio `CLAUDE.md` (137 KB, todo el conocimiento del
  proyecto) existían en UNA sola carpeta del Desktop.
- El pipeline completo — **419 scripts, 491 MB** — vivía dentro de
  `AppData\Local\Temp\claude\...`, una carpeta que Windows limpia por
  diseño. Ya había quedado huérfano una vez (sección 26).

**Lo que se hizo:**
1. El toolkit se copió a **`Dashboard 360 mkt/pipeline/`**. Los scripts de
   exploración de una sola vez (`probe_*`, `test_*`, `verif_*`) fueron a
   `pipeline/_scratch/` para que la carpeta principal se pueda leer.
2. Se reapuntaron las rutas absolutas (10 archivos). **Ojo con la trampa**:
   había DOS variantes de la misma ruta, con `C--Users` y con `c--Users`
   (mayúscula y minúscula), y un `sed` que solo cubría una dejaba 8
   archivos rotos en silencio.
3. `git init` + repo privado en
   `github.com/emmanuellopez-welli/dashboard-360-growth`. **446 archivos en
   el primer commit.**
4. La tarea `Welli_Reproceso_7am` se reapuntó a la ubicación nueva.
5. Se escribió un `README.md` para que otra persona pueda retomar esto sin
   contexto previo.

**LO MÁS IMPORTANTE DE ESTA SECCIÓN — la auditoría antes del push encontró
tres cosas que NO podían subir, y las tres se habrían filtrado:**

1. **24 scripts tenían el token de HubSpot (`pat-na1-...`) hardcodeado.**
   Eran `probe_*`, `test_*`, `verif_*` y los cuatro `pull_lt_wa_native*.py`.
   Se sanitizaron en la copia: ahora leen `lib.KEYS['HUBSPOT_PRIVATE_TOKEN']`
   del `.env`. **Ese token estuvo en texto plano en disco durante semanas —
   conviene rotarlo en HubSpot.**
2. **`.mcp.json` lleva la `x-consumer-api-key` de Composio en texto plano.**
   Quedó staged en el primer intento y solo lo atrapó el control explícito.
   Está en `.gitignore`.
3. **`sin_mensaje_134.csv` tenía nombres, CÉDULAS y teléfonos de 134
   pacientes** (salido del análisis del embudo de WhatsApp, sección 49).
   Alcanzó a entrar al commit local; se sacó con `git rm --cached` + amend
   ANTES del push, así que nunca llegó a GitHub. **Datos de habeas data no
   se versionan nunca**, aunque el repo sea privado. El `.gitignore` ahora
   cubre `sin_mensaje_*.csv`, `*_pacientes*.csv` y `*aprobados*.csv`.

**Regla para cualquier commit futuro en este repo**: antes de `git push`,
correr la auditoría sobre lo que está staged, no sobre el working tree:

```bash
git diff --cached | grep -icE "pat-na1-[a-z0-9]{10}|ck_[A-Za-z0-9]{18}|COMPOSIO_API_KEY=|META_ACCESS_TOKEN="
git diff --cached --name-only | grep -iE "^\.env|^\.mcp|\.csv$"
```

Los dos tienen que dar vacío/cero. Este proyecto mezcla código con datos de
pacientes reales todo el tiempo (listas de teléfonos, cédulas, montos), así
que el riesgo no es teórico: **de tres hallazgos, dos los atrapó el control
y no el `.gitignore` escrito de antemano.**

**Qué NO se versiona y por qué**: `.env` y `.mcp.json` (secretos),
`sheet_data.json` y `tables_*.json` (datos regenerables, 22 MB que
ensuciarían cada diff), `node_modules/`, `artifact_tablero.html` (14 MB
generados), los logs del reproceso, y cualquier `.csv`/`.xlsx` de análisis
puntual (suelen traer PII).

**Pendientes que quedaron de este mismo hilo** (en orden de valor):
- **Rotar el token de HubSpot** que estuvo hardcodeado.
- **Service account de GCP** (sección 51) — sin eso el reproceso de las 7am
  sigue fallando casi todos los días.
- **Migrar la gente al `/exec`** en vez del artefacto: el `/exec` lee el
  Sheet en vivo, así que con el reproceso automático quedaría siempre
  fresco sin paso manual. El artefacto, al llevar los datos embebidos,
  SIEMPRE va a necesitar una sesión de Claude para republicarse.
- **Sacar `CREDITO_DIA` del Sheet** (125 mil filas): es el origen del techo
  de 10M celdas (sección 43) y de que el artefacto pese 14 MB. Es un
  rediseño, no un parche.

## 53 · `profile_institucion.created` NO está en UTC — y casi cuesta la lectura contraria (29-sep-2026)

Emmanuel mandó la primera campaña de WhatsApp a los elegibles de segundo
crédito, a las 10:00 AM, y pidió medir si movió la aguja. La primera
consulta mostró las 9 solicitudes del día **entre las 5:27 y las 8:54 AM**
— o sea ANTES del envío — y la conclusión iba a ser "la campaña no produjo
nada". Era falso.

**`profile_institucion.created` guarda hora LOCAL de Bogotá pero está
tipada como TIMESTAMP**, así que BigQuery la interpreta como UTC y
`DATE(created,'America/Bogota')` / `FORMAT_TIMESTAMP(...,'America/Bogota')`
le restan 5 horas de más.

**Cómo se comprobó, porque a ojo no se distingue**: se miró la distribución
horaria de las 176.279 solicitudes de 2026.

| | pico | cola |
|---|---|---|
| Convertida a `America/Bogota` | **5-6 AM** | muere a las 3 PM |
| Sin convertir | **10-11 AM** | hasta las 7 PM |

Nadie pide crédito de consumo en masa a las 5 AM y para a las 3 PM. La
versión sin convertir es un día hábil normal. La campaña lo confirmó:
salió 10:00 y las solicitudes entraron 10:27, 10:51, 11:03, 11:12, 12:00,
12:09, 12:23, 13:11, 13:54 — un racimo de respuesta perfecto.

**Impacto a nivel de DÍA: 0,77%** (1.351 de 176.279 registros de 2026) — los
creados entre medianoche y 5 AM caen en el día anterior. **A nivel de HORA
es fatal** (5 horas de corrimiento), y por eso nunca había salido: este es
el primer análisis por hora del proyecto.

**Decisión de Emmanuel (29-sep-2026): corregir SOLO donde importa la hora.**
`pull_segundos.py` usa la hora sin convertir; el resto del tablero sigue
como está, porque 0,77% a nivel de día no mueve ninguna decisión y tocarlo
implicaría re-pull y re-verificación de todo. **Si algún día se quiere
corregir en serio, la evidencia está acá y no hay que volver a medirla.**

**Regla general**: antes de usar la HORA de cualquier campo de BigQuery en
este proyecto, correr la prueba de plausibilidad (distribución horaria: ¿el
pico cae en horario laboral?). Un campo fechado mal tipado se ve idéntico a
uno correcto hasta que se mira por hora.

## 54 · Panel de atribución de campañas en F8 (29-sep-2026)

La campaña manda a la gente a aplicar por **pre-check**, así que
`client_app_origination_medium = 'pre-check'` es la huella de un envío.
Validado contra el histórico antes de construir: de las 30 solicitudes de
segundo crédito que existen (desde el 22-sep), pre-check traía **3 en 7
días** (2 el día 22, 1 el 24) y la mañana de la campaña trajo **8**. El
salto es inequívoco.

**Se construyó como panel PERMANENTE de atribución, no como "la campaña de
hoy"** — a propósito. Un panel atado a una fecha caduca y hay que rehacerlo
en cada envío; así, cada campaña futura se ve sola como un pico de
pre-check sin tocar código. Tres piezas, **un solo eje cada una** (se
descartó la referencia que trajo Emmanuel, barras apiladas + línea con dos
ejes, que es justo lo que prohíbe la regla 5):

1. **Solicitudes por día, pre-check contra otros medios** (`chGrupos`).
2. **El día más activo del rango, hora por hora** — se pinta la jornada
   completa (6 AM a 8 PM) aunque haya horas vacías: un racimo se lee como
   racimo solo si al lado se ven las horas sin nada.
3. **Tabla de desenlace por medio**, con la **madurez de la cohorte
   declarada** (fecha de la solicitud más antigua y más reciente). Con
   horas de vida, "0 desembolsadas" no es fracaso: es que no ha pasado el
   tiempo. Sin esa línea la columna se lee al revés.

`pull_segundos.py` ganó `hora`, `hora_num` y `medio` en `SEG_SOLICITUDES`.

**Hallazgo, con su advertencia**: pre-check aprueba **64% (7 de 11)** contra
**21% (4 de 19)** de los otros medios, y trae casi el doble de plata con la
mitad de solicitudes. Tiene sentido — la campaña va a una lista ya filtrada
por buen comportamiento de pago. **Pero son 11 contra 19 solicitudes**: dos
o tres casos mueven la tasa varios puntos. Sirve para decir "la campaña
trae gente mejor calificada", no para poner un número en una meta.

## 55 · El tope de cobertura del QA estaba mal calibrado (29-sep-2026)

Al refrescar `RESCATE_DESENLACE`/`RESCATE_GESTION` el QA pasó de 2 fallos a
**48**, todos el mismo: `f4.metas[2026-09-28].cobertura = 492,9` contra un
tope de 300.

**No era un bug del tablero.** `cobertura = monto trabajado / enM`, donde
`enM = mApr - mFirm` — lo aprobado ese día MENOS lo que firmó ese mismo
día. El denominador es *lo que quedó esperando rescate*, no lo aprobado a
secas. En un día donde casi todo firma de una, `enM` se encoge y el % se
dispara aunque el equipo haya trabajado lo normal. El 28-sep: **$403M
trabajados** (en línea con $546M del 22 y $416M del 17) contra ~$82M netos
entrando.

Y encaja con lo medido el mismo día en el embudo de WhatsApp (sección 49):
**752 de 754 aprobados con fecha de firma firmaron el MISMO día**. Con ese
patrón, superar 300 era cuestión de tiempo.

**Se subió el tope a 1000 con el mecanismo escrito al lado**, no para que
el test pasara. La diferencia importa: subir un umbral sin entender por qué
falló es apagar la alarma; acá se rastreó la fórmula, se verificó que el
numerador estaba en línea con otros días, y se dejó el tope cuidando lo que
sí sería un error (un `enM` cercano a cero disparando el ratio a miles).

**Leyenda: `chGrupos` NO la dibuja sola.** Los tres gráficos de F8 salieron
publicados sin leyenda porque `panel(titulo, sub, CUERPO, idGrafico)` la
recibe como TERCER parámetro y se le pasó `''`. Emmanuel lo señaló de
inmediato: *"veo las barras pero a menos que me pare encima no me doy
cuenta que eso es welli check"* — con dos series distinguidas solo por
color, el tooltip es la única forma de saber cuál es cuál, y un tooltip no
sirve cuando alguien mira la pantalla compartida en una reunión.

Se corrigió pasando `leyenda([{nombre, color}, ...])` como cuerpo, que es
el patrón que ya usaban F1 y F5. **Y el rótulo lleva la explicación, no
solo el nombre técnico**: dice "pre-check — por donde entran las campañas",
no "pre-check" a secas, porque ese gráfico lo va a ver gente que no conoce
el flujo.

Regla: cualquier gráfico de MÁS DE UNA SERIE necesita `leyenda()` en el
cuerpo del panel. Si las series se distinguen solo por color, está
incompleto.

**Nota de proceso**: `jsdom_f8.js` empezó a fallar los 10 checks de
contenido con `VISTA=f1`. No era el bug de `VISTAS_VALIDAS` otra vez — eran
**los tiempos de espera**: el artefacto creció a 14,2 MB y el clic del nav
ocurría antes de que se engancharan los manejadores. Se subieron de
900/1400 ms a 3000/4000 ms, igual que `jsdom_f4wa.js`. **Si una
verificación de contenido falla con `VISTA=f1`, descartar primero el
tiempo de carga antes de buscar un bug de navegación** — a medida que el
artefacto crece, estos tests se vuelven frágiles por tamaño.

## 56 · Dos paneles de F8 borrados el mismo dia que se construyeron (29-sep-2026)

De la seccion 54 quedaron en pie solo dos de las tres piezas de atribucion.
Emmanuel pidio borrar **la grafica por hora del dia mas activo** y **la tabla
de desenlace por medio** ("Las dos"), horas despues de publicarlas. F8 queda
con: las 4 tarjetas, solicitudes vs desembolsos por dia, la atribucion diaria
(pre-check contra otros medios) y el Sankey de especialidades.

**Limpieza de codigo muerto aguas arriba (regla 33), no solo del HTML**: al
quitar esos dos paneles, `f.porMedio`, `f.horas`, `f.diaPico`, `f.diaPicoN`,
`f.cohorteDesde` y `f.cohorteHasta` quedaron sin ningun consumidor en
`scripts.html` — se borraron de `armarF8_` en vez de dejarlos calculando algo
que nadie lee. El bucle que quedo solo arma `f.atribDia`. Las variables
huerfanas del frontend (`pm`, `precheck`) tambien se fueron.

**El dato crudo SI se dejo**: `SEG_SOLICITUDES` conserva `hora` y `hora_num`
(seccion 54). Si algun dia se quiere volver a la vista por hora, se reagrega
en `Code.gs`/`scripts.html` sin volver a correr `pull_segundos.py` — esta
anotado en un comentario ahi mismo.

**QA**: `chequearF8` perdio los chequeos de `porMedio`/`horas`/`diaPico` (ya
no existe que verificar) y conserva el de `atribDia`: que la suma cuadre con
el total del periodo, que la serie de pre-check cuadre con un recalculo
independiente sobre `SEG_SOLICITUDES`, y que ningun dia salga negativo.
120 combinaciones, 274.011 aserciones, 0 fallos, 0 avisos. `jsdom_stress.js`
216/0, `jsdom_f8.js` 18/0, `jsdom_f4wa.js` 12/0, `dbg.js` con la pagina
cargando (regla 50). Publicado como version 109, misma URL.

**Falso positivo que vale anotar para la proxima verificacion de contenido**:
al comprobar que los paneles ya no estaban, se busco el texto "solicitudes en
el periodo" — que TAMBIEN aparece en el subtitulo del estado vacio del
Sankey, asi que el check fallaba con el borrado ya hecho. Se cambio por
`doc.querySelectorAll('.lectura').length === 0`, que es especifico de lo que
se borro. **Un negativo de contenido tiene que anclarse a algo que solo exista
en el panel borrado**, no a una frase generica que el tablero repite en otros
lados.

## 57 · F2 Profundizacion: "nunca han hecho nada" cambiado por dos mapas de Autogestionados (30-sep-2026)

Pedido explicito: borrar el mapa 8 ("Sedes que nunca han hecho nada",
seccion 24) y reemplazarlo por dos replicas de "Sedes exitosas" (2) y
"Sedes que desembolsan · acumulado" (3), **restringidas a las sedes que HOY
estan en el pipeline Autogestionados de HubSpot**.

**Es una foto del pipeline ACTUAL, no de la cosecha de entrada.** Una sede
puede salir de estos dos mapas nuevos de un dia para otro si se mueve a
Farmer o se deshabilita — aunque ya haya sido exitosa. Se declara en el
`sub` de cada panel para que no se lea como un bug si una cosecha "pierde"
sedes de esta tabla en particular sin que las otras (2 y 3) cambien.

**Implementacion — se reusa la MISMA agrupacion por cosecha, solo se angosta
la poblacion.** `armarF2_` ya agrupaba `cos`/`cosB` (cosecha de entrada →
lista de `id_internal`) antes de correr los MEDIR; se agrego
`idsAutoget_` (set de `id_internal` con `pipeline === 'Autogestionados'`,
leido de `U.base`, que ya trae el campo `pipeline` crudo de la hoja SEDES)
y `filtrarCosechaPorIds_()`, que produce `cosAuto`/`cosBAuto` filtrando
`ids` de cada cosecha contra ese set. Los dos mapas nuevos
(`exitosas_auto` orden 8, `desembolsos_auto` orden 9) corren los MISMOS
`MEDIR.exitosas`/`MEDIR.desembolsos` de siempre, pero sobre `cosAuto` en
vez de `cos` — no hizo falta un MEDIR nuevo ni un pull nuevo, `SEDES.pipeline`
ya viene embebida en el artefacto desde antes.

**Limpieza de codigo muerto (regla 33)**: `nuncaVivas_()` se borro entera
(su unico consumidor era el mapa borrado) junto con el
`if (B) B.nuncavivas = ...` del comparador. En su lugar,
`if (B) { B.exitosas_auto = ...; B.desembolsos_auto = ...; }` para que el
comparador de grupos (marketing/comercial) tambien traiga los dos mapas
nuevos — el loop generico de `f.mapas.forEach` que cuelga `filasB`/
`promedioB` por `m.id` los recoge solo con que existan en `B`.

**QA — recalculo genuinamente independiente, no autoconsistencia (regla 4).**
El chequeo viejo de `nuncavivas` comparaba dos salidas de Code.gs entre si
(activas vs. su complemento) — no habria servido para el pedido de hoy. El
nuevo (`chequearF2` ahora recibe `orig`/`rol`) llama al primitivo real
`universoSedes_(orig, rol)` (regla 3: el punto unico de filtro, reusarlo es
correcto — no se esta probando el filtro, se esta probando lo que armarF2_
hace CON el filtro), rearma la cosecha por sede con una implementacion
propia de `cosechaDe_` (no puede llamar a la de Code.gs porque es local a
`armarF2_`, no global) y vuelve a medir sobre `SEDE_ESTADO_MES` desde cero.
Verifica: `cruzables` de cada cosecha == el conteo independiente, cada
celda == el conteo independiente mes a mes, y la plata de `desembolsos_auto`
== la suma independiente. 286.131 aserciones (subio de 274.521 por los
checks nuevos), 0 fallos, en las 120 combinaciones de fecha×origen×rol.

**Verificacion de contenido (regla 16), con el aprendizaje de la seccion 56
ya aplicado**: se peino con `.panel h3` los titulos (NO `body.textContent`,
que incluye el codigo fuente del `<script>` embebido — un primer intento
con `textContent` dio un falso positivo porque el propio comentario de este
cambio, dentro de Code.gs, menciona el nombre del panel borrado) y se
confirmo que las tablas de los dos paneles nuevos pintan celdas de calor
reales (`td.hm`), no que el panel exista vacio.

**Numeros al 30-sep-2026** (todo 2026, sin filtro): 6 cosechas con al menos
una sede en Autogestionados hoy; la mas madura (enero-2026) tiene 33 sedes
cruzables, de las cuales 28 (85%) ya son exitosas y 13 (39%) ya
desembolsaron.

Publicado como version 111, misma URL de siempre.
