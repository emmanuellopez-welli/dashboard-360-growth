var LOG=[];
function log(m){LOG.push(m);var d=document.getElementById('__t');if(!d){d=document.createElement('pre');d.id='__t';document.body.appendChild(d);}d.textContent=LOG.join('\n');}
function sels(){return document.querySelectorAll('#filtrosOwner select');}
function sel(eq){return Array.from(sels()).filter(function(s){return s.getAttribute('data-equipo')===eq;})[0];}
function elige(eq,txt){var s=sel(eq);var o=Array.from(s.options).filter(function(o){return o.text.indexOf(txt)===0;})[0];s.value=o?o.value:'';s.dispatchEvent(new Event('change'));}
function foto(t){
  log(t);
  log('   cinta: '+(document.querySelector('.cinta-origen')||{textContent:'?'}).textContent.trim());
  log('   sedes='+D.meta.origenSedes+'  F1sol='+D.f1.embudo.kpis[0].valor+'  deals='+D.f1.dealsCohorte.filas.reduce(function(s,r){return s+r.n;},0)+'  F7='+D.f7.poblacion);
  log('   selects: '+Array.from(sels()).map(function(s){return s.getAttribute('data-equipo')+'='+(s.options[s.selectedIndex]||{text:'?'}).text;}).join(' | '));
}
setTimeout(function(){
  try{
    log('selectores: '+sels().length+'  -> '+Array.from(sels()).map(function(s){return s.getAttribute('data-equipo')+'('+(s.options.length-2)+' personas)';}).join(' '));
    foto('--- sin filtros ---');
    elige('Farmer','Todo Farmer');
    setTimeout(function(){
      foto('--- Todo Farmer ---');
      // una persona concreta
      var vz=Array.from(f.options).filter(function(o){return o.text.indexOf('Viviana')===0;})[0];
      f.value=vz.value; f.dispatchEvent(new Event('change'));
      setTimeout(function(){
        foto('--- Viviana Zuluaga ---');
        // suma con un hunter
        elige('Hunter','Johanna');
        setTimeout(function(){
          foto('--- Viviana + Johanna ---');
          elige('Farmer','— sin filtrar —');
          setTimeout(function(){ foto('--- solo Johanna ---'); },2400);
        },2400);
      },2400);
    },2400);
  }catch(e){log('EXCEPCION: '+e.message);}
},3200);
