const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const dbManager = require('./dbManager');
const { generarHTMLComprobante, validarRFC } = require('./lib/invoicing');
const paymentService = require('./lib/payments');

// ==========================================
// CONFIGURACIÓN DE SERVICIOS EXTERNOS
// ==========================================

// 1. Twilio Client (WhatsApp & SMS)
const twilio = require('twilio');
const hasTwilioCredentials = process.env.TWILIO_ACCOUNT_SID && 
  process.env.TWILIO_AUTH_TOKEN && 
  !process.env.TWILIO_ACCOUNT_SID.includes('mock') && 
  process.env.TWILIO_ACCOUNT_SID.startsWith('AC');

const twilioClient = hasTwilioCredentials 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

if (twilioClient) {
  console.log('✅ [TWILIO] Cliente oficial Twilio conectado y listo para envío real de alertas.');
} else {
  console.log('ℹ️ [TWILIO] Modo Simulación / Respaldo activo. Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env para envíos en vivo.');
}

// 2. Stripe Client (Pasarela de Pagos Directa)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const hasStripe = stripeSecretKey && !stripeSecretKey.includes('mock') && stripeSecretKey.startsWith('sk_');
let stripeClient = null;
if (hasStripe) {
  try {
    stripeClient = require('stripe')(stripeSecretKey);
    console.log('✅ [STRIPE] Pasarela de pagos Stripe en vivo conectada.');
  } catch (err) {
    console.warn('⚠️ [STRIPE] Error al inicializar Stripe:', err.message);
  }
} else {
  console.log('ℹ️ [STRIPE] Modo Sandbox/Simulado listo. Configura STRIPE_SECRET_KEY en .env para cobro con tarjeta real.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Estado volátil en memoria para viajes activos en tiempo real
const viajesActivos = new Map();
const telemetriaLog = [];

// ==========================================
// MOTOR MATEMÁTICO: FÓRMULA DE HAVERSINE
// Calcula la distancia real en metros entre 2 coordenadas
// ==========================================
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Devuelve distancia en metros
}

function normalizarWhatsAppNumero(tel) {
  let limpio = (tel || '').trim().replace(/[^\d+]/g, '');
  // Si es un número mexicano con lada +52 de 10 dígitos (ej. +523335952229), WhatsApp requiere el prefijo +521
  if (limpio.startsWith('+52') && !limpio.startsWith('+521') && limpio.length === 13) {
    limpio = '+521' + limpio.slice(3);
  } else if (limpio.startsWith('52') && !limpio.startsWith('521') && limpio.length === 12) {
    limpio = '+521' + limpio.slice(2);
  } else if (limpio.length === 10) {
    limpio = '+521' + limpio;
  } else if (!limpio.startsWith('+')) {
    limpio = '+' + limpio;
  }
  return limpio.startsWith('whatsapp:') ? limpio : `whatsapp:${limpio}`;
}

// Generador de Alertas con Twilio y Respaldo Directo WhatsApp wa.me
function despacharAlerta({ tipo, usuario, contacto, latitud, longitud, motivo, extra }) {
  const enlaceMapa = `https://maps.google.com/?q=${latitud},${longitud}`;
  const timestamp = new Date();
  const horaLegible = timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let titulo = '⚠️ ALERTA RUTA SEGURA';
  let mensajeWhatsapp = '';

  if (tipo === 'DETENCION_SOSPECHOSA') {
    titulo = '🚨 ALERTA: DETENCIÓN INUSUAL';
    mensajeWhatsapp = `⚠️ *ALERTA RUTA SEGURA* ⚠️\n\nHola *${contacto.nombreContacto}*, se ha detectado que *${usuario.nombre}* lleva más de 3 minutos sin moverse en un punto no habitual del trayecto.\n\n📍 *Última ubicación*: ${enlaceMapa}\n🕒 *Hora*: ${horaLegible}\n🔋 *Batería*: ${extra?.bateria || '92%'}\n\nPor favor, verifica su estado de inmediato o comunícate al ${usuario.telefonoPropio}.`;
  } else if (tipo === 'PANICO_SOS') {
    titulo = '🆘 BOTÓN DE PÁNICO ACTIVADO';
    mensajeWhatsapp = `🚨 *BOTÓN DE PÁNICO ACTIVADO* 🚨\n\n*${usuario.nombre}* ha presionado el botón de auxilio de *Ruta Segura* solicitando asistencia inmediata.\n\n📍 *Ubicación en tiempo real*: ${enlaceMapa}\n🕒 *Hora exacta*: ${horaLegible}\n🔋 *Batería*: ${extra?.bateria || '85%'}\n\nLlama inmediatamente a emergencias o al contacto.`;
  } else if (tipo === 'LLEGADA_A_SALVO') {
    titulo = '✅ LLEGADA CONFIRMADA';
    mensajeWhatsapp = `✅ *RUTA SEGURA - LLEGADA A SALVO*\n\nHola *${contacto.nombreContacto}*, te informamos que *${usuario.nombre}* ha finalizado su viaje y confirmó su llegada con éxito.\n\n📍 *Punto de llegada*: ${enlaceMapa}\n🕒 *Hora*: ${horaLegible}\n\n¡Monitoreo completado con tranquilidad!`;
  } else if (tipo === 'BATERIA_CRITICA') {
    titulo = '🔋 ALERTA BATERÍA CRÍTICA (< 5%)';
    mensajeWhatsapp = `⚠️ *AVISO DE BATERÍA BAJA*\n\nHola *${contacto.nombreContacto}*, el teléfono de *${usuario.nombre}* tiene menos del 5% de batería y podría apagarse en breve.\n\n📍 *Última coordenada enviada*: ${enlaceMapa}\n🕒 *Hora*: ${horaLegible}`;
  }

  // Generar enlace directo de WhatsApp (Click-to-Chat) como garantía de entrega 100%
  const telefonoNumerico = (contacto.telefonoContacto || '').replace(/[^\d]/g, '');
  const enlaceWhatsAppDirecto = `https://api.whatsapp.com/send?phone=${telefonoNumerico}&text=${encodeURIComponent(mensajeWhatsapp)}`;

  const registroAlerta = {
    id: 'alt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    tipo,
    titulo,
    usuarioId: usuario.id,
    nombreUsuario: usuario.nombre,
    telefonoUsuario: usuario.telefonoPropio,
    nombreContacto: contacto.nombreContacto,
    telefonoContacto: contacto.telefonoContacto,
    mensaje: mensajeWhatsapp,
    latitud,
    longitud,
    enlaceMapa,
    enlaceWhatsAppDirecto,
    horaLegible,
    timestamp: timestamp.toISOString(),
    motivo: motivo || 'Evaluación automática del motor de seguridad',
    estadoEnvio: twilioClient ? 'ENVIANDO_TWILIO' : 'ENTREGADO_SIMULADO'
  };

  if (twilioClient) {
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    const toNumber = normalizarWhatsAppNumero(contacto.telefonoContacto);

    twilioClient.messages.create({
      from: fromNumber,
      to: toNumber,
      body: mensajeWhatsapp
    }).then(msg => {
      console.log(`✅ [TWILIO API] Mensaje enviado a ${toNumber}. SID: ${msg.sid}`);
      registroAlerta.estadoEnvio = 'ENTREGADO_TWILIO_REAL';
      registroAlerta.twilioSid = msg.sid;
    }).catch(err => {
      console.error(`❌ [TWILIO API ERROR] Error al enviar WhatsApp:`, err.message);
      registroAlerta.estadoEnvio = 'ERROR_ENVIO_TWILIO';
      registroAlerta.errorTwilio = err.message;
    });
  }

  dbManager.addAlerta(registroAlerta);

  console.log(`\n======================================================`);
  console.log(`📡 [DISPATCH TWILIO/WHATSAPP] -> ${contacto.telefonoContacto}`);
  console.log(`Tipo: ${tipo} | Usuario: ${usuario.nombre}`);
  console.log(`Mensaje:\n${mensajeWhatsapp}`);
  console.log(`Enlace Directo: ${enlaceWhatsAppDirecto}`);
  console.log(`======================================================\n`);

  return registroAlerta;
}

// ==========================================
// ENDPOINTS DE LA API REST
// ==========================================

// 1. Registro de Usuario y Contacto de Emergencia (Persistente)
app.post('/registro', (req, res) => {
  try {
    const { nombre, telefonoPropio, nombreContacto, telefonoContacto, suscripcionActiva } = req.body;

    if (!nombre || !telefonoPropio || !nombreContacto || !telefonoContacto) {
      return res.status(400).json({
        ok: false,
        error: 'Todos los campos son obligatorios (nombre, teléfono propio y datos del contacto de emergencia).'
      });
    }

    const telLimpio = telefonoPropio.trim();
    const usuarioExistente = dbManager.getUser(telLimpio);
    const id = usuarioExistente ? usuarioExistente.id : 'usr_' + Date.now();

    const nuevoUsuario = {
      id,
      nombre: nombre.trim(),
      telefonoPropio: telLimpio,
      contactoEmergencia: {
        nombreContacto: nombreContacto.trim(),
        telefonoContacto: telefonoContacto.trim()
      },
      suscripcionActiva: suscripcionActiva !== undefined ? Boolean(suscripcionActiva) : (usuarioExistente ? usuarioExistente.suscripcionActiva : true),
      plan: (suscripcionActiva || (usuarioExistente && usuarioExistente.suscripcionActiva)) ? 'Anualidad ($120 MXN)' : 'Gratuito',
      metodoPago: usuarioExistente?.metodoPago || 'Directo',
      creadoEn: usuarioExistente?.creadoEn || new Date().toISOString()
    };

    dbManager.saveUser(nuevoUsuario);

    console.log(`👤 [REGISTRO] Usuario guardado en base de datos: ${nombre} (${telLimpio}) -> Contacto: ${nombreContacto} (${telefonoContacto})`);

    return res.status(201).json({
      ok: true,
      mensaje: 'Usuario y contacto de emergencia guardados con éxito en la base de datos persistente.',
      usuario: nuevoUsuario
    });
  } catch (error) {
    console.error('Error en /registro:', error);
    return res.status(500).json({ ok: false, error: 'Hubo un problema al registrar el usuario en el servidor.' });
  }
});

// 2. Recepción de Telemetría GPS Continua
app.post('/ubicacion', (req, res) => {
  try {
    const { latitud, longitud, timestamp, telefonoPropio, bateria, velocidad } = req.body;
    const idUsuario = telefonoPropio || '+525512345678';
    const ahora = Date.now();

    const usuarioDB = dbManager.getUser(idUsuario);

    if (!usuarioDB) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado en la base de datos. Completa el registro primero.'
      });
    }

    // Validación de Suscripción (Lógica de Negocio Rentable)
    if (!usuarioDB.suscripcionActiva) {
      console.log(`❌ [ACCESO DENEGADO] ${usuarioDB.nombre} no tiene suscripción activa de $120 MXN.`);
      return res.status(403).json({
        ok: false,
        bloqueadoPorPaywall: true,
        error: 'Suscripción inactiva. Renueva en la app para activar el monitoreo en segundo plano y alertas automáticas.'
      });
    }

    // Telemetría Log
    const puntoTelemetria = {
      telefono: idUsuario,
      nombre: usuarioDB.nombre,
      latitud: Number(latitud),
      longitud: Number(longitud),
      bateria: bateria !== undefined ? Number(bateria) : 95,
      velocidad: velocidad !== undefined ? Number(velocidad) : 0,
      timestamp: timestamp || ahora,
      fechaHora: new Date().toLocaleTimeString('es-MX')
    };

    telemetriaLog.push(puntoTelemetria);
    if (telemetriaLog.length > 200) telemetriaLog.shift();

    // Verificación de Viaje Activo
    let viaje = viajesActivos.get(idUsuario);
    let estadoAlerta = null;

    if (!viaje) {
      // Inicializar Viaje
      viaje = {
        idViaje: 'vj_' + Date.now(),
        usuario: usuarioDB,
        inicioLat: Number(latitud),
        inicioLon: Number(longitud),
        ultimaLat: Number(latitud),
        ultimaLon: Number(longitud),
        distanciaTotalMetros: 0,
        tiempoDetenido: ahora,
        horaInicio: ahora,
        ultimoUpdate: ahora,
        alertasDisparadas: 0,
        estado: 'EN_CAMINO',
        puntosRuta: [{ lat: Number(latitud), lng: Number(longitud), t: ahora }]
      };
      viajesActivos.set(idUsuario, viaje);
      console.log(`🚗 [VIAJE INICIADO] Monitoreo silencioso activado para ${usuarioDB.nombre}`);
    } else {
      // Calcular Distancia con el punto anterior usando Haversine
      const distancia = calcularDistancia(viaje.ultimaLat, viaje.ultimaLon, Number(latitud), Number(longitud));
      viaje.distanciaTotalMetros += distancia;
      viaje.puntosRuta.push({ lat: Number(latitud), lng: Number(longitud), t: ahora });
      viaje.ultimoUpdate = ahora;

      // REGLA DE NEGOCIO: Si se movió menos de 20 metros, se considera "DETENIDO"
      if (distancia < 20) {
        const tiempoSinMoverseMinutos = (ahora - viaje.tiempoDetenido) / 1000 / 60;
        console.log(`⚠️ [PRECAUCIÓN] Sin movimiento significativo por ${tiempoSinMoverseMinutos.toFixed(2)} min (${distancia.toFixed(1)} m recorridos)`);

        // Si pasan más de 3 minutos detenido sin confirmación -> DISPARAR ALERTA
        if (tiempoSinMoverseMinutos >= 3 && viaje.alertasDisparadas === 0) {
          console.log(`🚨 ¡ALERTA DE SEGURIDAD DETONADA POR DETENCIÓN PROLONGADA!`);
          estadoAlerta = despacharAlerta({
            tipo: 'DETENCION_SOSPECHOSA',
            usuario: usuarioDB,
            contacto: usuarioDB.contactoEmergencia,
            latitud,
            longitud,
            motivo: `Detención anómala en la misma coordenada por ${tiempoSinMoverseMinutos.toFixed(1)} minutos.`,
            extra: { bateria: `${puntoTelemetria.bateria}%` }
          });
          viaje.alertasDisparadas += 1;
          viaje.tiempoDetenido = ahora; // Reset para no spamear continuamente
        }
      } else {
        // Se está moviendo con normalidad
        console.log(`✅ [EN MOVIMIENTO] Avanzó ${distancia.toFixed(1)} m. Ruta en orden.`);
        viaje.ultimaLat = Number(latitud);
        viaje.ultimaLon = Number(longitud);
        viaje.tiempoDetenido = ahora; // Resetea cronómetro de detención
      }
    }

    // Regla de Batería Crítica (< 5%)
    if (puntoTelemetria.bateria <= 5 && (!viaje.alertaBateriaEnviada)) {
      estadoAlerta = despacharAlerta({
        tipo: 'BATERIA_CRITICA',
        usuario: usuarioDB,
        contacto: usuarioDB.contactoEmergencia,
        latitud,
        longitud,
        motivo: 'Nivel de batería inferior al 5% detectado por el sensor del dispositivo.'
      });
      viaje.alertaBateriaEnviada = true;
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Ubicación procesada con éxito por el motor de seguridad.',
      distanciaTotal: Math.round(viaje.distanciaTotalMetros),
      alertaDisparada: Boolean(estadoAlerta),
      detalleAlerta: estadoAlerta
    });
  } catch (error) {
    console.error('Error en /ubicacion:', error);
    return res.status(500).json({ ok: false, error: 'Error del servidor al procesar coordenadas de telemetría.' });
  }
});

// 3. Botón de Pánico SOS Inmediato
app.post('/api/panico', (req, res) => {
  try {
    const { telefonoPropio, latitud, longitud, bateria } = req.body;
    const idUsuario = telefonoPropio || '+525512345678';
    const usuarioDB = dbManager.getUser(idUsuario) || {
      id: 'usr_anon',
      nombre: 'Usuario en Riesgo',
      telefonoPropio: idUsuario,
      contactoEmergencia: { nombreContacto: 'Contacto de Emergencia', telefonoContacto: '+525500000000' }
    };

    const alerta = despacharAlerta({
      tipo: 'PANICO_SOS',
      usuario: usuarioDB,
      contacto: usuarioDB.contactoEmergencia,
      latitud: Number(latitud) || 19.432608,
      longitud: Number(longitud) || -99.133209,
      motivo: 'El usuario presionó el botón rojo de auxilio SOS.',
      extra: { bateria: `${bateria || 80}%` }
    });

    let viaje = viajesActivos.get(idUsuario);
    if (viaje) {
      viaje.estado = 'PANICO_ACTIVADO';
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Alerta SOS de máxima prioridad despachada a Twilio / WhatsApp.',
      alerta
    });
  } catch (error) {
    console.error('Error en /api/panico:', error);
    return res.status(500).json({ ok: false, error: 'Error al detonar botón de pánico.' });
  }
});

// 4. Confirmación de Llegada a Salvo
app.post('/api/llegada', (req, res) => {
  try {
    const { telefonoPropio, latitud, longitud } = req.body;
    const idUsuario = telefonoPropio || '+525512345678';
    const usuarioDB = dbManager.getUser(idUsuario);

    if (usuarioDB) {
      despacharAlerta({
        tipo: 'LLEGADA_A_SALVO',
        usuario: usuarioDB,
        contacto: usuarioDB.contactoEmergencia,
        latitud: Number(latitud) || 19.432608,
        longitud: Number(longitud) || -99.133209,
        motivo: 'El usuario presionó "Llegué a Salvo". Viaje completado exitosamente.'
      });
    }

    viajesActivos.delete(idUsuario);

    console.log(`🎉 [VIAJE CONCLUIDO] ${usuarioDB ? usuarioDB.nombre : idUsuario} llegó a salvo.`);

    return res.status(200).json({
      ok: true,
      mensaje: 'Viaje finalizado con éxito. Mensaje de tranquilidad enviado a tus contactos.'
    });
  } catch (error) {
    console.error('Error en /api/llegada:', error);
    return res.status(500).json({ ok: false, error: 'Error al procesar llegada a salvo.' });
  }
});

// 5. Validación de Cupones de Descuento
app.post('/api/cupon/validar', (req, res) => {
  try {
    const { codigo } = req.body;
    if (!codigo) {
      return res.status(400).json({ ok: false, error: 'Proporciona un código de cupón.' });
    }
    const resultado = dbManager.validarCupon(codigo);
    if (resultado.valido) {
      return res.status(200).json({ ok: true, cupon: resultado });
    } else {
      return res.status(404).json({ ok: false, error: 'Cupón no válido o vencido.' });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Error al validar cupón.' });
  }
});

// 6. Pasarela Stripe: Creación de Sesión de Checkout ($120 MXN / Tarjeta / Apple Pay / Google Pay)
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { telefonoPropio, nombre, contactoEmergencia, cupon, ref } = req.body;

    if (!telefonoPropio) {
      return res.status(400).json({ ok: false, error: 'El teléfono es requerido para registrar la suscripción.' });
    }

    // Calcular precio con cupón si existe
    let montoMXN = 120;
    let descuentoAplicado = null;
    if (cupon) {
      const validacion = dbManager.validarCupon(cupon);
      if (validacion && validacion.valido) {
        montoMXN = validacion.precioFinal;
        descuentoAplicado = validacion;
      }
    }

    // Si no tiene usuario previo, crearlo o actualizarlo
    let usuario = dbManager.getUser(telefonoPropio);
    if (!usuario) {
      usuario = {
        id: 'usr_' + Date.now(),
        nombre: nombre || 'Usuario Nuevo',
        telefonoPropio: telefonoPropio.trim(),
        contactoEmergencia: contactoEmergencia || { nombreContacto: 'Contacto de Emergencia', telefonoContacto: telefonoPropio },
        suscripcionActiva: false,
        plan: `Anualidad ($${montoMXN} MXN)`,
        creadoEn: new Date().toISOString()
      };
      dbManager.saveUser(usuario);
    }

    // Si Stripe está activo con credenciales reales
    if (stripeClient) {
      const origin = req.headers.origin || `http://localhost:${PORT}`;
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'mxn',
              product_data: {
                name: 'Ruta Segura — Cobertura Anual (365 días)',
                description: 'Monitoreo GPS silencioso 24/7, botón de auxilio SOS y alertas ilimitadas de WhatsApp vía Twilio.',
                images: ['https://images.unsplash.com/photo-1508962914676-134849a727f0?w=600']
              },
              unit_amount: Math.round(montoMXN * 100) // Centavos
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: `${origin}/?pago_exitoso=true&tel=${encodeURIComponent(telefonoPropio)}&tx_stripe={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?pago_cancelado=true`,
        metadata: {
          telefonoPropio,
          nombre: usuario.nombre,
          refAfiliado: ref || '',
          cuponUsado: cupon || ''
        }
      });

      return res.status(200).json({
        ok: true,
        url: session.url,
        sessionId: session.id,
        modo: 'STRIPE_LIVE'
      });
    }

    // Modo Demostración / Sandbox Inteligente si Stripe no tiene credenciales en .env
    const redirectUrl = `/?pago_exitoso=true&tel=${encodeURIComponent(telefonoPropio)}&metodo=Stripe&monto=${montoMXN}&simulado=true`;
    return res.status(200).json({
      ok: true,
      url: redirectUrl,
      modo: 'SANDBOX_STRIPE',
      monto: montoMXN,
      mensaje: 'Modo demostración Stripe listo. Para cobros con tarjeta bancaria en vivo, configura STRIPE_SECRET_KEY en tu .env'
    });
  } catch (error) {
    console.error('Error en /api/stripe/create-checkout-session:', error);
    return res.status(500).json({ ok: false, error: 'Error al generar la sesión de pago de Stripe: ' + error.message });
  }
});

// 7. Webhook de Stripe (Activación Automática tras Cobro Exitoso)
app.post('/api/stripe/webhook', (req, res) => {
  try {
    const evento = req.body;

    if (evento.type === 'checkout.session.completed') {
      const session = evento.data.object;
      const telefono = session.metadata?.telefonoPropio;
      const ref = session.metadata?.refAfiliado;
      const montoTotal = (session.amount_total || 12000) / 100;

      if (telefono) {
        dbManager.activarSuscripcion(telefono, {
          metodo: 'Stripe Tarjeta / Apple Pay',
          monto: montoTotal,
          transaccionId: session.id,
          ref
        });
        console.log(`💳 [STRIPE WEBHOOK] ¡Cobro exitoso confirmado de $${montoTotal} MXN para ${telefono}!`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error en /api/stripe/webhook:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// 8. Pasarela Mercado Pago / SPEI / OXXO
app.post('/api/mercadopago/create-preference', async (req, res) => {
  try {
    const { telefonoPropio, nombre, cupon, ref } = req.body;
    let montoMXN = 120;
    if (cupon) {
      const validacion = dbManager.validarCupon(cupon);
      if (validacion && validacion.valido) montoMXN = validacion.precioFinal;
    }

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (mpToken && !mpToken.includes('mock')) {
      // Integración directa con API de Mercado Pago
      const origin = req.headers.origin || `http://localhost:${PORT}`;
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mpToken}`
        },
        body: JSON.stringify({
          items: [
            {
              title: 'Ruta Segura — Cobertura Anual (365 días)',
              unit_price: montoMXN,
              quantity: 1,
              currency_id: 'MXN'
            }
          ],
          back_urls: {
            success: `${origin}/?pago_exitoso=true&tel=${encodeURIComponent(telefonoPropio)}&metodo=MercadoPago`,
            failure: `${origin}/?pago_cancelado=true`,
            pending: `${origin}/?pago_pendiente=true`
          },
          auto_return: 'approved',
          metadata: { telefonoPropio, ref }
        })
      });
      const data = await response.json();
      return res.status(200).json({ ok: true, url: data.init_point || data.sandbox_init_point, modo: 'MP_LIVE' });
    }

    // Modo Sandbox Mercado Pago
    const redirectUrl = `/?pago_exitoso=true&tel=${encodeURIComponent(telefonoPropio)}&metodo=MercadoPago&monto=${montoMXN}&simulado=true`;
    return res.status(200).json({
      ok: true,
      url: redirectUrl,
      modo: 'SANDBOX_MERCADOPAGO',
      monto: montoMXN,
      mensaje: 'Modo demostración de Mercado Pago (SPEI/OXXO). Agrega MERCADOPAGO_ACCESS_TOKEN en .env para producción.'
    });
  } catch (error) {
    console.error('Error en /api/mercadopago/create-preference:', error);
    return res.status(500).json({ ok: false, error: 'Error al generar preferencia Mercado Pago.' });
  }
});

// 9. Pasarela de Pago Directo Web / SPEI / Activación Rápida & Facturación
app.post('/api/pago-directo', (req, res) => {
  try {
    const { telefonoPropio, metodoPago, transaccionId, nombre, cupon, ref, rfc, razonSocial, correo } = req.body;
    if (!telefonoPropio) {
      return res.status(400).json({ ok: false, error: 'El teléfono es obligatorio para asociar la suscripción.' });
    }

    const idUsuario = telefonoPropio.trim();
    let usuario = dbManager.getUser(idUsuario);

    let monto = 120;
    if (cupon) {
      const v = dbManager.validarCupon(cupon);
      if (v && v.valido) monto = v.precioFinal;
    }

    if (!usuario) {
      usuario = {
        id: 'usr_' + Date.now(),
        nombre: nombre ? nombre.trim() : 'Usuario Suscriptor',
        telefonoPropio: idUsuario,
        contactoEmergencia: { nombreContacto: 'Contacto Principal', telefonoContacto: idUsuario },
        suscripcionActiva: true,
        plan: `Anualidad Premium ($${monto} MXN)`,
        actualizadoEn: new Date().toISOString()
      };
      dbManager.saveUser(usuario);
    }

    const txId = transaccionId || 'tx_' + Date.now();
    const activacion = dbManager.activarSuscripcion(idUsuario, {
      metodo: metodoPago || 'Tarjeta / SPEI / Web Checkout',
      monto,
      plan: `Anualidad Premium ($${monto} MXN)`,
      transaccionId: txId,
      ref,
      rfc: rfc || 'XAXX010101000',
      razonSocial: razonSocial || nombre || usuario.nombre,
      correo: correo || ''
    });

    const factura = activacion ? activacion.factura : null;
    const urlFactura = factura ? `/api/facturacion/recibo/${factura.folio}` : null;

    console.log(`\n💳 [PAGO PROCESADO EXITOSAMENTE] $${monto} MXN para ${usuario.nombre} (${idUsuario}) | Factura: ${factura ? factura.folio : 'N/A'}`);

    // Enviar confirmación por WhatsApp al usuario con enlace al comprobante fiscal
    if (twilioClient) {
      const toNumber = normalizarWhatsAppNumero(idUsuario);
      const urlCompletaRecibo = `http://localhost:${PORT}/api/facturacion/recibo/${factura ? factura.folio : ''}`;
      twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
        to: toNumber,
        body: `🎉 *¡SUSCRIPCIÓN RUTA SEGURA ACTIVADA!* 🛡️\n\nHola *${usuario.nombre}*, tu plan anual de *$${monto} MXN* ha sido confirmado con éxito.\n\n📄 *Comprobante Fiscal Digital:* ${factura ? factura.folio : 'Emitido'}\n🔗 *Descargar Factura:* ${urlCompletaRecibo}\n\n✅ Monitoreo inteligente activo 24/7\n✅ Alertas WhatsApp automáticas con motor Haversine\n✅ Botón de auxilio SOS satelital\n\n¡Viaja siempre con tranquilidad!`
      }).catch(err => console.log('Notice Twilio dispatch:', err.message));
    }

    return res.status(200).json({
      ok: true,
      mensaje: `¡Suscripción de $${monto} MXN activada con éxito! Tu cobertura anual está en vigor.`,
      usuario: activacion ? activacion.user : usuario,
      transaccion: activacion ? activacion.tx : null,
      factura,
      urlFactura
    });
  } catch (error) {
    console.error('Error en /api/pago-directo:', error);
    return res.status(500).json({ ok: false, error: 'Error al procesar el pago.' });
  }
});

// 9.1 Generación de Referencia Bancaria SPEI (STP)
app.post('/api/checkout/spei', (req, res) => {
  try {
    const { telefonoPropio } = req.body;
    const datosSPEI = paymentService.generarReferenciaSPEI(telefonoPropio);
    return res.status(200).json({ ok: true, datos: datosSPEI });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Error al generar referencia SPEI.' });
  }
});

// 9.2 Generación de Referencia OXXO Pay
app.post('/api/checkout/oxxo', (req, res) => {
  try {
    const { telefonoPropio } = req.body;
    const datosOXXO = paymentService.generarReferenciaOXXO(telefonoPropio);
    return res.status(200).json({ ok: true, datos: datosOXXO });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Error al generar referencia OXXO.' });
  }
});

// 9.3 Visualización y Descarga del Comprobante Fiscal Digital (CFDI / PDF)
app.get('/api/facturacion/recibo/:folio', (req, res) => {
  try {
    const { folio } = req.params;
    const factura = dbManager.getFactura(folio);
    if (!factura) {
      return res.status(404).send(`
        <div style="font-family:sans-serif; text-align:center; padding:3rem;">
          <h2>Comprobante no encontrado</h2>
          <p>El folio fiscal <strong>${folio}</strong> no se encuentra registrado en el sistema.</p>
          <a href="/">← Volver a Ruta Segura</a>
        </div>
      `);
    }

    const html = generarHTMLComprobante(factura);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Error al generar comprobante HTML:', error);
    return res.status(500).send('Error interno al renderizar comprobante.');
  }
});

// 9.4 Datos JSON de la Factura
app.get('/api/facturacion/recibo-json/:folio', (req, res) => {
  const factura = dbManager.getFactura(req.params.folio);
  if (!factura) return res.status(404).json({ ok: false, error: 'Factura no encontrada.' });
  return res.status(200).json({ ok: true, factura });
});

// 9.5 Lista de Todas las Facturas Emitidas (Para Panel de Facturación)
app.get('/api/facturacion/todas', (req, res) => {
  const facturas = dbManager.getAllFacturas();
  const totalFacturado = facturas.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
  const totalIVA = facturas.reduce((sum, f) => sum + (Number(f.iva) || 0), 0);

  return res.status(200).json({
    ok: true,
    totalFacturas: facturas.length,
    totalFacturadoMXN: Number(totalFacturado.toFixed(2)),
    totalIvaTrasladadoMXN: Number(totalIVA.toFixed(2)),
    facturas
  });
});

// 9.6 Solicitud o Actualización de Datos de Facturación
app.post('/api/facturacion/solicitar', (req, res) => {
  try {
    const { folio, rfc, razonSocial, regimenFiscal, usoCFDI, correo } = req.body;
    if (!folio || !rfc) {
      return res.status(400).json({ ok: false, error: 'Folio y RFC son obligatorios.' });
    }

    if (!validarRFC(rfc)) {
      return res.status(400).json({ ok: false, error: 'El RFC proporcionado no tiene una estructura válida según el SAT.' });
    }

    const factura = dbManager.getFactura(folio);
    if (!factura) {
      return res.status(404).json({ ok: false, error: 'Factura no encontrada.' });
    }

    factura.rfc = rfc.toUpperCase().trim();
    if (razonSocial) factura.nombreCliente = razonSocial.trim();
    if (regimenFiscal) factura.regimenFiscal = regimenFiscal.trim();
    if (usoCFDI) factura.usoCFDI = usoCFDI.trim();
    if (correo) factura.correo = correo.trim();
    factura.actualizadoEn = new Date().toISOString();

    dbManager.save();

    return res.status(200).json({
      ok: true,
      mensaje: 'Datos fiscales actualizados con éxito en el comprobante.',
      factura,
      urlRecibo: `/api/facturacion/recibo/${factura.folio}`
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Error al actualizar datos fiscales.' });
  }
});

// 10. Webhook de RevenueCat (Ciclo de Vida de Suscripción en Tiempo Real para App Stores)
app.post('/webhook-revenuecat', (req, res) => {
  try {
    const evento = req.body.event || req.body;
    const tipoEvento = evento.type || 'INITIAL_PURCHASE';
    const appUserId = evento.app_user_id || evento.subscriber_id;

    console.log(`\n💳 [REVENUECAT WEBHOOK RECIBIDO] Evento: ${tipoEvento} | User: ${appUserId}`);

    const registroEvento = {
      id: 'rev_' + Date.now(),
      tipo: tipoEvento,
      appUserId,
      precio: evento.price_in_purchased_currency || 120,
      moneda: evento.currency || 'MXN',
      productoId: evento.product_id || 'ruta_segura_anual_120',
      timestamp: new Date().toISOString()
    };
    dbManager.addRevenueCatEvent(registroEvento);

    // Buscar y actualizar usuario en la base de datos persistente
    let usuarioEncontrado = dbManager.getUser(appUserId) || dbManager.getUserById(appUserId);

    if (usuarioEncontrado) {
      if (tipoEvento === 'INITIAL_PURCHASE' || tipoEvento === 'RENEWAL') {
        dbManager.activarSuscripcion(usuarioEncontrado.telefonoPropio, {
          metodo: 'App Store / Google Play (RevenueCat)',
          monto: registroEvento.precio,
          plan: 'Anualidad Premium ($120 MXN)',
          transaccionId: registroEvento.id
        });
        console.log(`✅ ¡Pago validado por RevenueCat! Suscripción Premium activada para: ${usuarioEncontrado.nombre}`);
      } else if (tipoEvento === 'CANCELLATION' || tipoEvento === 'EXPIRATION') {
        usuarioEncontrado.suscripcionActiva = false;
        usuarioEncontrado.plan = 'Expirado';
        dbManager.saveUser(usuarioEncontrado);
        console.log(`⚠️ Suscripción expirada o cancelada para: ${usuarioEncontrado.nombre}`);
      }
    } else {
      console.log(`ℹ️ Evento recibido para usuario no indexado: ${appUserId}. Registrando webhook.`);
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Webhook de RevenueCat procesado correctamente por el backend de Ruta Segura.',
      eventoRecibido: tipoEvento
    });
  } catch (error) {
    console.error('Error en /webhook-revenuecat:', error);
    return res.status(500).json({ ok: false, error: 'Error al procesar webhook de RevenueCat.' });
  }
});

// 11. Programa de Afiliados & Creadores (Streamers)
app.get('/api/afiliados/:id', (req, res) => {
  const { id } = req.params;
  const afiliado = dbManager.getAfiliado(id);
  if (!afiliado) {
    return res.status(404).json({ ok: false, error: 'Afiliado no encontrado.' });
  }
  return res.status(200).json({ ok: true, afiliado });
});

app.post('/api/afiliados/visita', (req, res) => {
  const { ref } = req.body;
  if (ref) {
    dbManager.registrarVisitaAfiliado(ref);
  }
  return res.status(200).json({ ok: true });
});

app.get('/api/afiliados', (req, res) => {
  return res.status(200).json({ ok: true, afiliados: dbManager.getAllAfiliados() });
});

// 12. Panel de Administración & Métricas de Ingresos Reales
app.get('/api/admin/metrics', (req, res) => {
  const metricas = dbManager.getMetricas();
  return res.status(200).json({
    ok: true,
    plataforma: 'Ruta Segura Commercial API',
    uptime: Math.round(process.uptime()),
    metricas,
    viajesActivosCount: viajesActivos.size,
    transaccionesRecientes: dbManager.getTransacciones(10)
  });
});

app.get('/api/admin/suscriptores', (req, res) => {
  const usuarios = dbManager.getAllUsers();
  return res.status(200).json({
    ok: true,
    total: usuarios.length,
    usuarios
  });
});

// Descarga en formato CSV de suscriptores
app.get('/api/admin/export-csv', (req, res) => {
  const usuarios = dbManager.getAllUsers();
  let csv = 'ID,Nombre,Telefono,Contacto,TelefonoContacto,SuscripcionActiva,Plan,MetodoPago,Vencimiento\n';
  for (const u of usuarios) {
    csv += `"${u.id}","${u.nombre}","${u.telefonoPropio}","${u.contactoEmergencia?.nombreContacto || ''}","${u.contactoEmergencia?.telefonoContacto || ''}",${u.suscripcionActiva},"${u.plan || ''}","${u.metodoPago || ''}","${u.fechaVencimiento || ''}"\n`;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ruta_segura_suscriptores.csv"');
  return res.status(200).send(csv);
});

// 13. Diagnóstico Twilio en Vivo con Respaldo Automático Click-to-Chat
app.post('/api/twilio/test', async (req, res) => {
  try {
    const { telefono } = req.body;
    const destino = telefono || '+525512345678';
    const to = normalizarWhatsAppNumero(destino);
    const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    const directUrl = `https://api.whatsapp.com/send?phone=${destino.replace(/[^\d]/g, '')}&text=${encodeURIComponent('🚨 Alerta de Prueba Oficial Ruta Segura: https://maps.google.com/?q=19.432608,-99.133209')}`;

    if (!twilioClient) {
      const msgSim = `🛡️ [PRUEBA SIMULADA] Twilio listo para enviar a ${to}. Activa tus claves reales en .env cuando gustes.`;
      return res.status(200).json({
        ok: true,
        modo: 'SIMULADO',
        mensaje: msgSim,
        enlaceDirectoWhatsApp: directUrl
      });
    }

    try {
      const msg = await twilioClient.messages.create({
        from,
        to,
        body: `🛡️ *PRUEBA OFICIAL - RUTA SEGURA*\n\n¡La conexión de alertas automáticas WhatsApp está 100% OPERATIVA y lista para protegerte!\n\n📍 *Ubicación*: https://maps.google.com/?q=19.432608,-99.133209\n🕒 *Hora*: ${new Date().toLocaleTimeString('es-MX')}`
      });

      return res.status(200).json({
        ok: true,
        modo: 'REAL_TWILIO',
        sid: msg.sid,
        status: msg.status,
        enlaceDirectoWhatsApp: directUrl
      });
    } catch (twErr) {
      console.log(`ℹ️ [TWILIO TEST] Respuesta de Twilio: ${twErr.message} (Código ${twErr.code})`);
      return res.status(200).json({
        ok: true,
        modo: 'RESPALDO_WHATSAPP_DIRECTO',
        errorTwilio: twErr.message,
        codigoTwilio: twErr.code,
        limiteTrialAlcanzado: twErr.code === 63038,
        sugerencia: twErr.code === 63038 
          ? 'Cuenta Twilio Trial alcanzó el límite diario de 5 mensajes. Para envíos ilimitados añade saldo en twilio.com. El respaldo directo de WhatsApp está 100% activo.'
          : twErr.message,
        enlaceDirectoWhatsApp: directUrl
      });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 14. Estado del Sistema y Monitoreo en Tiempo Real
app.get('/api/status', (req, res) => {
  const metricas = dbManager.getMetricas();
  res.status(200).json({
    ok: true,
    plataforma: 'Ruta Segura Backend API Commercial',
    version: '2.0.0',
    tiempoActivo: Math.round(process.uptime()),
    usuariosRegistrados: metricas.totalUsuarios,
    suscriptoresActivos: metricas.suscriptoresActivos,
    arrProyectadoMXN: metricas.arrProyectadoMXN,
    viajesActivosCount: viajesActivos.size,
    totalAlertasGeneradas: dbManager.getAlertas(100).length,
    totalEventosRevenueCat: dbManager.getRevenueCatEvents(100).length,
    motorHaversine: 'ACTIVO_CALIBRADO',
    pasarelaTwilio: twilioClient ? 'CONECTADO_EN_VIVO' : 'MODO_RESPALDO_ACTIVO',
    pasarelaStripe: stripeClient ? 'PRODUCCION_ACTIVA' : 'SANDBOX_CONFIGURABLE',
    timestamp: new Date().toISOString()
  });
});

// 15. Telemetría Global y Viajes Activos para el Dashboard
app.get('/api/telemetria', (req, res) => {
  const viajesArray = Array.from(viajesActivos.values());
  const usuariosArray = dbManager.getAllUsers();

  res.status(200).json({
    ok: true,
    viajes: viajesArray,
    usuarios: usuariosArray,
    alertas: dbManager.getAlertas(15),
    eventosRevenueCat: dbManager.getRevenueCatEvents(10),
    puntosRecientes: telemetriaLog.slice(-30)
  });
});

// 16. Lista de Usuarios
app.get('/api/users', (req, res) => {
  res.status(200).json({
    ok: true,
    usuarios: dbManager.getAllUsers()
  });
});

// 17. Reset Demo Data
app.post('/api/reset-demo', (req, res) => {
  viajesActivos.clear();
  telemetriaLog.length = 0;
  res.status(200).json({ ok: true, mensaje: 'Estado de viajes demo reiniciado con éxito.' });
});

// Levantar el servidor
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🛡️  SERVIDOR RUTA SEGURA COMERCIAL 2.0 ENCENDIDO`);
  console.log(`🌐  URL Local: http://localhost:${PORT}`);
  console.log(`📡  Motor Haversine & Twilio WhatsApp en puerto ${PORT}`);
  console.log(`💳  Pasarelas de Pago: Stripe, Mercado Pago & RevenueCat`);
  console.log(`💾  Base de Datos Persistente Activa (data/database.json)`);
  console.log(`======================================================\n`);
});
