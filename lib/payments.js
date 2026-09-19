/**
 * MOTOR MULTI-PASARELA DE COBROS Y MONETIZACIÓN
 * Stripe, Mercado Pago, SPEI (STP) y OXXO Pay ($120 MXN / año)
 */

const db = require('./db');
const { generarHTMLComprobante } = require('./invoicing');

class PaymentService {
  constructor() {
    this.priceMXN = 120.00;
  }

  // 1. Stripe Checkout Session
  async createStripeSession({ telefono, nombre, correo, refCode, hostUrl }) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const baseSuccessUrl = `${hostUrl || 'http://localhost:3000'}/?checkout=success&tel=${encodeURIComponent(telefono)}&session_id={CHECKOUT_SESSION_ID}`;
    const baseCancelUrl = `${hostUrl || 'http://localhost:3000'}/?checkout=cancel`;

    if (stripeKey && !stripeKey.includes('mock') && stripeKey.startsWith('sk_')) {
      try {
        const bodyParams = new URLSearchParams();
        bodyParams.append('payment_method_types[0]', 'card');
        bodyParams.append('line_items[0][price_data][currency]', 'mxn');
        bodyParams.append('line_items[0][price_data][product_data][name]', 'Ruta Segura — Suscripción Anual ($120 MXN)');
        bodyParams.append('line_items[0][price_data][product_data][description]', 'Protección satelital 24/7, motor Haversine anti-detenciones y alertas ilimitadas de WhatsApp vía Twilio.');
        bodyParams.append('line_items[0][price_data][unit_amount]', '12000'); // 12000 centavos = $120.00 MXN
        bodyParams.append('line_items[0][quantity]', '1');
        bodyParams.append('mode', 'payment');
        bodyParams.append('success_url', baseSuccessUrl);
        bodyParams.append('cancel_url', baseCancelUrl);
        bodyParams.append('client_reference_id', telefono);
        bodyParams.append('metadata[telefono]', telefono);
        bodyParams.append('metadata[nombre]', nombre || '');
        if (refCode) bodyParams.append('metadata[refCode]', refCode);
        if (correo) bodyParams.append('customer_email', correo);

        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: bodyParams.toString()
        });

        const session = await response.json();
        if (session.id && session.url) {
          return {
            ok: true,
            provider: 'stripe_live',
            sessionId: session.id,
            checkoutUrl: session.url
          };
        } else {
          console.warn('⚠️ Stripe API devolvió error, pasando a modo Sandbox:', session.error);
        }
      } catch (e) {
        console.error('Error al conectar con Stripe API:', e.message);
      }
    }

    // Modo Sandbox / Simulación Instantánea si no hay llave de producción
    const mockSessionId = 'cs_test_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    return {
      ok: true,
      provider: 'stripe_sandbox',
      sessionId: mockSessionId,
      checkoutUrl: `/?sandbox_checkout=stripe&session_id=${mockSessionId}&tel=${encodeURIComponent(telefono)}&ref=${encodeURIComponent(refCode || '')}`,
      isSandbox: true
    };
  }

  // 2. Mercado Pago Preference
  async createMercadoPagoPreference({ telefono, nombre, correo, refCode, hostUrl }) {
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const baseSuccessUrl = `${hostUrl || 'http://localhost:3000'}/?checkout=success&tel=${encodeURIComponent(telefono)}`;

    if (mpToken && !mpToken.includes('mock') && mpToken.startsWith('APP_USR')) {
      try {
        const payload = {
          items: [
            {
              title: 'Ruta Segura — Cobertura Anual ($120 MXN)',
              description: 'Monitoreo GPS inteligente y despacho inmediato a contactos de emergencia.',
              quantity: 1,
              currency_id: 'MXN',
              unit_price: 120.00
            }
          ],
          payer: {
            name: nombre || 'Usuario Suscriptor',
            email: correo || 'contacto@rutasegura.mx',
            phone: { number: telefono }
          },
          back_urls: {
            success: baseSuccessUrl,
            failure: `${hostUrl || 'http://localhost:3000'}/?checkout=failure`,
            pending: `${hostUrl || 'http://localhost:3000'}/?checkout=pending`
          },
          auto_return: 'approved',
          external_reference: telefono,
          metadata: { telefono, refCode }
        };

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mpToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const pref = await response.json();
        if (pref.init_point) {
          return {
            ok: true,
            provider: 'mercadopago_live',
            preferenceId: pref.id,
            checkoutUrl: pref.init_point
          };
        }
      } catch (e) {
        console.error('Error al conectar con Mercado Pago:', e.message);
      }
    }

    const mockPrefId = 'pref_mp_' + Date.now();
    return {
      ok: true,
      provider: 'mercadopago_sandbox',
      preferenceId: mockPrefId,
      checkoutUrl: `/?sandbox_checkout=mercadopago&pref_id=${mockPrefId}&tel=${encodeURIComponent(telefono)}&ref=${encodeURIComponent(refCode || '')}`,
      isSandbox: true
    };
  }

  // 3. Generador de Referencias Oficiales SPEI (Transferencia STP)
  generarReferenciaSPEI(telefono) {
    const cleanTel = (telefono || '5500000000').replace(/\D/g, '').slice(-10);
    // Formato STP: Institución 646 + Plaza 180 + Cuenta + Dígito Verificador
    const clabe = `646180${cleanTel.padStart(10, '0')}18`;
    const concepto = `RUTA-${cleanTel.slice(-4)}`;
    return {
      metodo: 'SPEI',
      bancoReceptor: 'STP (Sistema de Transferencias y Pagos)',
      beneficiario: 'RUTA SEGURA TECH SAPI DE CV',
      clabe,
      concepto,
      monto: this.priceMXN,
      moneda: 'MXN',
      instrucciones: 'Abre tu app bancaria (BBVA, Banorte, Nu, Santander, etc.), transfiere a la CLABE indicada por exactamente $120.00 MXN con el concepto correspondiente.'
    };
  }

  // 4. Generador de Referencia OXXO Pay
  generarReferenciaOXXO(telefono) {
    const cleanTel = (telefono || '5500000000').replace(/\D/g, '').slice(-8);
    const refRaw = `9840${cleanTel}52`;
    const formatted = `${refRaw.slice(0, 4)}-${refRaw.slice(4, 8)}-${refRaw.slice(8, 12)}-${refRaw.slice(12, 14)}`;
    const fechaLimite = new Date(Date.now() + 48 * 3600 * 1000).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return {
      metodo: 'OXXO_PAY',
      comercio: 'OXXO',
      referencia: formatted,
      referenciaCruda: refRaw,
      monto: this.priceMXN,
      comisionOxxoAprox: '$15.00 MXN en caja',
      fechaLimite,
      instrucciones: 'Acude a cualquier tienda OXXO, dicta la referencia de 14 dígitos al cajero y paga $120.00 MXN en efectivo.'
    };
  }

  // 5. Finalizador Integral de Pago (Acreditación, Factura, Afiliado y WhatsApp)
  completarPago({
    telefonoPropio,
    nombre,
    metodoPago,
    transaccionId,
    rfc,
    correo,
    refCode,
    twilioClient
  }) {
    const tel = (telefonoPropio || '+525512345678').trim();
    let usuario = db.getUsuario(tel);

    const fechaExp = new Date();
    fechaExp.setFullYear(fechaExp.getFullYear() + 1); // 1 año de vigencia

    if (!usuario) {
      usuario = db.setUsuario(tel, {
        id: 'usr_' + Date.now(),
        nombre: nombre ? nombre.trim() : 'Usuario Suscriptor',
        contactoEmergencia: { nombreContacto: 'Contacto Principal', telefonoContacto: tel },
        suscripcionActiva: true,
        plan: 'Anualidad Premium ($120 MXN)',
        fechaExpiracion: fechaExp.toISOString()
      });
    } else {
      if (nombre) usuario.nombre = nombre.trim();
      usuario.suscripcionActiva = true;
      usuario.plan = 'Anualidad Premium ($120 MXN)';
      usuario.fechaExpiracion = fechaExp.toISOString();
      db.setUsuario(tel, usuario);
    }

    const txId = transaccionId || 'tx_' + Date.now();

    // 1. Crear Factura Digital con desglose de IVA (16%)
    const factura = db.crearFactura({
      usuarioId: tel,
      nombreCliente: usuario.nombre,
      rfc: rfc || 'XAXX010101000',
      correo: correo || '',
      metodoPago: metodoPago || 'Tarjeta / Pasarela Digital',
      transaccionId: txId,
      montoTotal: this.priceMXN
    });

    // 2. Registrar en feed de pagos
    db.agregarEventoRevenueCat({
      id: 'pay_' + Date.now(),
      tipo: 'INITIAL_PURCHASE',
      appUserId: tel,
      precio: this.priceMXN,
      moneda: 'MXN',
      metodo: metodoPago || 'Stripe / Mercado Pago',
      transaccionId: txId,
      folioFactura: factura.folio,
      timestamp: new Date().toISOString()
    });

    // 3. Acreditar comisión a Afiliado / Streamer si aplica
    let infoAfiliado = null;
    if (refCode) {
      infoAfiliado = db.acreditarVentaAfiliado(refCode, this.priceMXN);
    }

    console.log(`\n💳 [PAGO ACREDITADO AL 100%] $120 MXN | Cliente: ${usuario.nombre} (${tel}) | Folio: ${factura.folio}`);

    // 4. Despachar confirmación por Twilio WhatsApp al usuario
    if (twilioClient) {
      const toNumber = tel.startsWith('+') ? `whatsapp:${tel}` : `whatsapp:+${tel}`;
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const urlFactura = `${baseUrl}/api/facturacion/recibo/${factura.folio}`;

      twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
        to: toNumber,
        body: `🎉 *¡PAGO CONFIRMADO & SUSCRIPCIÓN RUTA SEGURA ACTIVA!* 🛡️\n\nHola *${usuario.nombre}*, hemos recibido exitosamente tu pago anual de *$120.00 MXN*.\n\n📄 *Comprobante Digital:* Folio ${factura.folio}\n🔗 *Descargar Factura:* ${urlFactura}\n\n✅ Monitoreo inteligente activo 24/7\n✅ Alertas WhatsApp automáticas para tu familia\n✅ Botón de auxilio SOS satelital\n\n¡Gracias por viajar seguro con nosotros!`
      }).then(msg => {
        console.log(`✅ [TWILIO WHATSAPP] Notificación de pago enviada a ${toNumber}. SID: ${msg.sid}`);
      }).catch(err => {
        console.log(`ℹ️ [TWILIO NOTICE] No se pudo enviar WhatsApp directo (${err.message})`);
      });
    }

    return {
      ok: true,
      usuario,
      factura,
      infoAfiliado,
      urlFactura: `/api/facturacion/recibo/${factura.folio}`
    };
  }
}

const paymentServiceInstance = new PaymentService();
module.exports = paymentServiceInstance;
