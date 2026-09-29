// El archivo local se queda como documento completo (se abre con doble clic
// en el navegador). El del artefacto va SIN <!doctype>, <html>, <head> ni
// <body>: el visor envuelve el contenido en su propio esqueleto, y publicar
// un documento anidado dentro de su <body> deja dos <head> y un
// <base target="_top"> donde no va. Venia funcionando de milagro.
function paraArtefacto(doc) {
  var mh = doc.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  var mb = doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  var head = mh ? mh[1] : '';
  var body = mb ? mb[1] : doc;
  // Del <head> se conserva lo que si hace falta: el titulo, la fuente y los
  // estilos. El resto del andamiaje se descarta.
  var util = (head.match(/<title[\s\S]*?<\/title>|<link[^>]*fonts[^>]*>|<style[\s\S]*?<\/style>/gi) || []).join('\n');
  // El tema se declaraba en <html data-tema="claro">. Sin ese atributo el
  // CSS de tema claro no aplica, asi que se reinyecta sobre el root.
  var tema = '<script>\ntry { document.documentElement.setAttribute("data-tema", "claro"); } catch (e) {}\n<' + '/script>';
  return util + '\n' + tema + '\n' + body;
}

const salidas = [['Dashboard_360_WELLI_previa.html', html],
                 ['artifact_tablero.html', paraArtefacto(html)]];
salidas.forEach(function (par) {
  const f = par[0], contenido = par[1];
  fs.writeFileSync(f, contenido, 'utf8');
  console.log('escrito ' + f + '  ' + Math.round(contenido.length / 1024) + 'KB');
