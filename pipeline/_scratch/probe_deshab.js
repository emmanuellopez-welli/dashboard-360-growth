// Verifica en el DOM real que la cinta declara el recorte y que los mapas
// de cohortes traen los denominadores ya recortados.
const out = [];
try {
  const c = document.querySelector('.cinta-origen');
  out.push('cinta: ' + (c ? c.textContent.trim() : 'NO EXISTE'));
  const nota = document.querySelector('.cinta-nota');
  out.push('nota deshab: ' + (nota ? nota.textContent.trim() : 'NO EXISTE'));
} catch (e) { out.push('ERR ' + e.message); }
document.title = 'PROBE::' + out.join(' | ');
