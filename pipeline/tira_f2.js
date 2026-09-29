/* Renderiza la previa en Chrome headless y saca el DOM del frente 4, para
   revisar la vista sin abrir el navegador a mano. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///C:/Users/millo/Desktop/Dashboard 360 mkt/pipeline/Dashboard_360_WELLI_previa.html#f2';
const out = execFileSync(CHROME, ['--headless=new', '--disable-gpu',
  '--host-resolver-rules=MAP fonts.googleapis.com 0.0.0.0',
  '--virtual-time-budget=25000', '--dump-dom', URL],
  { maxBuffer: 1 << 28, encoding: 'utf8' });
fs.writeFileSync('f4/dom2.html', out, 'utf8');
console.log('DOM ' + Math.round(out.length / 1024) + ' KB');
const m = out.match(/<main[\s\S]*?<\/main>/);
const cuerpo = m ? m[0] : out;
// texto plano, para leer la vista como la lee una persona
let t = cuerpo
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<h2 class="sec"[^>]*>/g, '\n\n### ')
  .replace(/<h3[^>]*>/g, '\n  · ')
  .replace(/<\/(h1|h2|h3|p|div|tr|li)>/g, '\n')
  .replace(/<t[dh][^>]*>/g, ' | ')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&[a-z]+;/g, '')
  .split('\n').map(x => x.trim()).filter(x => x).join('\n');
fs.writeFileSync('f4/texto2.txt', t, 'utf8');
console.log(t.length + ' chars de texto');
