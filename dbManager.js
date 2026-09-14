const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const TMP_FILE = path.join(DATA_DIR, 'database.json.tmp');

// Asegurar que el directorio data exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Datos semilla por defecto
const DEFAULT_DATA = {
  usuarios: [
    {
      id: 'usr_admin',
      nombre: 'Usuario Administrador',
      telefonoPropio: '+523335952229',
      contactoEmergencia: {
        nombreContacto: 'Contacto de Emergencia',
        telefonoContacto: '+523335952229'
      },
      suscripcionActiva: true,
      plan: 'Anualidad Premium ($120 MXN)',
      metodoPago: 'Sistema / Directo',
      fechaInicio: new Date().toISOString(),
      fechaVencimiento: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      creadoEn: new Date().toISOString()
    },
    {
      id: 'usr_1',
      nombre: 'Sofía Martínez',
      telefonoPropio: '+525512345678',
      contactoEmergencia: {
        nombreContacto: 'Bertha (Mamá)',
        telefonoContacto: '+523335952229'
      },
      suscripcionActiva: true,
      plan: 'Anualidad ($120 MXN)',
      metodoPago: 'Stripe Checkout',
      fechaInicio: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      fechaVencimiento: new Date(Date.now() + 335 * 24 * 3600 * 1000).toISOString(),
      creadoEn: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_2',
      nombre: 'Carlos Ramírez',
      telefonoPropio: '+525599887766',
      contactoEmergencia: {
        nombreContacto: 'Karen (Esposa)',
        telefonoContacto: '+525544332211'
      },
      suscripcionActiva: false,
      plan: 'Gratuito (Sin alertas)',
      metodoPago: 'Pendiente',
      creadoEn: new Date().toISOString()
    }
  ],
  transacciones: [
    {
      id: 'tx_init_01',
      usuarioId: 'usr_1',
      telefono: '+525512345678',
      nombre: 'Sofía Martínez',
      monto: 120,
      moneda: 'MXN',
      metodo: 'Stripe / Tarjeta',
      estado: 'COMPLETADO',
      timestamp: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    }
  ],
  cupones: {
    'STREAMER30': { codigo: 'STREAMER30', descuentoPorcentaje: 30, precioFinal: 84, descripcion: '30% Descuento Especial para Streamers' },
    'SEGURA20': { codigo: 'SEGURA20', descuentoPorcentaje: 20, precioFinal: 96, descripcion: '20% Descuento de Lanzamiento' },
    'FAMILIA': { codigo: 'FAMILIA', descuentoPorcentaje: 17.5, precioFinal: 99, descripcion: 'Tarifa Familiar Especial' },
    'RUTA2026': { codigo: 'RUTA2026', descuentoPorcentaje: 25, precioFinal: 90, descripcion: 'Promoción Anual 2026' }
  },
  afiliados: {
    'streamer_demo': {
      id: 'streamer_demo',
      nombre: 'Carlos Streamer',
      canal: 'Twitch / Kick',
      visitas: 142,
      conversiones: 8,
      comisionPorVenta: 36, // 30% de $120
      saldoComisiones: 288,
      creadoEn: new Date().toISOString()
    }
  },
  facturas: [
    {
      folio: 'FAC-2026-0001',
      uuid: 'cfdi_8a49c21b-1726284000',
      usuarioId: '+525512345678',
      nombreCliente: 'Sofía Martínez',
      rfc: 'XAXX010101000',
      regimenFiscal: '616 - Sin obligaciones fiscales',
      usoCFDI: 'S01 - Sin efectos fiscales',
      correo: 'sofia.martinez@gmail.com',
      concepto: 'Suscripción Anual Plataforma Ruta Segura (12 meses)',
      claveSAT: '43232605',
      subtotal: 103.45,
      iva: 16.55,
      total: 120.00,
      moneda: 'MXN',
      metodoPago: 'Stripe / Tarjeta de Débito',
      transaccionId: 'tx_init_01',
      fecha: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      estado: 'PAGADA_Y_TIMBRADA'
    }
  ],
  historialAlertas: [],
  eventosRevenueCat: []
};

class DatabaseManager {
  constructor() {
    this.data = this.load();
    this.usuariosMap = new Map();
    this.initMap();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        console.log(`📦 [DATABASE] Base de datos local persistente cargada con éxito (${parsed.usuarios?.length || 0} usuarios).`);
        return Object.assign({}, DEFAULT_DATA, parsed);
      }
    } catch (err) {
      console.warn(`⚠️ [DATABASE] Error al leer base de datos, inicializando con valores predeterminados:`, err.message);
    }

    // Inicializar archivo por primera vez
    this.saveData(DEFAULT_DATA);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  initMap() {
    this.usuariosMap.clear();
    for (const u of (this.data.usuarios || [])) {
      this.usuariosMap.set(u.telefonoPropio, u);
    }
  }

  saveData(dataToSave) {
    try {
      const payload = JSON.stringify(dataToSave || this.data, null, 2);
      fs.writeFileSync(TMP_FILE, payload, 'utf8');
      fs.renameSync(TMP_FILE, DB_FILE);
    } catch (e) {
      console.error(`❌ [DATABASE] Error al guardar datos en disco:`, e.message);
    }
  }

  save() {
    // Sincronizar array de usuarios desde el Map
    this.data.usuarios = Array.from(this.usuariosMap.values());
    this.saveData(this.data);
  }

  // --- MÉTODOS DE USUARIOS ---
  getUser(telefono) {
    if (!telefono) return null;
    return this.usuariosMap.get(telefono.trim()) || null;
  }

  getUserById(id) {
    for (const u of this.usuariosMap.values()) {
      if (u.id === id) return u;
    }
    return null;
  }

  saveUser(usuario) {
    if (!usuario || !usuario.telefonoPropio) return null;
    const tel = usuario.telefonoPropio.trim();
    usuario.actualizadoEn = new Date().toISOString();
    if (!usuario.id) usuario.id = 'usr_' + Date.now();
    this.usuariosMap.set(tel, usuario);
    this.save();
    return usuario;
  }

  getAllUsers() {
    return Array.from(this.usuariosMap.values());
  }

  // --- MÉTODOS DE SUSCRIPCIÓN & PAGOS ---
  activarSuscripcion(telefono, { metodo = 'Stripe / Web', monto = 120, plan = 'Anualidad Premium ($120 MXN)', transaccionId = null, ref = null, rfc = 'XAXX010101000', razonSocial = '', correo = '' } = {}) {
    const user = this.getUser(telefono);
    if (!user) return null;

    user.suscripcionActiva = true;
    user.plan = plan;
    user.metodoPago = metodo;
    user.fechaInicio = new Date().toISOString();
    user.fechaVencimiento = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    user.actualizadoEn = new Date().toISOString();

    const txId = transaccionId || 'tx_' + Date.now();
    const tx = {
      id: txId,
      usuarioId: user.id,
      telefono: user.telefonoPropio,
      nombre: user.nombre,
      monto,
      moneda: 'MXN',
      metodo,
      refAfiliado: ref || null,
      estado: 'COMPLETADO',
      timestamp: new Date().toISOString()
    };

    // Crear Factura Fiscal Digital
    const factura = this.crearFactura({
      usuarioId: user.telefonoPropio,
      nombreCliente: razonSocial || user.nombre,
      rfc: rfc || 'XAXX010101000',
      correo: correo || '',
      metodoPago: metodo,
      transaccionId: txId,
      montoTotal: monto
    });

    tx.folioFactura = factura.folio;

    this.data.transacciones.unshift(tx);
    if (this.data.transacciones.length > 500) this.data.transacciones.pop();

    // Si viene de un afiliado, sumar comisión (30% de lo pagado)
    if (ref && this.data.afiliados[ref]) {
      const afil = this.data.afiliados[ref];
      afil.conversiones = (afil.conversiones || 0) + 1;
      const comision = Math.round(monto * 0.30);
      afil.saldoComisiones = (afil.saldoComisiones || 0) + comision;
    }

    this.save();
    return { user, tx, factura };
  }

  // --- MÉTODOS DE FACTURACIÓN FISCAL ---
  crearFactura({
    usuarioId,
    nombreCliente,
    rfc = 'XAXX010101000',
    regimenFiscal = '616 - Sin obligaciones fiscales',
    usoCFDI = 'S01 - Sin efectos fiscales',
    correo = '',
    concepto = 'Suscripción Anual Plataforma Ruta Segura (12 meses)',
    metodoPago = 'Tarjeta / Pasarela Digital',
    transaccionId = 'tx_' + Date.now(),
    montoTotal = 120.00
  }) {
    if (!this.data.facturas) this.data.facturas = [];
    const folioNumero = this.data.facturas.length + 1;
    const folio = `FAC-2026-${String(folioNumero).padStart(4, '0')}`;
    const uuid = 'cfdi_' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();

    const subtotal = Number((montoTotal / 1.16).toFixed(2));
    const iva = Number((montoTotal - subtotal).toFixed(2));

    const nuevaFactura = {
      folio,
      uuid,
      usuarioId,
      nombreCliente: nombreCliente || 'Usuario Suscriptor',
      rfc: (rfc || 'XAXX010101000').toUpperCase().trim(),
      regimenFiscal,
      usoCFDI,
      correo: (correo || '').trim(),
      concepto,
      claveSAT: '43232605',
      subtotal,
      iva,
      total: Number(montoTotal.toFixed(2)),
      moneda: 'MXN',
      metodoPago,
      transaccionId,
      fecha: new Date().toISOString(),
      estado: 'PAGADA_Y_TIMBRADA'
    };

    this.data.facturas.unshift(nuevaFactura);
    return nuevaFactura;
  }

  getFactura(folioOUuid) {
    if (!folioOUuid) return null;
    const term = folioOUuid.toLowerCase();
    const facturas = this.data.facturas || [];
    return facturas.find(f => f.folio.toLowerCase() === term || f.uuid.toLowerCase() === term || f.transaccionId === folioOUuid) || null;
  }

  getAllFacturas() {
    return this.data.facturas || [];
  }

  // --- MÉTODOS DE CUPONES ---
  validarCupon(codigo) {
    if (!codigo) return null;
    const cod = codigo.trim().toUpperCase();
    const cup = this.data.cupones[cod];
    if (cup) {
      return {
        valido: true,
        codigo: cup.codigo,
        descuentoPorcentaje: cup.descuentoPorcentaje,
        precioFinal: cup.precioFinal,
        descripcion: cup.descripcion
      };
    }
    return { valido: false, error: 'Cupón inválido o expirado' };
  }

  // --- MÉTODOS DE AFILIADOS ---
  registrarVisitaAfiliado(ref) {
    if (!ref) return;
    const cod = ref.trim().toLowerCase();
    if (!this.data.afiliados[cod]) {
      this.data.afiliados[cod] = {
        id: cod,
        nombre: `Creador ${cod}`,
        canal: 'Redes Sociales',
        visitas: 1,
        conversiones: 0,
        comisionPorVenta: 36,
        saldoComisiones: 0,
        creadoEn: new Date().toISOString()
      };
    } else {
      this.data.afiliados[cod].visitas = (this.data.afiliados[cod].visitas || 0) + 1;
    }
    this.save();
  }

  getAfiliado(ref) {
    if (!ref) return null;
    return this.data.afiliados[ref.trim().toLowerCase()] || null;
  }

  getAllAfiliados() {
    return Object.values(this.data.afiliados || {});
  }

  // --- ALERTAS & TELEMETRÍA ---
  addAlerta(alerta) {
    this.data.historialAlertas.unshift(alerta);
    if (this.data.historialAlertas.length > 60) this.data.historialAlertas.pop();
    this.save();
  }

  getAlertas(limit = 20) {
    return this.data.historialAlertas.slice(0, limit);
  }

  addRevenueCatEvent(ev) {
    this.data.eventosRevenueCat.unshift(ev);
    if (this.data.eventosRevenueCat.length > 50) this.data.eventosRevenueCat.pop();
    this.save();
  }

  getRevenueCatEvents(limit = 15) {
    return this.data.eventosRevenueCat.slice(0, limit);
  }

  getTransacciones(limit = 30) {
    return (this.data.transacciones || []).slice(0, limit);
  }

  getMetricas() {
    const usuarios = this.getAllUsers();
    const activos = usuarios.filter(u => u.suscripcionActiva);
    const transacciones = this.data.transacciones || [];
    const ingresosTotales = transacciones.reduce((sum, t) => sum + (Number(t.monto) || 0), 0);
    const arrEstimado = activos.length * 120;

    let comisionesTotales = 0;
    for (const a of Object.values(this.data.afiliados || {})) {
      comisionesTotales += (a.saldoComisiones || 0);
    }

    return {
      totalUsuarios: usuarios.length,
      suscriptoresActivos: activos.length,
      suscriptoresInactivos: usuarios.length - activos.length,
      ingresosAcumuladosMXN: ingresosTotales,
      arrProyectadoMXN: arrEstimado,
      comisionesAfiliadosMXN: comisionesTotales,
      totalTransacciones: transacciones.length
    };
  }
}

module.exports = new DatabaseManager();
