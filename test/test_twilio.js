/**
 * SCRIPT DE PRUEBA RÁPIDA DE TWILIO - RUTA SEGURA
 * Ejecuta: node test/test_twilio.js [+numero_con_lada]
 * Ejemplo: node test/test_twilio.js +525512345678
 */

require('dotenv').config();
const twilio = require('twilio');

async function testTwilioConnection() {
  console.log('====================================================');
  console.log('📱 DIAGNÓSTICO Y PRUEBA DE TWILIO / WHATSAPP');
  console.log('====================================================\n');

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  const targetPhone = process.argv[2] || '+525512345678';

  console.log(`🔍 Verificando variables de entorno en .env:`);
  console.log(`- TWILIO_ACCOUNT_SID: ${accountSid ? (accountSid.startsWith('AC') ? accountSid.substring(0, 8) + '...' : '⚠️ SID inválido (debe iniciar con AC)') : '❌ No configurado'}`);
  console.log(`- TWILIO_AUTH_TOKEN: ${authToken ? (authToken.includes('mock') ? '⚠️ Token de prueba (mock)' : '••••••••' + authToken.slice(-4)) : '❌ No configurado'}`);
  console.log(`- TWILIO_WHATSAPP_NUMBER: ${fromNumber}`);
  console.log(`- Destinatario de prueba: ${targetPhone}\n`);

  if (!accountSid || !authToken || accountSid.includes('mock') || authToken.includes('mock')) {
    console.log('ℹ️ Twilio se encuentra actualmente en MODO SIMULACIÓN.');
    console.log('Para enviar mensajes reales a tu WhatsApp:');
    console.log('1. Abre tu archivo .env');
    console.log('2. Coloca tu TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN');
    console.log('3. Vuelve a ejecutar: node test/test_twilio.js ' + targetPhone);
    console.log('\n====================================================');
    return;
  }

  try {
    console.log('🚀 Conectando con los servidores de Twilio...');
    const client = twilio(accountSid, authToken);

    const to = targetPhone.startsWith('whatsapp:') ? targetPhone : `whatsapp:${targetPhone}`;

    console.log(`📤 Enviando mensaje de prueba a: ${to} desde ${fromNumber}...`);
    
    const message = await client.messages.create({
      from: fromNumber,
      to: to,
      body: `🚨 *PRUEBA DE ALERTA - RUTA SEGURA*\n\n¡Felicidades! La conexión entre tu servidor y Twilio funciona al 100%.\n\n📍 *Ubicación*: https://maps.google.com/?q=19.432608,-99.133209\n🕒 *Hora*: ${new Date().toLocaleTimeString('es-MX')}\n🛡️ *Estado*: Sistema de Monitoreo Activo.`
    });

    console.log('\n🎉 ¡MENSAJE ENVIADO CON ÉXITO!');
    console.log(`- Message SID: ${message.sid}`);
    console.log(`- Estado: ${message.status}`);
    console.log(`- Fecha: ${message.dateCreated}`);
    console.log('\nRevisa tu WhatsApp para verificar la llegada de la alerta.');
  } catch (error) {
    console.error('\n❌ ERROR AL ENVIAR MENSAJE VÍA TWILIO:');
    console.error(`- Código: ${error.code || 'N/A'}`);
    console.error(`- Mensaje: ${error.message}`);
    if (error.code === 21608 || error.message?.includes('Sandbox')) {
      console.log('\n💡 RECORDATORIO DE SANDBOX:');
      console.log('Si estás usando el Sandbox de Twilio WhatsApp, primero debes enviar el mensaje de activación (ej: "join <palabra>") desde tu teléfono al número ' + fromNumber);
    }
  }

  console.log('\n====================================================');
}

testTwilioConnection();
