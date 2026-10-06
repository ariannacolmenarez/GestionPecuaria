const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const mockupsDir = path.resolve(__dirname, '../docs/mockups');
if (!fs.existsSync(mockupsDir)) {
  fs.mkdirSync(mockupsDir, { recursive: true });
}

// Helper to wrap UI content into a mobile device frame SVG
function createMobileFrameSVG(title, subtitle, contentSvg, activeTab = 'home') {
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
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
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
  <text x="88" y="105" fill="#ffffff" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="15" font-weight="800">${title}</text>
  <text x="88" y="122" fill="#94a3b8" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="11" font-weight="500">${subtitle}</text>
  <circle cx="430" cy="110" r="14" fill="#334155"/>
  <text x="430" y="114" fill="#ffffff" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">⚙️</text>

  <!-- Screen Content Scroll Area -->
  <g transform="translate(32, 142)">
    ${contentSvg}
  </g>

  <!-- Bottom Navigation Bar -->
  <rect x="32" y="854" width="436" height="74" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <!-- Home Tab -->
  <g transform="translate(45, 862)" cursor="pointer">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'home' ? '#ecfdf5' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">🏠</text>
    <text x="25" y="48" fill="${activeTab === 'home' ? '#059669' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Granja</text>
  </g>
  <!-- Porcino Tab -->
  <g transform="translate(132, 862)" cursor="pointer">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'porcino' ? '#fff1f2' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">🐷</text>
    <text x="25" y="48" fill="${activeTab === 'porcino' ? '#e11d48' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Porcino</text>
  </g>
  <!-- Calendario Tab -->
  <g transform="translate(220, 862)" cursor="pointer">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'calendario' ? '#eff6ff' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">📅</text>
    <text x="25" y="48" fill="${activeTab === 'calendario' ? '#2563eb' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Sanitario</text>
  </g>
  <!-- Balance Tab -->
  <g transform="translate(308, 862)" cursor="pointer">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'balance' ? '#f0fdf4' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">📊</text>
    <text x="25" y="48" fill="${activeTab === 'balance' ? '#16a34a' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Balance</text>
  </g>
  <!-- Almacén Tab -->
  <g transform="translate(395, 862)" cursor="pointer">
    <circle cx="25" cy="22" r="16" fill="${activeTab === 'almacen' ? '#fef3c7' : 'transparent'}"/>
    <text x="25" y="26" font-size="15" text-anchor="middle">📦</text>
    <text x="25" y="48" fill="${activeTab === 'almacen' ? '#d97706' : '#64748b'}" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Almacén</text>
  </g>

  <!-- Home Indicator Bar -->
  <rect x="180" y="918" width="140" height="4" rx="2" fill="#0f172a"/>
</svg>
`;
}

// 1. Screen: Home Dashboard
const screen01Svg = `
  <!-- Notification Banner -->
  <rect x="14" y="10" width="408" height="38" rx="12" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
  <text x="28" y="34" font-size="14">🔔</text>
  <text x="48" y="33" fill="#065f46" font-family="Arial, sans-serif" font-size="11" font-weight="bold">Hoy: 2 Tareas Sanitarias • Vacunación Hierro Camada 1</text>

  <!-- Financial Summary Card -->
  <rect x="14" y="56" width="408" height="154" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <text x="30" y="80" fill="#64748b" font-family="Arial, sans-serif" font-size="11" font-weight="bold" letter-spacing="0.5">RESUMEN FINANCIERO TOTAL (AGO 2026)</text>
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

  <!-- Animal Counters Header -->
  <text x="16" y="232" fill="#0f172a" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Inventario de Animales por Rubro</text>

  <!-- Rubro Card 1: Porcino -->
  <rect x="14" y="244" width="408" height="96" rx="16" fill="#fff1f2" stroke="#fecdd3" stroke-width="1"/>
  <circle cx="50" cy="292" r="24" fill="#ffe4e6"/>
  <text x="50" y="299" font-size="24" text-anchor="middle">🐷</text>
  <text x="86" y="274" fill="#9f1239" font-family="Arial, sans-serif" font-size="15" font-weight="bold">Sector Porcino</text>
  <text x="86" y="294" fill="#475569" font-family="Arial, sans-serif" font-size="11">2 Productoras • 50 Lechones • 2 Verracos • 45 Engorde</text>
  <text x="86" y="316" fill="#be123c" font-family="Arial, sans-serif" font-size="11" font-weight="bold">Total: 99 Cerdos Activos ➔</text>
  <rect x="340" y="266" width="68" height="48" rx="10" fill="#ffffff" stroke="#fecdd3"/>
  <text x="374" y="298" fill="#e11d48" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">99</text>

  <!-- Rubro Card 2: Bovino -->
  <rect x="14" y="350" width="408" height="96" rx="16" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>
  <circle cx="50" cy="398" r="24" fill="#dbeafe"/>
  <text x="50" y="405" font-size="24" text-anchor="middle">🐄</text>
  <text x="86" y="380" fill="#1e40af" font-family="Arial, sans-serif" font-size="15" font-weight="bold">Hato Bovino</text>
  <text x="86" y="400" fill="#475569" font-family="Arial, sans-serif" font-size="11">2 Padrotes • 12 Becerros • 44 Vacas (Ordeño activo)</text>
  <text x="86" y="422" fill="#2563eb" font-family="Arial, sans-serif" font-size="11" font-weight="bold">Total: 58 Cabezas ➔</text>
  <rect x="340" y="372" width="68" height="48" rx="10" fill="#ffffff" stroke="#bfdbfe"/>
  <text x="374" y="404" fill="#2563eb" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">58</text>

  <!-- Rubro Card 3: Avícola -->
  <rect x="14" y="456" width="408" height="96" rx="16" fill="#fefce8" stroke="#fef08a" stroke-width="1"/>
  <circle cx="50" cy="504" r="24" fill="#fef9c3"/>
  <text x="50" y="511" font-size="24" text-anchor="middle">🐔</text>
  <text x="86" y="486" fill="#854d0e" font-family="Arial, sans-serif" font-size="15" font-weight="bold">Lotes Avícolas</text>
  <text x="86" y="506" fill="#475569" font-family="Arial, sans-serif" font-size="11">Lote 01 (Galpón 1) • FCR 1.62 • Peso Promedio 2.1 kg</text>
  <text x="86" y="528" fill="#ca8a04" font-family="Arial, sans-serif" font-size="11" font-weight="bold">Total: 850 Pollos de Engorde ➔</text>
  <rect x="340" y="478" width="68" height="48" rx="10" fill="#ffffff" stroke="#fef08a"/>
  <text x="374" y="510" fill="#ca8a04" font-family="Arial, sans-serif" font-size="18" font-weight="900" text-anchor="middle">850</text>

  <!-- Farm Members Mini Section -->
  <rect x="14" y="562" width="408" height="70" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <text x="30" y="586" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold">Personal de Finca Asignado (4)</text>
  <circle cx="45" cy="610" r="14" fill="#3b82f6"/>
  <text x="45" y="615" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">CM</text>
  <circle cx="80" cy="610" r="14" fill="#10b981"/>
  <text x="80" y="615" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">RS</text>
  <circle cx="115" cy="610" r="14" fill="#f59e0b"/>
  <text x="115" y="615" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">AC</text>
  <circle cx="150" cy="610" r="14" fill="#6366f1"/>
  <text x="150" y="615" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">RG</text>
  <text x="180" y="614" fill="#64748b" font-family="Arial, sans-serif" font-size="11">+ Invitar miembro</text>
`;

// 2. Screen: Porcino Pestaña 1 (Rebaño y Censo)
const screen02Svg = `
  <!-- Top 5 Tabs Navigation -->
  <rect x="14" y="6" width="408" height="34" rx="8" fill="#e2e8f0"/>
  <rect x="16" y="8" width="76" height="30" rx="6" fill="#e11d48"/>
  <text x="54" y="27" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Porcinos</text>
  <text x="126" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Atajos</text>
  <text x="198" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Sanitario</text>
  <text x="268" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Balance</text>
  <text x="350" y="27" fill="#475569" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Alimento</text>

  <!-- Action Buttons Row -->
  <rect x="14" y="48" width="130" height="28" rx="8" fill="#ffe4e6" stroke="#fecdd3"/>
  <text x="79" y="66" fill="#9f1239" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">🔢 Censo en Vivo</text>

  <rect x="152" y="48" width="130" height="28" rx="8" fill="#dcfce7" stroke="#bbf7d0"/>
  <text x="217" y="66" fill="#166534" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">🚛 Salida Matadero</text>

  <rect x="290" y="48" width="132" height="28" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text x="356" y="66" fill="#334155" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">🍼 Destete Rápido</text>

  <!-- GridView 3 Columns: Engorde, Maternidad, Verracos -->
  <!-- Card 1: Engorde -->
  <rect x="14" y="86" width="130" height="136" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="34" y="96" width="90" height="50" rx="8" fill="#f1f5f9"/>
  <text x="79" y="128" font-size="28" text-anchor="middle">🐖</text>
  <text x="79" y="160" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Engorde</text>
  <text x="79" y="182" fill="#0f172a" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">45</text>
  <rect x="24" y="192" width="110" height="18" rx="9" fill="#ecfdf5"/>
  <text x="79" y="205" fill="#059669" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle">GDP: 0.78 kg/d</text>

  <!-- Card 2: Maternidad -->
  <rect x="152" y="86" width="130" height="136" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="172" y="96" width="90" height="50" rx="8" fill="#f1f5f9"/>
  <text x="217" y="128" font-size="28" text-anchor="middle">🤱</text>
  <text x="217" y="160" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Maternidad</text>
  <text x="217" y="182" fill="#0f172a" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">2</text>
  <rect x="162" y="192" width="110" height="18" rx="9" fill="#fff1f2"/>
  <text x="217" y="205" fill="#e11d48" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle">LNV: 12.8 prom</text>

  <!-- Card 3: Verracos -->
  <rect x="290" y="86" width="130" height="136" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="310" y="96" width="90" height="50" rx="8" fill="#f1f5f9"/>
  <text x="355" y="128" font-size="28" text-anchor="middle">🐗</text>
  <text x="355" y="160" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Verracos</text>
  <text x="355" y="182" fill="#0f172a" font-family="Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle">2</text>
  <rect x="300" y="192" width="110" height="18" rx="9" fill="#eff6ff"/>
  <text x="355" y="205" fill="#2563eb" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle">18 Montas Reg.</text>

  <!-- Sub-Card: Lechones en Lactancia -->
  <rect x="14" y="232" width="408" height="66" rx="14" fill="#fffbeb" stroke="#fde68a" stroke-width="1"/>
  <circle cx="45" cy="265" r="20" fill="#fef3c7"/>
  <text x="45" y="272" font-size="20" text-anchor="middle">🐖</text>
  <text x="76" y="256" fill="#92400e" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Lechones en Lactancia (4 Camadas)</text>
  <text x="76" y="274" fill="#b45309" font-family="Arial, sans-serif" font-size="11">50 lechones vivos • 6.4 kg prom. • Bajas acumuladas: 2 (3.8%)</text>
  <text x="76" y="290" fill="#d97706" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Destete programado en ~9 días</text>
  <text x="390" y="272" fill="#92400e" font-family="Arial, sans-serif" font-size="22" font-weight="900" text-anchor="end">50</text>

  <!-- Movements Reconciliation Box -->
  <rect x="14" y="308" width="408" height="106" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="28" y="330" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold">Conciliación Matemática de Movimientos</text>
  <rect x="28" y="342" width="85" height="58" rx="8" fill="#f8fafc"/>
  <text x="70" y="358" fill="#64748b" font-size="9" text-anchor="middle">Censo Inicial</text>
  <text x="70" y="384" fill="#0f172a" font-size="16" font-weight="bold" text-anchor="middle">27</text>

  <rect x="122" y="342" width="85" height="58" rx="8" fill="#f0fdf4"/>
  <text x="164" y="358" fill="#166534" font-size="9" text-anchor="middle">(+) Entradas</text>
  <text x="164" y="384" fill="#15803d" font-size="16" font-weight="bold" text-anchor="middle">+72</text>

  <rect x="216" y="342" width="85" height="58" rx="8" fill="#fef2f2"/>
  <text x="258" y="358" fill="#991b1b" font-size="9" text-anchor="middle">(-) Salidas</text>
  <text x="258" y="384" fill="#b91c1c" font-size="16" font-weight="bold" text-anchor="middle">-27</text>

  <rect x="310" y="342" width="95" height="58" rx="8" fill="#881337"/>
  <text x="357" y="358" fill="#fecdd3" font-size="9" text-anchor="middle">(=) Total Activo</text>
  <text x="357" y="384" fill="#ffffff" font-size="18" font-weight="900" text-anchor="middle">99</text>

  <!-- Traceability List Header & Filter Chips -->
  <text x="14" y="434" fill="#0f172a" font-family="Arial, sans-serif" font-size="12" font-weight="bold">Listado de Animales para Trazabilidad</text>
  <rect x="14" y="444" width="60" height="22" rx="6" fill="#0f172a"/>
  <text x="44" y="458" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">Todos</text>
  <rect x="80" y="444" width="70" height="22" rx="6" fill="#f1f5f9"/>
  <text x="115" y="458" fill="#475569" font-size="9" font-weight="bold" text-anchor="middle">Engorde (45)</text>
  <rect x="156" y="444" width="85" height="22" rx="6" fill="#f1f5f9"/>
  <text x="198" y="458" fill="#475569" font-size="9" font-weight="bold" text-anchor="middle">Maternidad (2)</text>
  <rect x="247" y="444" width="75" height="22" rx="6" fill="#f1f5f9"/>
  <text x="284" y="458" fill="#475569" font-size="9" font-weight="bold" text-anchor="middle">Verracos (2)</text>

  <!-- Traceability Animal Cards -->
  <rect x="14" y="474" width="408" height="60" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="44" cy="504" r="18" fill="#f1f5f9"/>
  <text x="44" y="510" font-size="16" text-anchor="middle">🐖</text>
  <text x="74" y="496" fill="#0f172a" font-size="12" font-weight="bold">ENG-LOT-01 • Lote Engorde Ceba (45 cerdos)</text>
  <text x="74" y="514" fill="#64748b" font-size="10">85.5 kg prom. • Galpón Engorde 1 • Costo: $3,200 USD</text>
  <text x="395" y="508" fill="#e11d48" font-size="14" font-weight="bold" text-anchor="end">➔</text>

  <rect x="14" y="542" width="408" height="60" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="44" cy="572" r="18" fill="#f1f5f9"/>
  <text x="44" y="578" font-size="16" text-anchor="middle">🤱</text>
  <text x="74" y="564" fill="#0f172a" font-size="12" font-weight="bold">CER-101 • Duquesa L3 (Lactante)</text>
  <text x="74" y="582" fill="#64748b" font-size="10">215 kg • Maternidad 04 • Camada de 12 lechones</text>
  <text x="395" y="576" fill="#e11d48" font-size="14" font-weight="bold" text-anchor="end">➔</text>
`;

// Build all mockups and write to PNG using sharp
async function generateAllMockups() {
  const screens = [
    {
      id: 'mockup_01_home_dashboard',
      title: 'Granja Arianna',
      subtitle: 'Tablero Principal e Inventario General',
      svg: screen01Svg,
      activeTab: 'home',
    },
    {
      id: 'mockup_02_porcino_pestana1',
      title: 'Menú Porcino',
      subtitle: 'Pestaña 1: Rebaño Activo y Conciliación',
      svg: screen02Svg,
      activeTab: 'porcino',
    },
  ];

  console.log('Generating mockup PNGs with sharp...');
  for (const s of screens) {
    const fullSvg = createMobileFrameSVG(s.title, s.subtitle, s.svg, s.activeTab);
    const pngPath = path.join(mockupsDir, `${s.id}.png`);
    await sharp(Buffer.from(fullSvg)).png().toFile(pngPath);
    console.log(`Saved: ${pngPath}`);
  }
}

generateAllMockups().catch(console.error);
