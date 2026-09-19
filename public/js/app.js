/**
 * RUTA SEGURA - FRONTEND ENGINE & SIMULATOR
 * Architecture: Modular State Management, Leaflet Dark Maps, Web Audio Synth, Twilio/WhatsApp Mock & RevenueCat Webhooks
 */

// ==========================================
// 1. AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  }

  playSosAlarm() {
    if (!this.enabled) return;
    try {
      this.init();
      let step = 0;
      const interval = setInterval(() => {
        this.playTone(step % 2 === 0 ? 880 : 660, 'sawtooth', 0.18, 0.25);
        step++;
        if (step >= 6) clearInterval(interval);
      }, 200);
    } catch (e) {}
  }

  playWhatsappPing() {
    this.playTone(587.33, 'triangle', 0.1, 0.15);
    setTimeout(() => this.playTone(880, 'triangle', 0.2, 0.2), 120);
  }

  playSafeJingle() {
    this.playTone(523.25, 'sine', 0.12, 0.15); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.12, 0.15), 130); // E5
    setTimeout(() => this.playTone(783.99, 'sine', 0.25, 0.18), 260); // G5
  }

  playClick() {
    this.playTone(1200, 'sine', 0.04, 0.05);
  }
}

const sfx = new SoundFX();

// ==========================================
// 2. PRESET ROUTES (CDMX REAL COORDINATES)
// ==========================================
const PRESET_ROUTES = {
  reforma_polanco: {
    nombre: 'Paseo de la Reforma ➔ Polanco (Oficinas)',
    distanciaAprox: '4.2 km',
    tiempoAprox: '18 min',
    coordenadas: [
      { lat: 19.432608, lng: -99.133209, name: 'Zócalo / Centro' },
      { lat: 19.435211, lng: -99.141258, name: 'Bellas Artes' },
      { lat: 19.430045, lng: -99.155421, name: 'Monumento a la Revolución' },
      { lat: 19.427025, lng: -99.167682, name: 'Ángel de la Independencia' },
      { lat: 19.424108, lng: -99.175489, name: 'Diana Cazadora' },
      { lat: 19.420854, lng: -99.182412, name: 'Torre Mayor / Chapultepec' },
      { lat: 19.429381, lng: -99.191244, name: 'Campos Elíseos' },
      { lat: 19.433892, lng: -99.200115, name: 'Polanco (Masaryk)' }
    ]
  },
  condesa_coyoacan: {
    nombre: 'Parque México (Condesa) ➔ Centro de Coyoacán',
    distanciaAprox: '7.8 km',
    tiempoAprox: '28 min',
    coordenadas: [
      { lat: 19.412431, lng: -99.169124, name: 'Parque México (Condesa)' },
      { lat: 19.405128, lng: -99.167812, name: 'Metro Chilpancingo' },
      { lat: 19.390541, lng: -99.165214, name: 'Insurgentes Sur / Nápoles' },
      { lat: 19.375412, lng: -99.178912, name: 'Manacar / Mixcoac' },
      { lat: 19.354128, lng: -99.162489, name: 'Viveros de Coyoacán' },
      { lat: 19.349812, lng: -99.161042, name: 'Jardín Centenario (Coyoacán)' }
    ]
  },
  insurgentes_santafe: {
    nombre: 'Insurgentes ➔ Centro Comercial Santa Fe',
    distanciaAprox: '12.4 km',
    tiempoAprox: '42 min',
    coordenadas: [
      { lat: 19.398412, lng: -99.172412, name: 'WTC México' },
      { lat: 19.380124, lng: -99.195412, name: 'Periférico Poniente' },
      { lat: 19.368142, lng: -99.224151, name: 'Supervía Poniente' },
      { lat: 19.362145, lng: -99.261245, name: 'Puerta Santa Fe' },
      { lat: 19.359812, lng: -99.274152, name: 'Centro Santa Fe' }
    ]
  }
};

// ==========================================
// 3. GLOBAL APP STATE
// ==========================================
const AppState = {
  user: {
    nombre: 'Sofía Martínez',
    telefono: '+525512345678',
    contacto: {
      nombre: 'Bertha (Mamá)',
      telefono: '+525598765432'
    },
    suscripcionActiva: true,
    plan: 'Bimestral ($120 MXN)'
  },
  trip: {
    activo: false,
    rutaSeleccionada: 'reforma_polanco',
    puntos: [],
    indicePuntoActual: 0,
    intervaloId: null,
    enDetencionSimulada: false,
    tiempoDetenidoSegundos: 0,
    distanciaRecorridaMetros: 0,
    horaInicio: null,
    velocidadKmh: 35,
    bateriaNivel: 94
  },
  map: null,
  userMarker: null,
  routePolyline: null,
  historyPolyline: null,
  sosMarkers: []
};

// ==========================================
// 4. MAP INITIALIZATION (LEAFLET DARK MODE)
// ==========================================
function initLeafletMap() {
  const mapElement = document.getElementById('leaflet-map');
  if (!mapElement) return;

  // Centro inicial: CDMX
  AppState.map = L.map('leaflet-map', {
    zoomControl: true,
    attributionControl: false
  }).setView([19.432608, -99.133209], 13);

  // Tiles Oscuros Modernos (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(AppState.map);

  // Icono Personalizado para el Usuario
  const userIcon = L.divIcon({
    className: 'custom-user-marker',
    html: `
      <div style="position:relative; width:28px; height:28px;">
        <div style="position:absolute; inset:-8px; background:rgba(99,102,241,0.35); border-radius:50%; animation:pulse-ring 1.8s infinite;"></div>
        <div style="width:28px; height:28px; background:#6366f1; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 15px #6366f1; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;">
          🚗
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const coords = PRESET_ROUTES[AppState.trip.rutaSeleccionada].coordenadas[0];
  AppState.userMarker = L.marker([coords.lat, coords.lng], { icon: userIcon }).addTo(AppState.map);

  dibujarRutaPlanificada(AppState.trip.rutaSeleccionada);
}

function dibujarRutaPlanificada(rutaKey) {
  const ruta = PRESET_ROUTES[rutaKey];
  if (!ruta || !AppState.map) return;

  if (AppState.routePolyline) {
    AppState.map.removeLayer(AppState.routePolyline);
  }
  if (AppState.historyPolyline) {
    AppState.map.removeLayer(AppState.historyPolyline);
  }

  const latlngs = ruta.coordenadas.map(c => [c.lat, c.lng]);
  AppState.routePolyline = L.polyline(latlngs, {
    color: 'rgba(99, 102, 241, 0.45)',
    weight: 5,
    dashArray: '8, 8',
    smoothFactor: 1
  }).addTo(AppState.map);

  AppState.historyPolyline = L.polyline([], {
    color: '#10b981',
    weight: 6,
    smoothFactor: 1
  }).addTo(AppState.map);

  AppState.map.fitBounds(AppState.routePolyline.getBounds(), { padding: [40, 40] });
}

// ==========================================
// 5. TRIP ENGINE & HAVERSINE TELEMETRY
// ==========================================
function iniciarViaje() {
  if (AppState.trip.activo) return;

  sfx.playSafeJingle();
  AppState.trip.activo = true;
  AppState.trip.indicePuntoActual = 0;
  AppState.trip.distanciaRecorridaMetros = 0;
  AppState.trip.horaInicio = Date.now();
  AppState.trip.enDetencionSimulada = false;
  AppState.trip.tiempoDetenidoSegundos = 0;

  const ruta = PRESET_ROUTES[AppState.trip.rutaSeleccionada];
  AppState.trip.puntos = ruta.coordenadas;

  // Actualizar UI Mobile y Botones
  actualizarUIViajeActivo(true);
  showToast('🛡️ Monitoreo de Ruta Segura Activado con éxito.', 'safe');

  // Enviar primer punto al backend
  enviarPuntoABackend(AppState.trip.puntos[0]);

  // Intervalo de avance de telemetría GPS
  clearInterval(AppState.trip.intervaloId);
  AppState.trip.intervaloId = setInterval(() => {
    cicloTelemetriaGPS();
  }, 2500);
}

function detenerViaje(llegoASalvo = true) {
  AppState.trip.activo = false;
  clearInterval(AppState.trip.intervaloId);
  actualizarUIViajeActivo(false);

  if (llegoASalvo) {
    sfx.playSafeJingle();
    const punto = AppState.trip.puntos[AppState.trip.indicePuntoActual] || AppState.trip.puntos[0];

    fetch('/api/llegada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefonoPropio: AppState.user.telefono,
        latitud: punto.lat,
        longitud: punto.lng
      })
    })
      .then(res => res.json())
      .then(data => {
        console.log('Llegada confirmada:', data);
        agregarMensajeWhatsApp({
          tipo: 'LLEGADA_A_SALVO',
          titulo: '✅ Llegada Confirmada',
          mensaje: `Hola *${AppState.user.contacto.nombre}*, *${AppState.user.nombre}* ha confirmado su llegada a salvo a su destino. ¡Monitoreo concluido!`,
          lat: punto.lat,
          lng: punto.lng,
          hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        });
        showToast('✅ ¡Llegada confirmada! Tus contactos fueron notificados.', 'safe');
      });
  }
}

function cicloTelemetriaGPS() {
  if (!AppState.trip.activo) return;

  const ruta = AppState.trip.puntos;

  if (AppState.trip.enDetencionSimulada) {
    // Modo de Detención Sospechosa Simulada (< 20 metros)
    AppState.trip.tiempoDetenidoSegundos += 45; // Acelerar el reloj para demostración
    const puntoActual = ruta[AppState.trip.indicePuntoActual];
    AppState.trip.velocidadKmh = 0;

    document.getElementById('live-speed-val').textContent = '0 km/h (Detenido)';
    document.getElementById('mobile-trip-status').innerHTML = `⚠️ <span style="color:#f59e0b;">Detenido hace ${(AppState.trip.tiempoDetenidoSegundos / 60).toFixed(1)} min</span>`;

    // Enviar la misma coordenada repetidamente al backend
    enviarPuntoABackend(puntoActual);

    if (AppState.trip.tiempoDetenidoSegundos >= 180) {
      // 3 Minutos cumplidos -> Se dispara alerta de detención sospechosa
      sfx.playSosAlarm();
      showToast('🚨 ALERTA: Detención prolongada de más de 3 minutos detectada.', 'danger');
    }
    return;
  }

  // Movimiento Normal
  if (AppState.trip.indicePuntoActual < ruta.length - 1) {
    AppState.trip.indicePuntoActual++;
    const nuevoPunto = ruta[AppState.trip.indicePuntoActual];
    AppState.trip.velocidadKmh = Math.floor(Math.random() * 20) + 30; // 30-50 km/h

    // Mover marcador en el mapa
    AppState.userMarker.setLatLng([nuevoPunto.lat, nuevoPunto.lng]);
    AppState.historyPolyline.addLatLng([nuevoPunto.lat, nuevoPunto.lng]);
    AppState.map.panTo([nuevoPunto.lat, nuevoPunto.lng], { animate: true, duration: 1 });

    // Drenar batería levemente para realismo
    AppState.trip.bateriaNivel = Math.max(2, AppState.trip.bateriaNivel - 0.2);

    enviarPuntoABackend(nuevoPunto);
  } else {
    // Llegó al final de la ruta
    detenerViaje(true);
  }
}

function enviarPuntoABackend(punto) {
  fetch('/ubicacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telefonoPropio: AppState.user.telefono,
      latitud: punto.lat,
      longitud: punto.lng,
      bateria: Math.round(AppState.trip.bateriaNivel),
      velocidad: AppState.trip.velocidadKmh,
      timestamp: Date.now()
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        AppState.trip.distanciaRecorridaMetros = data.distanciaTotal || AppState.trip.distanciaRecorridaMetros;
        actualizarTelemetriaUI(punto, data);

        if (data.alertaDisparada && data.detalleAlerta) {
          sfx.playSosAlarm();
          agregarMensajeWhatsApp({
            tipo: data.detalleAlerta.tipo,
            titulo: data.detalleAlerta.titulo,
            mensaje: data.detalleAlerta.mensaje,
            lat: data.detalleAlerta.latitud,
            lng: data.detalleAlerta.longitud,
            hora: data.detalleAlerta.horaLegible
          });
        }
      } else if (data.bloqueadoPorPaywall) {
        showToast('🔒 Monitoreo pausado: Se requiere suscripción activa ($120 MXN cada 2 meses).', 'warning');
      }
    })
    .catch(err => console.error('Error enviando telemetría:', err));
}

// ==========================================
// 6. SOS EMERGENCY PANIC TRIGGER
// ==========================================
function detonarBotonPanico() {
  sfx.playSosAlarm();
  const punto = (AppState.trip.puntos && AppState.trip.puntos[AppState.trip.indicePuntoActual]) || {
    lat: 19.432608,
    lng: -99.133209
  };

  // Efecto Visual Flash
  document.body.classList.add('sos-flashing-active');
  setTimeout(() => document.body.classList.remove('sos-flashing-active'), 4000);

  fetch('/api/panico', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telefonoPropio: AppState.user.telefono,
      latitud: punto.lat,
      longitud: punto.lng,
      bateria: Math.round(AppState.trip.bateriaNivel)
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok && data.alerta) {
        showToast('🆘 ¡ALERTA SOS ENVIADA A CONTACTOS DE EMERGENCIA!', 'danger');

        // Agregar Pin Rojo en el Mapa
        if (AppState.map) {
          const sosIcon = L.divIcon({
            className: 'sos-pin-pulse',
            html: `
              <div style="position:relative; width:34px; height:34px;">
                <div style="position:absolute; inset:-10px; background:rgba(239,68,68,0.5); border-radius:50%; animation:pulse-ring 1s infinite;"></div>
                <div style="width:34px; height:34px; background:#ef4444; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 25px #ef4444; display:flex; align-items:center; justify-content:center; color:#fff; font-size:16px;">
                  🆘
                </div>
              </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          const marker = L.marker([punto.lat, punto.lng], { icon: sosIcon }).addTo(AppState.map);
          marker.bindPopup(`<b>🆘 AUXILIO SOS ACTIVADO</b><br>Usuario: ${AppState.user.nombre}<br>Hora: ${data.alerta.horaLegible}`).openPopup();
          AppState.sosMarkers.push(marker);
        }

        // Despachar en simulador WhatsApp
        agregarMensajeWhatsApp({
          tipo: 'PANICO_SOS',
          titulo: '🚨 BOTÓN DE PÁNICO ACTIVADO',
          mensaje: data.alerta.mensaje,
          lat: data.alerta.latitud,
          lng: data.alerta.longitud,
          hora: data.alerta.horaLegible
        });
      }
    });
}

// ==========================================
// 7. WHATSAPP / TWILIO DISPATCH SIMULATOR
// ==========================================
function agregarMensajeWhatsApp({ tipo, titulo, mensaje, lat, lng, hora }) {
  sfx.playWhatsappPing();
  const chatBody = document.getElementById('whatsapp-chat-body');
  if (!chatBody) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble bubble-received`;

  if (tipo === 'PANICO_SOS') bubble.classList.add('bubble-alert-sos');
  else if (tipo === 'DETENCION_SOSPECHOSA') bubble.classList.add('bubble-alert-stopped');
  else if (tipo === 'LLEGADA_A_SALVO') bubble.classList.add('bubble-alert-safe');

  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

  bubble.innerHTML = `
    <div style="font-weight:800; font-size:0.85rem; margin-bottom:0.3rem;">${titulo}</div>
    <div style="white-space: pre-wrap;">${mensaje.replace(/\*(.*?)\*/g, '<strong>$1</strong>')}</div>
    <div style="margin-top: 0.5rem;">
      <a href="${mapsUrl}" target="_blank" class="bubble-map-link" onclick="event.preventDefault(); window.AppState.map.setView([${lat}, ${lng}], 16);">
        📍 Ver ubicación en Google Maps
      </a>
    </div>
    <div class="bubble-time">${hora || 'Ahora'} • Entregado vía Twilio WhatsApp</div>
  `;

  chatBody.appendChild(bubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  // Registrar en el log global de eventos
  registrarEventoLog({
    tipo: tipo,
    descripcion: `${titulo} despachado a ${AppState.user.contacto.nombre} (${AppState.user.contacto.telefono})`,
    badgeClass: tipo === 'PANICO_SOS' ? 'badge-panic' : (tipo === 'LLEGADA_A_SALVO' ? 'badge-purchase' : 'badge-telemetry')
  });
}

function registrarEventoLog({ tipo, descripcion, badgeClass }) {
  const container = document.getElementById('events-log-container');
  if (!container) return;

  const item = document.createElement('div');
  item.className = 'event-log-item';
  item.innerHTML = `
    <span class="event-badge ${badgeClass}">${tipo}</span>
    <div style="flex:1;">
      <div>${descripcion}</div>
      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">${new Date().toLocaleTimeString()}</div>
    </div>
  `;
  container.prepend(item);
}

// ==========================================
// 8. REVENUECAT WEBHOOK SIMULATOR
// ==========================================
function simularWebhookRevenueCat(tipoEvento) {
  sfx.playClick();
  const payload = {
    event: {
      type: tipoEvento,
      app_user_id: AppState.user.telefono,
      subscriber_id: AppState.user.telefono,
      product_id: 'ruta_segura_bimestral_120',
      price_in_purchased_currency: 120,
      currency: 'MXN',
      period_type: 'BIMONTHLY'
    }
  };

  fetch('/webhook-revenuecat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      if (tipoEvento === 'INITIAL_PURCHASE' || tipoEvento === 'RENEWAL') {
        AppState.user.suscripcionActiva = true;
        AppState.user.plan = 'Bimestral Premium ($120 MXN)';
        sfx.playSafeJingle();
        showToast('💳 ¡Suscripción activada con éxito vía RevenueCat ($120 MXN / 2 meses)!', 'safe');
      } else {
        AppState.user.suscripcionActiva = false;
        AppState.user.plan = 'Expirado';
        showToast('⚠️ Suscripción cancelada / expirada en RevenueCat.', 'warning');
      }
      actualizarEstadoSuscripcionUI();
      registrarEventoLog({
        tipo: `RC_${tipoEvento}`,
        descripcion: `Webhook de RevenueCat procesado ($120 MXN / 2 meses - ${AppState.user.nombre})`,
        badgeClass: 'badge-purchase'
      });
    });
}

// ==========================================
// 9. FINANCIAL CALCULATOR ENGINE ($120 MXN CADA 2 MESES = $720 MXN/AÑO)
// ==========================================
function calcularModeloFinanciero() {
  const reachEl = document.getElementById('calc-reach');
  if (!reachEl) return;
  const reach = parseInt(reachEl.value, 10);
  const convRate = parseFloat(document.getElementById('calc-conversion').value) / 100;
  const price = parseFloat(document.getElementById('calc-price').value);
  const costPerUser = parseFloat(document.getElementById('calc-cost').value);
  const churn = parseFloat(document.getElementById('calc-churn').value) / 100;

  // Actualizar etiquetas de valores de los sliders
  document.getElementById('val-reach').textContent = reach.toLocaleString('es-MX') + ' personas';
  document.getElementById('val-conversion').textContent = (convRate * 100).toFixed(1) + '%';
  document.getElementById('val-price').textContent = '$' + price + ' MXN / 2 meses';
  document.getElementById('val-cost').textContent = '$' + costPerUser + ' MXN';
  document.getElementById('val-churn').textContent = (churn * 100).toFixed(0) + '%';

  // Cálculos (6 ciclos de facturación bimestral al año)
  const usuariosPagos = Math.round(reach * convRate);
  const usuariosRetenidos = Math.round(usuariosPagos * (1 - churn));
  const ciclosPorAno = 6;
  const ingresoBruto = usuariosRetenidos * price * ciclosPorAno;
  const comisionTiendas = ingresoBruto * 0.15; // Apple / Google 15% Small Business
  const costoTwilioInfra = usuariosRetenidos * costPerUser * ciclosPorAno;
  const utilidadNeta = ingresoBruto - comisionTiendas - costoTwilioInfra;
  const margenNeto = ingresoBruto > 0 ? (utilidadNeta / ingresoBruto) * 100 : 0;
  const utilidadUSD = utilidadNeta / 18.0; // Tipo de cambio estimado

  // Render en tarjetas
  document.getElementById('res-paying-users').textContent = usuariosRetenidos.toLocaleString('es-MX');
  document.getElementById('res-gross-revenue').textContent = '$' + Math.round(ingresoBruto).toLocaleString('es-MX') + ' MXN';
  document.getElementById('res-net-profit').textContent = '$' + Math.round(utilidadNeta).toLocaleString('es-MX') + ' MXN';
  document.getElementById('res-net-usd').textContent = '≈ $' + Math.round(utilidadUSD).toLocaleString('en-US') + ' USD / año';
  document.getElementById('res-margin').textContent = margenNeto.toFixed(1) + '% margen neto';
  document.getElementById('res-infra-cost').textContent = '-$' + Math.round(costoTwilioInfra).toLocaleString('es-MX') + ' MXN';
  document.getElementById('res-store-fees').textContent = '-$' + Math.round(comisionTiendas).toLocaleString('es-MX') + ' MXN';
}

// ==========================================
// 10. UI HELPERS & SCREEN CONTROLLERS
// ==========================================
function switchTab(tabId) {
  sfx.playClick();
  document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const activeTab = document.getElementById(tabId);
  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);

  if (activeTab) activeTab.classList.add('active');
  if (activeBtn) activeBtn.classList.add('active');

  if (tabId === 'tab-simulator' && AppState.map) {
    setTimeout(() => AppState.map.invalidateSize(), 200);
  }
}

function switchMobileScreen(screenId) {
  sfx.playClick();
  document.querySelectorAll('.native-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.phone-nav-item').forEach(b => b.classList.remove('active'));

  const screen = document.getElementById(screenId);
  const navBtn = document.querySelector(`[data-mobile-screen="${screenId}"]`);

  if (screen) screen.classList.add('active');
  if (navBtn) navBtn.classList.add('active');
}

function actualizarUIViajeActivo(activo) {
  const btnStart = document.getElementById('btn-start-trip');
  const btnStop = document.getElementById('btn-stop-trip');
  const btnSimStop = document.getElementById('btn-sim-stop');
  const mobileBanner = document.getElementById('mobile-active-trip-banner');
  const mobileStartBtn = document.getElementById('mobile-btn-start');

  if (activo) {
    if (btnStart) btnStart.style.display = 'none';
    if (btnStop) btnStop.style.display = 'inline-flex';
    if (btnSimStop) btnSimStop.style.display = 'inline-flex';
    if (mobileBanner) mobileBanner.style.display = 'block';
    if (mobileStartBtn) mobileStartBtn.textContent = 'En Ruta Segura (Activo)';
    switchMobileScreen('screen-active-trip');
  } else {
    if (btnStart) btnStart.style.display = 'inline-flex';
    if (btnStop) btnStop.style.display = 'none';
    if (btnSimStop) btnSimStop.style.display = 'none';
    if (mobileBanner) mobileBanner.style.display = 'none';
    if (mobileStartBtn) mobileStartBtn.textContent = '🛡️ Iniciar Ruta Segura';
  }
}

function actualizarTelemetriaUI(punto, resBackend) {
  const distKm = (AppState.trip.distanciaRecorridaMetros / 1000).toFixed(2);
  const speed = AppState.trip.velocidadKmh;
  const bat = Math.round(AppState.trip.bateriaNivel);

  document.getElementById('live-distance-val').textContent = `${distKm} km`;
  document.getElementById('live-speed-val').textContent = `${speed} km/h`;
  document.getElementById('live-battery-val').textContent = `${bat}%`;
  document.getElementById('phone-battery-bar').textContent = `${bat}% 🔋`;
  document.getElementById('mobile-dist-text').textContent = `${distKm} km`;
  document.getElementById('mobile-speed-text').textContent = `${speed} km/h`;
}

function actualizarEstadoSuscripcionUI() {
  const badge = document.getElementById('sub-status-badge');
  const planText = document.getElementById('user-plan-name');
  if (AppState.user.suscripcionActiva) {
    if (badge) {
      badge.textContent = 'Suscripción Activa ($120 MXN / 2 meses)';
      badge.style.color = '#10b981';
      badge.style.borderColor = 'rgba(16,185,129,0.4)';
    }
    if (planText) planText.textContent = 'Bimestral Premium ($120 MXN)';
  } else {
    if (badge) {
      badge.textContent = 'Suscripción Inactiva / Expirada';
      badge.style.color = '#ef4444';
      badge.style.borderColor = 'rgba(239,68,68,0.4)';
    }
    if (planText) planText.textContent = 'Plan Gratuito (Alertas Desactivadas)';
  }
}

function showToast(msg, type = 'info') {
  let toast = document.getElementById('toast-box');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-box';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }

  let icon = 'ℹ️';
  if (type === 'safe') icon = '✅';
  else if (type === 'danger') icon = '🚨';
  else if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span style="font-size:1.2rem;">${icon}</span> <span>${msg}</span>`;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3800);
}

// ==========================================
// 11. INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initLeafletMap();
  calcularModeloFinanciero();
  actualizarEstadoSuscripcionUI();

  // Tab Switching
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // Mobile Bottom Bar Navigation
  document.querySelectorAll('.phone-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const screenId = item.getAttribute('data-mobile-screen');
      if (screenId) switchMobileScreen(screenId);
    });
  });

  // Trip Route Selector
  const routeSelect = document.getElementById('select-route-preset');
  if (routeSelect) {
    routeSelect.addEventListener('change', e => {
      AppState.trip.rutaSeleccionada = e.target.value;
      dibujarRutaPlanificada(e.target.value);
    });
  }

  // Trip Control Buttons
  const btnStart = document.getElementById('btn-start-trip');
  if (btnStart) btnStart.addEventListener('click', iniciarViaje);

  const mobileBtnStart = document.getElementById('mobile-btn-start');
  if (mobileBtnStart) mobileBtnStart.addEventListener('click', iniciarViaje);

  const btnStop = document.getElementById('btn-stop-trip');
  if (btnStop) btnStop.addEventListener('click', () => detenerViaje(true));

  const mobileBtnArrival = document.getElementById('mobile-btn-arrival');
  if (mobileBtnArrival) mobileBtnArrival.addEventListener('click', () => detenerViaje(true));

  // Simulated 3-min stop trigger
  const btnSimStop = document.getElementById('btn-sim-stop');
  if (btnSimStop) {
    btnSimStop.addEventListener('click', () => {
      sfx.playClick();
      AppState.trip.enDetencionSimulada = !AppState.trip.enDetencionSimulada;
      if (AppState.trip.enDetencionSimulada) {
        btnSimStop.textContent = '▶️ Reanudar Movimiento';
        btnSimStop.style.background = '#f59e0b';
        showToast('⚠️ Detención anómala iniciada: El cronómetro de seguridad ha empezado a contar.', 'warning');
      } else {
        btnSimStop.textContent = '⏱️ Simular Detención (+3 min)';
        btnSimStop.style.background = '';
        AppState.trip.tiempoDetenidoSegundos = 0;
        showToast('✅ Movimiento restablecido.', 'safe');
      }
    });
  }

  // SOS Panic Triggers
  const btnSosMain = document.getElementById('btn-sos-main');
  if (btnSosMain) btnSosMain.addEventListener('click', detonarBotonPanico);

  const btnSosWeb = document.getElementById('btn-sos-web');
  if (btnSosWeb) btnSosWeb.addEventListener('click', detonarBotonPanico);

  // Financial Calculator Slider Listeners
  ['calc-reach', 'calc-conversion', 'calc-price', 'calc-cost', 'calc-churn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calcularModeloFinanciero);
  });

  // Sound Toggle
  const btnSound = document.getElementById('btn-toggle-sound');
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      sfx.enabled = !sfx.enabled;
      btnSound.innerHTML = sfx.enabled ? '🔊' : '🔇';
      btnSound.title = sfx.enabled ? 'Sonido Activado' : 'Sonido Silenciado';
    });
  }

  // User Profile Form
  const userForm = document.getElementById('user-settings-form');
  if (userForm) {
    userForm.addEventListener('submit', e => {
      e.preventDefault();
      const consentCheck = document.getElementById('ck-legal-consent');
      if (consentCheck && !consentCheck.checked) {
        showToast('⚠️ Debes aceptar los Términos y el Aviso de Privacidad para el tratamiento de tu ubicación.', 'danger');
        return;
      }

      const nombre = document.getElementById('input-user-name').value;
      const telPropio = document.getElementById('input-user-phone').value;
      const nombreContacto = document.getElementById('input-contact-name').value;
      const telContacto = document.getElementById('input-contact-phone').value;

      fetch('/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          telefonoPropio: telPropio,
          nombreContacto,
          telefonoContacto: telContacto,
          suscripcionActiva: AppState.user.suscripcionActiva,
          consentimientoLegal: true
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            AppState.user.nombre = nombre;
            AppState.user.telefono = telPropio;
            AppState.user.contacto = { nombre: nombreContacto, telefono: telContacto };
            document.getElementById('mobile-display-name').textContent = nombre;
            document.getElementById('whatsapp-target-name').textContent = nombreContacto;
            document.getElementById('whatsapp-target-phone').textContent = telContacto;
            showToast('👤 Perfil, contacto y consentimiento legal guardados con éxito.', 'safe');
          } else {
            showToast(`❌ Error: ${data.error || 'No se pudo guardar'}`, 'danger');
          }
        })
        .catch(err => {
          showToast(`❌ Error de conexión: ${err.message}`, 'danger');
        });
    });
  }

  // Cargar facturas y afiliados al iniciar
  recargarFacturasUI();
  recargarMetricasAdmin();

  // Polling backend status every 10 seconds
  setInterval(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(status => {
        if (status.ok) {
          const statusBadge = document.getElementById('system-status-indicator');
          if (statusBadge) statusBadge.textContent = `Backend Online • ${status.usuariosRegistrados} Usuarios • ${status.viajesActivosCount} Viajes`;
        }
      })
      .catch(() => {});
  }, 10000);
});

// ==========================================
// 12. CHECKOUT & FACTURACIÓN FISCAL ENGINE
// ==========================================
let checkoutState = {
  metodoSeleccionado: 'tarjeta',
  montoOriginal: 120,
  montoFinal: 120,
  cuponAplicado: null,
  refAfiliado: null
};

function abrirModalCheckout() {
  sfx.playClick();
  const backdrop = document.getElementById('checkout-modal-backdrop');
  if (!backdrop) return;

  // Cargar datos actuales de usuario
  const telInput = document.getElementById('ck-telefono');
  const nomInput = document.getElementById('ck-nombre');
  if (telInput && AppState.user.telefono) telInput.value = AppState.user.telefono;
  if (nomInput && AppState.user.nombre) nomInput.value = AppState.user.nombre;

  // Extraer ?ref= de la URL si existe
  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get('ref');
  if (refParam) {
    checkoutState.refAfiliado = refParam;
    console.log(`🔗 [AFILIADOS] Referido detectado en URL: @${refParam}`);
    fetch('/api/afiliados/visita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: refParam })
    }).catch(() => {});
  }

  // Cargar referencias SPEI y OXXO
  cargarDatosSPEIyOXXO(AppState.user.telefono || '+525512345678');

  // Resetear vista
  const form = document.getElementById('checkout-form');
  const successView = document.getElementById('checkout-success-view');
  if (form) form.style.display = 'block';
  if (successView) successView.style.display = 'none';

  backdrop.style.display = 'flex';
}

function cerrarModalCheckout() {
  sfx.playClick();
  const backdrop = document.getElementById('checkout-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function seleccionarMetodoPago(metodo) {
  sfx.playClick();
  checkoutState.metodoSeleccionado = metodo;
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-method') === metodo);
  });
  document.querySelectorAll('.pay-method-view').forEach(view => {
    view.classList.toggle('active', view.id === `pay-view-${metodo}`);
  });
}

function toggleDatosFiscales(checked) {
  const container = document.getElementById('fiscal-fields-container');
  if (container) container.style.display = checked ? 'block' : 'none';
}

function cargarDatosSPEIyOXXO(telefono) {
  fetch('/api/checkout/spei', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefonoPropio: telefono })
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok && data.datos) {
        const clabeSpan = document.getElementById('spei-clabe-display');
        const conceptoSpan = document.getElementById('spei-concepto-display');
        if (clabeSpan) clabeSpan.textContent = data.datos.clabe;
        if (conceptoSpan) conceptoSpan.textContent = data.datos.concepto;
      }
    }).catch(() => {});

  fetch('/api/checkout/oxxo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefonoPropio: telefono })
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok && data.datos) {
        const oxxoSpan = document.getElementById('oxxo-ref-display');
        if (oxxoSpan) oxxoSpan.textContent = data.datos.referencia;
      }
    }).catch(() => {});
}

function aplicarCuponCheckout() {
  const input = document.getElementById('ck-cupon');
  const feedback = document.getElementById('ck-cupon-feedback');
  if (!input || !input.value.trim()) return;

  const codigo = input.value.trim().toUpperCase();
  fetch('/api/cupon/validar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo })
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok && data.cupon) {
        checkoutState.cuponAplicado = data.cupon;
        checkoutState.montoFinal = data.cupon.precioFinal;

        const subtotal = Number((data.cupon.precioFinal / 1.16).toFixed(2));
        const iva = Number((data.cupon.precioFinal - subtotal).toFixed(2));

        document.getElementById('order-subtotal-val').textContent = `$${subtotal.toFixed(2)} MXN`;
        document.getElementById('order-iva-val').textContent = `$${iva.toFixed(2)} MXN`;
        document.getElementById('order-total-val').textContent = `$${data.cupon.precioFinal.toFixed(2)} MXN`;
        document.getElementById('btn-pay-amount').textContent = `$${data.cupon.precioFinal.toFixed(2)} MXN`;

        const discountLine = document.getElementById('order-discount-line');
        const discountVal = document.getElementById('order-discount-val');
        if (discountLine && discountVal) {
          discountLine.style.display = 'flex';
          discountVal.textContent = `-${data.cupon.descuentoPorcentaje}% ($${(120 - data.cupon.precioFinal).toFixed(2)} MXN)`;
        }

        if (feedback) {
          feedback.textContent = `✅ Cupón aplicado: ${data.cupon.descripcion}`;
          feedback.style.color = '#10b981';
        }
        showToast(`🎉 ¡Cupón aplicado! Nuevo total: $${data.cupon.precioFinal} MXN`, 'safe');
      } else {
        if (feedback) {
          feedback.textContent = '❌ Cupón inválido o expirado';
          feedback.style.color = '#ef4444';
        }
      }
    })
    .catch(() => {
      if (feedback) {
        feedback.textContent = 'Error al verificar cupón';
        feedback.style.color = '#ef4444';
      }
    });
}

function procesarPagoCheckout(e) {
  if (e) e.preventDefault();
  sfx.playClick();

  const nombre = document.getElementById('ck-nombre').value.trim();
  const telefono = document.getElementById('ck-telefono').value.trim();
  const correo = document.getElementById('ck-correo').value.trim();
  const requiereFactura = document.getElementById('ck-toggle-factura')?.checked;
  const rfc = requiereFactura ? document.getElementById('ck-rfc')?.value.trim() : 'XAXX010101000';
  const razonSocial = requiereFactura ? document.getElementById('ck-razon-social')?.value.trim() : nombre;
  const cupon = checkoutState.cuponAplicado ? checkoutState.cuponAplicado.codigo : null;
  const metodo = checkoutState.metodoSeleccionado;

  const btnSubmit = document.getElementById('btn-submit-payment');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando Cobro Seguro...';
  }

  // 1. Si eligió Tarjeta (Stripe Checkout)
  if (metodo === 'tarjeta') {
    fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefonoPropio: telefono,
        nombre,
        cupon,
        ref: checkoutState.refAfiliado
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.url) {
          if (data.modo === 'STRIPE_LIVE') {
            showToast('Redirigiendo a pasarela segura de Stripe...', 'info');
            window.location.href = data.url;
            return;
          }
          activarSuscripcionLocal({ telefono, nombre, correo, metodo: 'Stripe Tarjeta / Apple Pay', cupon, rfc, razonSocial, btnSubmit });
        } else {
          activarSuscripcionLocal({ telefono, nombre, correo, metodo: 'Stripe Tarjeta', cupon, rfc, razonSocial, btnSubmit });
        }
      })
      .catch(() => activarSuscripcionLocal({ telefono, nombre, correo, metodo: 'Stripe Tarjeta', cupon, rfc, razonSocial, btnSubmit }));
    return;
  }

  // 2. Si eligió Mercado Pago
  if (metodo === 'mercadopago') {
    fetch('/api/mercadopago/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefonoPropio: telefono,
        nombre,
        cupon,
        ref: checkoutState.refAfiliado
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.url && data.modo === 'MP_LIVE') {
          showToast('Redirigiendo a pasarela segura de Mercado Pago...', 'info');
          window.location.href = data.url;
          return;
        }
        activarSuscripcionLocal({ telefono, nombre, correo, metodo: 'Mercado Pago (OXXO/SPEI)', cupon, rfc, razonSocial, btnSubmit });
      })
      .catch(() => activarSuscripcionLocal({ telefono, nombre, correo, metodo: 'Mercado Pago', cupon, rfc, razonSocial, btnSubmit }));
    return;
  }

  // 3. Si eligió SPEI, OXXO o Directo
  activarSuscripcionLocal({ telefono, nombre, correo, metodo: `Pasarela ${metodo.toUpperCase()}`, cupon, rfc, razonSocial, btnSubmit });
}

function activarSuscripcionLocal({ telefono, nombre, correo, metodo, cupon, rfc, razonSocial, btnSubmit }) {
  fetch('/api/pago-directo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telefonoPropio: telefono,
      nombre,
      correo,
      metodoPago: metodo,
      cupon,
      ref: checkoutState.refAfiliado,
      rfc,
      razonSocial
    })
  })
    .then(r => r.json())
    .then(data => {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fa-solid fa-lock"></i> Confirmar y Pagar <span id="btn-pay-amount">$${checkoutState.montoFinal}.00 MXN</span>`;
      }

      if (data.ok) {
        AppState.user.suscripcionActiva = true;
        AppState.user.plan = `Bimestral Premium ($${checkoutState.montoFinal} MXN)`;
        AppState.user.nombre = nombre;
        AppState.user.telefono = telefono;

        sfx.playSafeJingle();
        showToast('💳 ¡Suscripción de $120 MXN (cada 2 meses) activada con éxito!', 'safe');

        document.getElementById('checkout-form').style.display = 'none';
        const successView = document.getElementById('checkout-success-view');
        if (successView) {
          successView.style.display = 'block';
          const folioSpan = document.getElementById('success-folio-text');
          const invoiceBtn = document.getElementById('btn-view-invoice');
          if (folioSpan) folioSpan.textContent = data.transaccion ? data.transaccion.id : `FAC-${Date.now().toString().slice(-6)}`;
          if (invoiceBtn) invoiceBtn.href = '#';
        }

        actualizarEstadoSuscripcionUI();
        recargarFacturasUI();
        recargarMetricasAdmin();
      } else {
        showToast(`❌ Error: ${data.error || 'Intenta de nuevo'}`, 'danger');
      }
    })
    .catch(err => {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fa-solid fa-lock"></i> Confirmar y Pagar <span id="btn-pay-amount">$${checkoutState.montoFinal}.00 MXN</span>`;
      }
      showToast('❌ Error de red al procesar pago', 'danger');
    });
}

// ==========================================
// 13. REAL GPS TRACKER FOR SMARTPHONES & PWA
// ==========================================
let realGpsWatcherId = null;

function activarGPSNativoReal() {
  sfx.playClick();
  if (!navigator.geolocation) {
    showToast('❌ Tu navegador o dispositivo no soporta geolocalización GPS.', 'danger');
    return;
  }

  switchTab('tab-simulator');
  showToast('🛰️ Solicitando coordenadas satelitales en vivo...', 'info');

  const btnGps = document.getElementById('btn-real-gps');
  if (btnGps) {
    btnGps.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando GPS...';
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude, speed, accuracy } = pos.coords;
      showToast(`📍 Coordenada satelital adquirida (Precisión: ±${Math.round(accuracy)}m)`, 'safe');

      if (btnGps) {
        btnGps.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> GPS Real Conectado';
        btnGps.style.background = '#10b981';
      }

      if (AppState.map) {
        AppState.map.setView([latitude, longitude], 16);
        if (AppState.markerUsuario) {
          AppState.markerUsuario.setLatLng([latitude, longitude]);
        } else if (typeof L !== 'undefined') {
          AppState.markerUsuario = L.marker([latitude, longitude]).addTo(AppState.map);
        }
      }

      iniciarVigilanciaGPSReal();
    },
    err => {
      showToast(`⚠️ Permiso de GPS no concedido (${err.message}). Activa la ubicación en tu navegador.`, 'warning');
      if (btnGps) {
        btnGps.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Reintentar GPS Real';
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function iniciarVigilanciaGPSReal() {
  if (realGpsWatcherId) navigator.geolocation.clearWatch(realGpsWatcherId);

  AppState.trip.activo = true;
  actualizarUIViajeActivo(true);

  realGpsWatcherId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude, speed } = pos.coords;
      if (AppState.markerUsuario) {
        AppState.markerUsuario.setLatLng([latitude, longitude]);
      }
      if (AppState.map) {
        AppState.map.panTo([latitude, longitude]);
      }

      try {
        const res = await fetch('/ubicacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefonoPropio: AppState.user.telefono,
            latitud: latitude,
            longitud: longitude,
            velocidad: speed ? Math.round(speed * 3.6) : 0,
            bateria: AppState.trip.bateriaNivel,
            timestamp: Date.now()
          })
        });
        const data = await res.json();
        if (data.ok) {
          AppState.trip.distanciaRecorridaMetros = data.distanciaTotal || AppState.trip.distanciaRecorridaMetros;
          actualizarTelemetriaUI(pos.coords, data);
          if (data.alertaDisparada && data.detalleAlerta) {
            sfx.playSosAlarm();
            showToast('🚨 ¡Alerta automática de seguridad disparada por detención prolongada!', 'danger');
            if (data.detalleAlerta.enlaceWhatsAppDirecto) {
              const waBtn = document.getElementById('btn-open-wa-direct');
              if (waBtn) {
                waBtn.href = data.detalleAlerta.enlaceWhatsAppDirecto;
                waBtn.style.display = 'inline-flex';
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error telemetría GPS real:', err);
      }
    },
    (err) => console.warn('GPS watcher err:', err),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
  );
}

function recargarFacturasUI() {
  fetch('/api/facturacion/todas')
    .then(r => r.json())
    .then(data => {
      if (!data.ok) return;

      const totalFacturadoEl = document.getElementById('billing-total-facturado');
      const totalIvaEl = document.getElementById('billing-total-iva');
      const totalSuscriptoresEl = document.getElementById('billing-suscriptores-count');
      const tbody = document.getElementById('tbody-facturas');

      if (totalFacturadoEl) totalFacturadoEl.textContent = `$${data.totalFacturadoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;
      if (totalIvaEl) totalIvaEl.textContent = `$${data.totalIvaTrasladadoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;

      if (tbody) {
        if (!data.facturas || data.facturas.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:2rem;">No hay facturas emitidas aún.</td></tr>`;
          return;
        }

        tbody.innerHTML = data.facturas.map(f => `
          <tr>
            <td><strong class="mono" style="color:#6366f1;">${f.folio}</strong></td>
            <td>
              <div style="font-weight:700; color:#fff;">${f.nombreCliente}</div>
              <div style="font-size:0.72rem; color:var(--text-dim);">${f.usuarioId}</div>
            </td>
            <td><span class="mono" style="color:#a5b4fc; background:rgba(99,102,241,0.1); padding:0.15rem 0.4rem; border-radius:4px;">${f.rfc}</span></td>
            <td>$${Number(f.subtotal).toFixed(2)}</td>
            <td style="color:#10b981;">+$${Number(f.iva).toFixed(2)}</td>
            <td><strong>$${Number(f.total).toFixed(2)} MXN</strong></td>
            <td><span style="font-size:0.75rem; color:var(--text-muted);">${f.metodoPago}</span></td>
            <td style="font-size:0.72rem; color:var(--text-dim);">${new Date(f.fecha).toLocaleDateString('es-MX')}</td>
            <td>
              <a href="/api/facturacion/recibo/${f.folio}" target="_blank" class="btn-copy-small" style="text-decoration:none; display:inline-flex; align-items:center; gap:3px;">
                <i class="fa-solid fa-file-invoice"></i> Ver CFDI
              </a>
            </td>
          </tr>
        `).join('');
      }
    })
    .catch(() => {});
}

function recargarMetricasAdmin() {
  fetch('/api/admin/metrics')
    .then(r => r.json())
    .then(data => {
      if (!data.ok || !data.metricas) return;
      const m = data.metricas;
      const countEl = document.getElementById('billing-suscriptores-count');
      const comisionesEl = document.getElementById('billing-comisiones-streamers');
      if (countEl) countEl.textContent = m.suscriptoresActivos;
      if (comisionesEl) comisionesEl.textContent = `$${(m.comisionesAfiliadosMXN || 0).toLocaleString('es-MX')} MXN`;

      // Cargar lista de afiliados
      cargarAfiliadosUI();
    })
    .catch(() => {});
}

function cargarAfiliadosUI() {
  fetch('/api/afiliados')
    .then(r => r.json())
    .then(data => {
      if (!data.ok || !data.afiliados) return;
      const container = document.getElementById('afiliados-list-container');
      if (!container) return;

      container.innerHTML = data.afiliados.map(a => `
        <div class="mobile-card" style="margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:800; font-size:0.88rem; color:#fff;">@${a.id || a.codigo} &bull; ${a.nombre}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              ${a.visitas || 0} visitas &bull; ${a.conversiones || 0} ventas concretadas
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.95rem; font-weight:900; color:#10b981;">+$${a.saldoComisiones || 0} MXN</div>
            <div style="font-size:0.68rem; color:#ec4899; font-weight:700;">30% COMISIÓN</div>
          </div>
        </div>
      `).join('');
    })
    .catch(() => {});
}

function actualizarEnlaceStreamerInput() {
  const input = document.getElementById('input-streamer-code');
  const output = document.getElementById('output-streamer-url');
  if (input && output) {
    const cod = input.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'streamer_safe';
    output.value = `${window.location.origin}/?ref=${cod}`;
  }
}

function copiarEnlaceAfiliado() {
  const output = document.getElementById('output-streamer-url');
  if (output) {
    navigator.clipboard.writeText(output.value).then(() => {
      showToast('📋 ¡Enlace copiado al portapapeles!', 'safe');
    }).catch(() => {
      output.select();
      document.execCommand('copy');
      showToast('📋 ¡Enlace copiado!', 'safe');
    });
  }
}

function copiarTexto(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    const texto = el.textContent.trim();
    navigator.clipboard.writeText(texto).then(() => {
      showToast(`📋 Copiado: ${texto}`, 'safe');
    }).catch(() => {
      showToast(`📋 Copiado`, 'safe');
    });
  }
}

// --- FUNCIONES LEGALES & DERECHOS ARCO (LFPDPPP) ---
function abrirModalARCO() {
  const modal = document.getElementById('arco-modal-backdrop');
  if (modal) {
    modal.style.display = 'flex';
    const telInput = document.getElementById('arco-modal-phone');
    if (telInput && AppState.user.telefono) {
      telInput.value = AppState.user.telefono;
    }
  }
}

function cerrarModalARCO() {
  const modal = document.getElementById('arco-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    const status = document.getElementById('arco-modal-status');
    if (status) status.style.display = 'none';
  }
}

async function enviarSolicitudARCOModal(e) {
  e.preventDefault();
  const tipo = document.getElementById('arco-modal-tipo').value;
  const telefono = document.getElementById('arco-modal-phone').value.trim();
  const motivo = document.getElementById('arco-modal-motivo').value.trim();
  const statusDiv = document.getElementById('arco-modal-status');
  const btn = document.getElementById('btn-submit-arco');

  if (!telefono) {
    showToast('Ingresa tu teléfono registrado para procesar la solicitud.', 'danger');
    return;
  }

  statusDiv.style.display = 'block';
  statusDiv.style.background = 'rgba(6, 182, 212, 0.15)';
  statusDiv.style.border = '1px solid #06b6d4';
  statusDiv.style.color = '#38bdf8';
  statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Transmitiendo y ejecutando solicitud ARCO...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/usuario/arco', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, telefono, motivo })
    });
    const data = await res.json();

    if (data.ok) {
      statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
      statusDiv.style.border = '1px solid #10b981';
      statusDiv.style.color = '#34d399';
      statusDiv.innerHTML = `✅ <strong>Solicitud ${tipo} Ejecutada</strong><br>Folio de Control Legal: <code>${data.folio}</code><br>${tipo === 'CANCELACION' ? 'Todos tus datos y registros telemáticos han sido eliminados de la base de datos de Ruta Segura.' : 'Tu solicitud ha sido registrada y formalizada.'}`;
      showToast(`🛡️ Solicitud ARCO procesada con éxito (Folio: ${data.folio})`, 'safe');
      if (tipo === 'CANCELACION') {
        AppState.user.nombre = 'Usuario';
        AppState.user.telefono = '';
      }
    } else {
      statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
      statusDiv.style.border = '1px solid #ef4444';
      statusDiv.style.color = '#f87171';
      statusDiv.innerHTML = `⚠️ Aviso: ${data.error || 'No se pudo procesar la solicitud con ese número.'}`;
    }
  } catch (err) {
    statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
    statusDiv.style.border = '1px solid #ef4444';
    statusDiv.style.color = '#f87171';
    statusDiv.innerHTML = `❌ Error de red: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

// Expose state globally for browser testing and console access
window.AppState = AppState;
window.simularWebhookRevenueCat = simularWebhookRevenueCat;
window.detonarBotonPanico = detonarBotonPanico;
window.iniciarViaje = iniciarViaje;
window.detenerViaje = detenerViaje;
window.switchTab = switchTab;
window.abrirModalCheckout = abrirModalCheckout;
window.cerrarModalCheckout = cerrarModalCheckout;
window.seleccionarMetodoPago = seleccionarMetodoPago;
window.toggleDatosFiscales = toggleDatosFiscales;
window.aplicarCuponCheckout = aplicarCuponCheckout;
window.procesarPagoCheckout = procesarPagoCheckout;
window.recargarFacturasUI = recargarFacturasUI;
window.actualizarEnlaceStreamerInput = actualizarEnlaceStreamerInput;
window.copiarEnlaceAfiliado = copiarEnlaceAfiliado;
window.copiarTexto = copiarTexto;
window.activarGPSNativoReal = activarGPSNativoReal;
window.abrirModalARCO = abrirModalARCO;
window.cerrarModalARCO = cerrarModalARCO;
window.enviarSolicitudARCOModal = enviarSolicitudARCOModal;


