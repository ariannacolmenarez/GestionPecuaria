import { UserStory, TechStackItem, FlowStep } from '../types';

export const userStoriesDoc: UserStory[] = [
  {
    id: 'HU-01',
    title: 'Gestión Multiusuario, Roles y Autenticación',
    role: 'Administrador o trabajador de la finca',
    want: 'Iniciar sesión e invitar a otros miembros a la aplicación con roles específicos',
    soThat: 'Garantizar el acceso seguro, controlado y colaborativo a la información de la finca',
    acceptanceCriteria: [
      {
        section: 'Interfaz de Usuario (UI)',
        points: [
          'Pantalla de Login accesible mediante correo electrónico y contraseña.',
          'Manejo de recuperación de contraseña y estados de error con feedback claro.',
          'Sección superior en el Home que muestra la lista de avatares de los miembros activos ("Miembros", botón de invitación rápida y opción "Ver todos").',
          'Modal de gestión de miembros con roles: Administrador, Veterinario, Operador, Trabajador.',
        ],
      },
      {
        section: 'Backend y Seguridad',
        points: [
          'Integración nativa con Firebase Authentication (Email/Password).',
          'Colección Cloud Firestore `users` y subcolección `farms/{farmId}/members` para almacenar datos de perfil y roles.',
          'Regla estricta: Solo usuarios autenticados con membresía activa en la granja pueden consultar o mutar datos.',
          'Role-Based Access Control (RBAC): Los trabajadores no pueden ver reportes contables sensibles; los veterinarios tienen acceso prioritario a Plan Sanitario.',
        ],
      },
    ],
    businessRule: 'Solo usuarios con rol Administrador pueden invitar nuevos miembros, remover accesos y editar presupuestos globales.',
  },
  {
    id: 'HU-02',
    title: 'Dashboard Principal e Inventario General (Home)',
    role: 'Administrador de la granja',
    want: 'Visualizar en la pantalla principal un tablero consolidado con el resumen financiero y los contadores de animales por rubro',
    soThat: 'Tener una vista global rápida y en tiempo real de la gestión bovina, porcina y avícola',
    acceptanceCriteria: [
      {
        section: 'Contadores Pecuarios',
        points: [
          'Sección Avícola: Contador de "Pollos de engorde" con botón interactivo que redirecciona a la gestión avícola.',
          'Sección Porcina: Contadores de "Productoras" y "Lechones" con botón que redirecciona al Menú Porcino.',
          'Sección Bovina: Contadores de "Padrotes", "Becerros" y "Vacas" con botón que redirecciona a la gestión bovina.',
        ],
      },
      {
        section: 'Tablero Financiero Consolidado',
        points: [
          'Tarjeta de resumen con el cálculo automático de: Gastos Totales, Ganancias Totales y Utilidad Neta.',
          'Desglose comparativo por cada uno de los 3 rubros producidos (Bovina, Porcina y Avícola) con barras de progreso proporcional.',
        ],
      },
      {
        section: 'Navegación Global',
        points: [
          'Barra de navegación inferior fija (BottomNavigationBar) con 5 accesos directos: 1. Granja (Home), 2. Actividades / Calendario, 3. Calculadora / Balance, 4. Notificaciones, 5. Perfil.',
        ],
      },
    ],
    businessRule: 'La Utilidad neta se calcula como `Utilidad = Ganancias - Gastos`. Si la utilidad es negativa, el valor debe destacarse en rojo con alerta de déficit.',
  },
  {
    id: 'HU-03',
    title: 'Opción Porcina: Menú Porcino (Pestaña 1)',
    role: 'Encargado del sector porcino',
    want: 'Acceder a una pestaña dedicada dentro del menú porcino con tarjetas informativas clasificadas',
    soThat: 'Consultar de forma rápida y visual el estado de los diferentes segmentos del rebaño de cerdos',
    acceptanceCriteria: [
      {
        section: 'Diseño e Interacción',
        points: [
          'Vista en cuadrícula (GridView) de 3 columnas con bordes redondeados y fondo gris claro suave.',
          'Tarjeta Engorde: Muestra imagen o vector ilustrativo de cerdo y contador numérico que suma los animales registrados en engorde.',
          'Tarjeta Maternidad: Muestra imagen ilustrativa y contador numérico de hembras en parideras o gestación.',
          'Tarjeta Verracos: Muestra imagen ilustrativa de verraco y contador numérico de machos reproductores activos.',
          'Al pulsar cualquiera de las tarjetas, se abre la vista detallada con el listado de animales pertenecientes a esa categoría, su código de arete, peso y estado.',
        ],
      },
    ],
    businessRule: 'La suma de las tarjetas en Pestaña 1 más los lechones registrados en lactancia debe coincidir con el total de animales porcinos del inventario general.',
  },
  {
    id: 'HU-04',
    title: 'Opción Porcina: Atajos de Gestión Operativa (Pestaña 2)',
    role: 'Operador de la finca',
    want: 'Disponer de una pestaña de "Atajos" con acceso rápido e intuitivo a los módulos operativos',
    soThat: 'Registrar movimientos de almacén, compras, ventas y tareas sin navegar por menús complejos en el campo',
    acceptanceCriteria: [
      {
        section: 'Módulos Obligatorios en Cuadrícula (GridView)',
        points: [
          '1. Almacén: Acceso al inventario discriminado en Alimentos, Medicinas y Otros.',
          '2. Compras: Icono representativo de recibo/dinero para registrar facturas y adquisiciones de insumos.',
          '3. Clientes / Ventas: Icono de grupo/trato para registrar ventas de cerdos en pie o en canal con cálculo de utilidad.',
          '4. Reporte General: Descarga y visualización de KPIs de mortalidad, ganancia diaria de peso (GDP) y conversión alimenticia.',
          '5. Tareas: Listado y asignación de tareas operativas diarias con checklist para el personal de campo.',
          '6. Conteo: Función de verificación física de lote para auditorías de inventario animal.',
        ],
      },
    ],
  },
  {
    id: 'HU-05',
    title: 'Opción Porcina: Plan Sanitario Interactivo (Pestaña 3)',
    role: 'Veterinario / Encargado de sanidad',
    want: 'Ver un calendario mensual interactivo con marcas en los días que tienen actividades programadas',
    soThat: 'Administrar los esquemas sanitarios, tratamientos, vacunas y desparasitaciones de todos los porcinos de la finca',
    acceptanceCriteria: [
      {
        section: 'Calendario Mensual',
        points: [
          'Visualización del mes transcurriendo (por ejemplo, Agosto de 2026) con botones de navegación hacia meses anteriores y posteriores.',
          'Marcas visuales (puntos/insignias) en las fechas con actividades profilácticas o veterinarias pendientes.',
          'Resaltado visual distintivo en color azul para el día actual y para el día seleccionado por el usuario.',
        ],
      },
      {
        section: 'Detalle de Actividades Diarias',
        points: [
          'Sección inferior que lista dinámicamente las tareas programadas para la fecha seleccionada en el calendario.',
          'Estado vacío controlado: Si no hay tareas para la fecha, mostrar el mensaje exacto: "No hay tareas para este día, agrega una".',
          'Al hacer clic sobre cualquier actividad, se debe abrir un modal o leyenda descriptiva detallando el procedimiento veterinario específico a realizar (vía de administración, dosis por kg, precauciones y tiempo de retiro).',
          'Opción de marcar la actividad como completada, lo cual descuenta automáticamente la medicina del almacén.',
        ],
      },
    ],
    businessRule: 'Completar una tarea sanitaria debe descontar de manera automática el volumen o dosis de medicamento del Almacén e imputar el gasto a la ficha del animal/lote.',
  },
  {
    id: 'HU-06',
    title: 'Opción Porcina: Balance Financiero de Porcinos (Pestaña 4)',
    role: 'Administrador financiero',
    want: 'Consultar el desglose detallado e histórico de ingresos y egresos vinculados al rubro porcino',
    soThat: 'Analizar los costos de producción y la rentabilidad del sector',
    acceptanceCriteria: [
      {
        section: 'Desglose de Saldos por Categoría',
        points: [
          'Egresos en color naranja/rojo con signo (-): Compra de cerdos, Alimento Balanceado, Balanceado Cerdas, Balanceado Verracos, Vacunación, Medicamentos, Gastos Generales, Otros.',
          'Ingresos en color verde con signo (+): Venta de cerdos (pie o canal), Venta de cerdas, Venta de verracos, Venta de pajuelas / dosis seminales.',
        ],
      },
      {
        section: 'Gráfica de Tendencia y Filtros',
        points: [
          'Gráfica de barras o líneas comparativas de Ingresos vs Egresos por mes (Ene, Feb, Mar... Dic).',
          'Interruptor / Selector para conmutar fácilmente entre "Balance Total" (histórico acumulado) y "Balance del Mes Actual".',
        ],
      },
    ],
  },
  {
    id: 'HU-07',
    title: 'Opción Porcina: Calendario de Alimentación y Fases del Ciclo (Pestaña 5)',
    role: 'Nutricionista y Operador de granja',
    want: 'Visualizar una línea de tiempo e infografía del calendario de alimentación de cada lote según edad y ciclo reproductivo',
    soThat: 'Garantizar el suministro exacto de nutrientes y optimizar los costos de alimento balanceado',
    acceptanceCriteria: [
      {
        section: 'Etapas del Ciclo Reproductivo (150 días totales)',
        points: [
          'Fase 1: Gestación Temprana (Días 1 - 85). Consumo diario base: 2.2 a 2.5 kg/día. Inversión estimada: 187 kg.',
          'Fase 2: Gestación Avanzada (Días 86 - 114). Consumo diario base: 3.0 a 3.5 kg/día. Inversión estimada: 92 kg.',
          'Fase 3: Lactancia (Días 115 - 142 / Duración 21 a 28 días). Consumo base: 6.0 a 7.5 kg/día (a voluntad según tamaño de camada). Inversión: 135 kg.',
          'Fase 4: Reacondicionamiento / Post-Destete (Días 143 - 147). Consumo base: 3.5 a 4.0 kg/día.',
        ],
      },
      {
        section: 'Protocolos de Transición Gradual',
        points: [
          'Transición Gestación a Lactancia (Días 110 al 114/115 - 5 días previo al parto):',
          '  * Día 110: 75% Alimento Gestación (2.25 kg) + 25% Alimento Lactancia (0.75 kg) = 3.0 kg/día.',
          '  * Día 111: 50% Alimento Gestación (1.50 kg) + 50% Alimento Lactancia (1.50 kg) = 3.0 kg/día.',
          '  * Día 112: 50% Alimento Gestación (1.50 kg) + 50% Alimento Lactancia (1.50 kg) = 3.0 kg/día.',
          '  * Día 113: 25% Alimento Gestación (0.75 kg) + 75% Alimento Lactancia (2.25 kg) = 3.0 kg/día.',
          '  * Día 114 / Parto: 100% Alimento Lactancia (3.0 kg con incremento progresivo a voluntad).',
          'Transición Lactancia a Mantenimiento (Días 142 al 144):',
          '  * Día 142 (Destete): Restricción a 2.0 kg de Lactancia para cortar secreción láctea.',
          '  * Día 143: 50% Lactancia (1.75 kg) + 50% Mantenimiento (1.75 kg) = 3.5 kg/día.',
          '  * Día 144-147: 100% Mantenimiento / Flushing (3.5 - 4.0 kg/día) hasta el servicio.',
        ],
      },
    ],
  },
  {
    id: 'HU-08',
    title: 'Gestión de Almacén, Alerta de Stock a 2 Meses y Descuentos Automáticos',
    role: 'Bodeguero / Operador de almacén',
    want: 'Gestionar ítems de Alimentos, Medicinas y Otros con registro, alertas predictivas y deducción por consumo',
    soThat: 'Mantener existencias óptimas, prevenir desabastecimiento de alimento y registrar costos reales por peso o volumen',
    acceptanceCriteria: [
      {
        section: 'Categorización y Formularios',
        points: [
          'Pestaña Alimentos: Listado agrupado por tipo con opción de registrar nuevo ítem o sumar existencias a uno previo.',
          'Pestaña Medicinas: Listado con stock en ml/dosis/unidades, fecha de expiración y proveedor.',
          'Pestaña Otros: Implementos, desinfectantes, agujas y aretes.',
          'Formulario de detalle, edición y opción de eliminación.',
        ],
      },
      {
        section: 'Alerta Predictiva a 2 Meses (60 Días)',
        points: [
          'Cálculo dinámico: `Días_Autonomía = Stock_Actual / Consumo_Diario_Hato`.',
          'Si la autonomía es inferior a 60 días (2 meses), el ítem debe mostrar una insignia en rojo/ámbar: "Stock Crítico: < 2 meses de cobertura".',
        ],
      },
      {
        section: 'Descuento por Consumo Animal Imputado',
        points: [
          'Permitir registrar consumo en gramos, kilogramos, mililitros o litros.',
          'El consumo descuenta inmediatamente el almacén y se asienta como egreso en el balance y en el costo acumulado del animal/lote.',
        ],
      },
    ],
  },
  {
    id: 'HU-09',
    title: 'Partos, Destete y Prorrateo Matemático del Costo de Lechones',
    role: 'Encargado de Maternidad y Destete',
    want: 'Registrar partos, destetes y calcular automáticamente el costo prorrateado de la madre entre los lechones destetados',
    soThat: 'Asignar un costo de entrada exacto al lote de engorde o conocer el margen real al vender lechones de destete',
    acceptanceCriteria: [
      {
        section: 'Registro de Parto y Lechones',
        points: [
          'Formulario de parto con número de lechones vivos, momias, muertos al nacer y peso promedio de camada.',
          'Opción para registrar nuevos lechones si son comprados a terceros.',
        ],
      },
      {
        section: 'Fórmula de Prorrateo de Costo al Destete',
        points: [
          'Cálculo: `Costo_Por_Lechón = (Costo_Alimento_Gestación + Costo_Alimento_Lactancia + Sanidad_Madre) / Lechones_Vivos_Destetados`.',
          'Opción A: "Dejar para la granja" -> Los lechones pasan a la sección Engorde ingresando con ese costo de transferencia.',
          'Opción B: "Vender lechones" -> Se ingresa precio de venta por unidad y la app calcula: `Utilidad = (Precio_Venta - Costo_Por_Lechón) * Cantidad`.',
        ],
      },
    ],
    businessRule: 'La madre no puede ser asignada a un nuevo servicio hasta que el destete esté registrado y completada la fase 4 de reacondicionamiento.',
  },
  {
    id: 'HU-10',
    title: 'Venta de Animales (En Pie vs En Canal) y Gastos Generales de la Finca',
    role: 'Administrador de ventas y finanzas',
    want: 'Registrar ventas de animales especificando venta en pie o en canal con precio y peso final, junto con gastos generales',
    soThat: 'Determinar con precisión el balance financiero neto, margen por kilo y rentabilidad del establecimiento',
    acceptanceCriteria: [
      {
        section: 'Modalidad de Venta Animal',
        points: [
          'Venta en Pie: Se registra Peso Vivo Final (kg) y Precio por kg en pie. Ingreso Bruto = Peso * Precio_kg.',
          'Venta en Canal: Se registra Rendimiento de Canal (% promedio 76-80% en cerdos) o Peso en Canal real y Precio por kg en canal.',
          'Cálculo de Utilidad Neta por Animal: `Utilidad = Ingreso_Venta - Costo_Acumulado_Trazabilidad (alimento + vacunas + costo inicial)`.',
        ],
      },
      {
        section: 'Gastos Generales del Establecimiento',
        points: [
          'Opción para registrar egresos generales: Nómina de jornaleros, electricidad, combustible, mantenimiento de infraestructura.',
          'Estos gastos se consolidan en el Balance General mensual y anual de la granja.',
        ],
      },
    ],
  },
];

export const techStackRecommendations: TechStackItem[] = [
  {
    layer: 'Frontend Móvil (Multiplataforma)',
    technology: 'React Native con Expo SDK / Tailwind (NativeWind) ó Flutter',
    rationale: 'Permite desplegar una aplicación móvil nativa para iOS y Android con una única base de código. Excelente rendimiento para formularios de campo, animaciones táctiles de 60fps y compatibilidad con escaneo de aretes RFID/códigos QR.',
    iconName: 'Smartphone',
  },
  {
    layer: 'Capa Web PWA Complementaria',
    technology: 'React 19 + Vite + Tailwind CSS',
    rationale: 'Permite acceso instantáneo desde computadores de oficina y tablets en granja mediante navegador, sin necesidad de instalación desde app store y con soporte de visualización en pantalla ancha.',
    iconName: 'Globe',
  },
  {
    layer: 'Base de Datos y Sincronización',
    technology: 'Cloud Firestore con Persistencia Offline Habilitada',
    rationale: 'Indispensable para granjas rurales con conectividad intermitente. Firestore guarda escrituras y lecturas en la caché local del dispositivo (IndexedDB / SQLite) y sincroniza automáticamente al recuperar señal 3G/WiFi.',
    iconName: 'Database',
  },
  {
    layer: 'Autenticación y Seguridad',
    technology: 'Firebase Authentication + Firestore Security Rules (RBAC)',
    rationale: 'Gestión segura de identidades (correo/clave, Google SSO), sesiones protegidas y reglas de seguridad granulares que impiden que operadores modifiquen módulos financieros reservados para la gerencia.',
    iconName: 'ShieldCheck',
  },
  {
    layer: 'Lógica de Backend Serverless',
    technology: 'Cloud Functions for Firebase (Node.js / TypeScript)',
    rationale: 'Ejecución de triggers automáticos: recalcular balance mensual ante cada venta, evaluar a medianoche si algún ítem de almacén entra en alerta de 2 meses, y generar reportes en PDF.',
    iconName: 'Server',
  },
  {
    layer: 'Visualización y Gráficos',
    technology: 'Recharts (Web) / Victory Native (Móvil)',
    rationale: 'Renderizado vectorial responsivo de curvas de crecimiento, barras comparativas de ingresos/egresos mensuales y gráficos de consumo de alimento por fase.',
    iconName: 'BarChart3',
  },
  {
    layer: 'Almacenamiento de Archivos',
    technology: 'Firebase Storage',
    rationale: 'Respaldo en la nube de fotos de animales para trazabilidad morfológica, comprobantes de compra de alimentos y recetas veterinarias.',
    iconName: 'CloudRain',
  },
];

export const userFlowSteps: FlowStep[] = [
  {
    step: 1,
    title: 'Acceso y Selección de Granja',
    actor: 'Usuario (Administrador u Operador)',
    action: 'Ingresa correo y contraseña en la pantalla de bienvenida.',
    systemResponse: 'Autentica las credenciales con Firebase Auth, carga el perfil del usuario, identifica sus roles y sincroniza los datos locales de "Granja Arianna".',
    edgeCases: 'Si no hay internet, valida la sesión persistente en caché y muestra banner de "Modo Fuera de Línea".',
  },
  {
    step: 2,
    title: 'Visualización del Tablero Central (Home)',
    actor: 'Administrador',
    action: 'Observa los contadores de animales (avícola, porcino, bovino) y el balance de utilidad general.',
    systemResponse: 'Renderiza los widgets con datos calculados en tiempo real. Presiona el contador de "Productoras / Lechones" para ingresar al Menú Porcino.',
  },
  {
    step: 3,
    title: 'Navegación al Menú Porcino & Selección de Pestaña',
    actor: 'Encargado del Sector Porcino',
    action: 'Selecciona entre las 5 pestañas: 1. Porcinos, 2. Atajos, 3. Plan Sanitario, 4. Balance, 5. Alimentación.',
    systemResponse: 'La interfaz realiza una transición fluida mostrando las tarjetas o sub-módulos correspondientes según la pestaña seleccionada.',
  },
  {
    step: 4,
    title: 'Ejecución de Actividad Sanitaria con Descuento de Almacén',
    actor: 'Veterinario',
    action: 'En Pestaña 3 (Plan Sanitario), toca un día del calendario con evento (ej. Aplicación de Hierro), lee el procedimiento y presiona "Marcar como Completada".',
    systemResponse: 'Registra la trazabilidad médica en la ficha de los animales, descuenta automáticamente la cantidad exacta (ej. 45 ml de Hierro Dextrano) del inventario de Almacén y registra el costo correspondiente en el Balance.',
    edgeCases: 'Si el stock en almacén es insuficiente, emite una advertencia pero permite registrar con flag de inventario negativo temporal.',
  },
  {
    step: 5,
    title: 'Registro de Parto y Destete con Prorrateo de Costos',
    actor: 'Operador de Maternidad',
    action: 'Registra el destete de una camada (ej. 12 lechones de la cerda CER-088). Selecciona la opción "Dejar para Engorde".',
    systemResponse: 'La aplicación calcula el gasto total acumulado en alimento y medicinas de la cerda durante sus 114 días de gestación + 28 días de lactancia, divide dicho costo entre los 12 lechones vivos y transfiere automáticamente los animales a la categoría "Engorde" con su costo base unitario.',
  },
  {
    step: 6,
    title: 'Cierre de Venta (Pie o Canal) y Balance Financiero',
    actor: 'Administrador Financiero',
    action: 'En Atajos > Clientes / Ventas, registra la salida de 20 cerdos cebados. Selecciona "Venta en Canal" con 78% de rendimiento.',
    systemResponse: 'Calcula el peso neto en canal, multiplica por el precio acordado, resta los costos históricos acumulados de cada animal (obteniendo la ganancia neta) y añade el asiento de Ingreso (+) al Balance de Porcinos y al Home.',
  },
];
