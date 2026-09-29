var LOG=[];
function log(m){LOG.push(m);var d=document.getElementById('__t');if(!d){d=document.createElement('pre');d.id='__t';document.body.appendChild(d);}d.textContent=LOG.join('\n');}
function marcas(){return document.querySelectorAll('#gF7Serie svg line[stroke-width="1.5"]').length;}
setTimeout(function(){
  try{
    document.getElementById('fDesde').value='2026-08-04';
    document.getElementById('fHasta').value='2026-09-02';
    irA('f7'); cargar();
    setTimeout(function(){
      log('chips: '+document.querySelectorAll('.imp-chip').length+'  grupos: '+document.querySelectorAll('.imp-grupo').length+'  encendidos: '+document.querySelectorAll('.imp-chip.on').length);
      log('marcas: '+marcas()+'  rotulos: '+document.querySelectorAll('#gF7Serie svg text[font-weight="700"]').length);
      // baja la pagina y hace clic: la posicion NO debe cambiar
      window.scrollTo(0, 900);
      setTimeout(function(){
        var antes=window.scrollY;
        document.querySelectorAll('.imp-chip')[0].click();
        setTimeout(function(){
          log('scroll antes='+antes+'  despues='+window.scrollY+'  -> '+(Math.abs(window.scrollY-antes)<5?'NO SALTA':'SALTA'));
          log('tras apagar: encendidos='+document.querySelectorAll('.imp-chip.on').length+'  marcas='+marcas());
          document.querySelectorAll('.imp-wf')[1].click();
          setTimeout(function(){
            log('solo un workflow: encendidos='+document.querySelectorAll('.imp-chip.on').length+'  marcas='+marcas()+'  scroll='+window.scrollY);
            var cols=new Set();
            document.querySelectorAll('#gF7Serie svg line[stroke-width="1.5"]').forEach(function(l){cols.add(l.getAttribute('stroke'));});
            log('colores distintos en las marcas: '+cols.size+' -> '+Array.from(cols).join(', '));
          },700);
        },700);
      },400);
    },2600);
  }catch(e){log('EXCEPCION: '+e.message);}
},2000);
