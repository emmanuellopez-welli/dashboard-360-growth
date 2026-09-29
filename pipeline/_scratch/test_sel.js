var LOG=[];
function log(m){LOG.push(m);var d=document.getElementById('__t');if(!d){d=document.createElement('pre');d.id='__t';document.body.appendChild(d);}d.textContent=LOG.join('\n');}
setTimeout(function(){
  try{
    var sm=document.getElementById('selMes'), ss=document.getElementById('selSemana');
    log('meses en el selector: '+sm.options.length+'  -> '+Array.from(sm.options).map(function(o){return o.value;}).join(' '));
    log('seleccionado: '+sm.value+'   rango: '+document.getElementById('fDesde').value+' a '+document.getElementById('fHasta').value);
    log('semanas: '+Array.from(ss.options).map(function(o){return o.text;}).join(' | '));
    // elige agosto
    sm.value='2026-08'; sm.dispatchEvent(new Event('change'));
    setTimeout(function(){
      log('');
      log('--- tras elegir agosto ---');
      log('rango: '+document.getElementById('fDesde').value+' a '+document.getElementById('fHasta').value);
      log('semanas de agosto: '+Array.from(ss.options).map(function(o){return o.text+'['+o.value+']';}).join(' | '));
      // elige la semana 3
      ss.selectedIndex=3; ss.dispatchEvent(new Event('change'));
      setTimeout(function(){
        log('');
        log('--- tras elegir '+ss.options[3].text+' ---');
        log('rango: '+document.getElementById('fDesde').value+' a '+document.getElementById('fHasta').value);
        log('F1 sedes nuevas: '+(D.f1.shareKpi?D.f1.shareKpi.valor:'-')+'  seccion5 sol: '+D.f1.embudo.kpis[0].valor);
        log('comparativo del motor: '+D.meta.prevInicio+' a '+D.meta.prevFin);
        // vuelve a mes completo
        ss.value=''; ss.dispatchEvent(new Event('change'));
        setTimeout(function(){
          log('');
          log('--- de vuelta a todo el mes ---');
          log('rango: '+document.getElementById('fDesde').value+' a '+document.getElementById('fHasta').value);
          log('F1 sedes nuevas: '+(D.f1.shareKpi?D.f1.shareKpi.valor:'-')+'  seccion5 sol: '+D.f1.embudo.kpis[0].valor);
        },2200);
      },2200);
    },2200);
  }catch(e){log('EXCEPCION: '+e.message+' | '+e.stack);}
},3000);
