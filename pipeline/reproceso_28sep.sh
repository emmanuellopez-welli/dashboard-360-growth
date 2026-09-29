#!/bin/bash
set -e
cd "C:\Users\millo\Desktop\Dashboard 360 mkt\pipeline"

marca() { echo; echo "===== $(date '+%H:%M:%S') $1 ====="; }

marca "FASE 0: SEDES (primero, todo lo demas cruza contra esto)"
python pull_sedes.py
python sube_sedes.py

marca "FASE 1: pulls que cruzan por id_internal contra SEDES local"
python pull_lt.py
python sube_lt.py
python pull_rescate.py
python sube_rescate.py
python pull_roles.py
python sube_rl.py
python repull_id_sede.py
python sube_generico.py tables_id_sede.json

marca "FASE 2: pulls independientes"
python pull_deals.py
python sube_dl.py
python pull_estado_mes.py
python sube_em.py
python pull_activacion.py
python sube_act.py
python pull_desembolso_rescate.py
python sube_desembolso_rescate.py
python pull_wa_pacientes.py
python sube_generico.py tables_wa_pacientes.json
python pull_aprob_msj.py
python sube_aprob_msj.py
python pull_plataforma_nombre.py
python sube_plataforma_nombre.py
python meta_pull.py
python sube_meta.py
python wp_pull2.py
python sube_generico.py tables_wp2.json
python pull_segundos.py
python sube_generico.py tables_segundos.json

marca "FASE 3: CREDITO_DIA (siempre pasa por comprime_cdia.py, nunca crudo)"
python pull_credito_dia.py
python comprime_cdia.py
python sube_cdia.py

marca "FASE 4: Welli Points"
python pull_wp_adopcion.py
python sube_generico.py tables_wp_adopcion.json
python pull_wp_adopcion2.py
python sube_generico.py tables_wp_login_sedes.json
python pull_wp_habilitadas.py
python sube_generico.py tables_wp_habilitadas.json
python pull_wp_login_dia.py
python sube_generico.py tables_wp_login_dia.json
python pull_wp_pts_mes.py
python sube_generico.py tables_wp_pts_mes.json
python pull_wp_resumen.py
python sube_generico.py tables_wp_resumen.json

marca "FASE 5: actualizar CONFIG.ultima_actualizacion"
python actualiza_config_fecha.py

marca "REPROCESO DE DATOS TERMINADO"
