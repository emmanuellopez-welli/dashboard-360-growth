const A = require('./map_crm.json').f2, B = require('./map_vinc.json').f2;
const pad=(s,n)=>String(s).padEnd(n), rp=(s,n)=>String(s).padStart(n);
// Mapas de TASA: la celda se lee como % de la cosecha -> comparar en puntos.
// Mapas de VOLUMEN (desembolsos, plata): comparar en % relativo.
const TASA = new Set(['activas','exitosas','inactivas','muertas','traspaso']);
console.log('DISCREPANCIA ENTRE LOS DOS RELOJES, por mapa\n');
console.log(pad('#',3)+pad('mapa',38)+pad('se lee como',13)+rp('promedio',11)+rp('maximo',10)+rp('donde',12));
const out=[];
A.mapas.forEach(ma=>{
  const mb=B.mapas.find(x=>x.id===ma.id); if(!mb) return;
  const ia={},ib={};
  (ma.filas||[]).forEach(r=>ia[r.cosecha]=r);
  (mb.filas||[]).forEach(r=>ib[r.cosecha]=r);
  const esTasa=TASA.has(ma.id);
  let n=0,suma=0,mx=0,donde='';
  Object.keys(ia).forEach(c=>{
    const ra=ia[c],rb=ib[c]; if(!rb) return;
    const na=ra.celdas||[],nb=rb.celdas||[];
    for(let k=0;k<Math.max(na.length,nb.length);k++){
      const va=na[k],vb=nb[k];
      if(va==null||vb==null) continue;
      let dif;
      if(esTasa){
        dif=Math.abs((ra.n?va/ra.n*100:0)-(rb.n?vb/rb.n*100:0));
      } else {
        if(!va) continue;
        dif=Math.abs((vb-va)/va*100);
      }
      n++;suma+=dif;
      if(dif>mx){mx=dif;donde=c+' M'+k;}
    }
  });
  out.push({o:ma.orden,t:ma.titulo,esTasa,prom:n?suma/n:0,mx,donde});
});
out.sort((a,b)=>b.prom-a.prom).forEach(r=>{
  const u=r.esTasa?' pp':'%';
  console.log(pad(r.o,3)+pad(r.t.slice(0,37),38)+pad(r.esTasa?'% de cosecha':'volumen',13)+
    rp(r.prom.toFixed(1)+u,11)+rp(r.mx.toFixed(0)+u,10)+rp(r.donde,12));
});
console.log('\nLectura: los mapas de TASA casi no se mueven (<=2,3 pp).');
console.log('Los de VOLUMEN si, porque enero pierde 69 sedes del denominador');
console.log('pero conserva casi toda su actividad -> sube el por-sede.');
