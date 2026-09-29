setTimeout(function(){
  irA('f2');
  setTimeout(function(){
    var c=Array.from(document.querySelectorAll('.cmp-chip')).filter(function(x){return x.textContent.indexOf('Equipo comercial')===0;})[0];
    if(c) c.click();
  },2600);
},3200);
