/**
 * ============================================================================
 * CAPA MODELO (MODEL) - MODELOS DE DOMINIO Y ENTIDADES DE LA GRANJA
 * ============================================================================
 * Define todas las interfaces de datos, entidades del negocio pecuario y
 * estructuras persistidas en Firebase Firestore y sincronizadas en la aplicación.
 */

export type AnimalType = 'porcino' | 'bovino' | 'avicola';

export type PorcinoCategory = 'engorde' | 'maternidad' | 'verracos' | 'lechones';
export type BovinoCategory = 'padrotes' | 'becerros' | 'vacas';
export type AvicolaCategory = 'pollos_engorde';

export interface FarmMember {
  id: string;
  name: string;
  role: 'Administrador' | 'Veterinario' | 'Operador' | 'Trabajador';
  avatar: string;
  email: string;
}

export interface FarmSummary {
  name: string;
  location: string;
  totalMembers: number;
  members: FarmMember[];
  finances: {
    period: string;
    totalExpenses: number;
    totalIncome: number;
    netUtility: number;
    byRubro: {
      rubro: 'Bovina' | 'Porcina' | 'Avícola';
      expenses: number;
      income: number;
      utility: number;
      color: string;
    }[];
  };
  counts: {
    avicola: {
      /** Pollos físicamente en galpón de los lotes activos. */
      pollosEngorde: number;
      /** Lotes de engorde activos. */
      lotesActivos?: number;
      /** Bajas (mortalidad) acumuladas de los lotes activos. */
      bajas?: number;
      /** Pollos sacrificados/entregados de los lotes activos. */
      sacrificados?: number;
      /** Pollos iniciados en los lotes activos. */
      iniciados?: number;
    };
    porcino: {
      productoras: number;
      lechones: number;
      verracos: number;
      engorde: number;
    };
    bovino: {
      padrotes: number;
      becerros: number;
      vacas: number;
    };
  };
}

export interface AnimalTraceEvent {
  id: string;
  date: string;
  type:
    | 'vacunacion'
    | 'tratamiento'
    | 'pesaje'
    | 'parto'
    | 'monta'
    | 'alimentacion'
    | 'traslado'
    | 'matadero'
    | 'observacion'
    | 'mortalidad';
  title: string;
  description: string;
  responsible?: string;
  costUsd?: number;
  details?: Record<string, any>;
}

export interface FarrowingRecord {
  id: string;
  sowCode: string;
  date: string;
  totalBorn: number;
  bornAlive: number;
  stillborn: number; // nacidos muertos
  mummies: number; // momias
  malesCount: number;
  femalesCount: number;
  hasReproductiveDisease: boolean;
  diseaseNotes?: string;
  litterBatchCode: string;
  notes?: string;
}

export interface LactatingLitter {
  id: string;
  batchCode: string;
  sowCode: string;
  birthDate: string;
  currentCount: number;
  initialCount: number;
  malesCount: number;
  femalesCount: number;
  mortalityCount: number;
  bornAlive?: number;
  ageDays?: number;
  currentWeightKg?: number;
  mortalityHistory?: {
    id: string;
    date: string;
    count: number;
    cause: string;
    notes?: string;
  }[];
  weaningStatus: 'en_lactancia' | 'destetado';
  /** Id de la cerda madre (preferido sobre sowCode para relacionar). */
  sowId?: string;
  /** Id del registro de parto que originó la camada. */
  farrowingRecordId?: string;
  /** Costos imputados directamente a la camada (medicamentos, alimento pre-iniciador...). */
  accumulatedCostUsd?: number;
  /** Total de lechones ya destetados de esta camada (destetes parciales acumulan). */
  weanedCount?: number;
  /** Fecha del destete total. */
  weanedAt?: string;
  /** Motivo de cierre si la camada se cerró sin destete (ej. 'mortalidad_total'). */
  closedReason?: string;
}

export interface SlaughterDispatchData {
  date: string;
  totalWeightKg: number;
  averageWeightKg: number;
  animalsCount: number;
  salePriceUsd: number;
  pricePerKgUsd: number;
  buyer: string;
  lotCode: string;
  accumulatedCostUsd: number;
  netProfitUsd: number;
}

export interface PorcinoAnimal {
  id: string;
  code: string;
  name?: string;
  category: PorcinoCategory;
  birthDate: string;
  currentWeightKg: number;
  healthStatus: 'Optimo' | 'Tratamiento' | 'En Observación' | 'Gestante' | 'Lactante' | 'Matadero' | 'Descarte';
  stage?: string;
  accumulatedCostUsd: number;
  lastVaccine?: string;
  dietPlan?: string;
  photoUrl: string;
  breed?: string;
  origin?: 'destetado' | 'comprado';
  penLocation?: string;
  admissionDate?: string;
  admissionWeightKg?: number;
  admissionPriceUsd?: number;
  provenance?: string;
  teatsCount?: number;
  ageWeeks?: number;
  traceability?: AnimalTraceEvent[];
  isSoldToSlaughter?: boolean;
  slaughterData?: SlaughterDispatchData;
  batchAnimalCount?: number;
  /** Cabezas ya vendidas/sacrificadas de este registro (ventas parciales acumulan). */
  soldHeadCount?: number;
  /** Costo del ciclo reproductivo en curso (cerdas): se transfiere a los lechones al destete. */
  cycleCostUsd?: number;
  /** Fecha del último servicio/monta (cerdas). */
  lastServiceDate?: string;
  /** Verraco del último servicio (cerdas). */
  lastServiceBoarCode?: string;
  /** Fecha probable de parto = servicio + 114 días (cerdas). */
  expectedFarrowingDate?: string;
  /** Fecha del último parto (cerdas). */
  lastFarrowingDate?: string;
  /** Número de partos (cerdas). */
  parity?: number;
}

export interface UnifiedSaleResult {
  animalId?: string;
  animalCode: string;
  category: string;
  saleMode: 'pie' | 'canal';
  date: string;
  animalsCount: number;
  totalLiveWeightKg: number;
  averageLiveWeightKg: number;
  carcassYieldPercent?: number;
  carcassWeightKg?: number;
  pricePerKg: number;
  slaughterFeeUsd?: number;
  transportFeeUsd?: number;
  grossRevenueUsd: number;
  totalDeductionsUsd: number;
  netRevenueUsd: number;
  accumulatedCostUsd: number;
  netProfitUsd: number;
  profitMarginPercent: number;
  buyer: string;
  sanitaryDocNumber?: string;
  paymentMethod: string;
  markAsSlaughtered: boolean;
  notes?: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  category: 'alimentos' | 'medicinas' | 'otros';
  subCategory: string; // ej: 'Alimento Balanceado Cerdas', 'Antibiótico', 'Desparasitante'
  quantity: number;
  unit: 'kg' | 'g' | 'litros' | 'ml' | 'unidades' | 'bultos (40kg)';
  unitCostUsd: number;
  minAlertThreshold: number;
  monthlyConsumptionRate: number; // Consumo mensual estimado del hato
  expirationDate?: string;
  supplier?: string;
  /** true si la compra se registró como egreso al dar de alta: el consumo posterior solo imputa costo (no crea otro egreso). */
  expensedOnPurchase?: boolean;
  /** Rubro al que pertenece el insumo (sin valor = uso general / porcino histórico). */
  rubro?: 'porcino' | 'bovino' | 'avicola' | 'general';
  /** Lote avícola al que se asignó el insumo (bodega del lote). */
  loteId?: string;
  /**
   * Ubicación porcina: id del lote o cerdo (PorcinoAnimal) al que está destinado el insumo.
   * Sin valor = almacén general. Un mismo producto puede tener una fila por ubicación.
   */
  animalId?: string;
}

export interface SanitaryTask {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  targetRubro: 'porcino' | 'bovino' | 'avicola';
  targetGroup: string; // ej: 'Cerdas Maternidad Lote A', 'Lechones Destete 3 semanas'
  targetAnimal?: string; // ej: 'Lote completo (45 animales)' o 'CER-088'
  batchCode?: string; // ej: 'LOTE-ENG-2026-03'
  procedure: string; // Procedimiento veterinario detallado
  medicamentUsed?: string;
  dosage?: string;
  responsible: string;
  status: 'completada' | 'pendiente' | 'retrasada' | 'cancelada';
  /** Animal/lote destino (id): permite imputar costo y trazabilidad al completar. */
  animalId?: string;
  /** Camada destino (id). */
  litterId?: string;
  /** Insumo de almacén a descontar al completar la tarea. */
  warehouseItemId?: string;
  /** Cantidad del insumo a descontar (en la unidad del insumo). */
  warehouseQuantity?: number;
  /**
   * Consumo de almacén ya aplicado al completar la tarea (stock descontado, egreso y costo imputado).
   * Se conserva al reabrir para no volver a descontar el stock al completarla de nuevo.
   */
  stockApplied?: {
    itemId: string;
    quantity: number;
    costUsd: number;
    date: string;
    /** Egreso generado al completar (se anula si la tarea se reabre). */
    movementId?: string;
    /** Dónde se imputó el costo (para revertirlo al reabrir). */
    costTarget?: { kind: 'animal' | 'litter'; id: string; cycle?: boolean };
  };
  /** Evento de dominio que generó la tarea ('monta' | 'parto' | 'destete' | 'protocolo' | 'manual'...). */
  sourceEvent?: string;
  /** Clave del paso de protocolo (ej. 'parto_probable', 'hierro_d3'). */
  protocolKey?: string;
  /** Fecha/hora real de cierre de la tarea. */
  completedAt?: string;
  /** Motivo de cancelación (ej. lote vendido). */
  cancelReason?: string;
  /** Lote avícola destino (id de AvicolaLot). */
  loteId?: string;
  /** Día de vida del lote en que toca la tarea (1 = fecha de inicio). Si existe, la fecha se recalcula al cambiar el inicio. */
  lifeDay?: number;
  /** Días antes del sacrificio (0 = día de sacrificio) si la tarea viene de un paso relativo de la plantilla: se recalcula al cambiar los días de producción. */
  slaughterOffset?: number;
  /** Tipo de actividad (vacuna, vitamina, medicamento, desinfeccion, cama, pesaje, alimentacion, otro). */
  activityKind?: string;
}

export type ProductionType = 'engorde' | 'lechones' | 'maternidad' | 'verracos';

export interface ProtocolActivityTemplate {
  id: string;
  dayOffset: number; // Días transcurridos desde el inicio del lote
  title: string;
  procedure: string;
  medicament: string;
  dosage: string;
  responsibleRole: string;
}

export interface BatchProductionConfig {
  id: string;
  productionType: ProductionType;
  typeName: string;
  cycleDurationDays: number;
  description: string;
  activities: ProtocolActivityTemplate[];
}

export interface ProductionBatch {
  id: string;
  code: string;
  productionType: ProductionType;
  animalCount: number;
  location: string;
  startDate: string; // YYYY-MM-DD
  status: 'activo' | 'finalizado';
  protocolId: string;
  assignedAnimals?: string[];
}

export interface FinancialMovement {
  id: string;
  type: 'ingreso' | 'egreso';
  concept: string;
  rubro: 'porcino' | 'bovino' | 'avicola' | 'general';
  amount: number;
  date: string;
  category: string;
  details?: string;
}

export interface FeedingPhaseData {
  phaseNumber: number;
  title: string;
  daysRange: string;
  state: string;
  dailyConsumptionBase: string; // ej: "2.2 a 2.5 kg/día"
  estimatedFeedKg: number; // Inversión estimada
  description: string;
  transitionProtocol?: {
    title: string;
    days: {
      dayLabel: string;
      formula: string;
      totalPerDay: string;
    }[];
  };
}

export interface ProductionFeedingPhase {
  id: string;
  phaseNumber: number;
  stageName: string; // ej: "Iniciación / Pre-cebo"
  feedName: string; // ej: "Iniciador Porcino 18% PB"
  weightRangeKg: string; // ej: "8 kg - 25 kg"
  minWeightKg: number;
  maxWeightKg: number;
  daysRange: string; // ej: "Días 1 - 28 (28 días)"
  durationDays: number;
  dailyConsumptionKg: number; // ej: 1.1 kg/día
  totalFeedKg: number; // Consumo total acumulado en la etapa = durationDays * dailyConsumptionKg
  animalState: string; // ej: "Crecimiento Inicial / Adaptación"
  description?: string;
}

export interface ProductionFeedingPlan {
  productionType: PorcinoCategory;
  typeName: string; // ej: "Engorde", "Maternidad", "Verracos", "Lechones"
  description: string;
  phases: ProductionFeedingPhase[];
}

export interface UserStory {
  id: string;
  title: string;
  role: string;
  want: string;
  soThat: string;
  acceptanceCriteria: {
    section: string;
    points: string[];
  }[];
  backendNotes?: string[];
  businessRule?: string;
}

export interface TechStackItem {
  layer: string;
  technology: string;
  rationale: string;
  iconName: string;
}

export interface BovinoAnimal {
  id: string;
  tag: string;
  name: string;
  type: 'padrote' | 'vaca_lactante' | 'vaca_seca' | 'becerro' | 'novilla';
  breed: string;
  birthDate?: string;
  weight: number;
  dailyLiters?: number;
  status: 'Optimo' | 'Tratamiento' | 'En Observación' | 'Seca' | 'Descarte';
  paddock: string;
  lastMilkingDate?: string;
  traceability?: AnimalTraceEvent[];
}

export interface AvicolaDailyLog {
  date: string;
  feedKg: number;
  mortality: number;
  sampledWeightGrams: number;
  notes?: string;
}

// ============================================================================
// MÓDULO AVÍCOLA - POLLOS DE ENGORDE
// ============================================================================

export type AvicolaBreed = 'Sin raza' | 'Cobb 500' | 'Ross 308' | 'Hubbard' | 'Arbor Acres' | 'Otra';
export type AvicolaStage = 'Preinicio' | 'Inicio' | 'Engorde' | 'Finalización';
/** Estados nuevos ('activo' | 'finalizado') + estados legados del modal antiguo. */
export type AvicolaLotStatus =
  | 'activo'
  | 'finalizado'
  | 'Iniciación'
  | 'Crecimiento'
  | 'Listo para Faena'
  | 'Liquidado';

export interface AvicolaLot {
  id: string;
  /** Nombre visible del lote (ej. 'Lote 001'). */
  name: string;
  /** Pollos que entraron al galpón. */
  initialChicks: number;
  /** Fecha de inicio 'YYYY-MM-DD' (ese día es el día 1). */
  startDate: string;
  /** Días de producción hasta el sacrificio (ciclo). */
  productionDays: number;
  status: AvicolaLotStatus;
  finalizedAt?: string;
  /** Bajas acumuladas (derivado de los registros de mortalidad). */
  deathsTotal: number;
  /** Pollos comprometidos en ventas/ingresos (derivado). */
  soldBirds?: number;
  /** Pollos ya entregados / sacrificados (derivado). */
  deliveredBirds?: number;
  createdAt?: string;
  notes?: string;
  /** true si al crear el lote se generó el plan sanitario base. */
  sanitaryPlanApplied?: boolean;

  // ---- Campos legados (la capa de dominio los mantiene sincronizados) ----
  /** = name */
  code: string;
  /** Galpón (opcional). */
  shed: string;
  /** Raza (AvicolaBreed; string por compatibilidad). */
  breed: AvicolaBreed | string;
  /** = initialChicks */
  initial: number;
  /** Pollos físicamente en galpón. */
  current: number;
  /** Día de vida al último cambio (usar lotDay() para el valor real). */
  age: number;
  /** Peso promedio del último pesaje (g). */
  avgWeightGrams: number;
  /** Alimento registrado como gasto (kg). */
  feedTotalKg: number;
  /** Conversión alimenticia estimada (0 si no hay datos). */
  fcr: number;
  dailyLogs?: AvicolaDailyLog[];
}

export type AvicolaProduct = 'pollo' | 'menudencia' | 'otros';
export type AvicolaSaleUnit = 'lb' | 'kg' | 'g' | 'unidad';
export type AvicolaWeightUnit = 'g' | 'lb' | 'kg';
export type AvicolaExpenseUnit = 'kg' | 'g' | 'lb' | 'bulto40' | 'ton' | 'unidad';
export type AvicolaExpenseCategory =
  | 'Alimento'
  | 'Pollos'
  | 'Bebedero'
  | 'Comedero'
  | 'Vitaminas'
  | 'Sanidad'
  | 'Mano de obra'
  | 'Otros';

export interface AvicolaPayment {
  id: string;
  date: string;
  amount: number;
  /** Ingreso del lote generado por este abono. */
  incomeId: string;
  notes?: string;
}

export interface AvicolaSale {
  id: string;
  loteId: string;
  date: string;
  customerName: string;
  phone?: string;
  product: AvicolaProduct;
  /** Cómo se cobra: por libra, kilo, gramo o unidad. */
  unit: AvicolaSaleUnit;
  /** Precio por unidad de cobro. */
  unitPrice: number;
  /** Pollos vendidos (descuentan disponibles). 0 para menudencia/otros. */
  birds: number;
  /** Peso total en la unidad de cobro (si unit != 'unidad'). */
  weight?: number;
  /** Cantidad cobrada por unidades (si unit == 'unidad'). */
  units?: number;
  /** Total a cobrar (editable). */
  total: number;
  /** Suma de abonos. */
  paidAmount: number;
  payments: AvicolaPayment[];
  delivered: boolean;
  deliveredAt?: string;
  /** Es un encargo (pedido para entregar después). */
  isOrder: boolean;
  deliveryDate?: string;
  notes?: string;
  createdAt: string;
}

export interface AvicolaExpense {
  id: string;
  loteId: string;
  date: string;
  category: AvicolaExpenseCategory;
  product: string;
  /** Etapa del alimento (solo categoría Alimento). */
  stage?: AvicolaStage;
  unit: AvicolaExpenseUnit;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Kilos de alimento equivalentes (solo categoría Alimento con unidad de peso). */
  feedKg?: number;
  /** Egreso financiero generado (rubro 'avicola'). */
  movementId?: string;
  /** Generado desde la bodega/almacén (consumo o tarea). */
  warehouseItemId?: string;
  /** Tarea que generó el gasto (al completar con insumo). */
  taskId?: string;
  notes?: string;
  createdAt: string;
}

export interface AvicolaIncome {
  id: string;
  loteId: string;
  date: string;
  type: AvicolaProduct;
  detail: string;
  /** Pollos entregados con este ingreso (solo ingresos manuales; los de venta cuentan en la venta). */
  birds: number;
  unit?: AvicolaWeightUnit;
  weight?: number;
  unitPrice?: number;
  total: number;
  /** Venta y abono de origen (ingreso automático por cobro). */
  saleId?: string;
  paymentId?: string;
  movementId?: string;
  createdAt: string;
}

export interface AvicolaMortality {
  id: string;
  loteId: string;
  date: string;
  /** Día de vida del lote. */
  day: number;
  count: number;
  cause: string;
  notes?: string;
  createdAt: string;
}

export interface AvicolaWeighing {
  id: string;
  loteId: string;
  date: string;
  /** Día de vida del lote. */
  day: number;
  avgWeightGrams: number;
  sampleSize?: number;
  sex?: 'mixto' | 'machos' | 'hembras';
  notes?: string;
  createdAt: string;
}

export interface FlowStep {
  step: number;
  title: string;
  actor: string;
  action: string;
  systemResponse: string;
  edgeCases?: string;
}
