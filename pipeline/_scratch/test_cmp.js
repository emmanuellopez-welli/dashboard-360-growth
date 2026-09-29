var LOG=[];
function log(m){LOG.push(m);var d=document.getElementById('__t');if(!d){d=document.createElement('pre');d.id='__t';document.body.appendChild(d);}d.textContent=LOG.join('\n');}
function foto(t){
  log(t);
  var ch=document.querySelectorAll('.cmp-chip');
  log('   chips: '+Array.from(ch).map(function(c){return (c.classList.contains('on')?'['+c.textContent.trim()+']':c.textContent.trim());}).join(' | '));
  var tb=document.querySelectorAll('#vistas table.t');
  log('   tablas: '+tb.length+'   filas 1a tabla: '+(tb[0]?tb[0].querySelectorAll('tbody tr').length:'?'));
  log('   filas promedio: '+document.querySelectorAll('#vistas tr.fila-prom').length+
      '   filas grupo B: '+document.querySelectorAll('#vistas tr.cmp-b').length);
  log('   leyenda: '+((document.querySelector('.cmp-leyenda')||{textContent:'(sin comparar)'}).textContent.trim()));
}
setTimeout(function(){
  irA('f2');
  setTimeout(function(){
    foto('--- sin comparar ---');
    var c=Array.from(document.querySelectorAll('.cmp-chip')).filter(function(x){return x.textContent.indexOf('Equipo comercial')===0;})[0];
    if(!c){log('!! no hay chip de comercial');return;}
    c.click();
    setTimeout(function(){ foto('--- comparando contra Equipo comercial ---'); },2600);
  },2600);
},3200);
