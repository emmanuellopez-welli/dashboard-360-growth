// --- correr -----------------------------------------------------------
console.log('PRUEBA DE probarCorreoAlertaEquipo() · ' + hoyISO_());

console.log('');
console.log('1) La corrida NORMAL debe detenerse por dato viejo:');
const normal = revisarSedesHuerfanas_();
console.log('   omitida = ' + normal.omitida);
if (normal.omitida) console.log('   motivo: ' + normal.motivo);

console.log('');
console.log('2) La PRUEBA debe pasar el guardarrail y enviar:');
const r = probarCorreoAlertaEquipo();
console.log('   destinatarios: ' + (CORREO ? CORREO.to : 'NO SE ENVIO'));
console.log('   asunto: ' + (CORREO ? CORREO.subject : '—'));
console.log('   avisa sobre: ' + r.avisar.length + ' casos (' +
            r.tipoA.length + ' tipo A, ' + r.tipoB.length + ' tipo B)');
console.log('   trae el aviso de prueba: ' +
            (CORREO && CORREO.htmlBody.indexOf('Correo de prueba') >= 0));
console.log('   menciona el dato viejo: ' +
            (CORREO && CORREO.htmlBody.indexOf('no se refresca desde') >= 0));

console.log('');
console.log('3) La bitacora NO debe haberse escrito:');
console.log('   filas escritas en ALERTAS_SEDES: ' +
            ((ESCRITAS['ALERTAS_SEDES'] || []).length));

fs.writeFileSync('correo_prueba.html', CORREO.htmlBody, 'utf8');
console.log('');
console.log('cuerpo guardado en correo_prueba.html (' +
            Math.round(CORREO.htmlBody.length / 1024) + ' KB)');
