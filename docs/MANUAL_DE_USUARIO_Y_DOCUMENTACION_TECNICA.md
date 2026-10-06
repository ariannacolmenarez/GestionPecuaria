# Granja Arianna - Gestión Pecuaria Integral
## Manual de Usuario y Documentación Técnica de Funcionalidades

**Versión del Sistema:** 2.5.0 Modular Release  
**Plataforma:** Web Responsive & Android APK Nativo (Capacitor)  
**Arquitectura:** Frontend React 19 + Backend Modular Express en TypeScript + Firebase Firestore / LocalStorage  
**Repositorio Oficial:** [https://github.com/ariannacolmenarez/GestionPecuaria.git](https://github.com/ariannacolmenarez/GestionPecuaria.git)  
**Formatos Disponibles:** 
* 📄 **Documento Word (.docx):** `docs/MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.docx` (y accesible en `/docs/MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.docx`)
* 📑 **Documento PDF (.pdf):** `docs/MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.pdf` (y accesible en `/docs/MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.pdf`)
* 🖼️ **Mockups de Pantallas en Alta Resolución:** `docs/mockups/`

---

## 1. Introducción y Alcance del Sistema

La plataforma **Granja Arianna - Gestión Pecuaria** es una suite tecnológica diseñada para el control integral técnico, zootécnico y económico de explotaciones agropecuarias modernas. Abarca de forma unificada:

1. **Gestión Porcina Integral:** Control del ciclo completo de producción (Gestación, Maternidad, Lactancia, Recría, Crecimiento y Engorde), libro de conciliación matemática de entradas/salidas, censo en tiempo real, registro de camadas y prorrateo de costos al destete.
2. **Gestión Bovina:** Control del hato lechero y de carne, censo de vacas en ordeño, registro diario de litros producidos e ingresos asociados.
3. **Gestión Avícola:** Lotes de pollo de engorde, control de conversión alimenticia (FCR), biomasa total en galpón y proyección de fecha óptima de faena.
4. **Almacén Central con Alerta Preventiva:** Clasificación de insumos en Alimentos, Medicinas y Materiales, con algoritmo automático de proyección de meses de cobertura y alertas rojas para insumos con existencia inferior a 2 meses.
5. **Sanidad Preventiva y Calendario:** Programación de planes de vacunación, desparasitación y vitaminización con imputación de costos unitarios directos a la ficha del lote o animal.
6. **Balance Financiero y Flujo de Caja:** Análisis de ingresos, egresos, utilidad neta en USD y margen operativo porcentual con filtros mensuales y anuales.
7. **Módulo Unificado de Ventas & Matadero:** Liquidación de lotes tanto en modalidad "En Pie" (peso vivo) como "En Canal" (rendimiento cárnico), generando comprobantes y sincronizando el balance económico.

---

## 2. Arquitectura de Software y Modularización Backend

El sistema ha sido implementado bajo estrictos principios de separación de responsabilidades:

* **Capa de Presentación (Frontend):** React 19, TypeScript, Tailwind CSS, Lucide Icons, animaciones con Motion y Capacitor para soporte móvil Android.
* **Capa de Controladores y Rutas (Backend REST):** 
  - `/api/porcino`: Contadores en vivo, censo por lotes, métricas de engorde, maternidad, lechones, verracos, planes de alimentación y calculadora interactiva.
  - `/api/financial`: Flujo de caja, ingresos, gastos, desglose por rubro y balance mensual/anual.
  - `/api/sanitary`: Tareas preventivas veterinarias, estados (pendiente/completada), calendario y costos.
  - `/api/warehouse`: Inventario, rotación de stock, registro de compras y alerta de reabastecimiento (< 2 meses).
  - `/api/sales-slaughter`: Liquidaciones comerciales en pie y canal con cálculo de rendimiento.
  - `/api/animals`: Trazabilidad animal individual, pesajes y altas/bajas.
* **Capa de Servicios y Negocio Puro:** Aislamiento de fórmulas matemáticas (FCR, GDP, Prorrateo, Balance).
* **Capa de Persistencia Híbrida:** Firebase Firestore con respaldo y sincronización automática en LocalStorage para trabajo 100% offline en el campo.

---

## 3. Catálogo Detallado de Pantallas, Mockups y Opciones Disponibles

### Pantalla 1: Tablero Principal e Inventario General (Home Dashboard)
* **Archivo de Mockup:** `docs/mockups/mockup_01_home_dashboard.png`
* **Propósito:** Brindar un panorama ejecutivo con indicadores clave consolidados de todos los rubros pecuarios.
* **Opciones y Botones Disponibles:**
  - **Selector de Rubro:** Botones interactivos para alternar entre "Todo", "Porcino", "Bovino" y "Avícola".
  - **Tarjeta Resumen Financiero Total:** Muestra la utilidad neta consolidada (+$8,330 USD) y margen porcentual (+28.4%).
  - **Censo Global de Animales Vivos:** Visualización de 140 cerdos, 58 bovinos y 850 aves.
  - **Barra de Alerta Rápida:** Banner superior con campana que avisa tareas que vencen hoy (ej. Vacunación de Hierro Camada 1).
  - **Acciones Rápidas:** Botones para "Nueva Venta", "Nuevo Animal", "Plan Sanitario" y "Nuevo Insumo".
* **Fórmula de Negocio:**
  $$\text{Utilidad Neta Consolidada} = \sum \text{Ingresos (Ventas en Pie, Leche, Canal)} - \sum \text{Egresos (Alimento, Fármacos, Gastos)}$$

---

### Pantalla 2: Módulo Porcino - Pestaña 1: Rebaño Activo y Conciliación
* **Archivo de Mockup:** `docs/mockups/mockup_02_porcino_pestana1.png`
* **Propósito:** Censo activo categorizado y cuadre matemático formal de entradas y salidas de cerdos.
* **Opciones y Botones Disponibles:**
  - **Tarjeta Total Vivos:** 140 cerdos en inventario activo.
  - **Categorías Fisiológicas:** Lactancia (24 lechones), Reproductores (14 cerdas/verracos), Engorde (102 animales).
  - **Libro de Conciliación de Movimientos:** Cuadro de doble partida con Censo Inicial (130) + Entradas (+22 nacimientos/compras) - Salidas (-12 ventas/mortalidad) = Balance Activo (140 cerdos).
  - **Censo en Vivo por Lotes:** Fichas de lotes (ENG-LOT-01, MAT-L02) con peso promedio (74.5 kg) y ganancia diaria de peso (GDP: 780 g/día).
  - **Botón "+ Nuevo Lote":** Registro de un nuevo grupo con corral asignado y fecha de entrada.
* **Fórmulas de Negocio:**
  $$\text{Censo Activo Final} = \text{Censo Inicial} + (\text{Nacimientos} + \text{Compras}) - (\text{Ventas} + \text{Mortalidad})$$
  $$\text{Ganancia Diaria de Peso (GDP)} = \frac{\text{Peso Actual (kg)} - \text{Peso Inicial (kg)}}{\text{Días Transcurridos en la Etapa}}$$

---

### Pantalla 3: Módulo Porcino - Pestaña 2: Atajos Operativos del Rebaño
* **Archivo de Mockup:** `docs/mockups/mockup_03_porcino_pestana2_atajos.png`
* **Propósito:** Acceso rápido a las operaciones más frecuentes en la rutina diaria de la granja.
* **Opciones y Botones Disponibles:**
  - **Atajo Engorde:** Registro de pesajes, cálculo de GDP y preparación de lotes para faena.
  - **Atajo Maternidad:** Registro de servicios, partos programados y lechones nacidos.
  - **Atajo Verracos / Padrotes:** Control de montas naturales, fertilidad por macho y descansos.
  - **Atajo Lechones:** Sexaje, pesaje individual y asignación de camada.
  - **Atajo Tareas del Día:** Lista de actividades programadas para la jornada.
  - **Atajo Conteo / Auditoría:** Cuadre físico de cerdos en corral contra la base de datos.
  - **Banner Especial "Parto & Prorrateo de Costo de Lechones":** Acceso directo a la herramienta matemática de prorrateo.

---

### Pantalla 4: Módulo Porcino - Pestaña 3: Plan Sanitario y Calendario
* **Archivo de Mockup:** `docs/mockups/mockup_04_porcino_pestana3_sanitario.png`
* **Propósito:** Gestión integral del cronograma veterinario preventivo y curativo.
* **Opciones y Botones Disponibles:**
  - **Selector de Vista:** Alternar entre "Vista Lista" y "Vista Calendario".
  - **Indicador de Cumplimiento:** 18 de 24 tareas completadas (75% de cumplimiento).
  - **Protocolos Predefinidos:** Hierro Dextrano (Día 3), Mycoplasma (Día 7 y 21), PCV2 Circovirus (Día 28).
  - **Estados de Tarea:** Pendiente, En Proceso, Completada (con descuento automático de inventario y costo).
  - **Botón "+ Programar Actividad":** Apertura de modal para agendar una nueva tarea sanitaria con fecha, lote, producto y dosis.

---

### Pantalla 5: Módulo Porcino - Pestaña 4: Balance Financiero y Flujo de Caja
* **Archivo de Mockup:** `docs/mockups/mockup_05_porcino_pestana4_balance.png`
* **Propósito:** Evaluación financiera y rentabilidad neta específica de la explotación porcina.
* **Opciones y Botones Disponibles:**
  - **Selector Temporal:** Filtro de balance por "Mes" (Agosto 2026) o histórico por "Año".
  - **Tarjeta Utilidad Neta Porcina:** Margen neto de +$3,850 USD (33.5% de margen sobre ventas).
  - **Ingresos Detallados:** Ventas de cerdos en pie ($9,200 USD) y lechones destetados ($2,300 USD).
  - **Egresos Detallados:** Alimento balanceado ($5,800 USD), Medicinas ($950 USD) y Mantenimiento ($900 USD).
  - **Tendencia Histórica:** Gráfica comparativa de rentabilidad mensual.

---

### Pantalla 6: Módulo Porcino - Pestaña 5: Nutrición y Calculadora de Bultos
* **Archivo de Mockup:** `docs/mockups/mockup_06_porcino_pestana5_nutricion.png`
* **Propósito:** Dosificación científica por fases de crecimiento y cálculo exacto de compras mensuales de alimento.
* **Opciones y Botones Disponibles:**
  - **Fases Técnicas:** Preiniciador (21-42 días, 21% PB), Crecimiento (43-70 días, 18% PB), Desarrollo (71-110 días, 16% PB) y Cerdas (15% PB).
  - **Controles de Censo:** Configuración de 28 cerdas en gestación, 12 cerdas en lactancia y 140 cerdos de engorde.
  - **Resultado Inmediato:** 368 Bultos de 40 kg requeridos (14,700 kg mensuales).
  - **Presupuesto Estimado:** Valor de compra proyectado de ~$6,468 USD.
* **Fórmula de Cálculo:**
  $$\text{Bultos Requeridos (40 kg)} = \left\lceil \frac{\sum (\text{Cabezas} \times \text{Consumo Diario (kg)} \times 30)}{40} \right\rceil$$

---

### Pantalla 7: Trazabilidad Animal Integral (Ficha Clínica y Curva GDP)
* **Archivo de Mockup:** `docs/mockups/mockup_07_trazabilidad.png`
* **Propósito:** Expediente digital único por ejemplar que garantiza trazabilidad de origen y salud.
* **Opciones y Botones Disponibles:**
  - **Datos del Ejemplar:** ID CER-101 ("Duquesa"), raza Landrace x Pietrain, sexo hembra, ubicación Maternidad Jaula 04.
  - **Condición Corporal y Peso:** 185 kg de peso actual, historial de pesajes y condición 3.5/5.
  - **Historial Reproductivo:** 3 partos registrados, 11.8 lechones nacidos vivos promedio.
  - **Línea de Tiempo Sanitaria:** Vacunas aplicadas, fechas, números de lote del medicamento y veterinario responsable.

---

### Pantalla 8: Prorrateo Matemático de Costo de Camada al Destete
* **Archivo de Mockup:** `docs/mockups/mockup_08_prorrateo_destete.png`
* **Propósito:** Determinar con rigor contable el costo unitario de cada lechón al momento del destete.
* **Opciones y Botones Disponibles:**
  - **Inversión en la Madre:** Alimento consumido en 114 días de gestación + 28 días de lactancia ($222.00 USD).
  - **Camada Destetada:** 12 lechones viables.
  - **Costo Resultante:** **$18.50 USD por lechón destetado**.
  - **Destino a Engorde:** Opción para transferir 10 lechones al Galpón de Engorde 1 con valor inicial de inventario de $185.00 USD.
  - **Destino Venta Inmediata:** Opción para vender 2 lechones a $65.00 c/u con utilidad neta de +$93.00 USD.
* **Fórmula de Prorrateo:**
  $$\text{Costo Unitario por Lechón} = \frac{\text{Costo Alimento Gestación} + \text{Costo Alimento Lactancia} + \text{Costos Sanitarios Madre y Camada}}{\text{Lechones Vivos Destetados}}$$

---

### Pantalla 9: Almacén Central y Control de Insumos (Alerta < 2 Meses)
* **Archivo de Mockup:** `docs/mockups/mockup_09_almacen.png`
* **Propósito:** Administración de existencias con sistema proactivo de alerta para evitar desabastecimientos.
* **Opciones y Botones Disponibles:**
  - **Pestañas de Categoría:** Alimentos, Medicinas y Otros Insumos.
  - **Insignia de Alerta Roja (< 2 Meses):** Alimento Crecimiento Ceba 18% PB con 45 sacos en stock y consumo de 32 sacos/mes = **1.4 meses de cobertura** (¡Crítico: reponer pedido!).
  - **Insignia de Stock Óptimo:** Hierro Dextrano con 8 frascos en stock y consumo de 2 frascos/mes = **4.0 meses de cobertura**.
  - **Botón "+ Entrada de Insumo":** Registro de compras recibidas.
* **Fórmula de Cobertura:**
  $$\text{Meses de Cobertura} = \frac{\text{Stock Físico Actual}}{\text{Consumo Mensual Promedio}}$$

---

### Pantalla 10: Módulo Unificado de Ventas & Matadero (Liquidación en Pie y Canal)
* **Archivo de Mockup:** `docs/mockups/mockup_10_venta_faena.png`
* **Propósito:** Liquidación formal de animales listos para faena o venta en pie.
* **Opciones y Botones Disponibles:**
  - **Modalidad:** Selector entre "Venta en Pie" y "Venta en Canal".
  - **Detalle de Liquidación:** 25 cerdos de engorde, peso total 2,625 kg a $1.81/kg.
  - **Resultados:** Ingreso bruto de **+$4,750 USD**, costo de producción de $3,200 USD y utilidad neta de **+$1,550 USD** (32.6% margen).
  - **Emisión de Comprobante:** Registro de comprador (Frigorífico Central) y método de pago.

---

### Pantalla 11: Módulo Bovino (Hato Lechero, Censo y Producción Diaria)
* **Archivo de Mockup:** `docs/mockups/mockup_11_bovino.png`
* **Propósito:** Gestión de vacas en ordeño, secas, becerros y registro de litros producidos por día.
* **Opciones y Botones Disponibles:**
  - **Censo Bovino:** 58 cabezas (44 vacas, 12 becerros, 2 toros padrotes).
  - **Producción Diaria de Leche:** 385 Litros/Día (13.75 L/vaca/día en 28 vacas en ordeño).
  - **Ingreso Diario Calculado:** $161.70 USD diarios a $0.42/L ($4,851 USD mensuales proyectados).

---

### Pantalla 12: Módulo Avícola (Lotes de Engorde, Conversión FCR y Biomasa)
* **Archivo de Mockup:** `docs/mockups/mockup_12_avicola.png`
* **Propósito:** Supervisión intensiva de galpones de pollos de engorde.
* **Opciones y Botones Disponibles:**
  - **Lote Activo:** 850 aves, 38 días de edad, estirpe Cobb 500 en Galpón 1.
  - **Factor de Conversión Alimenticia (FCR):** 1.62 kg alimento / kg carne ganada.
  - **Biomasa en Galpón:** 1,785 kg de peso vivo listos para faena comercial en 4 días.

---

### Pantalla 13: Centro de Notificaciones y Push (Alertas Críticas y Sanitarias)
* **Archivo de Mockup:** `docs/mockups/mockup_13_alertas.png`
* **Propósito:** Notificación anticipada de tareas, vencimientos y riesgos operativos.
* **Opciones y Botones Disponibles:**
  - **Alertas Críticas:** Avisos de rotura inminente de stock o mortalidad fuera de rango.
  - **Alertas Sanitarias:** Recordatorios de vacunas que vencen hoy o mañana.
  - **Simulador de Notificación Push:** Botón para disparar alertas directas al smartphone del operario.

---

## 4. Guía de Ejecución y Descarga de Archivos

Los documentos generados se encuentran disponibles en el servidor local y en el proyecto:

1. **Documento Word (.docx):**  
   Ruta local: `/app/applet/docs/MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.docx`  
   URL web: `http://localhost:3000/docs/MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.docx`

2. **Documento PDF (.pdf):**  
   Ruta local: `/app/applet/docs/MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.pdf`  
   URL web: `http://localhost:3000/docs/MANUAL_DE_USUARIO_Y_DOCUMENTACION_TECNICA.pdf`

3. **Carpeta de Imágenes de Mockups (.png):**  
   Ruta local: `/app/applet/docs/mockups/`  
   URL web: `http://localhost:3000/docs/mockups/`
