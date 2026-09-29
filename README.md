# Tablero 360 Growth — WELLI

Tablero de Growth de Welli. El motor es un Google Apps Script que lee un
Google Sheet; las tablas de ese Sheet las llena un pipeline de Python que
consulta BigQuery, HubSpot y Meta Ads.

> **Antes de tocar nada, lee [`CLAUDE.md`](CLAUDE.md).** Son 51 secciones de
> errores ya cometidos y corregidos en este proyecto, con sus fechas y sus
> números. No son hipótesis: cada una costó QA roto o una presentación en
> vivo. La sección 1 (nunca publicar sin correr las tres pruebas) y la 11
> (`dismissed` nunca cuenta como desembolso) son las que más caro salen si
> se ignoran.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `apps_script/` | El tablero en sí: `Code.gs` (motor y cálculos), `Filtro_Origen.gs` (filtros globales), `scripts.html` (frontend), `styles.html`, `dashboard.html`. Es lo que vive en Apps Script. |
| `pipeline/` | El pipeline de datos: ~35 `pull_*.py` que consultan las fuentes, los `sube_*.py` que escriben al Sheet, y el toolkit de QA (`qa_tablero.js`, `build_previa.js`, `jsdom_*.js`). |
| `pipeline/_scratch/` | Scripts de exploración de una sola vez. No son parte del pipeline; se guardan porque documentan cómo se investigó algo. |
| `CLAUDE.md` | El histórico de decisiones y errores. Lo más valioso del repo. |
| `apps_script/GUIA_DESPLIEGUE.md` | Cómo desplegar el Apps Script. |

## Lo que NO está en el repo (y hay que conseguir aparte)

- **`.env`** — credenciales (Composio, HubSpot, Meta, Hilos, ActiveCampaign).
  Pídeselo a Emmanuel. Formato:
  ```
  COMPOSIO_API_KEY=...
  HUBSPOT_PRIVATE_TOKEN=pat-na1-...
  META_ACCESS_TOKEN=...
  HILOS_API_KEY=...
  ACTIVECAMPAIGN_API_URL=https://welli.api-us1.com
  ACTIVECAMPAIGN_API_KEY=...
  ```
- **`.mcp.json`** — lleva la `x-consumer-api-key` de Composio, por eso no se
  versiona.
- **`pipeline/sheet_data.json`** — snapshot local del Sheet (22 MB). Se
  regenera corriendo los pulls, o se baja del Sheet.
- **`pipeline/node_modules/`** — `npm install` dentro de `pipeline/`.

## Reproceso diario

`pipeline/reproceso_diario.sh` refresca las ~35 hojas del Sheet, reconstruye
el artefacto y corre el QA. Lo dispara la tarea de Windows
`Welli_Reproceso_7am` todos los días a las 7:00.

**Dos límites conocidos** (detalle en la sección 51 de `CLAUDE.md`):

1. El token de BigQuery de Composio **se vence en menos de un día y no se
   renueva solo** — pide reautorización por navegador. Hasta que exista un
   *service account* de GCP, el job va a fallar la mayoría de los días
   dejando el motivo en `pipeline/reproceso_estado.txt`.
2. **Publicar el artefacto de claude.ai requiere una sesión de Claude.** El
   job deja el HTML reconstruido y verificado, pero el `publish` es manual.

## Las tres pruebas, obligatorias antes de publicar

Desde `pipeline/`:

```bash
node qa_tablero.js      # motor real sobre data completa, matriz fecha x origen x rol
node build_previa.js    # reconstruye artifact_tablero.html desde los .gs/.html
node jsdom_stress.js    # renderiza las pestañas de verdad en un DOM
node dbg.js             # que la pagina CARGUE (regla 50: las tres de arriba
                        # pueden dar 0 fallos con el tablero roto)
```

Cero fallos en las cuatro, o no se publica.
