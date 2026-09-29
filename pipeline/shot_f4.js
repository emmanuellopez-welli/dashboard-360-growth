const { execFileSync } = require('child_process');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///C:/Users/millo/Desktop/Dashboard 360 mkt/pipeline/Dashboard_360_WELLI_previa.html#f4';
execFileSync(CHROME, ['--headless=new', '--disable-gpu',
  '--host-resolver-rules=MAP fonts.googleapis.com 0.0.0.0',
  '--virtual-time-budget=25000',
  '--window-size=1500,' + (process.argv[3] || 4200),
  '--screenshot=' + (process.argv[2] || 'f4/f4.png'), URL],
  { maxBuffer: 1 << 28 });
console.log('ok ' + (process.argv[2] || 'f4/f4.png'));
