const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const mockupsDir = path.resolve(__dirname, '../docs/mockups');
if (!fs.existsSync(mockupsDir)) {
  fs.mkdirSync(mockupsDir, { recursive: true });
}

function sanitizeXml(str) {
  if (!str) return '';
  return str.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

function createMobileFrameSVG(title, subtitle, contentSvg, activeTab = 'home') {
  const safeTitle = sanitizeXml(title);
  const safeSubtitle = sanitizeXml(subtitle);
  const safeContent = sanitizeXml(contentSvg);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="960" viewBox="0 0 500 960">
  <defs>
    <filter id="shadow" x="-10%" y="-5%" width="120%" height="115%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>

  <!-- Device Outer Frame -->
  <rect x="20" y="20" width="460" height="920" rx="44" fill="#020617" stroke="#334155" stroke-width="6" filter="url(#shadow)"/>
  <!-- Screen Inner -->
  <rect x="32" y="32" width="436" height="896" rx="36" fill="#f1f5f9"/>

  <!-- Speaker & Dynamic Island -->
  <rect x="175" y="42" width="150" height="26" rx="13" fill="#000000"/>
  <circle cx="210" cy="55" r="4.5" fill="#1e293b"/>
  <rect x="240" y="52" width="45" height="6" rx="3" fill="#1e293b"/>

  <!-- Status Bar Time & Icons -->
  <text x="65" y="59" fill="#0f172a" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="12" font-weight="700">09:41</text>
  <path d="M 405 52 L 415 52 L 415 62 L 405 62 Z" fill="#0f172a"/>
  <circle cx="395" cy="57" r="4" fill="#0f172a"/>

  <!-- App Header -->
  <rect x="32" y="78" width="436" height="64" fill="url(#headerGrad)"/>
  <circle cx="62" cy="110" r="16" fill="#10b981"/>
  <text x="62" y="115" fill="#ffffff" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="14" font-weight="900" text-anchor="middle">GA</text>
  <text x="88" y="105" fill="#ffffff" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="15" font-weight="800">${safeTitle}</text>
  <text x="88" y="122" fill="#94a3b8" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="11" font-weight="500">${safeSubtitle}</text>
  <circle cx="430" cy="110" r="14" fill="#334155"/>
  <text x="430" y="114" fill="#ffffff" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">⚙️</text>

  <!-- Screen Content Scroll Area -->
  <g transform="translate(32, 142)">
    ${safeContent}
  </g>

  <!-- Bottom Navigation Bar -->
  <rect x="32" y="854" width="436" height="74" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <!-- Home Tab -->
  <g transform="translate(45, 862)">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'home' ? '#ecfdf5' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">🏠</text>
    <text x="25" y="48" fill="${activeTab === 'home' ? '#059669' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Granja</text>
  </g>
  <!-- Porcino Tab -->
  <g transform="translate(132, 862)">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'porcino' ? '#fff1f2' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">🐷</text>
    <text x="25" y="48" fill="${activeTab === 'porcino' ? '#e11d48' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Porcino</text>
  </g>
  <!-- Calendario Tab -->
  <g transform="translate(220, 862)">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'calendario' ? '#eff6ff' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">📅</text>
    <text x="25" y="48" fill="${activeTab === 'calendario' ? '#2563eb' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Sanitario</text>
  </g>
  <!-- Balance Tab -->
  <g transform="translate(308, 862)">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'balance' ? '#f0fdf4' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">📊</text>
    <text x="25" y="48" fill="${activeTab === 'balance' ? '#16a34a' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Balance</text>
  </g>
  <!-- Almacén Tab -->
  <g transform="translate(395, 862)">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'almacen' ? '#fef3c7' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">📦</text>
    <text x="25" y="48" fill="${activeTab === 'almacen' ? '#d97706' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Almacén</text>
  </g>

  <!-- Home Indicator Bar -->
  <rect x="180" y="918" width="140" height="4" rx="2" fill="#0f172a"/>
</svg>
`;
}

// 1. Home Dashboard
const s01 = `
  <rect x="14" y="10" width="408" height="38" rx="12" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
  <text x="28" y="34" font-size="14">🔔</text>
  <text x="48" y="33" fill="#065f46" font-family="Arial, sans-serif" font-size="11" font-weight="bold">Hoy: 2 Tareas Sanitarias • Vacunación Hierro Camada 1</text>

  <rect x="14" y="56" width="408" height="154" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <text x="30" y="80" fill="#64748b" font-family="Arial, sans-serif" font-size="11" font-weight="bold">RESUMEN FINANCIERO TOTAL (AGO 2026)</text>
  <text x="30" y="112" fill="#0f172a" font-family="Arial, sans-serif" font-size="26" font-weight="900">+$8,330 USD</text>
  <rect x="220" y="90" width="85" height="22" rx="11" fill="#ecfdf5"/>
  <text x="262" y="105" fill="#059669" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">+72.2% Margen</text>
  <line x1="30" y1="128" x2="400" y2="128" stroke="#f1f5f9" stroke-width="1"/>
  <rect x="30" y="138" width="115" height="58" rx="10" fill="#f0fdf4"/>
  <text x="40" y="156" fill="#166534" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Ganancias (+)</text>
  <text x="40" y="180" fill="#14532d" font-family="Arial, sans-serif" font-size="15" font-weight="bold">$11,540</text>
  <rect x="160" y="138" width="115" height="58" rx="10" fill="#fef2f2"/>
  <text x="170" y="156" fill="#991b1b" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Gastos (-)</text>
  <text x="170" y="180" fill="#7f1d1d" font-family="Arial, sans-serif" font-size="15" font-weight="bold">$3,210</text>
  <rect x="290" y="138" width="115" height="58" rx="10" fill="#f8fafc"/>
  <text x="300" y="156" fill="#475569" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Operación</text>
  <text x="300" y="180" fill="#0f172a" font-family="Arial, sans-serif" font-size="15" font-weight="bold">Optima</text>

  <text x="16" y="232" fill="#0f172a" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Inventario de Animales por Rubro</text>

  <rect x="14" y="244" width="408" height="96" rx="16" fill="#fff1f2" stroke="#fecdd3" stroke-width="1"/>
  <circle cx="50" cy="292" r="24" fill="#ffe4e6"/>
  <text x="50" y="299" font-size="24" text-anchor="middle">🐷</text>
  <text x="86" y="274" fill="#9f1239" font-family="Arial, sans-serif" font-size="15" font-weight="bold">Sector Porcino</text>
  <text x="86" y="294" fill="#475569" font-family="Arial, sans-serif" font-size="11">2 Productoras • 50 Lechones • 2 Verracos • 45 Engorde</text>
  <text x="86" y="316" fill="#be123c" font-family="Arial, sans-serif" font-size="11" font-weight="bold">Total: 99 Cerdos Activos ➔</text>
  <rect x="340" y="266" width="68" height="48" rx="10" fill="#ffffff" stroke="#fecdd3"/>
  <text x="374" y="298" fill="#e11d48" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">99</text>

  <rect x="14" y="350" width="408" height="96" rx="16" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>
  <circle cx="50" cy="398" r="24" fill="#dbeafe"/>
  <text x="50" y="405" font-size="24" text-anchor="middle">🐄</text>
  <text x="86" y="380" fill="#1e40af" font-family="Arial, sans-serif" font-size="15" font-weight="bold">Hato Bovino</text>
  <text x="86" y="400" fill="#475569" font-family="Arial, sans-serif" font-size="11">2 Padrotes • 12 Becerros • 44 Vacas (Ordeño activo)</text>
  <text x="86" y="422" fill="#2563eb" font-family="Arial, sans-serif" font-size="11" font-weight="bold">Total: 58 Cabezas ➔</text>
  <rect x="340" y="372" width="68" height="48" rx="10" fill="#ffffff" stroke="#bfdbfe"/>
  <text x="374" y="404" fill="#2563eb" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">58</text>

  <rect x="14" y="456" width="408" height="96" rx="16" fill="#fefce8" stroke="#fef08a" stroke-width="1"/>
  <circle cx="50" cy="504" r="24" fill="#fef9c3"/>
  <text x="50" y="511" font-size="24" text-anchor="middle">🐔</text>
  <text x="86" y="486" fill="#854d0e" font-family="Arial, sans-serif" font-size="15" font-weight="bold">Lotes Avícolas</text>
  <text x="86" y="506" fill="#475569" font-family="Arial, sans-serif" font-size="11">Lote 01 (Galpón 1) • FCR 1.62 • Peso Promedio 2.1 kg</text>
  <text x="86" y="528" fill="#ca8a04" font-family="Arial, sans-serif" font-size="11" font-weight="bold">Total: 850 Pollos de Engorde ➔</text>
  <rect x="340" y="478" width="68" height="48" rx="10" fill="#ffffff" stroke="#fef08a"/>
  <text x="374" y="510" fill="#ca8a04" font-family="Arial, sans-serif" font-size="18" font-weight="900" text-anchor="middle">850</text>
`;

// 2. Porcino Pestaña 1 (Rebaño Activo & Censo)
const s02 = `
  <rect x="14" y="6" width="408" height="34" rx="8" fill="#e2e8f0"/>
  <rect x="16" y="8" width="76" height="30" rx="6" fill="#e11d48"/>
  <text x="54" y="27" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Porcinos</text>
  <text x="126" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Atajos</text>
  <text x="198" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Sanitario</text>
  <text x="268" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Balance</text>
  <text x="350" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Alimento</text>

  <rect x="14" y="48" width="130" height="28" rx="8" fill="#ffe4e6" stroke="#fecdd3"/>
  <text x="79" y="66" fill="#9f1239" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">🔢 Censo en Vivo</text>
  <rect x="152" y="48" width="130" height="28" rx="8" fill="#dcfce7" stroke="#bbf7d0"/>
  <text x="217" y="66" fill="#166534" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">🚛 Salida Matadero</text>
  <rect x="290" y="48" width="132" height="28" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text x="356" y="66" fill="#334155" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">🍼 Destete Rápido</text>

  <!-- 3 Columns -->
  <rect x="14" y="86" width="130" height="136" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="34" y="96" width="90" height="50" rx="8" fill="#f1f5f9"/>
  <text x="79" y="128" font-size="28" text-anchor="middle">🐖</text>
  <text x="79" y="160" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Engorde</text>
  <text x="79" y="182" fill="#0f172a" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">45</text>
  <rect x="24" y="192" width="110" height="18" rx="9" fill="#ecfdf5"/>
  <text x="79" y="205" fill="#059669" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle">GDP: 0.78 kg/d</text>

  <rect x="152" y="86" width="130" height="136" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="172" y="96" width="90" height="50" rx="8" fill="#f1f5f9"/>
  <text x="217" y="128" font-size="28" text-anchor="middle">🤱</text>
  <text x="217" y="160" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Maternidad</text>
  <text x="217" y="182" fill="#0f172a" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">2</text>
  <rect x="162" y="192" width="110" height="18" rx="9" fill="#fff1f2"/>
  <text x="217" y="205" fill="#e11d48" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle">LNV: 12.8 prom</text>

  <rect x="290" y="86" width="130" height="136" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="310" y="96" width="90" height="50" rx="8" fill="#f1f5f9"/>
  <text x="355" y="128" font-size="28" text-anchor="middle">🐗</text>
  <text x="355" y="160" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Verracos</text>
  <text x="355" y="182" fill="#0f172a" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">2</text>
  <rect x="300" y="192" width="110" height="18" rx="9" fill="#eff6ff"/>
  <text x="355" y="205" fill="#2563eb" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle">18 Montas Reg.</text>

  <!-- Lechones -->
  <rect x="14" y="232" width="408" height="66" rx="14" fill="#fffbeb" stroke="#fde68a"/>
  <circle cx="45" cy="265" r="20" fill="#fef3c7"/>
  <text x="45" y="272" font-size="20" text-anchor="middle">🐖</text>
  <text x="76" y="256" fill="#92400e" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Lechones en Lactancia (4 Camadas)</text>
  <text x="76" y="274" fill="#b45309" font-family="Arial, sans-serif" font-size="11">50 lechones vivos • 6.4 kg prom. • Bajas acumuladas: 2 (3.8%)</text>
  <text x="76" y="290" fill="#d97706" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Destete programado en ~9 días</text>
  <text x="390" y="272" fill="#92400e" font-family="Arial, sans-serif" font-size="22" font-weight="900" text-anchor="end">50</text>

  <!-- Movements Reconciliation -->
  <rect x="14" y="308" width="408" height="98" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="28" y="328" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold">Conciliación de Movimientos del Rebaño</text>
  <rect x="28" y="338" width="85" height="54" rx="8" fill="#f8fafc"/>
  <text x="70" y="354" fill="#64748b" font-size="9" text-anchor="middle">Censo Inicial</text>
  <text x="70" y="378" fill="#0f172a" font-size="16" font-weight="bold" text-anchor="middle">27</text>

  <rect x="122" y="338" width="85" height="54" rx="8" fill="#f0fdf4"/>
  <text x="164" y="354" fill="#166534" font-size="9" text-anchor="middle">(+) Entradas</text>
  <text x="164" y="378" fill="#15803d" font-size="16" font-weight="bold" text-anchor="middle">+72</text>

  <rect x="216" y="338" width="85" height="54" rx="8" fill="#fef2f2"/>
  <text x="258" y="354" fill="#991b1b" font-size="9" text-anchor="middle">(-) Salidas</text>
  <text x="258" y="378" fill="#b91c1c" font-size="16" font-weight="bold" text-anchor="middle">-27</text>

  <rect x="310" y="338" width="95" height="54" rx="8" fill="#881337"/>
  <text x="357" y="354" fill="#fecdd3" font-size="9" text-anchor="middle">(=) Total Activo</text>
  <text x="357" y="378" fill="#ffffff" font-size="18" font-weight="900" text-anchor="middle">99</text>
`;

// 3. Porcino Pestaña 2 (Atajos Operativos)
const s03 = `
  <rect x="14" y="6" width="408" height="34" rx="8" fill="#e2e8f0"/>
  <text x="54" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Porcinos</text>
  <rect x="96" y="8" width="60" height="30" rx="6" fill="#e11d48"/>
  <text x="126" y="27" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Atajos</text>
  <text x="198" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Sanitario</text>
  <text x="268" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Balance</text>
  <text x="350" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Alimento</text>

  <text x="16" y="64" fill="#0f172a" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Atajos de Gestión Operativa (6 Módulos)</text>

  <!-- 2x3 GridView -->
  <rect x="14" y="78" width="194" height="90" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="48" cy="123" r="20" fill="#ecfdf5"/>
  <text x="48" y="129" font-size="18" text-anchor="middle">📦</text>
  <text x="78" y="114" fill="#0f172a" font-size="14" font-weight="bold">Almacén</text>
  <text x="78" y="132" fill="#64748b" font-size="10">Alimentos y Medicinas</text>
  <text x="78" y="148" fill="#dc2626" font-size="9" font-weight="bold">Alerta 2 meses activa</text>

  <rect x="228" y="78" width="194" height="90" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="262" cy="123" r="20" fill="#eff6ff"/>
  <text x="262" y="129" font-size="18" text-anchor="middle">🧾</text>
  <text x="292" y="114" fill="#0f172a" font-size="14" font-weight="bold">Compras</text>
  <text x="292" y="132" fill="#64748b" font-size="10">Facturas de insumos</text>
  <text x="292" y="148" fill="#2563eb" font-size="9" font-weight="bold">Ingreso de lechones</text>

  <rect x="14" y="178" width="194" height="90" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="48" cy="223" r="20" fill="#faf5ff"/>
  <text x="48" y="229" font-size="18" text-anchor="middle">🤝</text>
  <text x="78" y="214" fill="#0f172a" font-size="14" font-weight="bold">Clientes / Ventas</text>
  <text x="78" y="232" fill="#64748b" font-size="10">Venta pie o canal</text>
  <text x="78" y="248" fill="#7c3aed" font-size="9" font-weight="bold">Cálculo de utilidad</text>

  <rect x="228" y="178" width="194" height="90" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="262" cy="223" r="20" fill="#fffbeb"/>
  <text x="262" y="229" font-size="18" text-anchor="middle">📈</text>
  <text x="292" y="214" fill="#0f172a" font-size="14" font-weight="bold">Reporte General</text>
  <text x="292" y="232" fill="#64748b" font-size="10">KPIs de conversión</text>
  <text x="292" y="248" fill="#d97706" font-size="9" font-weight="bold">Mortalidad y GDP</text>

  <rect x="14" y="278" width="194" height="90" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="48" cy="323" r="20" fill="#f0fdfa"/>
  <text x="48" y="329" font-size="18" text-anchor="middle">✅</text>
  <text x="78" y="314" fill="#0f172a" font-size="14" font-weight="bold">Tareas</text>
  <text x="78" y="332" fill="#64748b" font-size="10">Checklist diario</text>
  <text x="78" y="348" fill="#0d9488" font-size="9" font-weight="bold">Asignación personal</text>

  <rect x="228" y="278" width="194" height="90" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="262" cy="323" r="20" fill="#fff1f2"/>
  <text x="262" y="329" font-size="18" text-anchor="middle">🔢</text>
  <text x="292" y="314" fill="#0f172a" font-size="14" font-weight="bold">Conteo</text>
  <text x="292" y="332" fill="#64748b" font-size="10">Auditoría física</text>
  <text x="292" y="348" fill="#e11d48" font-size="9" font-weight="bold">Verificación de lote</text>

  <!-- Banner Destete -->
  <rect x="14" y="380" width="408" height="90" rx="16" fill="#fff1f2" stroke="#fecdd3"/>
  <text x="32" y="406" fill="#e11d48" font-size="10" font-weight="bold" letter-spacing="0.5">HERRAMIENTA CLAVE DE PRODUCCIÓN</text>
  <text x="32" y="428" fill="#0f172a" font-size="14" font-weight="bold">Parto & Prorrateo de Costo de Lechones</text>
  <text x="32" y="446" fill="#64748b" font-size="11">Divide el costo de la madre entre los lechones destetados</text>
  <rect x="310" y="424" width="96" height="32" rx="8" fill="#e11d48"/>
  <text x="358" y="444" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">Abrir Prorrateo</text>
`;

// 4. Porcino Pestaña 3 (Plan Sanitario)
const s04 = `
  <rect x="14" y="6" width="408" height="34" rx="8" fill="#e2e8f0"/>
  <text x="54" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Porcinos</text>
  <text x="126" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Atajos</text>
  <rect x="168" y="8" width="70" height="30" rx="6" fill="#e11d48"/>
  <text x="203" y="27" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Sanitario</text>
  <text x="268" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Balance</text>
  <text x="350" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Alimento</text>

  <!-- Action Bar -->
  <rect x="14" y="48" width="200" height="34" rx="10" fill="#2563eb"/>
  <text x="114" y="70" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">+ Programar Actividad</text>

  <rect x="222" y="48" width="200" height="34" rx="10" fill="#0f172a"/>
  <text x="322" y="70" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">⚙️ Configurar Lotes</text>

  <!-- Calendar Container -->
  <rect x="14" y="90" width="408" height="236" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="30" y="116" fill="#0f172a" font-size="14" font-weight="bold">📅 Agosto de 2026</text>
  <rect x="330" y="102" width="76" height="20" rx="6" fill="#eff6ff"/>
  <text x="368" y="116" fill="#2563eb" font-size="10" font-weight="bold" text-anchor="middle">Mes Actual</text>

  <!-- Weekdays -->
  <text x="44" y="142" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">lun</text>
  <text x="100" y="142" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">mar</text>
  <text x="156" y="142" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">mié</text>
  <text x="212" y="142" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">jue</text>
  <text x="268" y="142" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">vie</text>
  <text x="324" y="142" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">sáb</text>
  <text x="380" y="142" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">dom</text>

  <!-- Day cells sample -->
  <circle cx="156" cy="172" r="14" fill="#eff6ff"/>
  <text x="156" y="176" fill="#1e40af" font-size="11" font-weight="bold" text-anchor="middle">12</text>
  <circle cx="156" cy="182" r="2" fill="#2563eb"/>

  <!-- Active selected day 19 -->
  <circle cx="212" cy="206" r="16" fill="#2563eb"/>
  <text x="212" y="210" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">19</text>
  <circle cx="212" cy="218" r="2" fill="#ffffff"/>

  <circle cx="268" cy="206" r="14" fill="#eff6ff"/>
  <text x="268" y="210" fill="#1e40af" font-size="11" font-weight="bold" text-anchor="middle">20</text>
  <circle cx="268" cy="216" r="2" fill="#d97706"/>

  <circle cx="380" cy="206" r="14" fill="#eff6ff"/>
  <text x="380" y="210" fill="#1e40af" font-size="11" font-weight="bold" text-anchor="middle">22</text>
  <circle cx="380" cy="216" r="2" fill="#7c3aed"/>

  <!-- Legend -->
  <line x1="30" y1="240" x2="406" y2="240" stroke="#f1f5f9"/>
  <text x="30" y="258" fill="#475569" font-size="10" font-weight="bold">Leyenda Cromática:</text>
  <circle cx="36" cy="274" r="4" fill="#2563eb"/>
  <text x="46" y="278" fill="#334155" font-size="9">Vacunación</text>
  <circle cx="116" cy="274" r="4" fill="#d97706"/>
  <text x="126" y="278" fill="#334155" font-size="9">Desparasitación</text>
  <circle cx="216" cy="274" r="4" fill="#eab308"/>
  <text x="226" y="278" fill="#334155" font-size="9">Hierro/Vitaminas</text>
  <circle cx="316" cy="274" r="4" fill="#7c3aed"/>
  <text x="326" y="278" fill="#334155" font-size="9">Tratamiento</text>

  <!-- Selected Day Tasks -->
  <text x="16" y="344" fill="#0f172a" font-size="13" font-weight="bold">Tareas para el 19 de Agosto de 2026 (2):</text>
  <rect x="14" y="356" width="408" height="74" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="30" y="378" fill="#0f172a" font-size="12" font-weight="bold">Inyección de Hierro Dextrano (200mg)</text>
  <rect x="330" y="366" width="76" height="18" rx="9" fill="#fef3c7"/>
  <text x="368" y="379" fill="#92400e" font-size="9" font-weight="bold" text-anchor="middle">pendiente</text>
  <text x="30" y="396" fill="#475569" font-size="11">Camada CAM-CER088-L1 • Dosis: 2ml IM profunda</text>
  <text x="30" y="412" fill="#2563eb" font-size="10" font-weight="bold">Dr. Roberto Salas (Vet) • Descargar 24ml de Almacén</text>
`;

// 5. Porcino Pestaña 4 (Balance Financiero)
const s05 = `
  <rect x="14" y="6" width="408" height="34" rx="8" fill="#e2e8f0"/>
  <text x="54" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Porcinos</text>
  <text x="126" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Atajos</text>
  <text x="198" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Sanitario</text>
  <rect x="238" y="8" width="66" height="30" rx="6" fill="#e11d48"/>
  <text x="271" y="27" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Balance</text>
  <text x="350" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Alimento</text>

  <!-- Filter Toggle -->
  <rect x="14" y="48" width="408" height="32" rx="8" fill="#e2e8f0"/>
  <rect x="16" y="50" width="198" height="28" rx="6" fill="#ffffff"/>
  <text x="115" y="68" fill="#0f172a" font-size="11" font-weight="bold" text-anchor="middle">📆 Clasificar por Mes</text>
  <text x="315" y="68" fill="#64748b" font-size="11" font-weight="bold" text-anchor="middle">📅 Clasificar por Año (2026)</text>

  <!-- Result Card -->
  <rect x="14" y="88" width="408" height="136" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="30" y="112" fill="#64748b" font-size="11" font-weight="bold">RESULTADO FINANCIERO PORCINO (AGO 2026)</text>
  <text x="30" y="142" fill="#15803d" font-size="28" font-weight="900">+$7,860 USD</text>
  <rect x="230" y="122" width="100" height="22" rx="11" fill="#ecfdf5"/>
  <text x="280" y="137" fill="#059669" font-size="10" font-weight="bold" text-anchor="middle">Rentabilidad: 72.6%</text>

  <rect x="30" y="160" width="180" height="50" rx="10" fill="#f0fdf4"/>
  <text x="44" y="178" fill="#166534" font-size="10" font-weight="bold">Ingresos (+)</text>
  <text x="44" y="198" fill="#14532d" font-size="16" font-weight="bold">+$10,820 USD</text>

  <rect x="220" y="160" width="180" height="50" rx="10" fill="#fef2f2"/>
  <text x="234" y="178" fill="#991b1b" font-size="10" font-weight="bold">Egresos (-)</text>
  <text x="234" y="198" fill="#7f1d1d" font-size="16" font-weight="bold">-$2,960 USD</text>

  <!-- 12-Month Bar Chart Visualizer -->
  <rect x="14" y="232" width="408" height="150" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="30" y="254" fill="#0f172a" font-size="12" font-weight="bold">Tendencia Mensual Ingresos vs Egresos (2026)</text>
  <!-- Mini Bar Chart -->
  <line x1="30" y1="350" x2="400" y2="350" stroke="#e2e8f0"/>
  <!-- Bars -->
  <rect x="50" y="320" width="8" height="30" fill="#10b981" rx="2"/>
  <rect x="60" y="330" width="8" height="20" fill="#ef4444" rx="2"/>
  <text x="59" y="364" fill="#94a3b8" font-size="8" text-anchor="middle">Ene</text>

  <rect x="120" y="300" width="8" height="50" fill="#10b981" rx="2"/>
  <rect x="130" y="325" width="8" height="25" fill="#ef4444" rx="2"/>
  <text x="129" y="364" fill="#94a3b8" font-size="8" text-anchor="middle">Mar</text>

  <rect x="190" y="290" width="8" height="60" fill="#10b981" rx="2"/>
  <rect x="200" y="315" width="8" height="35" fill="#ef4444" rx="2"/>
  <text x="199" y="364" fill="#94a3b8" font-size="8" text-anchor="middle">May</text>

  <rect x="260" y="270" width="10" height="80" fill="#10b981" rx="2"/>
  <rect x="272" y="320" width="10" height="30" fill="#ef4444" rx="2"/>
  <text x="271" y="364" fill="#be123c" font-size="9" font-weight="bold" text-anchor="middle">Ago</text>

  <rect x="330" y="310" width="8" height="40" fill="#10b981" rx="2"/>
  <rect x="340" y="330" width="8" height="20" fill="#ef4444" rx="2"/>
  <text x="339" y="364" fill="#94a3b8" font-size="8" text-anchor="middle">Oct</text>

  <rect x="380" y="295" width="8" height="55" fill="#10b981" rx="2"/>
  <rect x="390" y="322" width="8" height="28" fill="#ef4444" rx="2"/>
  <text x="389" y="364" fill="#94a3b8" font-size="8" text-anchor="middle">Dic</text>
`;

// 6. Porcino Pestaña 5 (Nutrición y Calculadora)
const s06 = `
  <rect x="14" y="6" width="408" height="34" rx="8" fill="#e2e8f0"/>
  <text x="54" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Porcinos</text>
  <text x="126" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Atajos</text>
  <text x="198" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Sanitario</text>
  <text x="268" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Balance</text>
  <rect x="312" y="8" width="76" height="30" rx="6" fill="#e11d48"/>
  <text x="350" y="27" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Alimento</text>

  <!-- Production Type Selector -->
  <rect x="14" y="48" width="98" height="28" rx="8" fill="#ffffff" stroke="#10b981"/>
  <text x="63" y="66" fill="#047857" font-size="10" font-weight="bold" text-anchor="middle">Engorde Ceba</text>
  <rect x="116" y="48" width="98" height="28" rx="8" fill="#f1f5f9"/>
  <text x="165" y="66" fill="#475569" font-size="10" font-weight="bold" text-anchor="middle">Maternidad</text>
  <rect x="218" y="48" width="98" height="28" rx="8" fill="#f1f5f9"/>
  <text x="267" y="66" fill="#475569" font-size="10" font-weight="bold" text-anchor="middle">Verracos</text>
  <rect x="320" y="48" width="98" height="28" rx="8" fill="#f1f5f9"/>
  <text x="369" y="66" fill="#475569" font-size="10" font-weight="bold" text-anchor="middle">Lechones</text>

  <!-- Phase Card 1 -->
  <rect x="14" y="86" width="408" height="88" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="26" y="98" width="90" height="20" rx="6" fill="#fef3c7"/>
  <text x="71" y="112" fill="#92400e" font-size="9" font-weight="bold" text-anchor="middle">Día 28 al 45 (17d)</text>
  <text x="126" y="113" fill="#64748b" font-size="10">8.5 kg - 15.0 kg meta</text>
  <text x="26" y="136" fill="#0f172a" font-size="13" font-weight="bold">Fase 1: Pre-iniciador Transición (21% PB)</text>
  <text x="26" y="154" fill="#475569" font-size="11">Consumo: 0.65 kg/día/cerdo • Total fase: 11.0 kg/cerdo</text>

  <!-- Calculator Box -->
  <rect x="14" y="184" width="408" height="230" rx="16" fill="#0f172a"/>
  <text x="30" y="210" fill="#ffffff" font-size="14" font-weight="bold">Calculadora de Bultos (Base 40 kg)</text>

  <rect x="30" y="224" width="115" height="54" rx="8" fill="#1e293b"/>
  <text x="40" y="242" fill="#94a3b8" font-size="9">Cerdas Gestación:</text>
  <text x="40" y="266" fill="#ffffff" font-size="16" font-weight="bold">30 cerdas</text>

  <rect x="160" y="224" width="115" height="54" rx="8" fill="#1e293b"/>
  <text x="170" y="242" fill="#94a3b8" font-size="9">Cerdas Lactancia:</text>
  <text x="170" y="266" fill="#ffffff" font-size="16" font-weight="bold">12 cerdas</text>

  <rect x="290" y="224" width="115" height="54" rx="8" fill="#1e293b"/>
  <text x="300" y="242" fill="#94a3b8" font-size="9">Cerdos Engorde:</text>
  <text x="300" y="266" fill="#34d399" font-size="16" font-weight="bold">140 cerdos</text>

  <!-- Result Banner -->
  <rect x="30" y="292" width="375" height="60" rx="10" fill="#022c22" stroke="#059669"/>
  <text x="45" y="316" fill="#6ee7b7" font-size="11" font-weight="bold">BULTOS REQUERIDOS AL MES:</text>
  <text x="45" y="340" fill="#ffffff" font-size="20" font-weight="900">368 Bultos (14,700 kg)</text>
  <text x="390" y="332" fill="#a7f3d0" font-size="13" font-weight="bold" text-anchor="end">~$6,468 USD</text>
`;

// Helper to write SVG and render to PNG
async function renderMockup(filename, title, subtitle, innerSvg, tab) {
  const fullSvg = createMobileFrameSVG(title, subtitle, innerSvg, tab);
  const outPng = path.join(mockupsDir, filename);
  await sharp(Buffer.from(fullSvg)).png().toFile(outPng);
  console.log(`Rendered: ${outPng}`);
}

async function run() {
  console.log('Rendering 13 Screen Mockups...');
  await renderMockup('mockup_01_home_dashboard.png', 'Granja Arianna', 'Tablero Principal e Inventario General', s01, 'home');
  await renderMockup('mockup_02_porcino_pestana1.png', 'Menú Porcino', 'Pestaña 1: Rebaño Activo y Conciliación', s02, 'porcino');
  await renderMockup('mockup_03_porcino_pestana2_atajos.png', 'Menú Porcino', 'Pestaña 2: Atajos Operativos', s03, 'porcino');
  await renderMockup('mockup_04_porcino_pestana3_sanitario.png', 'Menú Porcino', 'Pestaña 3: Plan Sanitario y Calendario', s04, 'calendario');
  await renderMockup('mockup_05_porcino_pestana4_balance.png', 'Menú Porcino', 'Pestaña 4: Balance Financiero', s05, 'balance');
  await renderMockup('mockup_06_porcino_pestana5_nutricion.png', 'Menú Porcino', 'Pestaña 5: Nutrición y Calculadora', s06, 'porcino');

  // Also render specialized modals
  // 7. Trazabilidad
  const s07 = `
    <rect x="14" y="10" width="408" height="120" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
    <circle cx="50" cy="50" r="24" fill="#fff1f2"/>
    <text x="50" y="58" font-size="24" text-anchor="middle">🐖</text>
    <text x="86" y="44" fill="#0f172a" font-size="16" font-weight="bold">ENG-LOT-01 (45 Cerdos)</text>
    <text x="86" y="62" fill="#64748b" font-size="11">Híbrido F1 x Pietrain • Galpón Engorde 1</text>
    <text x="86" y="80" fill="#0f172a" font-size="14" font-weight="bold">Peso: 85.5 kg • Costo: $3,200 USD</text>

    <text x="16" y="154" fill="#0f172a" font-size="13" font-weight="bold">Control de Pesaje en Báscula</text>
    <rect x="14" y="166" width="280" height="38" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
    <text x="26" y="190" fill="#0f172a" font-size="13">88.2</text>
    <rect x="304" y="166" width="118" height="38" rx="8" fill="#059669"/>
    <text x="363" y="190" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">Actualizar Peso</text>

    <text x="16" y="230" fill="#0f172a" font-size="13" font-weight="bold">Historial Cronológico de Trazabilidad</text>
    <rect x="14" y="242" width="408" height="66" rx="12" fill="#ffffff" stroke="#e2e8f0"/>
    <text x="30" y="264" fill="#2563eb" font-size="10" font-weight="bold">📅 2026-08-10 • PESORAMA BÁSCULA</text>
    <text x="30" y="282" fill="#0f172a" font-size="12" font-weight="bold">Pesaje Oficial de Lote: 85.5 kg promedio</text>
    <text x="30" y="298" fill="#64748b" font-size="10">Dr. Roberto Salas (Vet) • Ganancia positiva</text>
  `;
  await renderMockup('mockup_07_trazabilidad.png', 'Trazabilidad Animal', 'Ficha e Historial Clínico Integral', s07, 'porcino');

  // 8. Prorrateo Destete
  const s08 = `
    <rect x="14" y="10" width="408" height="110" rx="16" fill="#fff1f2" stroke="#fecdd3"/>
    <text x="30" y="34" fill="#9f1239" font-size="14" font-weight="bold">Cálculo de Prorrateo al Destete</text>
    <text x="30" y="52" fill="#475569" font-size="11">Cerda: CER-101 (Duquesa) • Camada: 12 Lechones</text>
    <text x="30" y="80" fill="#be123c" font-size="20" font-weight="900">$18.50 USD / lechón</text>
    <text x="30" y="100" fill="#9f1239" font-size="10">Inversión Gestación + Lactancia: $222.00 USD</text>

    <text x="16" y="146" fill="#0f172a" font-size="13" font-weight="bold">Destino de los Lechones Destetados:</text>
    <rect x="14" y="158" width="408" height="60" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
    <text x="30" y="180" fill="#0f172a" font-size="12" font-weight="bold">Pasar a Engorde Granja (10 cerdos)</text>
    <text x="30" y="200" fill="#64748b" font-size="10">Costo de transferencia: $185.00 USD ➔ Galpón Engorde 1</text>

    <rect x="14" y="228" width="408" height="60" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
    <text x="30" y="250" fill="#0f172a" font-size="12" font-weight="bold">Venta Inmediata de Destete (2 cerdos)</text>
    <text x="30" y="270" fill="#15803d" font-size="10" font-weight="bold">Precio: $65.00 c/u • Utilidad neta: +$93.00 USD</text>
  `;
  await renderMockup('mockup_08_prorrateo_destete.png', 'Prorrateo Destete', 'Cálculo Matemático de Transferencia', s08, 'porcino');

  // 9. Almacén
  const s09 = `
    <rect x="14" y="10" width="408" height="34" rx="8" fill="#e2e8f0"/>
    <rect x="16" y="12" width="126" height="30" rx="6" fill="#059669"/>
    <text x="79" y="31" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">Alimentos</text>
    <text x="217" y="31" fill="#475569" font-size="11" font-weight="bold" text-anchor="middle">Medicinas</text>
    <text x="355" y="31" fill="#475569" font-size="11" font-weight="bold" text-anchor="middle">Otros</text>

    <rect x="14" y="56" width="408" height="88" rx="14" fill="#ffffff" stroke="#fecdd3"/>
    <text x="30" y="80" fill="#0f172a" font-size="13" font-weight="bold">Alimento Crecimiento Ceba 18% PB</text>
    <rect x="290" y="66" width="118" height="20" rx="6" fill="#fee2e2"/>
    <text x="349" y="80" fill="#b91c1c" font-size="9" font-weight="bold" text-anchor="middle">Crítico: &lt; 2 meses</text>
    <text x="30" y="102" fill="#475569" font-size="11">Stock: 45 sacos (40kg) • Consumo mensual: 32 sacos</text>
    <text x="30" y="124" fill="#059669" font-size="11" font-weight="bold">Cobertura estimada: 1.4 meses ➔ Reponer pedido</text>

    <rect x="14" y="154" width="408" height="88" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
    <text x="30" y="178" fill="#0f172a" font-size="13" font-weight="bold">Hierro Dextrano 200mg/ml (Frasco 100ml)</text>
    <rect x="320" y="164" width="88" height="20" rx="6" fill="#ecfdf5"/>
    <text x="364" y="178" fill="#047857" font-size="9" font-weight="bold" text-anchor="middle">Stock Optimo</text>
    <text x="30" y="200" fill="#475569" font-size="11">Stock: 8 frascos • Consumo mensual: 2 frascos</text>
    <text x="30" y="222" fill="#2563eb" font-size="11" font-weight="bold">Cobertura estimada: 4.0 meses</text>
  `;
  await renderMockup('mockup_09_almacen.png', 'Almacén Central', 'Inventario y Alerta &lt; 2 Meses', s09, 'almacen');

  // 10. Venta Unificada
  const s10 = `
    <rect x="14" y="10" width="408" height="130" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
    <text x="30" y="34" fill="#0f172a" font-size="14" font-weight="bold">Liquidación: Venta en Pie (25 Cerdos)</text>
    <text x="30" y="54" fill="#64748b" font-size="11">Comprador: Frigorífico Central • Lote ENG-LOT-01</text>
    <text x="30" y="82" fill="#15803d" font-size="22" font-weight="900">+$4,750 USD Ingreso</text>
    <text x="30" y="104" fill="#475569" font-size="11">Peso total: 2,625 kg • Precio: $1.81/kg</text>
    <text x="30" y="122" fill="#059669" font-size="11" font-weight="bold">Utilidad Neta: +$1,550 USD (32.6% margen)</text>
  `;
  await renderMockup('mockup_10_venta_faena.png', 'Ventas & Matadero', 'Liquidación en Pie y Canal', s10, 'balance');

  // 11. Bovino
  const s11 = `
    <rect x="14" y="10" width="408" height="110" rx="16" fill="#eff6ff" stroke="#bfdbfe"/>
    <text x="30" y="34" fill="#1e40af" font-size="14" font-weight="bold">Hato Bovino Lechero (58 Animales)</text>
    <text x="30" y="54" fill="#475569" font-size="11">44 Vacas (28 en Ordeño) • 12 Becerros • 2 Padrotes</text>
    <text x="30" y="82" fill="#1e40af" font-size="22" font-weight="900">385 Litros / Día</text>
    <text x="30" y="102" fill="#2563eb" font-size="10" font-weight="bold">Ingreso Diario Estimado: $161.70 USD ($0.42/L)</text>
  `;
  await renderMockup('mockup_11_bovino.png', 'Módulo Bovino', 'Hato Lechero y Ordeño Diario', s11, 'home');

  // 12. Avícola
  const s12 = `
    <rect x="14" y="10" width="408" height="110" rx="16" fill="#fefce8" stroke="#fef08a"/>
    <text x="30" y="34" fill="#854d0e" font-size="14" font-weight="bold">Lote Avícola 01 (850 Aves)</text>
    <text x="30" y="54" fill="#475569" font-size="11">Galpón 1 • Edad: 38 Días • Estirpe: Cobb 500</text>
    <text x="30" y="82" fill="#ca8a04" font-size="22" font-weight="900">FCR: 1.62 • 2.1 kg prom.</text>
    <text x="30" y="102" fill="#854d0e" font-size="10" font-weight="bold">Listo para faena en 4 días • Biomasa: 1,785 kg</text>
  `;
  await renderMockup('mockup_12_avicola.png', 'Módulo Avícola', 'Lotes de Engorde y Conversión FCR', s12, 'home');

  // 13. Alertas
  const s13 = `
    <rect x="14" y="10" width="408" height="110" rx="16" fill="#ecfdf5" stroke="#a7f3d0"/>
    <text x="30" y="34" fill="#065f46" font-size="14" font-weight="bold">Centro de Notificaciones y Push</text>
    <text x="30" y="54" fill="#047857" font-size="11">Notificación simulada enviada al teléfono</text>
    <text x="30" y="82" fill="#059669" font-size="18" font-weight="900">🔔 3 Alertas Activas</text>
    <text x="30" y="102" fill="#065f46" font-size="10">2 Sanitarias hoy • 1 Stock Crítico en Almacén</text>
  `;
  await renderMockup('mockup_13_alertas.png', 'Centro de Alertas', 'Notificaciones Push y Recordatorios', s13, 'home');

  console.log('All 13 Mockup PNGs successfully generated!');
}

run().catch(console.error);
