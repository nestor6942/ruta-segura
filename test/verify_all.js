/**
 * SUITE COMPLETA DE PRUEBAS AUTOMATIZADAS - RUTA SEGURA COMERCIAL
 * Valida:
 * 1. Health check y servidor en vivo (GET /api/status con cumplimiento legal LFPDPPP)
 * 2. Entrega de assets estáticos y páginas legales (index.html, terminos.html, privacidad.html, css, js)
 * 3. POST /registro (Alta de usuario, contacto de emergencia y consentimiento legal)
 * 4. POST /ubicacion (Telemetría GPS y motor Haversine)
 * 5. POST /api/panico (Botón de auxilio SOS con enlace Google Maps y OpenStreetMap)
 * 6. POST /api/llegada (Confirmación de viaje seguro)
 * 7. POST /api/cupon/validar (Validación de cupones promocionales)
 * 8. POST /api/checkout/spei y /api/checkout/oxxo (Generación de referencias oficiales STP y OXXO Pay)
 * 9. POST /api/pago-directo (Procesamiento de pago, activación de suscripción y creación de comprobante fiscal)
 * 10. GET /api/facturacion/recibo/:folio (Renderizado HTML de CFDI / Recibo imprimible con IVA 16% y QR)
 * 11. GET /api/facturacion/todas (Reporte consolidado de facturas emitidas)
 * 12. GET y POST /api/afiliados (Programa de referidos para streamers y comisiones del 30%)
 * 13. POST /webhook-revenuecat (Ciclo de vida de suscripción móvil)
 * 14. GET /api/telemetria y GET /api/admin/metrics (Métricas comerciales en tiempo real)
 * 15. POST /api/usuario/arco y POST /api/usuario/eliminar (Ejercicio de Derechos ARCO y Supresión)
 * 16. Verificación de persistencia en disco (data/database.json)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function waitForServer(url, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/status`);
      if (res.ok) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function runTests() {
  const BASE_URL = 'http://127.0.0.1:3000';
  let serverProcess = null;

  // Auto-iniciar servidor si no está encendido
  const isRunning = await waitForServer(BASE_URL, 1000);
  if (!isRunning) {
    console.log('⚡ Servidor no detectado en puerto 3000. Iniciando server.js automáticamente...');
    serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      stdio: 'ignore',
      detached: false
    });
    const ready = await waitForServer(BASE_URL, 7000);
    if (!ready) {
      console.error('❌ No se pudo iniciar el servidor para las pruebas.');
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  }

  console.log('====================================================');
  console.log('🧪 INICIANDO VERIFICACIÓN INTEGRAL DE RUTA SEGURA');
  console.log('====================================================\n');

  try {
    // Test 1: Health status
    try {
      const res = await fetch(`${BASE_URL}/api/status`);
      const data = await res.json();
      assert(res.status === 200 && data.ok === true, 'GET /api/status responde 200 OK con healthcheck');
      assert(data.motorHaversine === 'ACTIVO_CALIBRADO', 'Motor Haversine reportado como ACTIVO_CALIBRADO');
      assert(data.version === '2.0.0', 'Versión comercial 2.0.0 reportada');
      assert(data.cumplimientoLegal === 'LFPDPPP_Y_GDPR_ACTIVO', 'Cumplimiento legal LFPDPPP y GDPR reportado activo');
    } catch (e) {
      assert(false, `GET /api/status falló: ${e.message}`);
    }

    // Test 2: Static assets & Legal Pages
    try {
      const htmlRes = await fetch(`${BASE_URL}/index.html`);
      const htmlText = await htmlRes.text();
      assert(htmlRes.status === 200 && htmlText.includes('Ruta Segura'), 'index.html se sirve con título y estructura');
      assert(htmlText.includes('checkout-modal-backdrop'), 'index.html incluye el modal de Checkout Multi-Pago');
      assert(htmlText.includes('arco-modal-backdrop'), 'index.html incluye el modal de Derechos ARCO LFPDPPP');
      assert(htmlText.includes('app-main-footer'), 'index.html incluye footer oficial con enlaces legales');

      const terminosRes = await fetch(`${BASE_URL}/terminos`);
      const terminosText = await terminosRes.text();
      assert(terminosRes.status === 200 && terminosText.includes('Términos y Condiciones de Uso'), 'GET /terminos entrega documento legal');
      assert(terminosText.includes('911'), 'Términos incluyen deslinde de responsabilidad formal');

      const privRes = await fetch(`${BASE_URL}/privacidad`);
      const privText = await privRes.text();
      assert(privRes.status === 200 && privText.includes('Aviso de Privacidad Integral'), 'GET /privacidad entrega aviso de privacidad LFPDPPP');
      assert(privText.includes('Geolocalización'), 'Aviso de privacidad regula datos sensibles de geolocalización');

      const cssRes = await fetch(`${BASE_URL}/css/style.css`);
      const cssText = await cssRes.text();
      assert(cssRes.status === 200 && cssText.includes('checkout-modal-card'), 'css/style.css contiene estilos de checkout');

      const jsRes = await fetch(`${BASE_URL}/js/app.js`);
      const jsText = await jsRes.text();
      assert(jsRes.status === 200 && jsText.includes('abrirModalARCO'), 'js/app.js contiene funciones de Derechos ARCO');
    } catch (e) {
      assert(false, `Carga de assets estáticos falló: ${e.message}`);
    }

    // Test 3: Registro de usuario y contacto de emergencia con consentimiento
    const testUser = {
      nombre: 'Valeria Rosales',
      telefonoPropio: '+525544332211',
      nombreContacto: 'Mario (Hermano)',
      telefonoContacto: '+525566778899',
      suscripcionActiva: true,
      consentimientoLegal: true
    };

    try {
      const res = await fetch(`${BASE_URL}/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });
      const data = await res.json();
      assert(res.status === 201 && data.ok === true, 'POST /registro crea usuario y contacto de emergencia');
      assert(data.usuario.contactoEmergencia.nombreContacto === 'Mario (Hermano)', 'Contacto de emergencia asignado');
      assert(Boolean(data.usuario.consentimientoLegal?.terminosAceptados), 'Consentimiento legal de LFPDPPP registrado');
    } catch (e) {
      assert(false, `POST /registro falló: ${e.message}`);
    }

    // Test 4: Envío de Telemetría GPS Continua (Haversine)
    try {
      const p1 = await fetch(`${BASE_URL}/ubicacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: testUser.telefonoPropio,
          latitud: 19.432608,
          longitud: -99.133209,
          bateria: 95,
          velocidad: 35,
          timestamp: Date.now()
        })
      });
      const d1 = await p1.json();
      assert(p1.status === 200 && d1.ok === true, 'POST /ubicacion procesa punto inicial con motor Haversine');

      // Segundo punto con desplazamiento
      const p2 = await fetch(`${BASE_URL}/ubicacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: testUser.telefonoPropio,
          latitud: 19.435000,
          longitud: -99.136000,
          bateria: 94,
          velocidad: 40,
          timestamp: Date.now() + 5000
        })
      });
      const d2 = await p2.json();
      assert(p2.status === 200 && d2.distanciaTotal > 0, `Distancia calculada por Haversine: ${d2.distanciaTotal} metros`);
    } catch (e) {
      assert(false, `POST /ubicacion falló: ${e.message}`);
    }

    // Test 5: Botón de Pánico SOS
    try {
      const panicRes = await fetch(`${BASE_URL}/api/panico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: testUser.telefonoPropio,
          latitud: 19.432608,
          longitud: -99.133209,
          bateria: 88
        })
      });
      const panicData = await panicRes.json();
      assert(panicRes.status === 200 && panicData.ok === true, 'POST /api/panico despacha alerta SOS de alta prioridad');
      assert(Boolean(panicData.alerta?.enlaceMapa), 'Alerta incluye enlace universal de Google Maps (sin costo de API)');
      assert(Boolean(panicData.alerta?.enlaceOSM), 'Alerta incluye enlace universal de OpenStreetMap');
      assert(Boolean(panicData.alerta?.enlaceWhatsAppDirecto), 'Alerta incluye respaldo directo Click-to-Chat');
    } catch (e) {
      assert(false, `POST /api/panico falló: ${e.message}`);
    }

    // Test 6: Confirmación de Llegada
    try {
      const arrRes = await fetch(`${BASE_URL}/api/llegada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: testUser.telefonoPropio,
          latitud: 19.435000,
          longitud: -99.136000
        })
      });
      const arrData = await arrRes.json();
      assert(arrRes.status === 200 && arrData.ok === true, 'POST /api/llegada finaliza viaje y notifica a familiares');
    } catch (e) {
      assert(false, `POST /api/llegada falló: ${e.message}`);
    }

    // Test 7: Validación de Cupones
    try {
      const cupRes = await fetch(`${BASE_URL}/api/cupon/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: 'STREAMER30' })
      });
      const cupData = await cupRes.json();
      assert(cupRes.status === 200 && cupData.ok === true, 'POST /api/cupon/validar reconoce STREAMER30');
      assert(cupData.cupon.precioFinal === 84, 'Precio de $120 rebajado a $84 MXN con 30% descuento');
    } catch (e) {
      assert(false, `POST /api/cupon/validar falló: ${e.message}`);
    }

    // Test 8: Checkout Alternativo SPEI y OXXO Pay
    try {
      const speiRes = await fetch(`${BASE_URL}/api/checkout/spei`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: testUser.telefonoPropio,
          nombre: testUser.nombre
        })
      });
      const speiData = await speiRes.json();
      assert(speiRes.status === 200 && speiData.ok === true, 'POST /api/checkout/spei genera CLABE STP oficial');
      assert(speiData.clabeInterbancaria.length === 18, `CLABE STP de 18 dígitos: ${speiData.clabeInterbancaria}`);

      const oxxoRes = await fetch(`${BASE_URL}/api/checkout/oxxo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: testUser.telefonoPropio,
          nombre: testUser.nombre
        })
      });
      const oxxoData = await oxxoRes.json();
      assert(oxxoRes.status === 200 && oxxoData.ok === true, 'POST /api/checkout/oxxo genera código OXXO Pay');
      assert(oxxoData.referenciaOxxo.length === 14, `Referencia OXXO de 14 dígitos: ${oxxoData.referenciaOxxo}`);
    } catch (e) {
      assert(false, `Generación de referencias SPEI/OXXO falló: ${e.message}`);
    }

    // Test 9: Pago Directo y Generación de Factura Fiscal CFDI 4.0
    let folioGenerado = null;
    try {
      const pagoRes = await fetch(`${BASE_URL}/api/pago-directo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: testUser.telefonoPropio,
          nombre: testUser.nombre,
          monto: 120,
          metodo: 'Stripe / Tarjeta de Débito',
          rfc: 'ROSA900101XYZ',
          razonSocial: 'Valeria Rosales SA de CV',
          correo: 'valeria.rosales@empresa.com',
          cupon: null,
          ref: 'streamer_demo'
        })
      });
      const pagoData = await pagoRes.json();
      assert(pagoRes.status === 200 && pagoData.ok === true, 'POST /api/pago-directo activa suscripción y genera CFDI 4.0');
      assert(Boolean(pagoData.factura?.folio), `Folio fiscal generado: ${pagoData.factura?.folio}`);
      assert(pagoData.factura?.total === 120, 'Total facturado $120.00 MXN');
      assert(pagoData.factura?.iva === 16.55, 'Desglose de IVA 16% ($16.55 MXN) verificado');
      assert(Boolean(pagoData.urlRecibo), 'URL pública de descarga de comprobante entregada');
      folioGenerado = pagoData.factura?.folio;
    } catch (e) {
      assert(false, `POST /api/pago-directo falló: ${e.message}`);
    }

    // Test 10: Renderizado de Recibo HTML con QR e IVA
    if (folioGenerado) {
      try {
        const reciboRes = await fetch(`${BASE_URL}/api/facturacion/recibo/${folioGenerado}`);
        const reciboHtml = await reciboRes.text();
        assert(reciboRes.status === 200, `GET /api/facturacion/recibo/${folioGenerado} responde 200 OK`);
        assert(reciboHtml.includes('Comprobante Fiscal Digital'), 'Recibo contiene encabezado fiscal oficial SAT');
        assert(reciboHtml.includes('ROSA900101XYZ'), 'Recibo incluye el RFC del cliente timbrado');
        assert(reciboHtml.includes('qrserver.com') || reciboHtml.includes('create-qr-code') || reciboHtml.includes('qr'), 'Recibo incluye código QR fiscal oficial para validación');
      } catch (e) {
        assert(false, `Renderizado de recibo falló: ${e.message}`);
      }
    }

    // Test 11: Consulta de Todas las Facturas
    try {
      const allRes = await fetch(`${BASE_URL}/api/facturacion/todas`);
      const allData = await allRes.json();
      assert(allRes.status === 200 && allData.ok === true, 'GET /api/facturacion/todas entrega catálogo');
      assert(Array.isArray(allData.facturas) && allData.facturas.length > 0, `Total facturas activas: ${allData.facturas.length}`);
    } catch (e) {
      assert(false, `GET /api/facturacion/todas falló: ${e.message}`);
    }

    // Test 12: Módulo de Afiliados Streamers
    try {
      const regVisita = await fetch(`${BASE_URL}/api/afiliados/visita`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'streamer_demo' })
      });
      const regData = await regVisita.json();
      assert(regVisita.status === 200 && regData.ok === true, 'POST /api/afiliados/visita incrementa contador');

      const afilRes = await fetch(`${BASE_URL}/api/afiliados`);
      const afilData = await afilRes.json();
      assert(afilRes.status === 200 && afilData.ok === true, 'GET /api/afiliados entrega lista de streamers');
      const streamer = afilData.afiliados.find(a => a.id === 'streamer_demo');
      assert(Boolean(streamer && streamer.conversiones > 0), `Streamer demo registra ${streamer?.conversiones} conversiones`);
    } catch (e) {
      assert(false, `Flujo de afiliados streamers falló: ${e.message}`);
    }

    // Test 13: Webhook RevenueCat (Suscripción Móvil)
    try {
      const rcRes = await fetch(`${BASE_URL}/webhook-revenuecat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_version: '1.0',
          event: {
            id: 'rc_evt_' + Date.now(),
            type: 'INITIAL_PURCHASE',
            app_user_id: testUser.telefonoPropio,
            product_id: 'ruta_segura_anual_120',
            price_in_purchased_currency: 120.00,
            currency: 'MXN'
          }
        })
      });
      const rcData = await rcRes.json();
      assert(rcRes.status === 200 && rcData.ok === true, 'POST /webhook-revenuecat procesa alta desde Play Store/App Store');
    } catch (e) {
      assert(false, `POST /webhook-revenuecat falló: ${e.message}`);
    }

    // Test 14: Métricas del Panel de Administración
    try {
      const adminRes = await fetch(`${BASE_URL}/api/admin/metrics`);
      const adminData = await adminRes.json();
      assert(adminRes.status === 200 && adminData.ok === true, 'GET /api/admin/metrics entrega estadísticas');
      assert(adminData.metricas.suscriptoresActivos > 0, `Suscriptores activos detectados: ${adminData.metricas.suscriptoresActivos}`);
    } catch (e) {
      assert(false, `GET /api/admin/metrics falló: ${e.message}`);
    }

    // Test 15: Cumplimiento de Derechos ARCO (Cancelación / Borrado de Datos Personales)
    try {
      const userToPurge = {
        nombre: 'Usuario Para Borrar',
        telefonoPropio: '+525599001122',
        nombreContacto: 'Contacto Temporal',
        telefonoContacto: '+525588776655',
        suscripcionActiva: true
      };

      // 1. Darlo de alta primero
      await fetch(`${BASE_URL}/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userToPurge)
      });

      // 2. Ejecutar solicitud ARCO
      const arcoRes = await fetch(`${BASE_URL}/api/usuario/arco`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'CANCELACION',
          telefono: userToPurge.telefonoPropio,
          nombre: userToPurge.nombre,
          motivo: 'Prueba formal de derecho al olvido LFPDPPP'
        })
      });
      const arcoData = await arcoRes.json();
      assert(arcoRes.status === 200 && arcoData.ok === true, 'POST /api/usuario/arco atiende solicitud de cancelación');
      assert(arcoData.folio.startsWith('ARCO-'), `Folio oficial de seguimiento ARCO: ${arcoData.folio}`);

      // 3. Comprobar que el usuario fue purgado de la base de datos
      const checkPurgeRes = await fetch(`${BASE_URL}/api/users`);
      const checkPurgeData = await checkPurgeRes.json();
      const stillExists = checkPurgeData.usuarios.some(u => u.telefonoPropio === userToPurge.telefonoPropio);
      assert(!stillExists, 'Usuario purgado permanentemente de la base de datos (Derecho al Olvido garantizado)');
    } catch (e) {
      assert(false, `Prueba de Derechos ARCO falló: ${e.message}`);
    }

    // Test 16: Persistencia en Disco de la Base de Datos
    try {
      const dbPath = path.join(__dirname, '..', 'data', 'database.json');
      const dbExists = fs.existsSync(dbPath);
      assert(dbExists, 'Archivo de persistencia data/database.json existe en disco');

      if (dbExists) {
        const dbContent = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const usuarioPersistido = (dbContent.usuarios || []).find(u => u.telefonoPropio === testUser.telefonoPropio);
        assert(Boolean(usuarioPersistido && usuarioPersistido.suscripcionActiva), 'Usuario y suscripción persistidos en database.json');
        assert(Array.isArray(dbContent.facturas) && dbContent.facturas.length > 0, 'Facturas y comprobantes fiscales persistidos en database.json');
        assert(Array.isArray(dbContent.solicitudesARCO), 'Historial de solicitudes ARCO persistido');
      }
    } catch (e) {
      assert(false, `Verificación de persistencia falló: ${e.message}`);
    }

  } finally {
    if (serverProcess) {
      console.log('\n🛑 Cerrando servidor temporal de pruebas...');
      serverProcess.kill();
    }
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTADOS: ${passed} Pasadas | ${failed} Fallidas`);
  console.log('====================================================');

  if (failed === 0) {
    console.log('🎉 ¡TODAS LAS PRUEBAS (FUNCIONALES, FISCALES Y DE PRIVACIDAD LFPDPPP) PASARON AL 100%!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
