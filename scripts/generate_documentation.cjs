const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} = require('docx');
const PDFDocument = require('pdfkit');

const docsDir = path.resolve(__dirname, '../docs');
const mockupsDir = path.resolve(docsDir, 'mockups');
const publicDocsDir = path.resolve(__dirname, '../public/docs');

if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
if (!fs.existsSync(publicDocsDir)) fs.mkdirSync(publicDocsDir, { recursive: true });

// Ensure mockups exist
const mockupFiles = [
  { id: 1, file: 'mockup_01_home_dashboard.png', title: '1. Tablero Principal e Inventario General (Home Dashboard)', tab: 'Granja / Home' },
  { id: 2, file: 'mockup_02_porcino_pestana1.png', title: '2. Módulo Porcino - Pestaña 1: Rebaño Activo y Conciliación', tab: 'Porcino' },
  { id: 3, file: 'mockup_03_porcino_pestana2_atajos.png', title: '3. Módulo Porcino - Pestaña 2: Atajos Operativos del Rebaño', tab: 'Porcino' },
  { id: 4, file: 'mockup_04_porcino_pestana3_sanitario.png', title: '4. Módulo Porcino - Pestaña 3: Plan Sanitario y Calendario', tab: 'Sanitario' },
  { id: 5, file: 'mockup_05_porcino_pestana4_balance.png', title: '5. Módulo Porcino - Pestaña 4: Balance Financiero y Flujo de Caja', tab: 'Balance' },
  { id: 6, file: 'mockup_06_porcino_pestana5_nutricion.png', title: '6. Módulo Porcino - Pestaña 5: Nutrición y Calculadora de Bultos', tab: 'Porcino' },
  { id: 7, file: 'mockup_07_trazabilidad.png', title: '7. Trazabilidad Animal Integral (Ficha Clínica y Curva GDP)', tab: 'Porcino / Animales' },
  { id: 8, file: 'mockup_08_prorrateo_destete.png', title: '8. Prorrateo Matemático de Costo de Camada al Destete', tab: 'Porcino / Maternidad' },
  { id: 9, file: 'mockup_09_almacen.png', title: '9. Almacén Central y Control de Insumos (Alerta < 2 Meses)', tab: 'Almacén' },
  { id: 10, file: 'mockup_10_venta_faena.png', title: '10. Módulo Unificado de Ventas & Matadero (Liquidación en Pie y Canal)', tab: 'Ventas' },
  { id: 11, file: 'mockup_11_bovino.png', title: '11. Módulo Bovino (Hato Lechero, Censo y Producción Diaria)', tab: 'Bovino' },
  { id: 12, file: 'mockup_12_avicola.png', title: '12. Módulo Avícola (Lotes de Engorde, Conversión FCR y Biomasa)', tab: 'Avícola' },
  { id: 13, file: 'mockup_13_alertas.png', title: '13. Centro de Notificaciones y Push (Alertas Críticas y Sanitarias)', tab: 'Notificaciones' },
];

const screenDetails = [
  {
    id: 1,
    title: '1. Tablero Principal e Inventario General (Home Dashboard)',
    filename: 'mockup_01_home_dashboard.png',
    purpose: 'Ofrecer una vista ejecutiva centralizada con métricas operativas y financieras de todos los rubros pecuarios en tiempo real.',
    options: [
      { name: 'Selector de Rubros', desc: 'Permite alternar entre "Todo", "Porcino", "Bovino" y "Avícola" actualizando al instante los contadores globales.' },
      { name: 'Tarjeta Resumen Financiero Total', desc: 'Muestra ingresos acumulados, gastos totales, utilidad neta en USD ($8,330) y margen operativo porcentual (28.4%).' },
      { name: 'Censo Global Activo', desc: 'Desglosa la cantidad viva: 140 cerdos, 58 bovinos lecheros y 850 aves de engorde.' },
      { name: 'Barra de Alerta Rápida', desc: 'Notifica con icono de campana tareas sanitarias que vencen en la jornada de hoy (2 tareas activas).' },
      { name: 'Botones de Acceso Rápido', desc: 'Navegación inmediata hacia "Nuevo Animal", "Nueva Venta", "Plan Sanitario" y "Nuevo Insumo".' }
    ],
    formulas: [
      'Utilidad Neta Consolidada = Ingresos Totales (Venta de Animales + Venta de Leche + Faena) - Egresos Totales (Alimento + Fármacos + Mantenimiento)',
      'Margen Operativo (%) = (Utilidad Neta / Ingresos Totales) * 100'
    ]
  },
  {
    id: 2,
    title: '2. Módulo Porcino - Pestaña 1: Rebaño Activo y Conciliación de Movimientos',
    filename: 'mockup_02_porcino_pestana1.png',
    purpose: 'Auditoría en tiempo real del censo porcino, con desglose por categorías fisiológicas y balance matemático estricto de entradas y salidas.',
    options: [
      { name: 'Tarjeta Total Vivos', desc: 'Contabiliza el total del censo porcino (140 cerdos) con desglose en tiempo real.' },
      { name: 'Categorías Fisiológicas', desc: 'Pestañas interactivas para Lactancia (24 lechones), Reproductores (14 vientres/verracos) y Engorde (102 animales).' },
      { name: 'Libro de Conciliación de Movimientos', desc: 'Cuadro formal de doble entrada con Censo Inicial (130) + Entradas (+22 nacimientos/compras) - Salidas (-12 ventas/mortalidad) = Balance Activo (140).' },
      { name: 'Censo en Vivo por Lotes', desc: 'Listado dinámico de lotes con código, cantidad, peso promedio (74.5 kg), ganancia de peso (GDP: 780 g/día) y días en lote.' },
      { name: 'Botón "+ Nuevo Lote"', desc: 'Abre formulario modal para dar de alta un nuevo grupo de engorde con galpón, peso inicial y costo base.' }
    ],
    formulas: [
      'Censo Activo Final = Censo Inicial + (Nacimientos + Compras) - (Ventas a Matadero + Bajas por Mortalidad)',
      'Ganancia Diaria de Peso (GDP) = (Peso Actual en kg - Peso Inicial en kg) / Días en Etapa'
    ]
  },
  {
    id: 3,
    title: '3. Módulo Porcino - Pestaña 2: Atajos Operativos del Rebaño',
    filename: 'mockup_03_porcino_pestana2_atajos.png',
    purpose: 'Facilitar la captura rápida de datos en campo mediante tarjetas de acceso directo para los eventos zootécnicos más frecuentes.',
    options: [
      { name: 'Atajo Engorde', desc: 'Registro ágil de pesajes grupales, verificación de GDP y solicitud de transferencia de lotes listos a matadero.' },
      { name: 'Atajo Maternidad', desc: 'Confirmación de partos, cálculo automático de fecha probable de parto (FPP: 114 días) y lechones nacidos vivos/muertos.' },
      { name: 'Atajo Verracos / Padrotes', desc: 'Registro de servicios y montas naturales, evaluación de fertilidad individual y períodos de descanso reproductivo.' },
      { name: 'Atajo Lechones', desc: 'Control de camadas lactantes, sexaje (machos vs hembras) y pesaje al nacimiento.' },
      { name: 'Atajo Tareas del Día', desc: 'Listado filtrado de tareas asignadas para hoy (inyecciones de hierro, desinfección de corrales).' },
      { name: 'Atajo Conteo / Auditoría', desc: 'Formulario de reconciliación física de animales en corral frente al inventario digital en sistema.' },
      { name: 'Banner Especial "Parto & Prorrateo"', desc: 'Acceso directo a la calculadora financiera de costo de lechón al destete.' }
    ],
    formulas: [
      'Fecha Probable de Parto (FPP) = Fecha de Servicio + 114 días (3 meses, 3 semanas, 3 días)'
    ]
  },
  {
    id: 4,
    title: '4. Módulo Porcino - Pestaña 3: Plan Sanitario y Calendario',
    filename: 'mockup_04_porcino_pestana3_sanitario.png',
    purpose: 'Control sistemático del cronograma preventivo veterinario con trazabilidad de costos e insumos aplicados por animal o camada.',
    options: [
      { name: 'Selector de Vista', desc: 'Permite alternar entre "Vista Lista" y "Vista Calendario Mensual".' },
      { name: 'Resumen de Cumplimiento', desc: 'Contadores de 18 tareas completadas de 24 programadas (75% de cumplimiento preventivo).' },
      { name: 'Protocolos Frecuentes', desc: 'Día 3: Hierro Dextrano 200mg (2ml/lechón); Día 7: Mycoplasma dosis 1; Día 21: Mycoplasma dosis 2; Día 28: PCV2 Circovirus.' },
      { name: 'Imputación de Costo', desc: 'Cada dosis aplicada descuenta producto del almacén e imputa el costo ($0.35/dosis) a la ficha del lote.' },
      { name: 'Botón "+ Programar Actividad"', desc: 'Formulario para registrar una nueva tarea sanitaria con fecha, tipo de fármaco, lote diana y dosis.' }
    ],
    formulas: [
      'Costo Sanitario por Lote = Sumatoria de (Dosis Aplicadas * Costo Unitario del Medicamento)'
    ]
  },
  {
    id: 5,
    title: '5. Módulo Porcino - Pestaña 4: Balance Financiero y Flujo de Caja',
    filename: 'mockup_05_porcino_pestana4_balance.png',
    purpose: 'Monitoreo de ingresos, egresos y rentabilidad neta del rubro porcino con filtros temporales.',
    options: [
      { name: 'Selector de Período', desc: 'Alterna entre balance por "Mes" (ej. Agosto 2026) o evolución por "Año" completo.' },
      { name: 'Tarjeta Utilidad Neta Porcina', desc: 'Visualiza la ganancia líquida del mes (+$3,850 USD) y el porcentaje de margen sobre ventas (33.5%).' },
      { name: 'Desglose de Ingresos', desc: 'Separación entre venta de cerdos en pie ($9,200 USD) y venta de lechones destetados ($2,300 USD).' },
      { name: 'Desglose de Egresos', desc: 'Rubros detallados: Alimento balanceado ($5,800), Fármacos ($950) y Personal/Mantenimiento ($900).' },
      { name: 'Evolución Mensual', desc: 'Tendencia histórica comparativa con meses anteriores.' }
    ],
    formulas: [
      'Utilidad Porcina = Total Ventas Porcinas - (Costo Alimento + Costo Fármacos + Costos Fijos Imputados)',
      'Margen Neto Porcino (%) = (Utilidad Porcina / Total Ventas Porcinas) * 100'
    ]
  },
  {
    id: 6,
    title: '6. Módulo Porcino - Pestaña 5: Nutrición y Calculadora de Bultos',
    filename: 'mockup_06_porcino_pestana5_nutricion.png',
    purpose: 'Planificación técnica de las raciones por etapa zootécnica y cálculo dinámico de sacos de alimento concentrado para abastecimiento mensual.',
    options: [
      { name: 'Etapas de Alimentación', desc: 'Fichas técnicas para Preiniciador (días 21-42, 21% PB), Crecimiento (días 43-70, 18% PB), Desarrollo (días 71-110, 16% PB) y Cerdas (15% PB).' },
      { name: 'Controles Dinámicos de Población', desc: 'Selectores numéricos para cerdas en gestación (28), cerdas en lactancia (12) y cerdos en engorde (140).' },
      { name: 'Resultado Instantáneo de Consumo', desc: 'Muestra los kilogramos totales requeridos por día y por mes.' },
      { name: 'Cálculo de Bultos de 40 kg', desc: 'Genera el pedido comercial: 368 Bultos de 40 kg (14,700 kg de alimento) y presupuesto aproximado de $6,468 USD.' }
    ],
    formulas: [
      'Consumo Mensual Gestantes (kg) = Cerdas Gestantes * 2.2 kg/día * 30 días',
      'Consumo Mensual Lactantes (kg) = Cerdas Lactantes * 6.5 kg/día * 30 días',
      'Consumo Mensual Engorde (kg) = Cerdos Engorde * 2.6 kg/día * 30 días',
      'Bultos Requeridos (40 kg) = TechoMatemático(Total kg Mensual / 40)'
    ]
  },
  {
    id: 7,
    title: '7. Trazabilidad Animal Integral (Ficha Clínica y Curva GDP)',
    filename: 'mockup_07_trazabilidad.png',
    purpose: 'Ficha médica e histórica individual de cada animal con su árbol genealógico, pesajes y registro sanitario.',
    options: [
      { name: 'Encabezado del Ejemplar', desc: 'Identificador único (CER-101 "Duquesa"), raza (Landrace x Pietrain), sexo y ubicación actual (Maternidad - Jaula 04).' },
      { name: 'Historial Biométrico', desc: 'Registro secuencial de peso actual (185 kg), peso al servicio y condición corporal (3.5/5).' },
      { name: 'Historial de Partos', desc: 'Total de partos (3), lechones nacidos vivos promedio por camada (11.8) e índice de destete.' },
      { name: 'Línea de Tiempo Clínica', desc: 'Vacunas aplicadas con fecha, lote del fármaco y firma digital del médico veterinario responsable.' }
    ],
    formulas: [
      'Índice de Productividad de Cerda = (Lechones Destetados Totales / Años Productivos en Granja)'
    ]
  },
  {
    id: 8,
    title: '8. Prorrateo Matemático de Costo de Camada al Destete',
    filename: 'mockup_08_prorrateo_destete.png',
    purpose: 'Determinación exacta del costo financiero unitario de cada lechón al momento del destete para transferir a engorde o venta directa.',
    options: [
      { name: 'Parámetros de Entrada de la Madre', desc: 'Inversión en alimentación durante los 114 días de gestación más los 28 días de lactancia ($222.00 USD total).' },
      { name: 'Censo de la Camada', desc: 'Total lechones viables destetados (12 lechones).' },
      { name: 'Costo Unitario Resultante', desc: 'Cálculo automático de $18.50 USD por lechón destetado.' },
      { name: 'Destino: Transferencia a Engorde', desc: 'Transfiere 10 lechones al Galpón de Engorde 1 con un valor de inventario de $185.00 USD.' },
      { name: 'Destino: Venta Inmediata de Destetados', desc: 'Liquida 2 lechones a precio de mercado ($65.00 c/u) con una utilidad neta inmediata de +$93.00 USD.' }
    ],
    formulas: [
      'Costo Total Invertido = (Costo Alimento Gestación + Costo Alimento Lactancia + Costo Sanitario Madre + Costo Sanitario Camada)',
      'Costo Unitario por Lechón = Costo Total Invertido / Lechones Destetados Vivos',
      'Utilidad en Venta de Destete = (Precio Venta Lechón - Costo Unitario por Lechón) * Cantidad Vendida'
    ]
  },
  {
    id: 9,
    title: '9. Almacén Central y Control de Insumos (Alerta < 2 Meses)',
    filename: 'mockup_09_almacen.png',
    purpose: 'Control de existencias de materias primas, concentrados y medicinas con algoritmo preventivo de reabastecimiento.',
    options: [
      { name: 'Pestañas de Categoría', desc: 'Filtrado instantáneo entre "Alimentos", "Medicinas" y "Otros Insumos".' },
      { name: 'Algoritmo de Cobertura Crítica', desc: 'Calcula los meses de existencia dividiendo el stock actual entre el consumo mensual proyectado.' },
      { name: 'Insignia de Alerta Roja', desc: 'Señalización automática cuando la cobertura es menor a 2.0 meses (ej. Alimento Crecimiento con 1.4 meses restantes).' },
      { name: 'Insignia de Stock Óptimo', desc: 'Señalización verde para insumos con más de 2 meses de cobertura asegurada.' },
      { name: 'Botón "+ Entrada de Insumo"', desc: 'Registro de facturas de compra con cantidad de sacos/frascos, fecha de vencimiento y costo unitario.' }
    ],
    formulas: [
      'Meses de Cobertura = Stock Actual de Insumo / Consumo Mensual Promedio',
      'Condición de Alerta Crítica = Meses de Cobertura < 2.0'
    ]
  },
  {
    id: 10,
    title: '10. Módulo Unificado de Ventas & Matadero (Liquidación en Pie y Canal)',
    filename: 'mockup_10_venta_faena.png',
    purpose: 'Liquidación comercial formal de lotes de cerdos, bovinos o aves, permitiendo seleccionar modalidad en pie o en canal.',
    options: [
      { name: 'Modalidad de Venta', desc: 'Selector entre "Venta en Pie" (báscula de campo) y "Venta en Canal" (rendimiento en matadero).' },
      { name: 'Liquidación de Lote', desc: 'Ejemplo: 25 cerdos de engorde, peso total 2,625 kg (105 kg prom.), precio $1.81/kg vivo.' },
      { name: 'Métricas de Liquidación', desc: 'Ingreso Bruto de +$4,750 USD, Costo de Producción de $3,200 USD y Utilidad Neta de +$1,550 USD (32.6% margen).' },
      { name: 'Generador de Comprobante', desc: 'Emisión de recibo formal con nombre del comprador (Frigorífico Central), fecha y método de pago.' }
    ],
    formulas: [
      'Ingreso Bruto Venta en Pie = Peso Total en Báscula (kg) * Precio por Kilo Vivo ($/kg)',
      'Ingreso Venta en Canal = Peso Vivo (kg) * (Rendimiento en Canal % / 100) * Precio Canal ($/kg)',
      'Utilidad Neta de Venta = Ingreso Bruto - Costo Acumulado del Lote'
    ]
  },
  {
    id: 11,
    title: '11. Módulo Bovino (Hato Lechero, Censo y Producción Diaria)',
    filename: 'mockup_11_bovino.png',
    purpose: 'Gestión especializada de vacunos de doble propósito y lechería especializada con registro de ordeño diario.',
    options: [
      { name: 'Censo del Hato', desc: 'Total 58 animales clasificados en 44 vacas (28 en ordeño activo, 16 secas/gestantes), 12 becerros y 2 padrotes reproductores.' },
      { name: 'Pesaje de Leche Diario', desc: 'Registro del doble ordeño diario con un promedio de 385 Litros/Día (13.75 L/vaca/día).' },
      { name: 'Ingreso Diario Estimado', desc: 'Conversión económica inmediata: 385 L * $0.42/L = $161.70 USD diarios ($4,851 USD mensuales).' },
      { name: 'Eventos Reproductivos', desc: 'Registro de palpación, fechas de inseminación y control de secado 60 días antes del parto.' }
    ],
    formulas: [
      'Promedio de Leche por Vaca = Litros Totales del Día / Vacas en Ordeño Activo',
      'Ingreso Mensual por Leche = Litros Diarios * 30 días * Precio por Litro'
    ]
  },
  {
    id: 12,
    title: '12. Módulo Avícola (Lotes de Engorde, Conversión FCR y Biomasa)',
    filename: 'mockup_12_avicola.png',
    purpose: 'Supervisión técnica de galpones de pollos de engorde con cálculo de conversión alimenticia y fecha de faena.',
    options: [
      { name: 'Ficha del Lote Avícola', desc: 'Lote 01 con 850 aves en Galpón 1, edad 38 días, estirpe comercial Cobb 500.' },
      { name: 'Factor de Conversión Alimenticia (FCR)', desc: 'Métrica zootécnica de 1.62 kg de alimento por cada kg de peso vivo ganado.' },
      { name: 'Biomasa Total', desc: '1,785 kg de carne en pie listos para proceso de faena comercial en los próximos 4 días.' },
      { name: 'Mortalidad Acumulada', desc: 'Control porcentual de bajas del lote (2.1%, dentro del estándar óptimo de la industria).' }
    ],
    formulas: [
      'Conversión Alimenticia (FCR) = Total Alimento Consumido en kg / Ganancia Total de Peso Vivo en kg',
      'Biomasa Total (kg) = Número de Aves Vivas * Peso Promedio por Ave (kg)'
    ]
  },
  {
    id: 13,
    title: '13. Centro de Notificaciones y Push (Alertas Críticas y Sanitarias)',
    filename: 'mockup_13_alertas.png',
    purpose: 'Bandeja centralizada de avisos automáticos que previene desabastecimientos, omisión de vacunas o retrasos reproductivos.',
    options: [
      { name: 'Alertas Críticas (Rojas)', desc: 'Notificaciones que requieren acción inmediata (ej. Medicamento o alimento con stock agotándose en menos de 15 días).' },
      { name: 'Alertas Preventivas (Amarillas)', desc: 'Recordatorio de insumos con menos de 2 meses de cobertura o vacunas programadas para mañana.' },
      { name: 'Alertas Operativas (Verdes)', desc: 'Confirmación de sincronización con base de datos en la nube y confirmación de transferencias de lote.' },
      { name: 'Simulador Push', desc: 'Botón para enviar notificación push directa al dispositivo móvil del administrador de campo.' }
    ],
    formulas: [
      'Nivel de Severidad = Crítico (Riesgo Vital / Ruptura de Stock Inminente) | Advertencia (Umbral < 60 días) | Informativo'
    ]
  }
];

// 1. GENERATE WORD (.DOCX) DOCUMENT
async function generateDocx() {
  console.log('Generating Word Document (.docx)...');

  const children = [];

  // Title / Portada
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 200 },
      children: [
        new TextRun({
          text: 'GRANJA ARIANNA - GESTIÓN PECUARIA INTEGRAL',
          bold: true,
          size: 38,
          color: '0F172A',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'MANUAL TÉCNICO Y DOCUMENTACIÓN COMPLETA DE FUNCIONALIDADES',
          bold: true,
          size: 26,
          color: '059669',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [
        new TextRun({
          text: 'Con Mockups a Color, Reglas de Negocio, Opciones Disponibles y Fórmulas Zootécnicas',
          italics: true,
          size: 22,
          color: '64748B',
          font: 'Calibri',
        }),
      ],
    })
  );

  // Metadata Table
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Aplicación / Plataforma:', bold: true, size: 20 })] })],
              width: { size: 40, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Gestión Pecuaria (Web Responsive & Android APK Nativo)', size: 20 })] })],
              width: { size: 60, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Versión del Software:', bold: true, size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '2.5.0 Modular Backend & Frontend React 19', size: 20 })] })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Rubros Soportados:', bold: true, size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Porcino (Integral), Bovino Leche/Carne, Avícola Engorde', size: 20 })] })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Backend & Base de Datos:', bold: true, size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Express Modular (Routes/Services/DTOs) + Firebase Firestore + Offline LocalStorage', size: 20 })] })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Repositorio GitHub:', bold: true, size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'https://github.com/ariannacolmenarez/GestionPecuaria.git', size: 20, color: '2563EB' })] })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Fecha de Emisión:', bold: true, size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Octubre 2026', size: 20 })] })],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 500, after: 400 }, children: [] })
  );

  // Executive Summary
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: '1. INTRODUCCIÓN Y ALCANCE DEL SISTEMA', bold: true, color: '0F172A', size: 28 })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'La plataforma Granja Arianna - Gestión Pecuaria es una solución integral diseñada para la administración técnico-financiera de explotaciones ganaderas modernas. Integra en una única experiencia móvil y web la trazabilidad zootécnica de cada ejemplar, el control de inventario de almacén con alertas preventivas automáticas, la planificación nutricional precisa por fases de crecimiento, el seguimiento de la sanidad preventiva con imputación de costos veterinarios y la liquidación comercial de animales en pie o en canal con cálculo exacto de rentabilidad.',
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'El sistema ha sido desarrollado bajo estrictos estándares de modularización de software, garantizando que cada componente de negocio (Porcino, Bovino, Avícola, Sanidad, Almacén, Finanzas y Ventas) cuente con su propia capa independiente de rutas REST, controladores, servicios y modelos de datos tipados (DTOs), permitiendo alta escalabilidad, trabajo sin conexión (offline-first) y sincronización con Firebase Firestore.',
          size: 22,
        }),
      ],
    })
  );

  // Section 2: Architecture
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: '2. ARQUITECTURA MODULAR Y ESTÁNDARES TÉCNICOS', bold: true, color: '0F172A', size: 28 })],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: '• Frontend Multiplataforma: ',
          bold: true,
          size: 22,
        }),
        new TextRun({
          text: 'Desarrollado en React 19 con TypeScript, Tailwind CSS y componentes adaptativos para dispositivos móviles con soporte touch y desktop con barras de navegación ergonómicas.',
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: '• Backend Modular (Capas Claras): ',
          bold: true,
          size: 22,
        }),
        new TextRun({
          text: 'Estructurado en web/src/backend con enrutadores desacoplados (/api/porcino, /api/financial, /api/sanitary, /api/warehouse, /api/animals, /api/sales-slaughter), controladores con validación y servicios con lógica de negocio pura.',
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: '• Motor de Persistencia Híbrida: ',
          bold: true,
          size: 22,
        }),
        new TextRun({
          text: 'Sincronización en tiempo real con Firebase Firestore combinada con caché de alta resiliencia en LocalStorage para garantizar que la operación en corral no se interrumpa en ausencia de señal de Internet.',
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: '• Empaquetado Nativo Android: ',
          bold: true,
          size: 22,
        }),
        new TextRun({
          text: 'Configuración mediante Capacitor 8 y Gradle Kotlin DSL para generar el APK nativo instalable en smartphones y tablets de campo.',
          size: 22,
        }),
      ],
    })
  );

  // Section 3: Screen-by-Screen Detailed Documentation with Mockups
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 500, after: 300 },
      children: [new TextRun({ text: '3. DETALLE EXHAUSTIVO DE PANTALLAS, MOCKUPS Y OPCIONES DISPONIBLES', bold: true, color: '0F172A', size: 28 })],
    })
  );

  for (const screen of screenDetails) {
    const mockupPath = path.join(mockupsDir, screen.filename);

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 150 },
        children: [new TextRun({ text: screen.title, bold: true, color: '059669', size: 24 })],
      }),
      new Paragraph({
        spacing: { after: 150 },
        children: [
          new TextRun({ text: 'Propósito Operativo: ', bold: true, size: 22, color: '1E293B' }),
          new TextRun({ text: screen.purpose, size: 22, color: '334155' }),
        ],
      })
    );

    // Insert Image Mockup if it exists
    if (fs.existsSync(mockupPath)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 250 },
          children: [
            new ImageRun({
              data: fs.readFileSync(mockupPath),
              transformation: {
                width: 250,
                height: 480,
              },
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 250 },
          children: [
            new TextRun({
              text: `Figura: Mockup de interfaz para ${screen.title}`,
              italics: true,
              size: 18,
              color: '64748B',
            }),
          ],
        })
      );
    }

    // List of available options
    children.push(
      new Paragraph({
        spacing: { before: 150, after: 100 },
        children: [new TextRun({ text: 'Opciones y Elementos Interactivos Disponibles:', bold: true, size: 22, color: '0F172A' })],
      })
    );

    for (const opt of screen.options) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: `• ${opt.name}: `, bold: true, size: 20, color: '047857' }),
            new TextRun({ text: opt.desc, size: 20, color: '334155' }),
          ],
        })
      );
    }

    // Mathematical / Zootecnic formulas if any
    if (screen.formulas && screen.formulas.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 150, after: 100 },
          children: [new TextRun({ text: 'Reglas de Negocio y Fórmulas Matemáticas:', bold: true, size: 22, color: '0F172A' })],
        })
      );
      for (const formula of screen.formulas) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 360 },
            children: [
              new TextRun({ text: `📐 ${formula}`, italics: true, size: 20, color: 'B91C1C' }),
            ],
          })
        );
      }
    }

    children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
  }

  // Section 4: REST API Reference
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 500, after: 250 },
      children: [new TextRun({ text: '4. ESPECIFICACIÓN DE LA API REST MODULAR', bold: true, color: '0F172A', size: 28 })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'El backend proporciona los siguientes endpoints tipados para consumo de la interfaz web, móvil y sistemas de reportería externa:',
          size: 22,
        }),
      ],
    })
  );

  const apiEndpoints = [
    { method: 'GET', path: '/api/porcino/counters', desc: 'Devuelve los totales vivos por categoría fisiológica (total, lactantes, verracos, engorde).' },
    { method: 'GET', path: '/api/porcino/census', desc: 'Auditoría y censo detallado de animales por lotes con fechas de ingreso y pesos.' },
    { method: 'GET', path: '/api/porcino/movements', desc: 'Libro mayor de conciliación de entradas (nacimientos/compras) y salidas (ventas/mortalidad).' },
    { method: 'GET', path: '/api/porcino/engorde/metrics', desc: 'Métricas de engorde: ganancia diaria (GDP), días promedio y cerdos listos para faena.' },
    { method: 'GET', path: '/api/porcino/maternidad/metrics', desc: 'Métricas de maternidad: cerdas gestantes, lechones nacidos vivos, mortalidad predestete.' },
    { method: 'GET', path: '/api/porcino/feeding-plans', desc: 'Especificación de las 4 fases de alimentación y parámetros nutricionales.' },
    { method: 'POST', path: '/api/porcino/feeding-calculator', desc: 'Calcula bultos requeridos en base al censo activo de cerdas y cerdos de engorde.' },
    { method: 'GET', path: '/api/financial/balance', desc: 'Obtiene balance financiero con desglose por rubro, ingresos, egresos y tendencia mensual.' },
    { method: 'GET', path: '/api/sanitary/tasks', desc: 'Lista tareas veterinarias programadas con estado (pendiente/completada) y costos.' },
    { method: 'GET', path: '/api/warehouse/items', desc: 'Inventario físico con algoritmo de meses de cobertura y detección de stock crítico < 2 meses.' },
    { method: 'POST', path: '/api/sales-slaughter/sell-batch', desc: 'Liquidación comercial de lote de animales en pie o en canal con cálculo de utilidad neta.' }
  ];

  for (const ep of apiEndpoints) {
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: `[${ep.method}] `, bold: true, color: ep.method === 'GET' ? '2563EB' : '16A34A', size: 20 }),
          new TextRun({ text: `${ep.path}: `, bold: true, size: 20, color: '0F172A' }),
          new TextRun({ text: ep.desc, size: 20, color: '475569' }),
        ],
      })
    );
  }

  // Section 5: Step by Step Operator Manual
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 500, after: 250 },
      children: [new TextRun({ text: '5. GUÍA OPERATIVA DIARIA PARA EL ENCARGADO DE CAMPO', bold: true, color: '0F172A', size: 28 })],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({ text: '1. Checklist Matutino: ', bold: true, size: 22 }),
        new TextRun({ text: 'Abrir el Tablero Principal, revisar la tarjeta de tareas sanitarias del día y verificar que el stock de alimento en almacén no muestre alertas rojas de < 2 meses.', size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({ text: '2. Registro de Nacimientos y Partos: ', bold: true, size: 22 }),
        new TextRun({ text: 'Ingresar a Menú Porcino > Atajos > Maternidad. Registrar el parto de la cerda indicando nacidos vivos, muertos y peso promedio. Al momento del destete, utilizar la calculadora de Prorrateo para fijar el costo de entrada a engorde.', size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({ text: '3. Pesajes Seriados y Trazabilidad: ', bold: true, size: 22 }),
        new TextRun({ text: 'Tomar muestras de peso en corrales de engorde cada 15 días para evaluar que la GDP se mantenga por encima de 750 g/día.', size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({ text: '4. Venta y Liquidación: ', bold: true, size: 22 }),
        new TextRun({ text: 'Al transferir a matadero, ingresar a Ventas & Matadero, registrar el pesaje en báscula o rendimiento en canal para emitir el comprobante y registrar automáticamente el ingreso en el balance financiero.', size: 22 }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Granja Arianna | Manual de Usuario y Documentación Técnica',
                    size: 16,
                    color: '94A3B8',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Página ',
                    size: 16,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 16,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '94A3B8',
                  }),
                ],
              }),
            ],
          }),
        },
        children: children,
      },
    ],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  const outDocxPath = path.join(docsDir, 'MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.docx');
  const outDocxPublicPath = path.join(publicDocsDir, 'MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.docx');

  fs.writeFileSync(outDocxPath, docxBuffer);
  fs.writeFileSync(outDocxPublicPath, docxBuffer);
  console.log(`Word Document generated: ${outDocxPath} (${docxBuffer.length} bytes)`);
}

// 2. GENERATE PDF DOCUMENT
async function generatePdf() {
  console.log('Generating PDF Document (.pdf)...');

  const outPdfPath = path.join(docsDir, 'MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.pdf');
  const outPdfPublicPath = path.join(publicDocsDir, 'MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.pdf');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true,
    });

    const writeStream = fs.createWriteStream(outPdfPath);
    doc.pipe(writeStream);

    // Cover Page
    doc.rect(40, 40, 515, 762).lineWidth(2).strokeColor('#059669').stroke();
    doc.rect(44, 44, 507, 754).lineWidth(0.5).strokeColor('#CBD5E1').stroke();

    doc.moveDown(4);
    doc.fontSize(26).fillColor('#0F172A').font('Helvetica-Bold').text('GRANJA ARIANNA', { align: 'center' });
    doc.fontSize(18).fillColor('#059669').text('GESTIÓN PECUARIA INTEGRAL', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(14).fillColor('#334155').font('Helvetica-Bold').text('MANUAL DE USUARIO Y DOCUMENTACIÓN TÉCNICA', { align: 'center' });
    doc.fontSize(11).fillColor('#64748B').font('Helvetica').text('Catálogo Oficial de Pantallas, Mockups y Reglas de Negocio', { align: 'center' });

    doc.moveDown(3);
    // Draw decorative box
    doc.rect(80, 240, 435, 180).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#0F172A');

    doc.fontSize(10).font('Helvetica-Bold').text('RESUMEN DE FICHA TÉCNICA', 100, 255);
    doc.font('Helvetica').fontSize(9);
    doc.text('• Plataforma: Web Responsive & Android APK Nativo (Capacitor)', 100, 280);
    doc.text('• Versión: 2.5.0 Modular Release', 100, 300);
    doc.text('• Módulos: Porcino (Integral), Bovino Leche/Carne, Avícola Engorde', 100, 320);
    doc.text('• Backend: Express Modular en TypeScript (Controllers, Services, DTOs)', 100, 340);
    doc.text('• Base de Datos: Firebase Firestore + Persistencia LocalStorage Offline', 100, 360);
    doc.text('• Repositorio: https://github.com/ariannacolmenarez/GestionPecuaria.git', 100, 380);

    doc.moveDown(10);
    doc.fontSize(10).fillColor('#059669').font('Helvetica-Bold').text('DOCUMENTO TÉCNICO OFICIAL CON 13 MOCKUPS A COLOR', { align: 'center' });
    doc.fontSize(9).fillColor('#64748B').font('Helvetica').text('Generado para Operación y Auditoría Zootécnica - Octubre 2026', { align: 'center' });

    // Section 1: Introduction
    doc.addPage();
    doc.fontSize(16).fillColor('#0F172A').font('Helvetica-Bold').text('1. INTRODUCCIÓN Y ARQUITECTURA MODULAR');
    doc.moveDown(0.5);
    doc.fontSize(9.5).fillColor('#334155').font('Helvetica').text(
      'La plataforma Granja Arianna - Gestión Pecuaria es una solución integral diseñada para la administración zootécnica y financiera de explotaciones pecuarias modernas. Permite supervisar en tiempo real los rubros Porcino, Bovino y Avícola, controlando el ciclo biológico completo de los animales, el inventario de insumos críticos en almacén, los calendarios de vacunación y la liquidación comercial en pie y en canal.',
      { align: 'justify', lineGap: 3 }
    );
    doc.moveDown(0.5);
    doc.text(
      'El sistema implementa una arquitectura modular limpia por capas (Clean Architecture / MVC): en el frontend, componentes React 19 desacoplados con Tailwind CSS y Capacitor; en el backend, enrutadores independientes (/api/porcino, /api/financial, /api/sanitary, /api/warehouse) conectados a controladores y servicios que garantizan consistencia matemática y persistencia híbrida en Firebase Firestore y almacenamiento local.',
      { align: 'justify', lineGap: 3 }
    );

    doc.moveDown(1);
    doc.fontSize(13).fillColor('#059669').font('Helvetica-Bold').text('Matriz de Módulos Implementados:');
    doc.fontSize(9).fillColor('#1E293B').font('Helvetica');
    doc.text('1. Tablero Principal: Indicadores clave de desempeño (KPIs), utilidad consolidada y tareas del día.');
    doc.text('2. Módulo Porcino: Rebaño activo, conciliación matemática de entradas/salidas y censo en vivo.');
    doc.text('3. Atajos Operativos: Maternidad, Engorde, Padrotes/Verracos, Registro de Lechones y Conteo físico.');
    doc.text('4. Plan Sanitario: Cronograma de vacunación, desparasitación y registro de costos veterinarios.');
    doc.text('5. Balance Financiero: Flujo de caja, ingresos, egresos, margen operativo y filtros por mes/año.');
    doc.text('6. Nutrición y Alimentación: Fases zootécnicas y calculadora interactiva de bultos mensuales.');
    doc.text('7. Trazabilidad Animal: Ficha individual con historia clínica, pesajes seriados y curvas de GDP.');
    doc.text('8. Prorrateo de Costo al Destete: Algoritmo financiero de transferencia de costos madre-camada.');
    doc.text('9. Almacén Central: Insumos de concentrado y farmacia con alerta preventiva de stock < 2 meses.');
    doc.text('10. Ventas & Faena: Liquidación de animales en pie y en canal con cálculo de utilidad de lote.');
    doc.text('11. Módulo Bovino: Hato lechero, censo de vacas en ordeño y pesaje diario de producción de leche.');
    doc.text('12. Módulo Avícola: Lotes de pollo de engorde, conversión alimenticia FCR y proyección de faena.');
    doc.text('13. Alertas y Notificaciones: Avisos preventivos y críticos con soporte de notificaciones push.');

    // Screen details loop
    for (const screen of screenDetails) {
      doc.addPage();
      const mockupPath = path.join(mockupsDir, screen.filename);

      // Header of Screen
      doc.fontSize(14).fillColor('#059669').font('Helvetica-Bold').text(screen.title);
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#475569').font('Helvetica-Bold').text('Propósito: ', { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(screen.purpose);
      doc.moveDown(0.5);

      // Embed Mockup Image centered
      if (fs.existsSync(mockupPath)) {
        const imageWidth = 200;
        const imageHeight = 384;
        const xPos = (doc.page.width - imageWidth) / 2;
        doc.image(mockupPath, xPos, doc.y, { width: imageWidth });
        doc.y += imageHeight + 10;
        doc.fontSize(8).fillColor('#64748B').font('Helvetica-Oblique').text(`Mockup en Alta Resolución: ${screen.title}`, { align: 'center' });
        doc.moveDown(0.5);
      }

      // Options list
      doc.fontSize(10).fillColor('#0F172A').font('Helvetica-Bold').text('Opciones y Funcionalidades Disponibles:');
      doc.moveDown(0.3);

      for (const opt of screen.options) {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#047857').text(`• ${opt.name}: `, { continued: true });
        doc.font('Helvetica').fillColor('#334155').text(opt.desc, { lineGap: 2 });
      }

      if (screen.formulas && screen.formulas.length > 0) {
        doc.moveDown(0.4);
        doc.fontSize(9.5).fillColor('#0F172A').font('Helvetica-Bold').text('Reglas y Fórmulas de Cálculo:');
        for (const formula of screen.formulas) {
          doc.fontSize(8).font('Helvetica-Oblique').fillColor('#B91C1C').text(`  📐 ${formula}`, { lineGap: 2 });
        }
      }
    }

    // Add page numbers on all pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      // Skip cover page
      if (i > 0) {
        doc.fontSize(8).fillColor('#94A3B8').font('Helvetica');
        doc.text('Granja Arianna - Manual de Usuario y Documentación Técnica', 40, 20, { align: 'left' });
        doc.text(`Página ${i + 1} de ${range.count}`, 40, doc.page.height - 25, { align: 'center' });
      }
    }

    doc.end();

    writeStream.on('finish', () => {
      // Copy to public folder
      fs.copyFileSync(outPdfPath, outPdfPublicPath);
      const stat = fs.statSync(outPdfPath);
      console.log(`PDF Document generated: ${outPdfPath} (${stat.size} bytes)`);
      resolve();
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('Starting full documentation generation...');
  await generateDocx();
  await generatePdf();
  console.log('All documentation files generated successfully in /docs and /public/docs!');
}

main().catch(console.error);
