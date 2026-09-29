var LOG=[];
function log(m){LOG.push(m);var d=document.getElementById('__t');if(!d){d=document.createElement('pre');d.id='__t';document.body.appendChild(d);}d.textContent=LOG.join('\n');}
function sel(eq){return Array.from(document.querySelectorAll('#filtrosOwner select'))
  .filter(function(s){return s.getAttribute('data-equipo')===eq;})[0];}
function elige(eq,txt){
  try{
    var s=sel(eq); if(!s){log('  !! no hay select de '+eq);return;}
    var o=Array.from(s.options).filter(function(o){return o.text.indexOf(txt)===0;})[0];
    if(!o){log('  !! no hay opcion "'+txt+'" en '+eq);return;}
    s.value=o.value; s.dispatchEvent(new Event('change'));
  }catch(e){log('  !! EXC en elige('+eq+','+txt+'): '+e.message);}
}
function foto(t){
  try{
    log(t);
    log('   cinta: '+(document.querySelector('.cinta-origen')||{textContent:'?'}).textContent.trim());
    log('   sedes='+D.meta.origenSedes+'  F1sol='+D.f1.embudo.kpis[0].valor+
        '  deals='+D.f1.dealsCohorte.filas.reduce(function(s,r){return s+r.n;},0)+
        '  F4apr='+D.f4.oportunidad.filas.reduce(function(s,r){return s+r.apr;},0)+
        '  F5jun='+((D.f5.serie[0]||{}).sedes||0)+'  F7='+D.f7.poblacion);
  }catch(e){log('  !! EXC en foto: '+e.message);}
}
var PASOS=[
  function(){ elige('Farmer','Viviana'); },
  function(){ foto('--- Viviana Zuluaga (Farmer) ---'); elige('Hunter','Johanna'); },
  function(){ foto('--- Viviana + Johanna ---'); elige('Farmer','— sin filtrar —'); },
  function(){ foto('--- solo Johanna (Hunter) ---'); elige('Customer Success','Mariana'); },
  function(){ foto('--- Johanna + Mariana ---'); },
];
var i=0;
function siguiente(){
  if(i>=PASOS.length){log('FIN');return;}
  try{ PASOS[i++](); }catch(e){ log('  !! EXC paso '+i+': '+e.message); }
  setTimeout(siguiente,2600);
}
setTimeout(function(){ foto('--- sin filtros ---'); siguiente(); },3200);
