#!/bin/bash
# =====================================================================
# Reproceso diario del Tablero 360 WELLI — 7:00 AM (29-sep-2026)
# =====================================================================
# Lo corre el Programador de tareas de Windows (tarea "Welli_Reproceso_7am").
# NO lo corras a mano en paralelo con una sesion de Claude que este subiendo
# hojas: los dos escriben sheet_data.json y se pisan (ver seccion 40 de
# CLAUDE.md, donde una escritura a medias corrompio el archivo).
#
# Que hace y que NO hace:
#   SI  refresca las ~35 hojas del Google Sheet (la fuente que lee el /exec
#       de Apps Script en vivo) y reconstruye artifact_tablero.html local.
#   NO  publica el artefacto de claude.ai — eso necesita la herramienta
#       Artifact, o sea una sesion de Claude. El HTML queda listo en el
#       scratchpad para publicarlo en un paso.
#
# Si falla, deja el motivo en reproceso_estado.txt y el detalle en el log
# del dia. La causa mas probable es el token de BigQuery de Composio, que
# se vence solo cada pocos dias y pide reautorizacion por navegador
# (secciones 9 y 38) — un job desatendido no puede resolver eso.

# El Programador de tareas invoca bash.exe DIRECTO, sin pasar por el lanzador
# de Git Bash, asi que el proceso arranca sin el PATH de MSYS: no encuentra
# ni `mkdir` ni `date` ni `tee`, y el script muere antes de escribir la
# primera linea del log. Tampoco hereda el PATH de usuario, asi que python y
# node tambien hay que declararlos. Todo explicito a proposito.
export PATH="/usr/bin:/bin:/mingw64/bin:/c/Users/millo/AppData/Local/Programs/Python/Python312:/c/Users/millo/AppData/Local/Programs/Python/Python312/Scripts:/c/Program Files/nodejs:$PATH"

cd "C:/Users/millo/Desktop/Dashboard 360 mkt/pipeline" || exit 1

LOGDIR="logs_reproceso"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/$(date '+%Y-%m-%d').log"
ESTADO="reproceso_estado.txt"
FALLOS=0
FALLIDOS=""

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

# Corre un paso y NO aborta todo si falla: un pull caido no debe impedir
# que los otros 18 se refresquen. Se acumula la lista de fallidos.
paso() {
  local nombre="$1"; shift
  log "-> $nombre"
  if "$@" >> "$LOG" 2>&1; then
    log "   ok"
  else
    log "   FALLO: $nombre"
    FALLOS=$((FALLOS + 1))
    FALLIDOS="$FALLIDOS $nombre"
  fi
}

echo "=====================================================" >> "$LOG"
log "REPROCESO DIARIO — inicio"

# --- Chequeo previo del token: si BigQuery no responde, todo lo demas
# --- va a fallar en cascada y el log queda ilegible. Mejor cortar aca.
log "verificando acceso a BigQuery..."
if ! python -c "import lib; lib.bq('SELECT 1 AS ok', project='welli-data')" >> "$LOG" 2>&1; then
  log "ABORTADO: BigQuery no responde (token vencido o sin red)."
  log "Hay que reautorizar Composio a mano desde una sesion de Claude."
  echo "FALLO $(date '+%Y-%m-%d %H:%M') · token de BigQuery vencido, hay que reautorizar" > "$ESTADO"
  exit 1
fi
log "BigQuery ok"

# --- FASE 0: SEDES primero. Los cuatro pulls de la fase 1 cruzan por
# --- id_internal contra sheet_data.json, asi que con SEDES vieja cruzarian
# --- contra sedes de hace dias (seccion 34).
log "FASE 0 · SEDES"
paso "pull_sedes"  python pull_sedes.py
paso "sube_sedes"  python sube_sedes.py
if [ $FALLOS -gt 0 ]; then
  log "ABORTADO: fallo SEDES, el resto cruzaria contra datos viejos."
  echo "FALLO $(date '+%Y-%m-%d %H:%M') · fallo en SEDES, reproceso abortado" > "$ESTADO"
  exit 1
fi

log "FASE 1 · pulls que cruzan por id_internal"
paso "pull_lt"          python pull_lt.py
paso "sube_lt"          python sube_lt.py
paso "pull_rescate"     python pull_rescate.py
paso "sube_rescate"     python sube_rescate.py
paso "pull_roles"       python pull_roles.py
paso "sube_rl"          python sube_rl.py
paso "repull_id_sede"   python repull_id_sede.py
paso "sube_id_sede"     python sube_generico.py tables_id_sede.json

log "FASE 2 · pulls independientes"
paso "pull_deals"        python pull_deals.py
paso "sube_dl"           python sube_dl.py
paso "pull_estado_mes"   python pull_estado_mes.py
paso "sube_em"           python sube_em.py
paso "pull_activacion"   python pull_activacion.py
paso "sube_act"          python sube_act.py
paso "pull_desem_resc"   python pull_desembolso_rescate.py
paso "sube_desem_resc"   python sube_desembolso_rescate.py
paso "pull_wa_pacientes" python pull_wa_pacientes.py
paso "sube_wa_pacientes" python sube_generico.py tables_wa_pacientes.json
paso "pull_aprob_msj"    python pull_aprob_msj.py
paso "sube_aprob_msj"    python sube_aprob_msj.py
paso "pull_plataforma"   python pull_plataforma_nombre.py
paso "sube_plataforma"   python sube_plataforma_nombre.py
paso "meta_pull"         python meta_pull.py
paso "sube_meta"         python sube_meta.py
paso "wp_pull2"          python wp_pull2.py
paso "sube_wp2"          python sube_generico.py tables_wp2.json
paso "pull_segundos"     python pull_segundos.py
paso "sube_segundos"     python sube_generico.py tables_segundos.json

# --- FASE 3: CREDITO_DIA SIEMPRE pasa por comprime_cdia.py antes de subir
# --- (regla 12). Subir el crudo rompe hechos_() en produccion.
log "FASE 3 · CREDITO_DIA (comprimido, nunca crudo)"
paso "pull_credito_dia" python pull_credito_dia.py
paso "comprime_cdia"    python comprime_cdia.py
paso "sube_cdia"        python sube_cdia.py

log "FASE 4 · Welli Points"
paso "wp_adopcion"    python pull_wp_adopcion.py
paso "sube_adopcion"  python sube_generico.py tables_wp_adopcion.json
paso "wp_adopcion2"   python pull_wp_adopcion2.py
paso "sube_login_sed" python sube_generico.py tables_wp_login_sedes.json
paso "wp_habilitadas" python pull_wp_habilitadas.py
paso "sube_habilit"   python sube_generico.py tables_wp_habilitadas.json
paso "wp_login_dia"   python pull_wp_login_dia.py
paso "sube_login_dia" python sube_generico.py tables_wp_login_dia.json
paso "wp_pts_mes"     python pull_wp_pts_mes.py
paso "sube_pts_mes"   python sube_generico.py tables_wp_pts_mes.json
paso "wp_resumen"     python pull_wp_resumen.py
paso "sube_resumen"   python sube_generico.py tables_wp_resumen.json

# --- FASE 5: la etiqueta "Datos actualizados" del header no se mueve sola
# --- con refrescar tablas (regla 23).
log "FASE 5 · CONFIG.ultima_actualizacion"
paso "config_fecha" python actualiza_config_fecha.py

# --- FASE 6: reconstruir el artefacto y DEJARLO VERIFICADO. El publish en
# --- si necesita la herramienta Artifact (una sesion de Claude), pero si el
# --- QA ya corrio aca, en la mañana publicar es un solo paso y se sabe de
# --- antemano si el tablero quedo sano o no. Las tres pruebas de la regla 1,
# --- en el mismo orden.
log "FASE 6 · reconstruir y verificar el artefacto"
paso "build_previa" node build_previa.js

QA_FALLOS="?"
log "-> qa_tablero"
if node qa_tablero.js >> "$LOG" 2>&1; then
  QA_FALLOS=$(grep -oE "FALLOS: [0-9]+" "$LOG" | tail -1 | grep -oE "[0-9]+")
  log "   qa_tablero ok (fallos: ${QA_FALLOS:-0})"
else
  QA_FALLOS=$(grep -oE "FALLOS: [0-9]+" "$LOG" | tail -1 | grep -oE "[0-9]+")
  log "   qa_tablero con fallos: ${QA_FALLOS:-?}"
  FALLOS=$((FALLOS + 1)); FALLIDOS="$FALLIDOS qa_tablero"
fi

paso "jsdom_stress" node jsdom_stress.js

# Chequeo barato que habria atrapado el tablero roto del 28-sep (regla 50):
# que la pagina de verdad CARGUE. Las tres pruebas pueden dar 0 fallos con
# el artefacto sin cargar ninguna pestaña.
log "-> carga real de la pagina"
if node dbg.js 2>&1 | grep -q "D despues: object"; then
  log "   la pagina carga ok"
  CARGA="ok"
else
  log "   LA PAGINA NO CARGA — no publicar"
  CARGA="ROTA"
  FALLOS=$((FALLOS + 1)); FALLIDOS="$FALLIDOS carga_pagina"
fi

if [ $FALLOS -eq 0 ] && [ "$CARGA" = "ok" ]; then
  log "TERMINADO sin fallos — listo para publicar"
  echo "LISTO PARA PUBLICAR $(date '+%Y-%m-%d %H:%M') · datos frescos, QA 0 fallos, pagina carga. Falta el paso manual: publicar el artefacto desde una sesion de Claude." > "$ESTADO"
else
  log "TERMINADO con $FALLOS fallo(s):$FALLIDOS"
  echo "NO PUBLICAR $(date '+%Y-%m-%d %H:%M') · $FALLOS fallo(s):$FALLIDOS" > "$ESTADO"
fi

# Dejar solo los ultimos 14 logs, para que la carpeta no crezca sin fin.
ls -1t "$LOGDIR"/*.log 2>/dev/null | tail -n +15 | xargs -r rm -f
exit $FALLOS
