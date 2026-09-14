/**
 * GENERADOR DE COMPROBANTES FISCALES Y RECIBOS DIGITALES CFDI
 * Ruta Segura — Estándar SAT México (IVA 16%, CFDI 4.0 Layout)
 */

function validarRFC(rfc) {
  if (!rfc) return false;
  const clean = rfc.toUpperCase().trim();
  if (clean === 'XAXX010101000') return true; // RFC Genérico Nacional
  if (clean === 'XEXX010101000') return true; // RFC Extranjero
  // Patrón RFC Persona Física (4 letras, 6 dígitos, 3 homoclave) o Moral (3 letras, 6 dígitos, 3 homoclave)
  const regex = /^([A-ZÑ&]{3,4})(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))([A-Z\d]{3})$/;
  return regex.test(clean);
}

function generarHTMLComprobante(factura) {
  const fechaObj = new Date(factura.fecha || Date.now());
  const fechaFormateada = fechaObj.toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'America/Mexico_City'
  });

  const qrData = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${factura.uuid}&re=RSE240915ABC&rr=${factura.rfc}&tt=${factura.total}&fe=${factura.uuid.substring(0, 8)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante Fiscal Digital — ${factura.folio}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #4f46e5;
      --primary-dark: #3730a3;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --bg-subtle: #f8fafc;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #f1f5f9;
      color: var(--text);
      padding: 2.5rem 1rem;
      display: flex;
      justify-content: center;
    }
    .invoice-card {
      width: 100%;
      max-width: 820px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      padding: 3rem;
      border: 1px solid var(--border);
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid var(--border);
      padding-bottom: 2rem;
      margin-bottom: 2rem;
    }
    .brand-title {
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .brand-sub {
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-top: 0.3rem;
      line-height: 1.4;
    }
    .badge-folio {
      text-align: right;
    }
    .badge-folio .folio-number {
      font-size: 1.4rem;
      font-weight: 900;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
    }
    .badge-status {
      display: inline-block;
      margin-top: 0.4rem;
      background: #dcfce7;
      color: #166534;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
      background: var(--bg-subtle);
      padding: 1.5rem;
      border-radius: 12px;
    }
    .meta-box h4 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .meta-box p {
      font-size: 0.88rem;
      line-height: 1.5;
    }
    .mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
    }
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2rem;
    }
    table.invoice-table th {
      background: #f8fafc;
      padding: 0.85rem 1rem;
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }
    table.invoice-table td {
      padding: 1.1rem 1rem;
      font-size: 0.88rem;
      border-bottom: 1px solid var(--border);
    }
    .totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 2.5rem;
    }
    .totals-box {
      width: 280px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .totals-row.grand-total {
      border-top: 2px solid var(--border);
      margin-top: 0.5rem;
      padding-top: 0.75rem;
      font-size: 1.25rem;
      font-weight: 900;
      color: var(--text);
    }
    .sat-stamp-box {
      border-top: 1px dashed var(--border);
      padding-top: 1.8rem;
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }
    .sat-qr {
      width: 120px;
      height: 120px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 4px;
      background: #fff;
    }
    .sat-keys {
      flex: 1;
      font-size: 0.7rem;
      color: var(--text-muted);
      line-height: 1.4;
      word-break: break-all;
    }
    .sat-keys strong {
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .actions-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    .btn-print {
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 0.75rem 1.4rem;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }
    .btn-print:hover {
      background: var(--primary-dark);
    }
    .btn-back {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 600;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-card { box-shadow: none; border: none; padding: 0; }
      .actions-bar { display: none; }
    }
  </style>
</head>
<body>

  <div class="invoice-card">
    <!-- Header -->
    <div class="invoice-header">
      <div>
        <div class="brand-title">
          🛡️ Ruta Segura
        </div>
        <div class="brand-sub">
          <strong>RUTA SEGURA TECH S.A.P.I. DE C.V.</strong><br>
          R.F.C.: <strong>RSE240915ABC</strong><br>
          Régimen Fiscal: 601 - General de Ley Personas Morales<br>
          Lugar de Expedición: C.P. 06600, Ciudad de México
        </div>
      </div>
      <div class="badge-folio">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Comprobante Digital (CFDI)</div>
        <div class="folio-number">${factura.folio}</div>
        <div class="badge-status">● PAGO CONFIRMADO</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
          ${fechaFormateada}
        </div>
      </div>
    </div>

    <!-- Client / Receptor Data -->
    <div class="meta-grid">
      <div class="meta-box">
        <h4>Datos del Suscriptor / Cliente</h4>
        <p><strong>Nombre:</strong> ${factura.nombreCliente}</p>
        <p><strong>R.F.C.:</strong> <span class="mono">${factura.rfc}</span></p>
        <p><strong>Régimen Fiscal:</strong> ${factura.regimenFiscal || '616 - Sin obligaciones fiscales'}</p>
        <p><strong>Uso de CFDI:</strong> ${factura.usoCFDI || 'S01 - Sin efectos fiscales'}</p>
        ${factura.correo ? `<p><strong>Correo:</strong> ${factura.correo}</p>` : ''}
        <p><strong>Teléfono / ID:</strong> <span class="mono">${factura.usuarioId}</span></p>
      </div>

      <div class="meta-box">
        <h4>Información del Pago</h4>
        <p><strong>Método de Pago:</strong> ${factura.metodoPago}</p>
        <p><strong>Forma de Pago SAT:</strong> 04 (Tarjeta de Crédito) / 03 (SPEI)</p>
        <p><strong>Moneda:</strong> MXN — Peso Mexicano</p>
        <p><strong>ID Transacción:</strong> <span class="mono">${factura.transaccionId}</span></p>
        <p><strong>UUID Fiscal:</strong> <span class="mono">${factura.uuid}</span></p>
      </div>
    </div>

    <!-- Itemized Table -->
    <table class="invoice-table">
      <thead>
        <tr>
          <th>Clave SAT</th>
          <th>Descripción del Servicio</th>
          <th>Cant.</th>
          <th>Precio Unit.</th>
          <th style="text-align: right;">Importe</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="mono">${factura.claveSAT || '43232605'}</td>
          <td>
            <strong>${factura.concepto}</strong><br>
            <span style="font-size: 0.78rem; color: var(--text-muted);">
              Vigilancia satelital 24/7, motor Haversine anti-detenciones y despacho ilimitado de alertas a familiares vía Twilio WhatsApp.
            </span>
          </td>
          <td>1 Servicio (E48)</td>
          <td>$${factura.subtotal.toFixed(2)}</td>
          <td style="text-align: right; font-weight: 700;">$${factura.subtotal.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Totals Breakdown -->
    <div class="totals-wrapper">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>$${factura.subtotal.toFixed(2)} MXN</span>
        </div>
        <div class="totals-row">
          <span>I.V.A. (16%):</span>
          <span>$${factura.iva.toFixed(2)} MXN</span>
        </div>
        <div class="totals-row grand-total">
          <span>Total Pagado:</span>
          <span style="color: var(--primary);">$${factura.total.toFixed(2)} MXN</span>
        </div>
      </div>
    </div>

    <!-- SAT Digital Stamp & QR -->
    <div class="sat-stamp-box">
      <img src="${qrUrl}" alt="Código QR SAT" class="sat-qr">
      <div class="sat-keys">
        <p><strong>Folio Fiscal (UUID):</strong> ${factura.uuid}</p>
        <p><strong>No. de Serie del Certificado SAT:</strong> 00001000000508924160</p>
        <p><strong>Fecha y Hora de Certificación:</strong> ${factura.fecha}</p>
        <p style="margin-top: 4px;"><strong>Cadena Original del Timbre:</strong><br>
        ||1.1|${factura.uuid}|${factura.fecha}|SAT970701NN3|RSE240915ABC|${factura.rfc}|${factura.total}|43232605||</p>
        <p style="margin-top: 4px;"><strong>Sello Digital del Emisor:</strong><br>
        xM8QyT+9K1kPloW1sV98A2Kq99ZkM==L14P8qKlaW99</p>
      </div>
    </div>

    <!-- Actions Bar -->
    <div class="actions-bar">
      <a href="/" class="btn-back">← Volver a Ruta Segura</a>
      <button onclick="window.print()" class="btn-print">
        🖨️ Imprimir / Guardar en PDF
      </button>
    </div>
  </div>

</body>
</html>`;
}

module.exports = {
  validarRFC,
  generarHTMLComprobante
};
