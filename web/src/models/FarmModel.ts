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
      pollosEngorde: number;
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

export interface AvicolaLot {
  id: string;
  code: string;
  shed: string;
  breed: string;
  initial: number;
  current: number;
  age: number;
  avgWeightGrams: number;
  feedTotalKg: number;
  fcr: number;
  status: 'Iniciación' | 'Crecimiento' | 'Listo para Faena' | 'Liquidado';
  startDate?: string;
  dailyLogs?: AvicolaDailyLog[];
}

export interface FlowStep {
  step: number;
  title: string;
  actor: string;
  action: string;
  systemResponse: string;
  edgeCases?: string;
}
