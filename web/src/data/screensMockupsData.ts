export interface ScreenOptionDetail {
  id: string;
  number: number;
  name: string;
  controlType: 'Botón' | 'Pestaña' | 'Tarjeta de Datos' | 'Selector / Filtro' | 'Formulario / Input' | 'Gráfico Interactivo' | 'Lista / Registro';
  description: string;
  action: string;
  backendOrDb: string;
  businessRule?: string;
}

export interface ScreenMockupDoc {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  wireframeAscii: string;
  options: ScreenOptionDetail[];
  summary: string;
}

export const screensMockupsCatalog: ScreenMockupDoc[] = [
  {
    id: 'home_dashboard',
    title: 'Pantalla 1: Home Dashboard Unificado (Granja Arianna)',
    subtitle: 'Tablero principal con consolidado multi-rubro, estado financiero general y accesos directos',
    badge: 'Vista Principal',
    summary: 'Ofrece una vista ejecutiva instantánea de toda la explotación agropecuaria (Bovina, Porcina y Avícola), la salud financiera consolidada y alertas del día.',
    wireframeAscii: `
+-----------------------------------------------------------+
| [Granja Arianna]                (Miembros) (⚙ Ajustes)    |
| (1) Banner: 🔔 Tareas Sanitarias de Hoy (5 pendientes)   |
+-----------------------------------------------------------+
| (2) TABLERO FINANCIERO CONSOLIDADO                        |
|   Gastos: $2,960   |  Ganancias: $10,820  | Utilidad: +$7,860|
|   [================= Bar Porcino/Bovino/Avícola ========] |
+-----------------------------------------------------------+
| (3) SECTOR PORCINO                                        |
|   🐷 Productoras: 48   | 🐖 Lechones: 50 | [Entrar Menú]  |
| (4) SECTOR BOVINO                                         |
|   🐮 Padrotes: 3       | 🐄 Vacas: 45    | 🐂 Becerros: 14|
| (5) SECTOR AVÍCOLA                                        |
|   🐔 Pollos de Engorde: 1,250 aves       | FCR: 1.65      |
+-----------------------------------------------------------+
| [Granja]  [Actividades]  [Balance]  [Almacén]  [Perfil]   |
+-----------------------------------------------------------+`,
    options: [
      {
        id: 'opt-home-1',
        number: 1,
        name: 'Banner de Notificaciones Push / Tareas de Hoy',
        controlType: 'Tarjeta de Datos',
        description: 'Muestra en tiempo real las tareas veterinarias y aplicaciones de medicamentos programadas para la fecha actual.',
        action: 'Al pulsar sobre el banner se abre el Centro de Alertas y Notificaciones (`AlertsCenterModal`).',
        backendOrDb: 'Consulta en Firestore colección `tasks` filtrando por fecha actual y estado `pendiente`.',
        businessRule: 'Si no existen tareas pendientes para hoy y no hay alertas críticas de almacén, el banner se oculta automáticamente.',
      },
      {
        id: 'opt-home-2',
        number: 2,
        name: 'Resumen Financiero Global (Gastos, Ganancias y Utilidad Neta)',
        controlType: 'Tarjeta de Datos',
        description: 'Calcula en tiempo real los ingresos acumulados por ventas de leche, aves y cerdos contra los egresos por alimento y vacunas.',
        action: 'Al pulsar sobre la tarjeta de balance se redirecciona al desglose de movimientos y análisis por mes/año.',
        backendOrDb: 'Suma agregada de `financial_movements` filtrados por rubro y tipo (`ingreso` / `egreso`).',
        businessRule: 'Utilidad Neta = Ganancias Totales - Gastos Totales. Si es positiva se resalta en verde esmeralda (+), si es deficitaria en rojo (-).',
      },
      {
        id: 'opt-home-3',
        number: 3,
        name: 'Módulo de Acceso a Gestión Porcina',
        controlType: 'Botón',
        description: 'Muestra los contadores en vivo de cerdas reproductoras (gestantes + lactantes) y lechones activos.',
        action: 'Navega hacia el Menú Porcino especializado con sus 5 pestañas de producción.',
        backendOrDb: 'Sincronizado en tiempo real mediante listener de Firestore en `animals` y `litters`.',
      },
      {
        id: 'opt-home-4',
        number: 4,
        name: 'Módulo de Acceso a Ganadería Bovina',
        controlType: 'Botón',
        description: 'Muestra el censo de padrotes, vacas en ordeño y terneros, junto al registro de litros diarios.',
        action: 'Abre el modal especializado `BovinoModal` para registro de ordeño matutino/vespertino y altas de animales.',
        backendOrDb: 'Colección Firestore `bovino_herd`. Cada registro de ordeño genera automáticamente un ingreso financiero en `financial_movements`.',
      },
      {
        id: 'opt-home-5',
        number: 5,
        name: 'Módulo de Acceso a Avicultura de Engorde',
        controlType: 'Botón',
        description: 'Visualiza los lotes de pollos de engorde activos, conversión alimenticia (FCR) y días de ciclo.',
        action: 'Abre el modal `AvicolaModal` para liquidación de lotes, pesado de muestras y control de bajas.',
        backendOrDb: 'Colección Firestore `avicola_lots`. Al liquidar un lote calcula biomasa total en kg e inserta el ingreso contable.',
      },
      {
        id: 'opt-home-6',
        number: 6,
        name: 'Barra Inferior de Navegación (BottomNav)',
        controlType: 'Selector / Filtro',
        description: 'Permite alternar entre el Home (`Granja`), Calendario Sanitario, Balance Contable y Almacén.',
        action: 'Conmuta la pantalla activa manteniendo el estado en memoria y persistiendo la sesión.',
        backendOrDb: 'Controlado por `useFarmController` mediante state `mockupScreen`.',
      },
    ],
  },
  {
    id: 'porcino_tab1',
    title: 'Pantalla 2: Menú Porcino - Pestaña 1: Porcinos (Rebaño Activo)',
    subtitle: 'Control segmentado del hato porcino, indicadores zootécnicos y trazabilidad por animal',
    badge: 'Módulo Porcino / Pestaña 1',
    summary: 'Segmenta el inventario porcino en 4 categorías productivas esenciales (Engorde, Maternidad, Verracos y Lechones) con cálculo de indicadores zootécnicos (GDP, FCR, LNV) y auditoría de censo en vivo.',
    wireframeAscii: `
+-----------------------------------------------------------+
| [<- Volver Home]   Rebaño Porcino Activo: 99 Cerdos       |
| (1)[Censo en Vivo]  (2)[Salida a Matadero]  (3)[Destete]  |
+-----------------------------------------------------------+
| CUADRÍCULA DE SEGMENTACIÓN (3 COLUMNAS):                 |
| (4) ENGORDE        | (5) MATERNIDAD      | (6) VERRACOS   |
|     45 Cerdos      |     48 Cerdas       |     4 Padrillos|
|     85.5 kg prom   |     30 gest / 12 lact|    18 montas  |
|   GDP: 0.78 kg/d   |   LNV: 12.8 lech.   |  Fertilidad 94%|
+-----------------------------------------------------------+
| (7) SUB-TARJETA: LECHONES EN LACTANCIA                    |
|     50 lechones vivos • 4 camadas activas • 6.4 kg prom   |
|     Mortalidad acumulada: 2 lechones (3.8%)               |
+-----------------------------------------------------------+
| (8) CONCILIACIÓN DE MOVIMIENTOS DEL REBAÑO                |
|     Censo Inicial: 27 | Entradas: +74 | Salidas: -2 | Final: 99|
+-----------------------------------------------------------+
| (9) TRAZABILIDAD DE ANIMALES REGISTRADOS                  |
|     [Todos] [Engorde] [Maternidad] [Verracos]             |
|     * CER-101 | Lactante | 215 kg | Costo: $380.50 [>]    |
|     * VER-001 | Semental | 245 kg | Costo: $680.00 [>]    |
+-----------------------------------------------------------+`,
    options: [
      {
        id: 'opt-p1-1',
        number: 1,
        name: 'Botón "Censo en Vivo"',
        controlType: 'Botón',
        description: 'Abre la auditoría en tiempo real del censo porcino desagregado por corrales, parideras y galpones.',
        action: 'Despliega el modal `PorcinoCensusModal`. Permite contrastar el conteo físico de campo contra el inventario digital.',
        backendOrDb: 'Agrupa `animals` y `litters` por el campo `penLocation`.',
        businessRule: 'Si existe discrepancia entre el inventario del sistema y el conteo físico, permite emitir un ajuste de inventario.',
      },
      {
        id: 'opt-p1-2',
        number: 2,
        name: 'Botón "Salida a Matadero"',
        controlType: 'Botón',
        description: 'Formulario unificado para liquidar cerdos de engorde o descarte bajo modalidad en pie o en canal.',
        action: 'Abre el modal `UnifiedSaleSlaughterModal`. Registra peso vivo, rendimiento canal, precio y cliente.',
        backendOrDb: 'Guarda en `sales_slaughter`, actualiza el animal a `healthStatus: Matadero` e inserta el movimiento contable en `financial_movements`.',
        businessRule: 'Calcula Utilidad Neta = Ingreso Bruto - Costo Acumulado del animal (nutrición + sanidad acumulada).',
      },
      {
        id: 'opt-p1-3',
        number: 3,
        name: 'Botón "Destete" (Prorrateo Matemático)',
        controlType: 'Botón',
        description: 'Herramienta clave de producción para destetar camadas de lechones.',
        action: 'Abre `WeaningProratingModal`. Calcula el costo acumulado de la cerda madre y lo divide entre los lechones destetados.',
        backendOrDb: 'Cierra la camada en `litters` (`weaningStatus: destetado`) y transfiere los lechones a `animals` (Engorde o Futuras Reproductoras).',
        businessRule: 'Costo por Lechón = Gasto Total de la Madre / Lechones Vivos Destetados. Si se venden de inmediato calcula la utilidad neta.',
      },
      {
        id: 'opt-p1-4',
        number: 4,
        name: 'Tarjeta Engorde (GridView Columna 1)',
        controlType: 'Tarjeta de Datos',
        description: 'Muestra el número total de cerdos en ceba, peso promedio y Ganancia Diaria de Peso (GDP).',
        action: 'Al pulsarla abre `HerdCategoryViewModal` filtrado en la categoría "Engorde", con opción de registrar nuevo lote.',
        backendOrDb: 'Calculado por `calculateEngordeMetrics(animals)`.',
        businessRule: 'GDP = (Peso Actual - Peso de Admisión) / Días en Granja.',
      },
      {
        id: 'opt-p1-5',
        number: 5,
        name: 'Tarjeta Maternidad (GridView Columna 2)',
        controlType: 'Tarjeta de Datos',
        description: 'Muestra total de hembras reproductoras clasificadas en gestantes y lactantes, más el promedio de Lechones Nacidos Vivos (LNV).',
        action: 'Al pulsarla abre el listado de madres con botón para registrar nuevo parto (`FarrowingModal`) o nueva cerda.',
        backendOrDb: 'Calculado por `calculateMaternidadMetrics(animals, litters)`.',
        businessRule: 'Verifica conteo de pezones funcionales de la cerda (mínimo 14 recomendados) para calificar como reproductora.',
      },
      {
        id: 'opt-p1-6',
        number: 6,
        name: 'Tarjeta Verracos (GridView Columna 3)',
        controlType: 'Tarjeta de Datos',
        description: 'Muestra el número de sementales activos, total de servicios de monta realizados y tasa de fertilidad esperada.',
        action: 'Al pulsarla abre el listado de verracos con botón para registrar nueva monta natural/inseminación (`BoarMatingAndNewModal`).',
        backendOrDb: 'Calculado por `calculateVerracosMetrics(animals)`.',
      },
      {
        id: 'opt-p1-7',
        number: 7,
        name: 'Sub-tarjeta Lechones en Lactancia',
        controlType: 'Tarjeta de Datos',
        description: 'Monitoreo de camadas activas al pie de la madre, peso estimado según días de vida y tasa de mortalidad predestete.',
        action: 'Al pulsarla abre el listado de camadas con opción de registrar bajas y causas de mortalidad (`PigletMortalityModal`).',
        backendOrDb: 'Calculado por `calculateLechonesMetrics(litters)`.',
        businessRule: 'Tasa de Mortalidad = (Lechones Muertos / Total Nacidos Vivos) * 100.',
      },
      {
        id: 'opt-p1-8',
        number: 8,
        name: 'Cuadro de Conciliación Matemática de Movimientos',
        controlType: 'Tarjeta de Datos',
        description: 'Demuestra matemáticamente la concordancia del inventario animal:',
        action: 'Actualiza los bloques en tiempo real: Censo Inicial + Entradas (Nacimientos + Compras) - Salidas (Matadero + Mortalidad) = Censo Final.',
        backendOrDb: 'Ejecutado por `calculateAnimalMovementsLedger(animals, litters)`.',
      },
      {
        id: 'opt-p1-9',
        number: 9,
        name: 'Listado y Filtros de Trazabilidad Animal',
        controlType: 'Lista / Registro',
        description: 'Lista los animales con chips de filtro rápido por categoría (Todos, Engorde, Maternidad, Verracos).',
        action: 'Al hacer clic sobre cualquier animal se abre el `AnimalTraceabilityModal` con su historial clínico, pesajes y eventos.',
        backendOrDb: 'Lee sub-array `traceability` del animal. Permite agregar nuevos pesajes y tratamientos que se sincronizan en Firestore.',
      },
    ],
  },
  {
    id: 'porcino_tab2',
    title: 'Pantalla 3: Menú Porcino - Pestaña 2: Atajos de Gestión Operativa',
    subtitle: 'Accesos directos a los módulos de inventario, finanzas, ventas y protocolos de lotes',
    badge: 'Módulo Porcino / Pestaña 2',
    summary: 'Dispone de 6 botones de acceso rápido indispensables para agilizar la interacción del operario en el galpón sin navegar por menús anidados.',
    wireframeAscii: `
+-----------------------------------------------------------+
| Atajos de Gestión Operativa                               |
+-----------------------------------------------------------+
| (1) [ 📦 ALMACÉN ]         | (2) [ 🧾 COMPRAS ]          |
|     Alimentos, Medicinas   |     Facturas de insumos y    |
|     Alerta 2 meses stock   |     compra de animales       |
+-----------------------------------------------------------+
| (3) [ 👥 CLIENTES / VENTAS]| (4) [ 📊 REPORTE GENERAL ]   |
|     Venta en pie, canal    |     KPIs de conversión y     |
|     Liquidación comercial  |     rentabilidad neta        |
+-----------------------------------------------------------+
| (5) [ ✅ TAREAS ]           | (6) [ 🔢 CONTEO ]            |
|     Checklist diario de    |     Auditoría física vs      |
|     operaciones de campo   |     inventario digital       |
+-----------------------------------------------------------+
| (7) BANNER DESTACADO: PRORRATEO DE PARTO Y DESTETE        |
|     Calcula el costo del lechón dividiendo gastos madre   |
+-----------------------------------------------------------+
| (8) [⚙️ Lotes & Protocolos] | (9) [📅 + Nueva Actividad]   |
+-----------------------------------------------------------+`,
    options: [
      {
        id: 'opt-p2-1',
        number: 1,
        name: 'Acceso a Almacén',
        controlType: 'Botón',
        description: 'Abre el módulo de control de stock de concentrados, vacunas y desparasitantes.',
        action: 'Despliega `WarehouseModal` con filtros por categoría y cálculo automático de cobertura en meses.',
        backendOrDb: 'Colección `warehouse`. Permite registrar consumo directo deduciendo stock e insertando el costo en finanzas.',
      },
      {
        id: 'opt-p2-2',
        number: 2,
        name: 'Acceso a Compras',
        controlType: 'Botón',
        description: 'Acceso rápido para registrar adquisición de bultos de alimento, medicamentos o compra de nuevos lechones.',
        action: 'Abre el formulario de ingreso de compras en `WarehouseModal` y añade el egreso en el Balance.',
        backendOrDb: 'Inserta en `warehouse` y `financial_movements` con tipo `egreso`.',
      },
      {
        id: 'opt-p2-3',
        number: 3,
        name: 'Acceso a Clientes / Ventas',
        controlType: 'Botón',
        description: 'Registra despachos de animales a clientes, carnicerías o frigoríficos.',
        action: 'Abre `UnifiedSaleSlaughterModal` sin animal preseleccionado para elegir el lote a comercializar.',
        backendOrDb: 'Inserta en `sales_slaughter` y genera el ingreso neto en `financial_movements`.',
      },
      {
        id: 'opt-p2-4',
        number: 4,
        name: 'Acceso a Reporte General',
        controlType: 'Botón',
        description: 'Redirecciona al análisis de rendimiento del rebaño y gráficas de balance.',
        action: 'Conmuta de pestaña hacia la Pestaña 4: Balance Financiero.',
        backendOrDb: 'Navegación interna de la vista.',
      },
      {
        id: 'opt-p2-5',
        number: 5,
        name: 'Acceso a Tareas',
        controlType: 'Botón',
        description: 'Redirecciona al control y ejecución de actividades veterinarias.',
        action: 'Conmuta de pestaña hacia la Pestaña 3: Plan Sanitario.',
        backendOrDb: 'Navegación interna de la vista.',
      },
      {
        id: 'opt-p2-6',
        number: 6,
        name: 'Acceso a Conteo',
        controlType: 'Botón',
        description: 'Abre la herramienta de auditoría de censo por corral.',
        action: 'Despliega el modal `PorcinoCensusModal`.',
        backendOrDb: 'Sincronizado con contadores de Firestore.',
      },
      {
        id: 'opt-p2-7',
        number: 7,
        name: 'Banner de Prorrateo al Destete',
        controlType: 'Botón',
        description: 'Acceso directo destacado para calcular el costo de crianza de los lechones destetados.',
        action: 'Abre el modal `WeaningProratingModal`.',
        backendOrDb: 'Ejecuta algoritmo de prorrateo dividiendo costos madre entre camada viva.',
      },
      {
        id: 'opt-p2-8',
        number: 8,
        name: 'Botón "Lotes & Protocolos"',
        controlType: 'Botón',
        description: 'Permite configurar los protocolos sanitarios estándar aplicables al abrir un nuevo lote (Engorde, Maternidad, Verracos).',
        action: 'Despliega `BatchProductionConfigModal`.',
        backendOrDb: 'Guarda en `batch_configs` de Firestore.',
      },
      {
        id: 'opt-p2-9',
        number: 9,
        name: 'Botón "+ Nueva Actividad"',
        controlType: 'Botón',
        description: 'Programación manual de una vacuna o tratamiento veterinario.',
        action: 'Despliega `AddSanitaryActivityModal`.',
        backendOrDb: 'Inserta en colección `tasks`.',
      },
    ],
  },
  {
    id: 'porcino_tab3',
    title: 'Pantalla 4: Menú Porcino - Pestaña 3: Plan Sanitario',
    subtitle: 'Calendario mensual interactivo, leyenda de procedimientos y listado de actividades',
    badge: 'Módulo Porcino / Pestaña 3',
    summary: 'Ofrece una vista dual (Calendario Mensual vs Listado Completo) para planificar, ejecutar y certificar tratamientos veterinarios, vacunas y desparasitaciones.',
    wireframeAscii: `
+-----------------------------------------------------------+
| (1) [+ Programar Actividad]     (2) [⚙️ Configurar Lotes]   |
| (3) [ 📅 Calendario Mensual ]  [ 📋 Listado de Actividades]|
+-----------------------------------------------------------+
| VISTA CALENDARIO:                                         |
| Agosto de 2026 [< Mes Actual >]                           |
| lun  mar  mié  jue  vie  sáb  dom                         |
|  27   28   29   30   31   1    2                          |
|   3    4    5    6    7   8    9                          |
|  10   11   12   13   14  15   16                          |
|  17   18  [19*] 20   21  22   23  <- (4) Días con punto    |
|  24   25   26   27   28  29   30                          |
+-----------------------------------------------------------+
| (5) LEYENDA COMPLETA DE COLORES:                          |
| ● Vacunación (Azul)    | ● Desparasitación (Ámbar)        |
| ● Hierro/Vit (Amarillo)| ● Tratamiento Clínico (Púrpura)  |
| ● Parto/Monta (Rosa)   | ● Completada (Verde)             |
+-----------------------------------------------------------+
| (6) DETALLE PARA EL DÍA SELECCIONADO (19 de Agosto):       |
|  * Vacuna Peste Porcina Clásica (Cerdas Maternidad)       |
|    Dosis: 2ml IM | Responsable: Dr. Roberto Salas         |
|    (7)[Ver Leyenda / Detalle]     (8)[✓ Completar]        |
+-----------------------------------------------------------+`,
    options: [
      {
        id: 'opt-p3-1',
        number: 1,
        name: 'Botón "Programar Actividad"',
        controlType: 'Botón',
        description: 'Permite registrar una nueva tarea sanitaria para una fecha específica.',
        action: 'Abre `AddSanitaryActivityModal`, donde se elige animal o lote, medicamento de almacén, dosis y vía de aplicación.',
        backendOrDb: 'Inserta en Firestore `tasks`. Al completarse descuenta automáticamente el medicamento del almacén.',
      },
      {
        id: 'opt-p3-2',
        number: 2,
        name: 'Botón "Configurar Lotes"',
        controlType: 'Botón',
        description: 'Permite definir plantillas de protocolos veterinarios preventivos (ej: Día 1 hierro, Día 21 micoplasma, Día 60 desparasitación).',
        action: 'Abre `BatchProductionConfigModal`. Al iniciar un lote nuevo, autogenera todas las tareas en el calendario.',
        backendOrDb: 'Persiste en `batch_configs` de Firestore y sincroniza en `tasks`.',
      },
      {
        id: 'opt-p3-3',
        number: 3,
        name: 'Selector de Vista (Calendario vs Listado)',
        controlType: 'Selector / Filtro',
        description: 'Conmuta entre la cuadrícula mensual visual y la vista de lista con buscador y filtros.',
        action: 'Cambia el estado `sanitaryViewMode` entre `calendario` y `listado`.',
        backendOrDb: 'Estado local reactivo.',
      },
      {
        id: 'opt-p3-4',
        number: 4,
        name: 'Días del Calendario con Indicador de Tarea',
        controlType: 'Selector / Filtro',
        description: 'Días que poseen tareas programadas exhiben un punto azul. Al pulsar un día filtra instantáneamente las tareas de esa fecha.',
        action: 'Actualiza `selectedDay` y renderiza el bloque inferior de tareas del día.',
        backendOrDb: 'Filtra el array reactivo `tasks`.',
      },
      {
        id: 'opt-p3-5',
        number: 5,
        name: 'Leyenda Completa de Actividades',
        controlType: 'Tarjeta de Datos',
        description: 'Guía visual que asocia cada color con una categoría médica: Azul (Vacunación), Ámbar (Desparasitación), Amarillo (Hierro/Vitaminas), Púrpura (Tratamiento), Rosa (Parto/Monta), Verde (Completada).',
        action: 'Referencia visual permanente para el personal veterinario.',
        backendOrDb: 'Mapeo estandarizado de categorías sanitarias.',
      },
      {
        id: 'opt-p3-6',
        number: 6,
        name: 'Tarjeta de Tarea Sanitaria Individual',
        controlType: 'Lista / Registro',
        description: 'Muestra título del procedimiento, lote/grupo objetivo, arete del animal, medicamento utilizado, dosis y responsable.',
        action: 'Exhibe estado (`pendiente` / `completada`).',
        backendOrDb: 'Sincronizado con Firestore `tasks`.',
      },
      {
        id: 'opt-p3-7',
        number: 7,
        name: 'Botón "Ver Leyenda / Detalle"',
        controlType: 'Botón',
        description: 'Abre la ficha completa del protocolo veterinario con instrucciones de bioseguridad.',
        action: 'Despliega el modal `SanitaryProcedureModal`.',
        backendOrDb: 'Detalle de la entidad `SanitaryTask`.',
      },
      {
        id: 'opt-p3-8',
        number: 8,
        name: 'Botón "✓ Completar / Desmarcar"',
        controlType: 'Botón',
        description: 'Alterna el estado de la tarea entre completada y pendiente.',
        action: 'Actualiza el estado de la tarea en la base de datos y descuenta los insumos del almacén si no han sido consumidos.',
        backendOrDb: 'Llama a `dbService.saveTask` y actualiza `tasks` en Firestore.',
      },
    ],
  },
  {
    id: 'porcino_tab4',
    title: 'Pantalla 5: Menú Porcino - Pestaña 4: Balance Financiero',
    subtitle: 'Estados contables clasificados por mes o año, gráfica mensual y desglose de movimientos',
    badge: 'Módulo Porcino / Pestaña 4',
    summary: 'Centraliza todos los ingresos y egresos derivados de compras de animales, ventas a matadero, ventas de lechones y consumo de insumos, permitiendo clasificar por mes o por año.',
    wireframeAscii: `
+-----------------------------------------------------------+
| (1) [ 📆 Clasificar por Mes ]    [ 📅 Clasificar por Año ]|
| (2) Selector: [Ene][Feb][Mar][Abr][May][Jun][Jul][Ago*]...|
+-----------------------------------------------------------+
| (3) RESULTADO FINANCIERO PORCINO (Agosto 2026):           |
|     Utilidad Neta: +$2,580 USD  |  Rentabilidad: ~54.3%   |
|     (4) Ingresos (+): +$4,750   | (5) Egresos (-): -$2,170|
+-----------------------------------------------------------+
| (6) GRÁFICA DE TENDENCIA MENSUAL (Ene - Dic 2026):        |
|     100% |                                [█]             |
|      50% |                           [█]  [█]             |
|       0% | [_][_][_][_][_][_][_][_]  [█]  [█]  [_][_]     |
|            Ene Feb Mar Abr May Jun   Jul  Ago  Sep Oct    |
|            ■ Verde: Ingresos  |  ■ Rojo: Egresos          |
+-----------------------------------------------------------+
| (7) DESGLOSE DE MOVIMIENTOS:                              |
|     (-) Egresos: Compra Alimento (-$1,520), Mano Obra...  |
|     (+) Ingresos: Venta 25 cerdos a Frigorífico (+$4,750) |
+-----------------------------------------------------------+`,
    options: [
      {
        id: 'opt-p4-1',
        number: 1,
        name: 'Selector de Modo: "Clasificar por Mes" vs "Clasificar por Año"',
        controlType: 'Selector / Filtro',
        description: 'Permite alternar entre el análisis granular de un mes específico o el consolidado de todo el año fiscal.',
        action: 'Actualiza el estado `balanceFilter` a `mes` o `año` y recalcula instantáneamente todas las tarjetas y gráficos.',
        backendOrDb: 'Ejecuta `calculateBalanceByPeriod(movements, filter, month, year)`.',
      },
      {
        id: 'opt-p4-2',
        number: 2,
        name: 'Selector Interactivo de los 12 Meses (Ene a Dic)',
        controlType: 'Selector / Filtro',
        description: 'Botones de los 12 meses del año para examinar cualquier período contable.',
        action: 'Al pulsar un mes actualiza `selectedBalanceMonth` y filtra los movimientos de esa fecha.',
        backendOrDb: 'Filtra fechas con prefijo `YYYY-MM`.',
      },
      {
        id: 'opt-p4-3',
        number: 3,
        name: 'Tarjeta de Utilidad Neta y Margen de Rentabilidad',
        controlType: 'Tarjeta de Datos',
        description: 'Exhibe el balance neto en dólares y el porcentaje de rentabilidad sobre ingresos.',
        action: 'Muestra color verde para ganancia (+) y rojo para déficit (-).',
        backendOrDb: 'Utilidad Neta = Total Ingresos - Total Egresos. Margen % = (Utilidad / Ingresos) * 100.',
      },
      {
        id: 'opt-p4-4',
        number: 4,
        name: 'Caja de Ingresos (+) Porcinos',
        controlType: 'Tarjeta de Datos',
        description: 'Totaliza las entradas de dinero provenientes de ventas de cerdos cebados, canales y lechones destetados.',
        action: 'Suma de todos los movimientos con `type: ingreso` en el período.',
        backendOrDb: 'Sincronizado con `financial_movements`.',
      },
      {
        id: 'opt-p4-5',
        number: 5,
        name: 'Caja de Egresos (-) Porcinos',
        controlType: 'Tarjeta de Datos',
        description: 'Totaliza los costos operativos: compra de alimento balanceado, biológicos veterinarios y compra de nuevos lechones.',
        action: 'Suma de todos los movimientos con `type: egreso` en el período.',
        backendOrDb: 'Sincronizado con `financial_movements`.',
      },
      {
        id: 'opt-p4-6',
        number: 6,
        name: 'Gráfica de Barras Dinámica (Ene - Dic)',
        controlType: 'Gráfico Interactivo',
        description: 'Visualizador de barras duales por cada mes: barra verde para ingresos y barra roja para egresos.',
        action: 'Muestra visualmente la evolución de la rentabilidad mes a mes.',
        backendOrDb: 'Generado a partir del historial mensual de movimientos.',
      },
      {
        id: 'opt-p4-7',
        number: 7,
        name: 'Desglose Detallado de Movimientos',
        controlType: 'Lista / Registro',
        description: 'Lista cada factura o recibo individual con su concepto, fecha, categoría contable y monto exacto.',
        action: 'Permite auditar el origen de cada cifra mostrada en el balance.',
        backendOrDb: 'Registros de la colección `financial_movements`.',
      },
    ],
  },
  {
    id: 'porcino_tab5',
    title: 'Pantalla 6: Menú Porcino - Pestaña 5: Alimentación & Nutrición',
    subtitle: 'Planes nutricionales por tipo de producción y calculadora interactiva de bultos requeridos',
    badge: 'Módulo Porcino / Pestaña 5',
    summary: 'Administra los planes nutricionales por etapa biológica y calcula con precisión los sacos de alimento concentrado de 40 kg necesarios para abastecer el hato.',
    wireframeAscii: `
+-----------------------------------------------------------+
| Planes Nutricionales por Tipo de Producción               |
| (1) [⚙️ Configurar Plan de Alimentación]                  |
+-----------------------------------------------------------+
| (2) SELECTOR DE TIPO DE PRODUCCIÓN:                       |
|   [Engorde Comercial] [Maternidad & Cerdas]               |
|   [Verracos Sementales] [Lechones Lactantes]              |
+-----------------------------------------------------------+
| (3) LISTADO DE ETAPAS DEL PLAN:                           |
|   * Fase 1: Pre-iniciador Transición (Día 28 al 45)       |
|     Consumo: 0.65 kg/día | Rango: 8.5 kg - 15.0 kg        |
|     Total etapa: 11.05 kg/animal | Proteína: 21% PB       |
|   * Fase 2: Crecimiento y Desarrollo (Día 46 al 90)       |
|     Consumo: 1.85 kg/día | Rango: 15.0 kg - 50.0 kg       |
|   * Fase 3: Engorde Final y Terminación (Día 91 al 150)   |
|     Consumo: 2.85 kg/día | Rango: 50.0 kg - 110.0 kg      |
+-----------------------------------------------------------+
| (4) CALCULADORA INTERACTIVA DE BULTOS (BASE 40 KG):       |
|   Cerdas Gestación: [ 30 ] cerdas (2.8 kg/d)              |
|   Cerdas Lactancia: [ 12 ] cerdas (6.5 kg/d)              |
|   Lechones Engorde: [ 140 ] cerdos                        |
|   Consumo Engorde : [ 2.2 ] kg/día/animal                 |
|   Presets: [Pre-cebo 1.2k] [Crecimiento 2.0k] [Final 2.6k]|
+-----------------------------------------------------------+
| (5) RESULTADO DE REQUERIMIENTOS MENSUALES:                |
|   Gestación: 63 sacos | Lactancia: 59 sacos | Engorde: 231|
|   TOTAL HATO: 353 bultos (14,120 kg) ~ $6,213 USD         |
+-----------------------------------------------------------+`,
    options: [
      {
        id: 'opt-p5-1',
        number: 1,
        name: 'Botón "Configurar Plan de Alimentación"',
        controlType: 'Botón',
        description: 'Permite editar, añadir o personalizar las fases de alimentación, porcentajes de proteína bruta (PB) y kilogramos diarios recomendados.',
        action: 'Abre el modal `FeedingPlanConfigModal` y persiste las configuraciones en Firestore.',
        backendOrDb: 'Llama a `dbService.saveFeedingPlans` y actualiza `feedingPlans`.',
      },
      {
        id: 'opt-p5-2',
        number: 2,
        name: 'Selector de Tipo de Producción',
        controlType: 'Selector / Filtro',
        description: 'Conmuta entre las 4 categorías: Engorde Comercial, Maternidad & Cerdas, Verracos Sementales y Lechones Lactantes.',
        action: 'Filtra las tarjetas de etapas nutricionales según el tipo seleccionado.',
        backendOrDb: 'Estado local `selectedFeedingPlanType`.',
      },
      {
        id: 'opt-p5-3',
        number: 3,
        name: 'Tarjetas de Etapas Nutricionales',
        controlType: 'Lista / Registro',
        description: 'Detalla para cada etapa: nombre de la fase, rango de días del ciclo, peso corporal meta, nombre del concentrado, consumo diario (kg/día), consumo acumulado por animal y protocolos de transición.',
        action: 'Consulta técnica y verificación zootécnica de requerimientos.',
        backendOrDb: 'Modelo `ProductionFeedingPlan`.',
      },
      {
        id: 'opt-p5-4',
        number: 4,
        name: 'Calculadora Interactiva de Bultos por Lote',
        controlType: 'Formulario / Input',
        description: 'Campos numéricos interactivos para ingresar cantidad de cerdas gestantes, lactantes y cerdos de engorde con su tasa de consumo.',
        action: 'Incluye botones presets para engorde (Pre-cebo a 1.2 kg, Crecimiento a 2.0 kg, Engorde Final a 2.6 kg).',
        backendOrDb: 'Cálculo reactivo en memoria en tiempo real.',
        businessRule: 'Total Kg Mensual = (Cerdas_Gestación * 2.8 * 30) + (Cerdas_Lactancia * 6.5 * 30) + (Cerdos_Engorde * Kg_Día * 30). Bultos = Math.ceil(Total_Kg / 40).',
      },
      {
        id: 'opt-p5-5',
        number: 5,
        name: 'Panel de Resultados Consolidados y Presupuesto',
        controlType: 'Tarjeta de Datos',
        description: 'Presenta el número de bultos necesarios para cada grupo, barra porcentual de distribución y costo estimado en dólares.',
        action: 'Permite planificar las órdenes de compra en el módulo de Almacén con antelación.',
        backendOrDb: 'Multiplica los kilogramos calculados por el costo promedio ponderado ($0.44 USD/kg).',
      },
    ],
  },
  {
    id: 'modals_catalog',
    title: 'Pantalla 7: Catálogo de Pantallas Modales Especializadas',
    subtitle: 'Detalle de los 10 modales operativos secundarios para transacciones del campo',
    badge: 'Modales Operativos',
    summary: 'Los modales proporcionan interfaces de captura dedicadas para eventos biológicos específicos sin perder el contexto de la vista principal.',
    wireframeAscii: `
+-----------------------------------------------------------+
| CATÁLOGO DE MODALES INTERACTIVOS DE LA APLICACIÓN:        |
|  1. AnimalTraceabilityModal : Historial clínico & pesajes |
|  2. FarrowingModal          : Partos (vivos/muertos/momia)|
|  3. WeaningProratingModal   : Destete & división de costo |
|  4. UnifiedSaleSlaughterModal: Venta pie/canal & matadero  |
|  5. BoarMatingAndNewModal   : Monta natural / inseminación|
|  6. PigletMortalityModal    : Registro de bajas lechones  |
|  7. WarehouseModal          : Almacén, kardex y stock     |
|  8. BatchProductionConfig   : Protocolos preventivos lote |
|  9. AddSanitaryActivityModal: Programar vacuna / medicina |
| 10. FeedingPlanConfigModal  : Personalizar fases nutrición|
+-----------------------------------------------------------+`,
    options: [
      {
        id: 'opt-m-1',
        number: 1,
        name: 'Modal de Trazabilidad (`AnimalTraceabilityModal`)',
        controlType: 'Formulario / Input',
        description: 'Muestra la ficha técnica completa del cerdo con fotografía, días de vida, peso actual vs esperado, y lista de eventos.',
        action: 'Botones para: "+ Registrar Evento" (vacuna, pesaje, traslado, observación) y "Actualizar Peso" con báscula.',
        backendOrDb: 'Actualiza el animal en `animals` y almacena el evento en su array `traceability` de Firestore.',
      },
      {
        id: 'opt-m-2',
        number: 2,
        name: 'Modal de Parto (`FarrowingModal`)',
        controlType: 'Formulario / Input',
        description: 'Registra el alumbramiento de una cerda reproductora.',
        action: 'Campos para: cerda madre, nacidos vivos, muertos (stillborn), momificados, distribución macho/hembra y notas de salud.',
        backendOrDb: 'Crea nueva camada en `litters`, cambia el estado de la madre a `Lactante` y programa automáticamente la inyección de hierro dextrano en `tasks`.',
      },
      {
        id: 'opt-m-3',
        number: 3,
        name: 'Modal de Prorrateo al Destete (`WeaningProratingModal`)',
        controlType: 'Formulario / Input',
        description: 'Cierra el ciclo de lactancia de la madre y distribuye los lechones.',
        action: 'Permite asignar lechones a: Engorde Comercial, Futuras Madres (con registro de pezones), Futuros Verracos o Venta Directa con comprador.',
        backendOrDb: 'Crea los nuevos registros en `animals` y asientos en `financial_movements`.',
      },
      {
        id: 'opt-m-4',
        number: 4,
        name: 'Modal de Venta y Matadero (`UnifiedSaleSlaughterModal`)',
        controlType: 'Formulario / Input',
        description: 'Liquidación comercial de cerdos de engorde o animales de descarte.',
        action: 'Modo en pie vs canal, cálculo de merma/rendimiento %, precio por kg, comprador y número de guía sanitaria oficial.',
        backendOrDb: 'Registra en `sales_slaughter`, marca el animal como `Matadero` e inserta el ingreso neto en `financial_movements`.',
      },
      {
        id: 'opt-m-5',
        number: 5,
        name: 'Modal de Verracos y Monta (`BoarMatingAndNewModal`)',
        controlType: 'Formulario / Input',
        description: 'Gestión de servicios reproductivos y alta de sementales.',
        action: 'Pestaña 1: Monta con verraco propio o externo (generando egreso contable). Proyecta retorno a celo (+21d), ecografía (+35d) y parto (+114d). Pestaña 2: Compra de nuevo verraco.',
        backendOrDb: 'Actualiza estado de la cerda a `Gestante` e inserta eventos en la trazabilidad de ambos reproductores.',
      },
      {
        id: 'opt-m-6',
        number: 6,
        name: 'Modal de Mortalidad de Lechones (`PigletMortalityModal`)',
        controlType: 'Formulario / Input',
        description: 'Registro riguroso de bajas durante la lactancia.',
        action: 'Ingreso de cantidad de lechones muertos, causa médica (aplastamiento, diarrea, inanición) y fecha.',
        backendOrDb: 'Deduce lechones de la camada en `litters`, actualiza el censo y añade observación de trazabilidad a la madre.',
      },
      {
        id: 'opt-m-7',
        number: 7,
        name: 'Modal de Almacén (`WarehouseModal`)',
        controlType: 'Formulario / Input',
        description: 'Kardex de existencias clasificado en Alimentos, Medicinas y Otros.',
        action: 'Deducción de insumos por aplicación médica y registro de nuevas compras con alerta si la cobertura es menor a 2 meses (60 días).',
        backendOrDb: 'Actualiza `warehouse` y genera egreso en `financial_movements`.',
      },
      {
        id: 'opt-m-8',
        number: 8,
        name: 'Modal de Protocolos por Lote (`BatchProductionConfigModal`)',
        controlType: 'Formulario / Input',
        description: 'Configuración de planes profilácticos estándar para lotes de producción.',
        action: 'Permite editar días de aplicación de vacunas para que al abrir un lote se agenden automáticamente todas sus tareas.',
        backendOrDb: 'Persiste en `batch_configs` de Firestore.',
      },
      {
        id: 'opt-m-9',
        number: 9,
        name: 'Modal de Nueva Actividad Sanitaria (`AddSanitaryActivityModal`)',
        controlType: 'Formulario / Input',
        description: 'Agendamiento individual de tratamientos y vacunas.',
        action: 'Selección de fecha, lote o arete, medicamento de almacén, dosis y responsable.',
        backendOrDb: 'Guarda en colección `tasks`.',
      },
      {
        id: 'opt-m-10',
        number: 10,
        name: 'Modal de Configuración Nutricional (`FeedingPlanConfigModal`)',
        controlType: 'Formulario / Input',
        description: 'Editor de las fases nutricionales para cada tipo de producción.',
        action: 'Edición de días de duración, consumo kg/día, peso corporal meta y proteína bruta (PB).',
        backendOrDb: 'Guarda en `feeding_plans` de Firestore.',
      },
    ],
  },
];
