# PROMPT: Dashboard 360 de Growth & Marketing — WELLI

## Contexto del proyecto

Soy el líder de Growth & Marketing de **WELLI**, una fintech colombiana de créditos de salud. Necesito construir un **dashboard ejecutivo de resultados** que presenta ante el equipo de Growth y C-Level en comité. El dashboard tiene **6 frentes** (páginas/pestañas), cada uno enfocado en un área de gestión.

---

## Arquitectura técnica

El sistema tiene 3 capas:

1. **Google Apps Script (backend):** Scripts que se conectan a las APIs de Meta Ads, HubSpot, BigQuery e Hilos para extraer datos y escribirlos en un Google Sheet.
2. **Google Sheets (capa de datos):** Almacena toda la data procesada. Se actualiza automáticamente una vez al día con un trigger de Apps Script (ej. 6:00 AM Colombia, UTC-5).
3. **HTML/CSS/JS (frontend):** Una web app desplegada como Apps Script Web App (`doGet()`) que lee los datos del Google Sheet vía `google.script.run` y renderiza el dashboard con gráficas, tarjetas y tablas interactivas.

**Todo se crea desde cero** — no hay Sheet ni proyecto de Apps Script existente.

### Estructura del Google Sheet (hojas sugeridas)

| Hoja | Fuente | Contenido |
|------|--------|-----------|
| `META_ADS` | Meta Ads API | Datos diarios: fecha, leads, gasto, impresiones, clics, CTR, CPL calculado |
| `COSECHAS` | HubSpot API | Sedes agrupadas por mes de entrada (`fecha_entrada_pipeline_actual`) × origen × calidad (A/AA/AAA) |
| `CONVERSION` | BigQuery | Embudo de conversión: fecha_solicitud, id, solicitud, flag_aprobado, flag_convertido (query exacta incluida abajo) |
| `REVENUE` | BigQuery | Ingresos/desembolsos: id, referencia_pago, validated_on (fecha OTP), monto_credito (query exacta incluida abajo) |
| `F2_WORKFLOWS` | HubSpot API | Sedes en workflows: estrena primer paciente, pacientes que pasan, desembolso, atribución |
| `RESCATE` | BigQuery + Hilos | Pacientes rescatados (ventana corta/media), piezas, interacción — **MOCKUP por ahora** |
| `WELLI_POINTS` | BigQuery | Sedes habilitadas, activas, adopción, WP entregados/redimidos por mes |
| `NOVEDADES` | Manual / Mockup | Productos nuevos, acciones, piezas — **MOCKUP por ahora** |
| `CONFIG` | Manual | Parámetros: API keys (en Properties del proyecto, NO en la hoja), textos cualitativos, fechas de referencia |

---

## Configuración de APIs (desde cero en Apps Script)

### 1. Meta Ads API
- **Auth:** Token de acceso de larga duración (Long-Lived User Access Token) o System User Token.
- **Endpoint:** `https://graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/insights`
- **Ad Account WELLI:** `act_1373974740859060` (moneda COP)
- **Campos a pedir:** `spend, impressions, clicks, ctr, actions` (filtrar `action_type == 'lead'` para leads; **NO sumar** `lead_grouped` ni `offsite_conversion.*_add_meta_leads` porque duplican el mismo lead)
- **CPL:** campo derivado = `spend / leads`
- **CTR:** viene como porcentaje (2.07 = 2.07%)
- **Breakdowns opcionales:** `campaign_name`, `adset_name`, `ad_name` para desglose por creativo
- **Time range:** `time_range: {since: 'YYYY-MM-DD', until: 'YYYY-MM-DD'}` con `time_increment: 1` para datos diarios
- **Guardar en Properties del script:** `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`

### 2. HubSpot API
- **Auth:** Private App Token (Bearer token). Scopes necesarios: `crm.objects.custom.read`, `crm.objects.contacts.read`, `crm.objects.deals.read`, `automation`.
- **Base URL:** `https://api.hubapi.com`
- **Portal:** `50421361`
- **Objeto Sedes (custom):** typeId `2-50958246`
  - Endpoint búsqueda: `POST /crm/v3/objects/2-50958246/search`
  - Body: `{"filterGroups": [{"filters": [{"propertyName": "hs_object_id", "operator": "GTE", "value": "0"}]}], "properties": [...], "limit": 100, "after": "..."}`
  - **QUIRK:** si filtras POR una propiedad, HubSpot la EXCLUYE de la respuesta. Usar `hs_object_id GTE 0` para traer todo.
  - **Propiedades clave de Sedes:**
    - `origen` (enum: HUNTER, FARMER, PAGINA WEB, SOCIAL MEDIA, EVENTO, REFERIDO, INFLUENCER, etc.)
    - `clasificacion_aliado` (enum: A, AA, AAA) — **esta es la calidad de sede**
    - `fecha_entrada_pipeline_actual` — **define la cosecha** (mes en que la sede entró al pipeline actual)
    - `fecha_entrada_auto`, `fecha_entrada_farmer`, `cs_fecha_entrada`, `fecha_entrada_capm` — fechas de entrada por pipeline
    - `hs_pipeline`, `hs_pipeline_stage` — pipeline y etapa actual
    - `grupo_long_tail` (enum 15 valores: A1·Sin estrenar ... R4·Pasa a Muertos, A·Deuda onboarding ... E·Muerta de verdad)
    - `ranking` (Oro/Plata/Bronce)
    - ⚠️ **`wrapped_pacientes_aprobados`, `wrapped_pacientes_desembolsados` — MUERTOS, NO USAR** (vacíos en las 3.601 sedes, son del "Wrapped 2025")
    - **Contadores VIVOS (usar estos):**
      - `aplicaciones` — total aplicaciones de por vida de la sede
      - `total_aprobados` — total aprobados de por vida
      - `desembolsos` — total desembolsos de por vida
      - `apps_sede_actual` — aplicaciones del mes en curso
      - `desembolsos_mes_actual` — desembolsos del mes en curso
      - `aprobados_no_firmados` — inventario directo de rescate (940 sedes)
      - `total_aprobados_no_firmados_ultimos_30_dias` / `_60_dias`
      - `total_aprobados_ultimos_30_dias` / `_60_dias`
      - `total_de_desembolsos_ultimos_30_dias` / `_60_dias`
      - `monto_total_desembolsado`, `monto_desembolsado_mes`
      - `cs_apps_total_bq`, `cs_firmas_total_bq` — contadores poblados desde BigQuery
      - `cs_hizo_1app` — booleano, ¿la sede hizo al menos 1 app?
      - `cs_exitosa_real` — booleano, ¿la sede fue exitosa en CS?
      - `dias_desde_ultima_app` — días desde la última aplicación
    - `asesor_comercial` — email del farmer asignado
    - `puntos` (welli-points balance), `wp_ganado_acumulado_mes`, `wp_ofrecido_acumulado_mes`, `no_aplica_wp`
- **Paginación:** usar campo `after` del response (cursor-based, no offset).
- **Guardar en Properties:** `HUBSPOT_TOKEN`

### 3. Google BigQuery
- **Auth:** Service Account JSON key almacenada en Properties del script, usar `ScriptApp.getOAuthToken()` con el scope `https://www.googleapis.com/auth/bigquery`.
- **Proyecto:** `welli-tecnologia`
- **Dataset:** `public`
- **Endpoint:** `https://bigquery.googleapis.com/bigquery/v2/projects/welli-tecnologia/queries`
- **Tablas principales:**
  1. **`profile_institucion`** (48 columnas) — solicitudes de crédito de pacientes:
     - `id` — ID único de la solicitud/aplicación
     - `estado` — estado actual del crédito (ver mapeo completo en la sección de conversión)
     - `monto` — monto del crédito (USAR ESTE para revenue, NO `monto_desembolso_medico`)
     - `monto_aprobado`, `monto_desembolso_medico` — montos alternativos
     - `created_on` — fecha de creación de la solicitud (USAR `DATE(created_on)` para filtrar por período)
     - `fecha_solicitud_desembolso` — fecha de solicitud de desembolso
     - `medico` = nombre de la SEDE/institución (ej. "Sonria sede Centro Mayor")
     - `medico_id` = ID de la sede (para join con HubSpot)
     - `referencia_pago` — referencia del pago
     - `cambios` = JSON STRING con historial de cambios de estado y timestamps
  2. **`otp_log`** — validaciones OTP (firma del paciente = momento real del desembolso):
     - `application_id` — FK a `profile_institucion.id`
     - `validated_on` — timestamp de validación del OTP (**esta es la fecha real de revenue**)
     - Usar `MAX(validated_on)` por `application_id` para evitar duplicados
  3. **Tabla Welli Points** — buscar en dataset `public` (el usuario confirmará el nombre exacto). Si no existe, complementar con propiedades WP del objeto Sedes en HubSpot.
- **Guardar en Properties:** `BQ_PROJECT_ID`, `BQ_SERVICE_ACCOUNT_JSON`

### 4. Hilos API
- **Auth:** Header `Authorization: Token {API_KEY}`
- **Base URL:** `https://api.hilos.io/api/`
- **IMPORTANTE:** rutas SIN slash final (el slash da 404)
- **Endpoints útiles:**
  - `GET broadcast` — campañas WhatsApp con métricas: `sent, delivered, read, answered, failed, pending, created_on, status`
  - `GET flow` — flows con `num_contacts, completed, running, failed`
  - `GET inbox/conversation` — conversaciones
- **Paginación:** campo `next` en el response, usar `limit=40` y reintentos por timeouts
- **Guardar en Properties:** `HILOS_API_KEY`

---

## Diseño visual — Marca WELLI

- **Colores:**
  - Amarillo `#FFCE00` (principal, predominante — fondo de acento, highlights)
  - Azul `#4C7DFF` (jerarquía, botones, resaltados, gráficas primarias)
  - Morado `#8C65C9` (solo acentos pequeños)
  - Fondos claros: `#FFF4C4` (amarillo suave), `#EBEFF7` (azul suave)
  - Texto: `#141310` (solo para texto, nunca para fondos/botones)
  - Semáforo: verde `#22C55E`, amarillo `#EAB308`, rojo `#EF4444`
- **Tipografía:** Inter (Google Fonts). Fallback: Arial.
- **Reglas:** "WELLI" SIEMPRE en mayúsculas. Tono humano, claro, sencillo.
- **Layout:** Responsive, mobile-friendly. Sidebar con navegación entre frentes. Header fijo con logo WELLI + filtro de fechas global.

---

## Filtro de fechas (GLOBAL, impacta todo)

- **Tipo:** Rango libre, día a día (date picker de inicio y fin).
- **Presets rápidos:** "Esta semana", "Últimas 4 semanas", "Este mes", "Mes anterior", "Últimos 3 meses", "Todo 2026".
- **Comparación vs período anterior:** Automática. Si selecciono del 5 al 15 de agosto (10 días), el período anterior es del 26 de julio al 4 de agosto (los 10 días previos). Las tarjetas KPI muestran:
  - Valor actual del período seleccionado
  - Delta porcentual vs período anterior (verde si es positivo/bueno, rojo si es negativo/malo — invertido para CPL donde menos es mejor)
  - Flecha visual (▲ o ▼)
- **Impacto:** TODAS las tarjetas, gráficas y tablas se filtran por este rango de fechas.

---

## FRENTE 1: Adquisición & Inbound/Outbound Marketing

### Fuente principal: Meta Ads + HubSpot + BigQuery

### Tarjetas KPI (fila superior, 5 tarjetas)
Cada tarjeta muestra: valor grande, label, delta % vs período anterior con flecha y color.

| Tarjeta | Fuente | Cálculo |
|---------|--------|---------|
| **Leads (Meta)** | Meta Ads | Suma de `actions` donde `action_type == 'lead'` en el rango |
| **CPL** | Meta Ads | Gasto total / Leads totales en el rango (COP). **Menos es mejor** → delta invertido |
| **Gasto** | Meta Ads | Suma de `spend` en el rango (COP, formato $X.XXX.XXX) |
| **Impresiones** | Meta Ads | Suma de `impressions` en el rango |
| **CTR** | Meta Ads | Promedio ponderado: (clics totales / impresiones totales) × 100 en el rango |

### Gráfica 1: Leads vs CPL a lo largo del tiempo
- **Tipo:** Combo — barras (leads, amarillo `#FFCE00`) + línea (CPL, azul `#4C7DFF`)
- **Eje X:** Fechas (agrupadas por día o semana según rango seleccionado; si el rango es > 60 días, agrupar por semana)
- **Eje Y izquierdo:** Leads (barras)
- **Eje Y derecho:** CPL en COP (línea)
- **Tooltip:** al hover mostrar fecha, leads exactos, CPL exacto

### Gráfica 2: Histograma de inversión en pauta
- **Tipo:** Barras verticales (azul `#4C7DFF`)
- **Eje X:** Fechas (misma agrupación que gráfica 1)
- **Eje Y:** Gasto en COP
- **Formato:** valores en K o M según magnitud

### Tabla de Cosechas (de HubSpot)
**Concepto:** Una cosecha = cohorte de sedes agrupadas por el mes en que entraron al pipeline actual (`fecha_entrada_pipeline_actual`). Ej: cosecha enero = sedes cuya `fecha_entrada_pipeline_actual` cae entre 1-31 de enero.

**Columnas de la tabla:**

| Cosecha (mes) | Total sedes | Eventos | Referidos | Página Web | Social Media | Otros orígenes | Sedes AA | Sedes AAA |
|---|---|---|---|---|---|---|---|---|

- **Fuente:** HubSpot objeto Sedes (`2-50958246`)
  - Agrupar por `MONTH(fecha_entrada_pipeline_actual)` 
  - Desglosar por `origen` (EVENTO, REFERIDO, PAGINA WEB, SOCIAL MEDIA, resto = "Otros")
  - Filtrar calidad de `clasificacion_aliado` = AA o AAA para las últimas 2 columnas
- **Nota importante:** Si la fuente de "página web" o "social media" está vacía o con 0 sedes, mostrar la celda con un badge que diga: `⚠️ Falta conexión con [fuente]` — NO inventar datos.
- **Filtro de fechas:** la tabla muestra las cosechas cuyos meses caen dentro del rango seleccionado.

### Gráfica 3: Tasa de conversión por origen
- **Tipo:** Barras horizontales
- **Fuente:** BigQuery — `profile_institucion`
- **Valor:** Tasa de conversión = Convertidos / Total solicitudes
- **Query EXACTA de conversión (proporcionada por el usuario):**
  ```sql
  WITH
    base AS (
      SELECT
        id,
        DATE(created_on) AS fecha_solicitud,
        CASE
          WHEN estado IN (
            'on_hold_rejected', 'rejected_validation', 'risk_in_process',
            'rejected', 'fraud', 'creada', 'on_hold_approved', 'on_hold_docs')
            THEN 'Rechazado'
          WHEN estado IN ('firma_contrato', 'approved', 'not_taken')
            THEN 'Aprobado'
          WHEN estado IN (
            'pendiente_aprobacion_medico', 'desembolsado',
            'pendiente_validacion_cliente', 'fulfilled', 'pendiente_desembolso',
            'dismissed')
            THEN 'Convertido'
          ELSE 'Otro'
        END AS estado_final
      FROM `welli-tecnologia.public.profile_institucion`
      WHERE medico_id IS NOT NULL
    ),
    flags AS (
      SELECT
        *,
        CASE WHEN estado_final IN ('Aprobado', 'Convertido') THEN 1 ELSE 0 END AS flag_aprobado,
        CASE WHEN estado_final = 'Convertido' THEN 1 ELSE 0 END AS flag_convertido
      FROM base
    )
  SELECT
    fecha_solicitud,
    id,
    1 AS solicitud,
    flag_aprobado,
    flag_convertido
  FROM flags
  ```
  **Lógica del embudo:**
  - `flag_aprobado = 1` incluye TANTO "Aprobado" como "Convertido" (el aprobado es precondición del convertido)
  - Embudo: **Solicitudes** (count total) → **Aprobados** (sum flag_aprobado) → **Convertidos** (sum flag_convertido)
  - Tasa aprobación = aprobados / solicitudes
  - Tasa conversión = convertidos / solicitudes
  - Tasa aprobado→convertido = convertidos / aprobados
  
  **Mapeo completo de estados:**
  | Categoría | Estados en BigQuery |
  |-----------|-------------------|
  | **Rechazado** | `on_hold_rejected`, `rejected_validation`, `risk_in_process`, `rejected`, `fraud`, `creada`, `on_hold_approved`, `on_hold_docs` |
  | **Aprobado** (no convirtió aún) | `firma_contrato`, `approved`, `not_taken` |
  | **Convertido** (desembolsó) | `pendiente_aprobacion_medico`, `desembolsado`, `pendiente_validacion_cliente`, `fulfilled`, `pendiente_desembolso`, `dismissed` |

  **Para desglose por origen:** Agregar `WHERE fecha_solicitud BETWEEN @inicio AND @fin` y hacer JOIN con la tabla de sedes de HubSpot usando `medico_id`. Si no es posible el join directo, mostrar conversión total + badge `⚠️ Pendiente: mapeo medico_id ↔ HubSpot para desglose por origen`.

### Sección cualitativa (editable desde el Sheet hoja CONFIG)
Tres bloques de texto con ícono:
- ✅ **Lo que está funcionando** — texto libre
- ⚠️ **Cuello de botella** — texto libre
- 🔔 **Atención esta semana** — texto libre

---

## FRENTE 2: Profundización & Cuentas VIP (Autogestionados + Muertos)

### Fuente: HubSpot (objeto Sedes + Workflows)

> **CONTEXTO:** El 27-28 de agosto de 2026 se activaron workflows en HubSpot: "Estrenar tu primer paciente" y "Pacientes que pasan". Estos workflows operan sobre el objeto Sedes.

### Tarjetas KPI principales (fila de 4)

| Tarjeta | Qué mide | Cómo sacarlo de HubSpot |
|---------|----------|------------------------|
| **Estrena tu primer paciente** | Sedes que hicieron su primera aplicación en el período | `cs_hizo_1app = true` Y la sede entró al pipeline en el rango de fechas. O contar sedes donde `aplicaciones >= 1` y `fecha_entrada_pipeline_actual` cae en el período. Los workflows recién se activaron (27-28 ago), así que enrollment data puede ser limitada aún. |
| **Pacientes que pasan** | Sedes que tuvieron al menos una app aprobada en el período | `total_aprobados >= 1` Y `apps_sede_actual > 0` (activas este mes). O sedes con `aprobados_no_firmados > 0` → pacientes con aprobación pendiente de firma. |
| **Desembolso** | Sedes que desembolsaron en el período | `desembolsos_mes_actual > 0` para el mes en curso. Para histórico: `desembolsos >= 1`. Complementar con `monto_desembolsado_mes` para el monto. |
| **Atribución** | Sedes autogestionadas activas que abrieron comunicación e hicieron apps/desembolsos | Usar la **capa de atribución que ya existe en HubSpot**: `audiencia_long_tail` (ESTRENA/PERFILAMIENTO/DESEMBOLSO/REACTIVAR/etc.) + `lt_ultima_pieza` (la pieza enviada) + `estado_comunicaciones` (active/died/etc.). Cruzar: sedes en pipeline Autogestionados + `audiencia_long_tail` != 'SIN_CAMPANA' + `apps_sede_actual > 0`. **⚠️ Ojo:** `lt_ultimo_canal` y `lt_ultimo_envio_fecha` están vacíos — se sabe qué pieza recibió cada sede pero NO cuándo ni por qué canal. |

> **⚠️ CAMPOS MUERTOS — NO USAR `wrapped_*`:** Los campos `wrapped_pacientes_aprobados`, `wrapped_pacientes_desembolsados`, `wrapped_monto_desembolsado` están **vacíos en las 3.601 sedes** (son del "Wrapped 2025"). Siempre usar los contadores vivos listados en la sección de propiedades de HubSpot.

### Bloque de clínicas muertas reactivadas
- **Card:** "Clínicas muertas que abrieron comunicación y se reactivaron"
- **Fuente:** Sedes cuyo pipeline anterior era "Muertos" y ahora están en otro pipeline (usar `fecha_entrada_pipeline_actual` vs fecha de pipeline anterior)
- **Open Rate:** XX% (si está disponible desde email/WhatsApp, sino badge `⚠️ OR pendiente`)

### Bloque de acciones marketing a clínicas AAA
- Filtrar sedes con `clasificacion_aliado = 'AAA'`
- Listar estrategias y visitas (si `fecha_de_visita` está poblada)
- **Nota:** `fecha_de_visita` casi no se registra (solo 23 sedes de 3.546) → mostrar dato real + nota "Solo 23 sedes con visita registrada"

### Histórico: comunicaciones promedio antes de revivir
- Promedio de touchpoints (emails + WhatsApp) antes de que una sede muerta se reactive
- **Si no se puede calcular:** badge `⚠️ Requiere cruce Hilos × HubSpot para medir touchpoints pre-reactivación`

---

## FRENTE 3: (Incluido en Frente 2 — no es pestaña separada)

El slide 2 de la presentación combina F2 y F3 ("Profundización & Cuentas VIP — Autogestionados + Muertos"). Todo el contenido de "Mundo AAA" va dentro del Frente 2.

---

## FRENTE 4: Rescate de Créditos Estancados — **MOCKUP**

> **ESTADO:** Este frente todavía no se ha empezado a operar. Dejar el mockup visual listo con tarjetas y gráficas pero con datos de ejemplo/placeholder claramente marcados.

### Tarjetas KPI (mockup)

| Tarjeta | Descripción | Valor mockup |
|---------|-------------|--------------|
| **Pacientes rescatados** | Total rescatados en el período | `--` |
| **Rescatados ventana corta** | Pacientes que desembolsaron en < 15 días tras contacto | `--` |
| **Rescatados ventana media** | Pacientes que desembolsaron entre 15-30 días tras contacto | `--` |

### Sección de piezas (mockup)
- Tabla/cards de las piezas de comunicación (WhatsApp/email) con más interacción
- Columnas: Pieza, Tipo, Enviados, Interacción, Resultado
- Datos: placeholder con `[Pendiente conexión]`

### Sección cualitativa (mockup, misma estructura que F1)
- ✅ Lo que está funcionando — `[Por definir]`
- ⚠️ Cuello de botella — `[Por definir]`
- 🔔 Atención esta semana — `[Por definir]`

### Banner superior del frente
Mostrar un banner informativo:
> 🚧 **Frente en construcción** — Los datos de rescate requieren: conexión BigQuery (`profile_institucion` con lógica de ventana de firma) + cruce con Hilos (contacto previo al desembolso). Fuente de datos pendiente de integración.

**Referencia de query para cuando se active (ya existe, del dashboard anterior):**
```sql
-- Rescate: desembolsados cuya fecha_solicitud_desembolso - fecha_approved > 30 días
SELECT 
  medico as sede,
  monto_desembolso_medico as monto,
  fecha_solicitud_desembolso,
  -- fecha_approved extraída de JSON 'cambios'
FROM `welli-tecnologia.public.profile_institucion`
WHERE estado = 'desembolsado'
  AND DATE_DIFF(fecha_solicitud_desembolso, fecha_approved, DAY) > 30
```

---

## FRENTE 5: Adopción de Welli Points

### Fuente principal: BigQuery (tabla de Welli Points — nombre exacto por confirmar con el usuario)

> **NOTA PARA EL DESARROLLADOR:** El usuario confirmó que la fuente es BigQuery. Buscar la tabla en el dataset `public` del proyecto `welli-tecnologia`. Si no existe una tabla específica de Welli Points, complementar con las propiedades del objeto Sedes en HubSpot: `puntos`, `wp_ganado_acumulado_mes`, `wp_ofrecido_acumulado_mes`, `no_aplica_wp`, `ultimo_wp_ganado_fecha`.

### Tarjetas KPI (fila de 4)

| Tarjeta | Descripción | Fuente |
|---------|-------------|--------|
| **Sedes habilitadas** | Total de sedes con acceso a Welli Points | BigQuery o HubSpot (`no_aplica_wp = false/true`) |
| **Sedes que han entrado** | Sedes que han usado/activado WP al menos una vez | BigQuery (logins únicos) o HubSpot (`puntos > 0` o `wp_ganado_acumulado_mes > 0`) |
| **Adopción %** | Sedes activas / Sedes habilitadas × 100 | Calculado |
| **Sedes sin entrar** | Sedes habilitadas que nunca han usado WP | Habilitadas − Activas (target de outreach) |

### Tarjetas secundarias

| Tarjeta | Descripción |
|---------|-------------|
| **WP entregados en el mes** | Suma de `wp_ganado_acumulado_mes` de todas las sedes en el período |
| **WP redimidos en el mes** | WP canjeados (si existe el campo; sino badge `⚠️ Campo redención pendiente`) |
| **Entregados vs Redimidos** | Ratio o comparación visual |
| **Promedio apps sedes con WP vs sin WP** | Promedio de `wrapped_pacientes_aprobados` de sedes activas con WP vs sedes sin WP |

### Gráfica: Sedes que entraron por mes
- **Tipo:** Barras o línea temporal
- **Eje X:** Meses
- **Eje Y:** Sedes nuevas que activaron WP ese mes

### Sección: Campañas/mensajes activos en el mes
- Lista de campañas WP activas (si hay fuente; sino placeholder)
- Métricas por campaña si están disponibles

---

## FRENTE 6: Novedades de Producto — **MOCKUP**

> **ESTADO:** Fuente de datos no definida. Dejar mockup visual para que se vea la estructura.

### Estructura del mockup

**Card por cada producto/novedad:**
- Nombre del producto (ej. "Cupones", "Nueva funcionalidad X")
- Descripción breve
- Acciones asociadas (qué se hizo: campaña, pieza, email)
- Piezas de la campaña (thumbnails placeholder)
- Inversión (si aplica)
- Período de la campaña

**Gráfica mockup:** Comparación de aumento semana y mes (barras comparativas)

### Banner superior
> 🚧 **Frente en construcción** — Las novedades de producto se ingresarán manualmente o desde una fuente por definir. Actualmente en modo mockup.

### Referencia visual (del slide 5)
- Cards tipo "Cupones": Cupones creados, Cupones en curso, Total redenciones, Próximos a vencer (con colores rosa/verde/azul/amarillo como en la imagen de referencia)

---

## Especificaciones del frontend (HTML)

### Estructura general
```
┌──────────────────────────────────────────────┐
│  HEADER: Logo WELLI + "Dashboard 360 Growth" │
│  [Filtro fechas: Desde ___ Hasta ___] [Presets ▾]  │
│  Período anterior: XX/XX — XX/XX             │
├────────┬─────────────────────────────────────┤
│ SIDEBAR│  CONTENIDO DEL FRENTE ACTIVO        │
│        │                                     │
│ F1 ●   │  [Tarjetas KPI]                    │
│ F2     │  [Gráficas]                        │
│ F3     │  [Tablas]                          │
│ F4     │  [Sección cualitativa]             │
│ F5     │                                     │
│ F6     │                                     │
│        │                                     │
│ Última │                                     │
│ actual.│                                     │
│ 6:02am │                                     │
└────────┴─────────────────────────────────────┘
```

### Tecnología frontend
- **HTML5 + CSS3 + JavaScript vanilla** (no frameworks pesados — debe correr embebido en Apps Script)
- **Gráficas:** Chart.js (incluir vía CDN o embebido) — soporta combo charts, tooltips, responsive
- **CSS:** Variables CSS para los colores de marca. Flexbox/Grid. Responsive.
- **Dark/Light mode:** Opcional pero recomendado (toggle en header)

### Comunicación frontend ↔ backend
```javascript
// Desde el HTML, llamar al backend:
google.script.run
  .withSuccessHandler(function(data) {
    // data = JSON con toda la info del Sheet
    renderDashboard(data);
  })
  .withFailureHandler(function(err) {
    showError(err);
  })
  .getDashboardData(fechaInicio, fechaFin);
```

```javascript
// En Apps Script (Code.gs):
function doGet() {
  return HtmlService.createHtmlOutputFromFile('dashboard')
    .setTitle('Dashboard 360 — WELLI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDashboardData(fechaInicio, fechaFin) {
  // Leer datos del Sheet, filtrar por fechas, calcular deltas
  // Retornar JSON estructurado por frente
}
```

### Tarjetas KPI — Componente reutilizable
Cada tarjeta tiene:
- Label superior (ej. "LEADS (META)")
- Valor grande (ej. "372")
- Sublabel (ej. "costo por lead")
- Delta vs período anterior: flecha + porcentaje + color
  - Verde (▲ +15%) si es bueno
  - Rojo (▼ -8%) si es malo
  - **Invertir para CPL:** menos CPL es bueno → verde cuando baja
- Borde izquierdo de color según el tipo de dato

### Regla fundamental: NO inventar datos
**Para cada métrica que se muestre:**
- Si hay datos reales de la fuente → mostrar el dato real
- Si la fuente no está conectada o no tiene datos → mostrar `--` con un badge: `⚠️ Falta conexión con [nombre de la fuente] para [qué se necesita]`
- Si es un frente en mockup (F4, F6) → banner claro "Frente en construcción" + datos placeholder con estilo visual distinto (fondo gris claro, texto en itálica)
- **NUNCA rellenar con datos inventados o estimados sin marcarlo explícitamente**

---

## Plan de ejecución sugerido (fases)

### Fase 1: Infraestructura
1. Crear Google Sheet con las hojas definidas
2. Crear proyecto Apps Script vinculado al Sheet
3. Configurar Properties del script con las API keys
4. Crear función `doGet()` y desplegar como Web App

### Fase 2: Conexiones de datos (Apps Script backend)
5. Script `metaAds.gs` — conexión Meta Ads, escritura a hoja `META_ADS`
6. Script `hubspot.gs` — conexión HubSpot, escritura a hojas `COSECHAS` y `F2_WORKFLOWS`
7. Script `bigquery.gs` — conexión BigQuery, escritura a hojas `CONVERSION` y `WELLI_POINTS`
8. Script `hilos.gs` — conexión Hilos (para WhatsApp data si se necesita en algún frente)
9. Script `triggers.gs` — configurar trigger diario de actualización
10. Script `main.gs` — función `getDashboardData()` que lee todas las hojas y retorna JSON filtrado

### Fase 3: Frontend
11. `dashboard.html` — estructura completa con sidebar, header, filtros, y los 6 frentes
12. `styles.html` — CSS con variables de marca WELLI, componentes (cards, charts, tables, badges)
13. `scripts.html` — JS para renderizar datos, filtros de fecha, navegación entre frentes, Chart.js
14. Componente de tarjetas KPI reutilizable
15. Componente de gráficas (configurables por tipo)
16. Componente de tablas (sortable, con badges de pendiente)

### Fase 4: Testing y pulido
17. Probar cada fuente de datos individualmente
18. Probar filtro de fechas con diferentes rangos
19. Verificar comparación vs período anterior
20. Verificar responsividad (móvil, tablet, desktop)
21. Marcar claramente todo lo que falta con badges

---

## Datos adicionales de referencia

### Query EXACTA de ingresos/revenue (proporcionada por el usuario)
```sql
WITH
  otp AS (
    SELECT
      application_id,
      MAX(validated_on) AS validated_on
    FROM `welli-tecnologia.public.otp_log`
    GROUP BY application_id
  )
SELECT
  pi.id,
  pi.referencia_pago,
  DATE(otp.validated_on) AS validated_on,
  pi.monto AS monto_credito
FROM `welli-tecnologia.public.profile_institucion` AS pi
LEFT JOIN otp
  ON otp.application_id = pi.id
WHERE
  pi.estado IN (
    'firma_contrato',
    'pendiente_validacion_cliente',
    'in_progress_validation_client',
    'pendiente_aprobacion_medico',
    'pendiente_desembolso',
    'pendiente_validacion',
    'approved',
    'on_hold_approved',
    'on_hold_rejected',
    'desembolsado')
  AND DATE(otp.validated_on) >= '2026-01-01'
```

**Lógica de ingresos:**
- **Revenue = créditos cuyo OTP fue validado** (tabla `otp_log`). La fecha de revenue es `validated_on` (cuando el paciente firmó el OTP), NO `fecha_solicitud_desembolso` ni `created_on`.
- **Monto:** campo `monto` de `profile_institucion` (monto del crédito), NO `monto_desembolso_medico`.
- **Tabla `otp_log`:** tiene `application_id` (= `profile_institucion.id`) y `validated_on`. Se toma el `MAX(validated_on)` por application para evitar duplicados.
- **Filtro de estados:** incluye estados activos/en proceso + desembolsado. El filtro real es que `validated_on` no sea NULL y sea >= 2026-01-01.
- **Uso en el dashboard:** Agrupar por `DATE(validated_on)` para revenue diario/semanal/mensual. Sumar `monto` para totales. Formatear en COP con separador de miles (ej. $81.325M).

### Cifras conocidas (2026, para validar que los datos que se extraen son correctos)
- **Meta Ads (Ene-Ago 2026):** 728 leads totales, CPL promedio ~$5.489, gasto mensual ~$184K–$660K COP
- **Ad account:** 2 grupos de anuncios principales (Público segmentado ~$2.89M, base_pacientes_cobranzas ~$1.11M)
- **Conversión (BigQuery):** 150.452 solicitudes → 46.159 aprobados (30.7%) → 19.663 convertidos (13.1%)
- **Desembolsado 2026:** $81.325.539.050 COP (17.622 créditos, ticket promedio $4.615.000)
- **Sedes totales en HubSpot:** 3.546
- **Sedes snapshot:** Farmer-Nuevos 1.429, Muertos 618, Autogestionados 554, Deshabilitados 343, CS 336, Cap.muertos 264
- **Rescate 2026:** 253 rescatados, $1.342.775.674 COP, 154 sedes

### Queries de conversión e ingresos
> El usuario proporcionará las queries exactas de BigQuery para conversión e ingresos. Usar las referencias de este prompt como guía y ajustar cuando lleguen las queries definitivas.

---

## Resumen de lo que está listo vs pendiente

| Elemento | Estado | Notas |
|----------|--------|-------|
| Meta Ads data | ✅ Listo para conectar | API configurada, ad account conocido |
| HubSpot Sedes | ✅ Listo para conectar | Propiedades mapeadas, objeto custom identificado |
| HubSpot Cosechas | ✅ Listo para conectar | `fecha_entrada_pipeline_actual` × `origen` × `clasificacion_aliado` |
| BigQuery Conversión | ✅ Query lista | `profile_institucion`, mapeo Rechazado/Aprobado/Convertido, embudo con flags |
| BigQuery Ingresos/Revenue | ✅ Query lista | `profile_institucion` JOIN `otp_log`, revenue por `validated_on`, monto = `monto` |
| BigQuery Welli Points | ⏳ Tabla por confirmar | Nombre exacto de tabla por confirmar |
| Hilos WhatsApp | ✅ Listo para conectar | API validada, broadcast endpoint funciona |
| F1 Meta tarjetas | ✅ Diseño definido | 5 KPIs con delta |
| F1 Cosechas tabla | ✅ Diseño definido | Por origen + calidad |
| F1 Conversión gráfica | ⏳ Depende de query BQ | Barras horizontales por origen |
| F2 Workflows | ⚠️ Recién activados | Verificar enrollment data después de unos días |
| F2 Atribución | ⚠️ Lógica por definir | Cruce comunicación → resultado es complejo |
| F4 Rescate | 🚧 Mockup | Frente no iniciado operativamente |
| F5 Welli Points | ⏳ Tabla BQ por confirmar | HubSpot tiene props complementarias |
| F6 Novedades | 🚧 Mockup | Sin fuente de datos definida |
| APIs desde cero | ⏳ Todo por configurar | Meta, HubSpot, BQ, Hilos — guía paso a paso necesaria |

---

**INSTRUCCIÓN FINAL:** Construye todo esto paso a paso, empezando por la infraestructura (Sheet + Apps Script), luego las conexiones de datos, y finalmente el frontend. En cada paso, muestra el código completo y explica qué hace. Si encuentras algo que no se puede hacer como está descrito, propón la alternativa y márcalo. Prioriza que el dashboard se vea profesional, esté bien diseñado con la marca WELLI, y que lo que no tenga datos reales esté claramente señalizado — nunca inventar cifras.
