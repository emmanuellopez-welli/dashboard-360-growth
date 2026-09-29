setTimeout(function () {
  document.documentElement.setAttribute('data-tema', 'oscuro');
  setTimeout(function () {
    var d = document.createElement('pre'); d.id = '__t';
    var muestras = [];
    ['riesgo', 'muerte', 'acum'].forEach(function (c) {
      for (var i = 1; i <= 4; i++) {
        var el = document.querySelector('.hm-' + c + '-' + i);
        muestras.push(c + '-' + i + '=' + (el ? getComputedStyle(el).backgroundColor : 'NO EXISTE'));
      }
    });
    d.textContent = muestras.join('\n');
    document.body.appendChild(d);
  }, 1500);
}, 3000);
