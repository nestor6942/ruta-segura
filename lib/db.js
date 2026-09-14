const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Garantizar existencia de directorio
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

class DatabaseManager {
  constructor() {
    this.data = {
      usuarios: {},
      facturas: [],
      afiliados: {},
      eventosRevenueCat: [],
      historialAlertas: [],
      telemetriaLog: []
    };
    this.saveTimeout = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          usuarios: parsed.usuarios || {},
          facturas: parsed.facturas || [],
          afiliados: parsed.afiliados || {},
          eventosRevenueCat: parsed.eventosRevenueCat || [],
          historialAlertas: parsed.historialAlertas || [],
          telemetriaLog: parsed.telemetriaLog || []
        };
        console.log(`💾 [DATABASE] Base de datos cargada: ${Object.keys(this.data.usuarios).length} usuarios, ${this.data.facturas.length} facturas.`);
      } else {
        this.saveSync();
      }
    } catch (e) {
      console.error('❌ [DATABASE] Error al cargar db.json, usando memoria:', e.message);
    }
  }

  saveSync() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('❌ [DATABASE] Error al guardar síncrono db.json:', e.message);
    }
  }

  scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
    }, 400);
  }

  // --- Usuarios ---
  getUsuario(telefono) {
    if (!telefono) return null;
    const clean = telefono.trim();
    return this.data.usuarios[clean] || null;
  }

  getAllUsuarios() {
    return Object.values(this.data.usuarios);
  }

  setUsuario(telefono, usuarioObj) {
    const clean = telefono.trim();
    this.data.usuarios[clean] = {
      ...usuarioObj,
      telefonoPropio: clean,
      actualizadoEn: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data.usuarios[clean];
  }

  // --- Facturas y Comprobantes Fiscales ---
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
    const folioNumero = this.data.facturas.length + 1;
    const folio = `FAC-2026-${String(folioNumero).padStart(4, '0')}`;
    const uuid = 'cfdi_' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();

    // Desglose fiscal de México (IVA 16%)
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
      correo: correo.trim(),
      concepto,
      claveSAT: '43232605', // Servicios de seguridad digital y monitoreo
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
    this.scheduleSave();
    return nuevaFactura;
  }

  getFactura(folioOUuid) {
    if (!folioOUuid) return null;
    const term = folioOUuid.toLowerCase();
    return this.data.facturas.find(f => f.folio.toLowerCase() === term || f.uuid.toLowerCase() === term || f.transaccionId === folioOUuid) || null;
  }

  getAllFacturas() {
    return this.data.facturas;
  }

  // --- Afiliados / Streamers ---
  getAfiliado(codigo) {
    if (!codigo) return null;
    return this.data.afiliados[codigo.toLowerCase().trim()] || null;
  }

  registrarAfiliado({ codigo, nombre, clabeRetiro = '' }) {
    const cod = codigo.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    if (!this.data.afiliados[cod]) {
      this.data.afiliados[cod] = {
        codigo: cod,
        nombre: nombre || cod,
        comisionPorcentaje: 30, // 30% = $36 MXN por cada $120 MXN
        ventas: 0,
        gananciasMXN: 0,
        clabeRetiro: clabeRetiro || '127180001000000000',
        creadoEn: new Date().toISOString()
      };
      this.scheduleSave();
    }
    return this.data.afiliados[cod];
  }

  acreditarVentaAfiliado(codigo, monto = 120) {
    if (!codigo) return null;
    const af = this.getAfiliado(codigo);
    if (af) {
      af.ventas += 1;
      const ganancia = Number((monto * (af.comisionPorcentaje / 100)).toFixed(2));
      af.gananciasMXN += ganancia;
      this.scheduleSave();
      console.log(`🎉 [AFILIADOS] Venta acreditada a @${af.codigo}: +$${ganancia} MXN (Total acumulado: $${af.gananciasMXN} MXN)`);
      return { afiliado: af, comisionGenerada: ganancia };
    }
    return null;
  }

  getAllAfiliados() {
    return Object.values(this.data.afiliados);
  }

  // --- Telemetría y Alertas ---
  agregarAlerta(alerta) {
    this.data.historialAlertas.unshift(alerta);
    if (this.data.historialAlertas.length > 50) this.data.historialAlertas.pop();
    this.scheduleSave();
  }

  agregarEventoRevenueCat(evento) {
    this.data.eventosRevenueCat.unshift(evento);
    if (this.data.eventosRevenueCat.length > 50) this.data.eventosRevenueCat.pop();
    this.scheduleSave();
  }

  agregarTelemetria(punto) {
    this.data.telemetriaLog.push(punto);
    if (this.data.telemetriaLog.length > 200) this.data.telemetriaLog.shift();
    // La telemetría no se guarda inmediatamente en disco para alto rendimiento
  }
}

const dbInstance = new DatabaseManager();
module.exports = dbInstance;
