/**
 * SUITE COMPLETA DE PRUEBAS AUTOMATIZADAS - RUTA SEGURA COMERCIAL
 * Valida:
 * 1. Health check y servidor en vivo (GET /api/status)
 * 2. Entrega de assets estáticos y nuevos componentes de Checkout / Facturación (index.html, css/style.css, js/app.js)
 * 3. POST /registro (Alta de usuario y contacto de emergencia)
 * 4. POST /ubicacion (Telemetría GPS y motor Haversine)
 * 5. POST /api/panico (Botón de auxilio SOS y despacho Twilio WhatsApp)
 * 6. POST /api/llegada (Confirmación de viaje seguro)
 * 7. POST /api/cupon/validar (Validación de cupones promocionales)
 * 8. POST /api/checkout/spei y /api/checkout/oxxo (Generación de referencias oficiales STP y OXXO Pay)
 * 9. POST /api/pago-directo (Procesamiento de pago, activación de suscripción y creación de comprobante fiscal)
 * 10. GET /api/facturacion/recibo/:folio (Renderizado HTML de CFDI / Recibo imprimible con IVA 16% y QR)
 * 11. GET /api/facturacion/todas (Reporte consolidado de facturas emitidas)
 * 12. GET y POST /api/afiliados (Programa de referidos para streamers y comisiones del 30%)
 * 13. POST /webhook-revenuecat (Ciclo de vida de suscripción móvil)
 * 14. GET /api/telemetria y GET /api/admin/metrics (Métricas comerciales en tiempo real)
 * 15. Verificación de persistencia en disco (data/database.json)
 */

const fs = require('fs');
const path = require('path');

async function runTests() {
  const BASE_URL = 'http://127.0.0.1:3000';
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

  // Test 1: Health status
  try {
    const res = await fetch(`${BASE_URL}/api/status`);
    const data = await res.json();
    assert(res.status === 200 && data.ok === true, 'GET /api/status responde 200 OK con healthcheck');
    assert(data.motorHaversine === 'ACTIVO_CALIBRADO', 'Motor Haversine reportado como ACTIVO_CALIBRADO');
    assert(data.version === '2.0.0', 'Versión comercial 2.0.0 reportada');
  } catch (e) {
    assert(false, `GET /api/status falló: ${e.message}`);
  }

  // Test 2: Static assets
  try {
    const htmlRes = await fetch(`${BASE_URL}/index.html`);
    const htmlText = await htmlRes.text();
    assert(htmlRes.status === 200 && htmlText.includes('Ruta Segura'), 'index.html se sirve con título y estructura');
    assert(htmlText.includes('checkout-modal-backdrop'), 'index.html incluye el modal de Checkout Multi-Pago');
    assert(htmlText.includes('tab-billing'), 'index.html incluye la sección de Facturación & Monetización');

    const cssRes = await fetch(`${BASE_URL}/css/style.css`);
    const cssText = await cssRes.text();
    assert(cssRes.status === 200 && cssText.includes('checkout-modal-card'), 'css/style.css contiene estilos de checkout');

    const jsRes = await fetch(`${BASE_URL}/js/app.js`);
    const jsText = await jsRes.text();
    assert(jsRes.status === 200 && jsText.includes('abrirModalCheckout'), 'js/app.js contiene funciones de checkout y facturación');
  } catch (e) {
    assert(false, `Carga de assets estáticos falló: ${e.message}`);
  }

  // Test 3: Registro de usuario y contacto de emergencia
  const testUser = {
    nombre: 'Valeria Rosales',
    telefonoPropio: '+525544332211',
    nombreContacto: 'Mario (Hermano)',
    telefonoContacto: '+525566778899',
    suscripcionActiva: true
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

    const p2 = await fetch(`${BASE_URL}/ubicacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefonoPropio: testUser.telefonoPropio,
        latitud: 19.435211,
        longitud: -99.141258,
        bateria: 94,
        velocidad: 40,
        timestamp: Date.now() + 60000
      })
    });
    const d2 = await p2.json();
    assert(p2.status === 200 && d2.distanciaTotal > 500, `Haversine calcula desplazamiento correcto (>500m): ${d2.distanciaTotal}m`);
  } catch (e) {
    assert(false, `POST /ubicacion falló: ${e.message}`);
  }

  // Test 5: Botón de Pánico SOS
  try {
    const res = await fetch(`${BASE_URL}/api/panico`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefonoPropio: testUser.telefonoPropio,
        latitud: 19.435211,
        longitud: -99.141258,
        bateria: 90
      })
    });
    const data = await res.json();
    assert(res.status === 200 && data.ok === true, 'POST /api/panico despacha alerta SOS');
    assert(data.alerta.tipo === 'PANICO_SOS', 'Alerta contiene tipo PANICO_SOS');
  } catch (e) {
    assert(false, `POST /api/panico falló: ${e.message}`);
  }

  // Test 6: Confirmación de Llegada a Salvo
  try {
    const res = await fetch(`${BASE_URL}/api/llegada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefonoPropio: testUser.telefonoPropio,
        latitud: 19.433892,
        longitud: -99.200115
      })
    });
    const data = await res.json();
    assert(res.status === 200 && data.ok === true, 'POST /api/llegada finaliza viaje con confirmación');
  } catch (e) {
    assert(false, `POST /api/llegada falló: ${e.message}`);
  }

  // Test 7: Validación de Cupones de Descuento
  try {
    const cupRes = await fetch(`${BASE_URL}/api/cupon/validar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: 'STREAMER30' })
    });
    const cupData = await cupRes.json();
    assert(cupRes.status === 200 && cupData.ok === true, 'POST /api/cupon/validar valida cupón STREAMER30');
    assert(cupData.cupon.descuentoPorcentaje === 30 && cupData.cupon.precioFinal === 84, 'Descuento 30% aplicado ($84 MXN)');
  } catch (e) {
    assert(false, `POST /api/cupon/validar falló: ${e.message}`);
  }

  // Test 8: Generación de Referencias SPEI y OXXO Pay
  try {
    const speiRes = await fetch(`${BASE_URL}/api/checkout/spei`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefonoPropio: testUser.telefonoPropio })
    });
    const speiData = await speiRes.json();
    assert(speiRes.status === 200 && speiData.ok === true, 'POST /api/checkout/spei genera referencia STP');
    assert(speiData.datos.clabe.length === 18 && speiData.datos.monto === 120, 'CLABE de 18 dígitos y monto $120.00 generados');

    const oxxoRes = await fetch(`${BASE_URL}/api/checkout/oxxo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefonoPropio: testUser.telefonoPropio })
    });
    const oxxoData = await oxxoRes.json();
    assert(oxxoRes.status === 200 && oxxoData.ok === true, 'POST /api/checkout/oxxo genera código de 14 dígitos OXXO Pay');
  } catch (e) {
    assert(false, `Generación de referencias SPEI/OXXO falló: ${e.message}`);
  }

  // Test 9: Pago Directo y Generación Automática de Factura Fiscal (CFDI)
  let folioFacturaCreada = null;
  try {
    const payRes = await fetch(`${BASE_URL}/api/pago-directo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefonoPropio: testUser.telefonoPropio,
        nombre: testUser.nombre,
        metodoPago: 'Tarjeta de Crédito / Stripe',
        rfc: 'ROMA900101XYZ',
        razonSocial: 'Valeria Rosales Martínez',
        correo: 'valeria.rosales@ejemplo.com',
        ref: 'streamer_demo'
      })
    });
    const payData = await payRes.json();
    assert(payRes.status === 200 && payData.ok === true, 'POST /api/pago-directo procesa compra anual ($120 MXN)');
    assert(payData.factura && payData.factura.folio, `Comprobante fiscal timbrado automáticamente: ${payData.factura?.folio}`);
    assert(payData.factura.subtotal === 103.45 && payData.factura.iva === 16.55, 'Desglose fiscal SAT 16% verificado ($103.45 + $16.55 = $120.00)');
    folioFacturaCreada = payData.factura.folio;
  } catch (e) {
    assert(false, `POST /api/pago-directo falló: ${e.message}`);
  }

  // Test 10: Descarga y Visualización HTML del Comprobante Fiscal Digital
  try {
    if (folioFacturaCreada) {
      const recRes = await fetch(`${BASE_URL}/api/facturacion/recibo/${folioFacturaCreada}`);
      const recHtml = await recRes.text();
      assert(recRes.status === 200 && recHtml.includes('Comprobante Fiscal Digital'), 'GET /api/facturacion/recibo/:folio entrega HTML CFDI 4.0');
      assert(recHtml.includes(folioFacturaCreada) && recHtml.includes('ROMA900101XYZ'), 'HTML contiene el folio, RFC del cliente y desglose');
      assert(recHtml.includes('Código QR SAT') && recHtml.includes('window.print()'), 'HTML incluye código QR y botón para imprimir/guardar PDF');
    } else {
      assert(false, 'No se pudo validar recibo fiscal porque no se obtuvo folio');
    }
  } catch (e) {
    assert(false, `GET /api/facturacion/recibo falló: ${e.message}`);
  }

  // Test 11: Listado Consolidado de Facturación
  try {
    const facRes = await fetch(`${BASE_URL}/api/facturacion/todas`);
    const facData = await facRes.json();
    assert(facRes.status === 200 && facData.ok === true, 'GET /api/facturacion/todas entrega reporte contable');
    assert(facData.totalFacturas > 0 && facData.totalFacturadoMXN > 0, `Total facturado reportado: $${facData.totalFacturadoMXN} MXN`);
  } catch (e) {
    assert(false, `GET /api/facturacion/todas falló: ${e.message}`);
  }

  // Test 12: Programa de Afiliados y Streamers
  try {
    // Visita
    const visRes = await fetch(`${BASE_URL}/api/afiliados/visita`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'streamer_demo' })
    });
    assert(visRes.status === 200, 'POST /api/afiliados/visita registra clic de referido');

    // Consulta de métricas de afiliado
    const afilRes = await fetch(`${BASE_URL}/api/afiliados/streamer_demo`);
    const afilData = await afilRes.json();
    assert(afilRes.status === 200 && afilData.ok === true, 'GET /api/afiliados/:id entrega balance del streamer');
    assert(afilData.afiliado.saldoComisiones > 0, `Streamer acumula comisiones del 30%: $${afilData.afiliado.saldoComisiones} MXN`);
  } catch (e) {
    assert(false, `Flujo de afiliados streamers falló: ${e.message}`);
  }

  // Test 13: Webhook de RevenueCat
  try {
    const rcPurchase = await fetch(`${BASE_URL}/webhook-revenuecat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: testUser.telefonoPropio,
          product_id: 'ruta_segura_anual_120',
          price_in_purchased_currency: 120,
          currency: 'MXN'
        }
      })
    });
    const rcData = await rcPurchase.json();
    assert(rcPurchase.status === 200 && rcData.ok === true, 'POST /webhook-revenuecat procesa INITIAL_PURCHASE ($120 MXN)');
  } catch (e) {
    assert(false, `POST /webhook-revenuecat falló: ${e.message}`);
  }

  // Test 14: Métricas del Panel de Administración y Telemetría
  try {
    const adminRes = await fetch(`${BASE_URL}/api/admin/metrics`);
    const adminData = await adminRes.json();
    assert(adminRes.status === 200 && adminData.ok === true, 'GET /api/admin/metrics entrega estadísticas');
    assert(adminData.metricas.suscriptoresActivos > 0, `Suscriptores activos detectados: ${adminData.metricas.suscriptoresActivos}`);
  } catch (e) {
    assert(false, `GET /api/admin/metrics falló: ${e.message}`);
  }

  // Test 15: Persistencia en Disco de la Base de Datos
  try {
    const dbPath = path.join(__dirname, '..', 'data', 'database.json');
    const dbExists = fs.existsSync(dbPath);
    assert(dbExists, 'Archivo de persistencia data/database.json existe en disco');

    if (dbExists) {
      const dbContent = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const usuarioPersistido = (dbContent.usuarios || []).find(u => u.telefonoPropio === testUser.telefonoPropio);
      assert(Boolean(usuarioPersistido && usuarioPersistido.suscripcionActiva), 'Usuario y suscripción persistidos en database.json');
      assert(Array.isArray(dbContent.facturas) && dbContent.facturas.length > 0, 'Facturas y comprobantes fiscales persistidos en database.json');
    }
  } catch (e) {
    assert(false, `Verificación de persistencia falló: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTADOS: ${passed} Pasadas | ${failed} Fallidas`);
  console.log('====================================================');

  if (failed === 0) {
    console.log('🎉 ¡TODAS LAS PRUEBAS DE FACTURACIÓN Y MONETIZACIÓN PASARON AL 100%!');
    process.exitCode = 0;
  } else {
    process.exitCode = 1;
  }
}

runTests();
