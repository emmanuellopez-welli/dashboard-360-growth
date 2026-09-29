var LOG=[];
function log(m){LOG.push(m);var d=document.getElementById('__t');if(!d){d=document.createElement('pre');d.id='__t';document.body.appendChild(d);}d.textContent=LOG.join('\n');}
function sel(rol){return Array.from(document.querySelectorAll('#filtrosOwner select'))
  .filter(function(s){return s.getAttribute('data-rol')===rol;})[0];}
function elige(rol,txt){
  try{
    var s=sel(rol); if(!s){log('  !! no hay select de '+rol);return;}
    var o=Array.from(s.options).filter(function(o){return o.text.indexOf(txt)===0;})[0];
    if(!o){log('  !! no hay "'+txt+'" en '+rol);return;}
    s.value=o.value; s.dispatchEvent(new Event('change'));
  }catch(e){log('  !! EXC: '+e.message);}
}
function foto(t){
  try{
    log(t);
    log('   cinta: '+(document.querySelector('.cinta-origen')||{textContent:'?'}).textContent.trim());
    log('   sedes='+D.meta.origenSedes+'  F1sol='+D.f1.embudo.kpis[0].valor+
        '  F4apr='+D.f4.oportunidad.filas.reduce(function(s,r){return s+r.apr;},0)+
        '  F5jun='+((D.f5.serie[0]||{}).sedes||0)+'  F7='+D.f7.poblacion);
  }catch(e){log('  !! EXC foto: '+e.message);}
}
var PASOS=[
  function(){ elige('hunter','Johanna'); },
  function(){ foto('--- hunter = Johanna Vasquez ---'); elige('farmer','Viviana'); },
  function(){ foto('--- + farmer = Viviana Zuluaga ---'); elige('cs','Lina'); },
  function(){ foto('--- + CS = Lina Camacho ---'); elige('hunter','— sin filtrar —'); },
  function(){ foto('--- solo farmer Viviana + CS Lina ---'); },
];
var i=0;
function sig(){
  if(i>=PASOS.length){log('FIN');return;}
  try{ PASOS[i++](); }catch(e){ log('  !! EXC paso '+i+': '+e.message); }
  setTimeout(sig,3000);
}
setTimeout(function(){
  var ss=document.querySelectorAll('#filtrosOwner select');
  log('selectores: '+ss.length+' -> '+Array.from(ss).map(function(s){
    return s.getAttribute('data-rol')+'('+(s.options.length-1)+')';}).join(' '));
  foto('--- sin filtros ---'); sig();
},3500);
