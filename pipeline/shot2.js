const { execFileSync } = require('child_process');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const D = 'C:/Users/millo/Desktop/Dashboard 360 mkt/pipeline/';
const URL = 'file:///' + D + 'Dashboard_360_WELLI_previa.html#f4';
execFileSync(CHROME, ['--headless=new', '--disable-gpu',
  '--host-resolver-rules=MAP fonts.googleapis.com 0.0.0.0',
  '--virtual-time-budget=25000', '--window-size=1500,2500',
  '--screenshot=' + D + process.argv[2], URL], { maxBuffer: 1 << 28 });
