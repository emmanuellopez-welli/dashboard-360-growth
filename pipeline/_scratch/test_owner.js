var LOG=[];
function log(m){LOG.push(m);var d=document.getElementById('__t');if(!d){d=document.createElement('pre');d.id='__t';document.body.appendChild(d);}d.textContent=LOG.join('\n');}
function foto(t){
  log(t);
  log('   cinta: '+(document.querySelector('.cinta-origen')||{textContent:'?'}).textContent.trim());
  log('   meta: sedes='+D.meta.origenSedes+'  equipo='+D.meta.equipoEtiqueta+'  origen='+D.meta.origenEtiqueta);
  log('   F1 sol='+D.f1.embudo.kpis[0].valor+'  deals='+D.f1.dealsCohorte.filas.reduce(function(s,r){return s+r.n;},0)+'  F2 cosech='+D.f2.cosechas+'  F7 pob='+D.f7.poblacion);
}
setTimeout(function(){
  try{
    var so=document.getElementById('selOwner');
    log('opciones de equipo: '+Array.from(so.options).map(function(o){return o.text;}).join(' | '));
    foto('--- sin filtros ---');
    so.value='Hunter'; so.dispatchEvent(new Event('change'));
    setTimeout(function(){
      foto('--- equipo Hunter ---');
      // ahora combina con origen
      document.getElementById('btnOrigen').click();
      setTimeout(function(){
        document.querySelectorAll('#poLista input[type=checkbox]').forEach(function(c){c.checked=(c.value==='PAGINA WEB');});
        document.getElementById('poListo').click();
        setTimeout(function(){
          foto('--- Hunter + Pagina web ---');
          so.value=''; so.dispatchEvent(new Event('change'));
          setTimeout(function(){ foto('--- solo Pagina web ---'); },2400);
        },2400);
      },700);
    },2400);
  }catch(e){log('EXCEPCION: '+e.message);}
},3000);
