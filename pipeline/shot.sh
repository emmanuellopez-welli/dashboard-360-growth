#!/bin/bash
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
B='C:/Users/millo/Desktop/Dashboard 360 mkt/pipeline'
V="$1"; H="${2:-2600}"
"$CH" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --host-resolver-rules="MAP fonts.googleapis.com 0.0.0.0, MAP fonts.gstatic.com 0.0.0.0" \
  --window-size=1500,"$H" --virtual-time-budget=8000 \
  --screenshot="$B/caps/$V.png" "file:///$B/Dashboard_360_WELLI_previa.html#$V" 2>&1 \
  | grep -Ei 'bytes' | head -1
