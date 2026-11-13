/**
 * ============================================================================
 * MODELO DE DATOS - MÓDULO BOVINO (CEBA, LECHERÍA Y CRÍA)
 * ============================================================================
 * Diseño offline-first:
 *  - Los HECHOS (pesaje, ordeño, servicio, tratamiento, salida de almacén...) son
 *    documentos de evento INDEPENDIENTES (id propio + createdAt/createdBy). Dos
 *    teléfonos sin conexión crean documentos distintos: al sincronizar no se pisan.
 *  - El estado del animal (peso actual, lote/potrero actual, estado reproductivo,
 *    retiro sanitario, categoría) se DERIVA de sus eventos (models/bovinoCalc.ts).
 *    Los campos lotId/paddockId/status del documento del animal son una caché que
 *    el dominio mantiene; la derivación por eventos prevalece.
 *  - Montos en moneda dual: USD (base de la app) + moneda local con la tasa del día
 *    guardada en cada registro.
 * Sin datos de ejemplo: solo constantes técnicas configurables (BOVINO_DEFAULT_CONFIG).
 */

// ============================================================================
// ENUMERACIONES
// ============================================================================

export type BovinoSex = 'macho' | 'hembra';
/** Categoría DERIVADA por edad/sexo/estado (ver bovinoCategory()). */
export type BovinoCategoryKey = 'cria' | 'levante' | 'novilla' | 'novillo' | 'vaca' | 'toro';
export type BovinoPurpose = 'ceba' | 'leche' | 'cria' | 'reproductor';
export type BovinoStatus = 'activo' | 'vendido' | 'muerto' | 'descarte';
export type BovinoOrigin = 'nacido' | 'compra';
export type BovinoLotType = 'ceba' | 'leche' | 'cria' | 'levante' | 'otro';
/** Unidad de negocio para el balance: ceba (carne) vs lechería/cría. 'general' se prorratea. */
export type BovinoBusinessUnit = 'ceba' | 'leche' | 'general';
export type BovinoPaddockStatus = 'disponible' | 'ocupado' | 'descanso' | 'mantenimiento';

/** Submódulo del almacén bovino. */
export type BovinoWarehouseCategory = 'alimentos' | 'minerales' | 'farmacia' | 'otros';
export type BovinoPharmacyType = 'vacuna' | 'desparasitante' | 'antibiotico' | 'hormona' | 'vitamina' | 'material' | 'pajuela' | 'embrion' | 'otro';

/** Rol bovino derivado del rol de la granja. */
export type BovinoRole = 'operario' | 'encargado' | 'propietario';
export type FarmRole = 'Administrador' | 'Veterinario' | 'Operador' | 'Trabajador';

export const BOVINO_CATEGORY_LABEL: Record<BovinoCategoryKey, string> = {
  cria: 'Cría',
  levante: 'Levante',
  novilla: 'Novilla',
  novillo: 'Novillo/Ceba',
  vaca: 'Vaca',
  toro: 'Toro',
};
export const BOVINO_CATEGORIES: BovinoCategoryKey[] = ['cria', 'levante', 'novilla', 'novillo', 'vaca', 'toro'];
export const BOVINO_PURPOSE_LABEL: Record<BovinoPurpose, string> = {
  ceba: 'Ceba',
  leche: 'Leche',
  cria: 'Cría',
  reproductor: 'Reproductor',
};
export const BOVINO_STATUS_LABEL: Record<BovinoStatus, string> = {
  activo: 'Activo',
  vendido: 'Vendido',
  muerto: 'Muerto',
  descarte: 'Descarte',
};
export const BOVINO_LOT_TYPE_LABEL: Record<BovinoLotType, string> = {
  ceba: 'Ceba',
  leche: 'Ordeño',
  cria: 'Cría',
  levante: 'Levante',
  otro: 'Otro',
};
export const BOVINO_UNIT_LABEL: Record<BovinoBusinessUnit, string> = {
  ceba: 'Ceba',
  leche: 'Lechería y cría',
  general: 'General (prorrateado)',
};
export const BOVINO_WAREHOUSE_CATEGORY_LABEL: Record<BovinoWarehouseCategory, string> = {
  alimentos: 'Alimentos y concentrados',
  minerales: 'Minerales y sales',
  farmacia: 'Farmacia y biológicos',
  otros: 'Otros insumos',
};
export const BOVINO_PHARMACY_TYPE_LABEL: Record<BovinoPharmacyType, string> = {
  vacuna: 'Vacuna',
  desparasitante: 'Desparasitante',
  antibiotico: 'Antibiótico',
  hormona: 'Hormona',
  vitamina: 'Vitamina',
  material: 'Jeringas / material',
  pajuela: 'Pajuela (semen)',
  embrion: 'Embrión',
  otro: 'Otro',
};
export const BOVINO_BREEDS = [
  'Mestizo',
  'Brahman',
  'Nelore',
  'Gyr',
  'Girolando',
  'Holstein',
  'Pardo Suizo',
  'Jersey',
  'Simmental',
  'Angus',
  'Carora',
  'Otra',
];

// ============================================================================
// AUDITORÍA Y MONEDA DUAL
// ============================================================================

/** Usuario que ejecuta la acción (lo entrega el controlador desde la sesión). */
export interface BovinoActor {
  uid: string;
  name: string;
  role: FarmRole;
}

/** Sello de autoría presente en TODOS los documentos bovinos. */
export interface BovinoStamp {
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

/** Monto en moneda dual (USD base + moneda local con la tasa del día). */
export interface BovinoMoney {
  usd: number;
  /** Monto en moneda local (si la granja configuró moneda local y tasa). */
  local?: number;
  /** Código de moneda local (ej. 'VES', 'COP'). */
  currency?: string;
  /** Unidades de moneda local por 1 USD usadas en este registro. */
  rate?: number;
}

/** Entrada de monto desde la UI: monto en USD o en moneda local (+ tasa opcional). */
export interface BovinoMoneyInput {
  amount: number;
  /** 'USD' (por defecto) o 'LOCAL'. */
  in?: 'USD' | 'LOCAL';
  /** Tasa del día (si se omite se usa config.exchangeRate). */
  rate?: number;
}

// ============================================================================
// ENTIDADES
// ============================================================================

export interface BovinoAnimal extends BovinoStamp {
  id: string;
  /** Número de arete visual / código corto (único entre animales activos). */
  tag: string;
  name?: string;
  sex: BovinoSex;
  /** Fecha de nacimiento (si se conoce). */
  birthDate?: string;
  /** Edad estimada en meses al ingreso (si no se conoce la fecha de nacimiento). */
  estimatedAgeMonthsAtEntry?: number;
  /** Fecha de ingreso al hato (nacimiento en finca o compra). */
  entryDate: string;
  /**
   * La fecha de ingreso real se desconoce (registro antiguo migrado): entryDate es la fecha
   * de la migración. No se valida "evento antes del ingreso" y el peso de ingreso nunca
   * desplaza a un pesaje real.
   */
  entryDateEstimated?: boolean;
  breed?: string;
  origin: BovinoOrigin;
  /** Peso al ingreso (nacimiento o compra), kg. */
  entryWeightKg?: number;
  /** Datos de compra (origin 'compra'). */
  purchase?: {
    money: BovinoMoney;
    supplier?: string;
    /** Gasto financiero generado por la compra (bovino_finance). */
    financeId?: string;
  };
  /**
   * Compra registrada SIN costo (p. ej. la ingresó el encargado, que no ve montos): queda
   * pendiente para que el propietario cargue el costo (setBovinoPurchaseCost).
   */
  purchasePending?: boolean;
  purpose: BovinoPurpose;
  /** Castrado (machos de ceba). */
  castrated?: boolean;
  /** Categoría indicada al ingreso cuando no hay edad (ej. compra de vacas adultas). */
  initialCategory?: BovinoCategoryKey;
  /** Partos previos al ingreso (vacas compradas). */
  priorCalvings?: number;
  /** Fecha del último parto previo al ingreso (vacas compradas paridas). */
  priorLastCalvingDate?: string;
  /** Caché: lote actual (la fuente de verdad son los eventos 'movimiento'). */
  lotId?: string;
  /** Caché: potrero actual. */
  paddockId?: string;
  /** Caché: estado (la fuente de verdad es el evento 'baja'). */
  status: BovinoStatus;
  statusDate?: string;
  motherId?: string;
  fatherId?: string;
  /** Pajuela / toro externo (texto) cuando el padre no está en el hato. */
  fatherLabel?: string;
  notes?: string;
  /** Datos crudos del registro antiguo (BovinoModal) conservados al normalizar. */
  legacy?: Record<string, any>;
}

export interface BovinoLot extends BovinoStamp {
  id: string;
  name: string;
  type: BovinoLotType;
  /** Caché: potrero actual del lote (fuente de verdad: eventos 'movimiento' scope 'lote'). */
  paddockId?: string;
  /** Peso objetivo de venta (kg) para la proyección a faena (ceba). */
  targetSaleWeightKg?: number;
  openedAt: string;
  closedAt?: string;
  status: 'abierto' | 'cerrado';
  /** Liquidación generada al cerrar (bovino_finance). */
  liquidationId?: string;
  notes?: string;
}

export interface BovinoPaddock extends BovinoStamp {
  id: string;
  name: string;
  areaHa?: number;
  /** Capacidad de carga (cabezas). */
  capacityHeads?: number;
  /** Estado manual (mantenimiento) — ocupado/descanso se derivan de la ocupación. */
  status: BovinoPaddockStatus;
  /** Días de descanso recomendados tras la salida del ganado. */
  restDays?: number;
  grass?: string;
  notes?: string;
}

// ----------------------------------------------------------------------------
// EVENTOS (colección bovino_events, discriminados por `kind`)
// ----------------------------------------------------------------------------

export type BovinoEventKind =
  | 'movimiento'
  | 'pesaje'
  | 'racion'
  | 'salida'
  | 'entrada'
  | 'ordeno'
  | 'servicio'
  | 'diagnostico'
  | 'parto'
  | 'calostro'
  | 'secado'
  | 'destete'
  | 'tratamiento'
  | 'baja'
  | 'observacion';

interface BovinoEventBase extends BovinoStamp {
  id: string;
  kind: BovinoEventKind;
  /** Fecha del hecho 'YYYY-MM-DD'. */
  date: string;
  animalId?: string;
  lotId?: string;
  /** Agrupa los documentos creados por una acción masiva (lote completo / lista rápida). */
  groupId?: string;
  /** Valor fuera de rango guardado con confirmación explícita del usuario. */
  confirmedOutOfRange?: boolean;
  notes?: string;
}

/** Movimiento de potrero y/o lote (ocupación del pasto). */
export interface BovinoMoveEvent extends BovinoEventBase {
  kind: 'movimiento';
  scope: 'lote' | 'animal';
  fromPaddockId?: string;
  toPaddockId?: string;
  fromLotId?: string;
  toLotId?: string;
  /** Cabezas movidas (scope lote: animales del lote en ese momento). */
  heads?: number;
}

/** Pesaje individual (animalId) o promedio de lote (lotId + avgWeightKg). */
export interface BovinoWeighEvent extends BovinoEventBase {
  kind: 'pesaje';
  weightKg: number;
  method?: 'bascula' | 'cinta' | 'estimado';
  /** Pesaje por lote: número de animales promediados. */
  heads?: number;
  /** true si es un promedio de lote (sin animalId). */
  lotAverage?: boolean;
}

/** Ración/forraje entregado al lote SIN salida de almacén (ej. pasto de corte propio). */
export interface BovinoRationEvent extends BovinoEventBase {
  kind: 'racion';
  feedName: string;
  kg: number;
  /** Días que cubre la entrega (kg/día = kg / days). */
  days?: number;
}

/** Destino obligatorio de una salida de almacén. */
export interface BovinoDestination {
  type: 'lote' | 'animal' | 'potrero' | 'unidad' | 'sanidad';
  lotId?: string;
  animalId?: string;
  paddockId?: string;
  /** Unidad de negocio a la que se imputa el costo (resuelta por el dominio). */
  unit: BovinoBusinessUnit;
  /** Texto legible ('Lote Ceba 2', 'Vaca #402', 'Sanidad'...). */
  label: string;
}

/** Salida de almacén con destino → costo directo de la unidad. */
export interface BovinoStockOutEvent extends BovinoEventBase {
  kind: 'salida';
  itemId: string;
  itemName: string;
  category: BovinoWarehouseCategory;
  quantity: number;
  unit: string;
  /** Kilos equivalentes (alimentos/minerales) para conversión alimenticia. */
  kgEquivalent?: number;
  unitCost: BovinoMoney;
  cost: BovinoMoney;
  destination: BovinoDestination;
  /** Egreso financiero creado (solo si el insumo no se llevó a gasto al comprarlo). */
  movementId?: string;
  /** Tratamiento / servicio que originó la salida. */
  sourceEventId?: string;
  mfgLot?: string;
}

/** Entrada (compra) al almacén bovino. */
export interface BovinoStockInEvent extends BovinoEventBase {
  kind: 'entrada';
  itemId: string;
  itemName: string;
  category: BovinoWarehouseCategory;
  quantity: number;
  unit: string;
  unitCost: BovinoMoney;
  total: BovinoMoney;
  supplier?: string;
  invoice?: string;
  mfgLot?: string;
  expirationDate?: string;
  movementId?: string;
}

export type BovinoMilkShift = 'manana' | 'tarde' | 'unico';

/** Ordeño por vaca (animalId) o total del tanque (tank=true). */
export interface BovinoMilkEvent extends BovinoEventBase {
  kind: 'ordeno';
  shift: BovinoMilkShift;
  liters: number;
  /** Total del tanque (sin animalId). */
  tank?: boolean;
  /** Desglose por vaca de un total de tanque (no suma de nuevo a la producción). */
  tankEventId?: string;
  /** Leche de vaca con retiro sanitario activo: se descarta (no se envía ni vende). */
  discarded?: boolean;
  discardReason?: string;
  /** Destino de la leche no vendible: se bota (descarte) o se da a los terneros. */
  discardDestination?: 'descarte' | 'terneros';
}

/** Monta natural, inseminación (IA; IATF = IA con protocolo) o transferencia de embriones (TE). */
export type BovinoServiceMethod = 'monta' | 'ia' | 'iatf' | 'te';

export const BOVINO_SERVICE_METHOD_LABEL: Record<BovinoServiceMethod, string> = {
  monta: 'Monta natural',
  ia: 'Inseminación (IA)',
  iatf: 'IATF',
  te: 'Transf. embriones',
};

export interface BovinoServiceEvent extends BovinoEventBase {
  kind: 'servicio';
  method: BovinoServiceMethod;
  /** Toro del hato (monta natural). */
  bullId?: string;
  /** Pajuela (IA/IATF) o embrión (TE) del almacén. */
  semenItemId?: string;
  /** Nombre del toro / pajuela, o embrión / donante en TE (texto para el historial). */
  sireLabel?: string;
  technician?: string;
  /** Salida de almacén de la pajuela. */
  stockOutId?: string;
}

export interface BovinoDiagnosisEvent extends BovinoEventBase {
  kind: 'diagnostico';
  method: 'palpacion' | 'ecografia';
  result: 'preñada' | 'vacia' | 'dudosa';
  /** Servicio diagnosticado (el último antes del diagnóstico). */
  serviceId?: string;
  /** Días de gestación estimados en el diagnóstico (si no hay servicio registrado). */
  gestationDays?: number;
  /** FPP calculada al diagnosticar. */
  expectedCalvingDate?: string;
}

export interface BovinoCalfRecord {
  animalId?: string;
  tag?: string;
  sex: BovinoSex;
  weightKg?: number;
  alive: boolean;
}

export interface BovinoCalvingEvent extends BovinoEventBase {
  kind: 'parto';
  difficulty: 'normal' | 'asistido' | 'cesarea' | 'aborto';
  calves: BovinoCalfRecord[];
  /** Número de parto de la vaca (1 = primer parto). */
  parity?: number;
}

export interface BovinoColostrumEvent extends BovinoEventBase {
  kind: 'calostro';
  /** Horas de vida al suministro. */
  hoursAfterBirth: number;
  liters?: number;
  method?: 'mamada' | 'tetero' | 'sonda';
}

export interface BovinoDryOffEvent extends BovinoEventBase {
  kind: 'secado';
  /** Tratamiento de secado aplicado (texto). */
  treatment?: string;
}

export interface BovinoWeaningEvent extends BovinoEventBase {
  kind: 'destete';
  weightKg?: number;
}

export interface BovinoTreatmentEvent extends BovinoEventBase {
  kind: 'tratamiento';
  purpose: 'preventivo' | 'curativo';
  itemId: string;
  productName: string;
  pharmacyType?: BovinoPharmacyType;
  dose: number;
  doseUnit: string;
  route?: 'IM' | 'SC' | 'IV' | 'oral' | 'topica' | 'intramamaria' | 'otra';
  mfgLot?: string;
  diagnosis?: string;
  symptoms?: string;
  withdrawalMeatDays: number;
  withdrawalMilkDays: number;
  /** Fecha hasta la que NO se puede vender para carne (inclusive). */
  meatWithdrawalUntil?: string;
  /** Fecha hasta la que la leche se descarta (inclusive). */
  milkWithdrawalUntil?: string;
  effectiveness?: 'pendiente' | 'efectivo' | 'parcial' | 'no_efectivo';
  /** Peso usado para la dosis automática. */
  weightKgForDose?: number;
  stockOutId?: string;
  taskId?: string;
  cost?: BovinoMoney;
}

export interface BovinoExitEvent extends BovinoEventBase {
  kind: 'baja';
  exitType: 'venta' | 'muerte' | 'descarte';
  cause?: string;
  weightKg?: number;
  /** Ingreso de la venta (bovino_finance). */
  financeId?: string;
  /** Venta con retiro sanitario activo autorizada explícitamente. */
  withdrawalOverride?: { reason: string; by: string; byName: string; at: string };
}

export interface BovinoNoteEvent extends BovinoEventBase {
  kind: 'observacion';
  title: string;
}

export type BovinoEvent =
  | BovinoMoveEvent
  | BovinoWeighEvent
  | BovinoRationEvent
  | BovinoStockOutEvent
  | BovinoStockInEvent
  | BovinoMilkEvent
  | BovinoServiceEvent
  | BovinoDiagnosisEvent
  | BovinoCalvingEvent
  | BovinoColostrumEvent
  | BovinoDryOffEvent
  | BovinoWeaningEvent
  | BovinoTreatmentEvent
  | BovinoExitEvent
  | BovinoNoteEvent;

// ----------------------------------------------------------------------------
// FINANZAS (colección bovino_finance)
// ----------------------------------------------------------------------------

export type BovinoIncomeType = 'leche' | 'ganado_pie' | 'ganado_canal' | 'cria' | 'descarte' | 'otro';
export type BovinoExpenseCategory =
  | 'nomina'
  | 'cercas'
  | 'electricidad'
  | 'fletes'
  | 'combustible'
  | 'veterinario'
  | 'mantenimiento'
  | 'compra_ganado'
  | 'arriendo'
  | 'impuestos'
  | 'otros';

export const BOVINO_INCOME_TYPE_LABEL: Record<BovinoIncomeType, string> = {
  leche: 'Venta de leche',
  ganado_pie: 'Venta de ganado en pie',
  ganado_canal: 'Venta de ganado en canal',
  cria: 'Venta de crías',
  descarte: 'Venta de descarte',
  otro: 'Otros ingresos',
};
export const BOVINO_EXPENSE_CATEGORY_LABEL: Record<BovinoExpenseCategory, string> = {
  nomina: 'Nómina',
  cercas: 'Cercas',
  electricidad: 'Electricidad',
  fletes: 'Fletes',
  combustible: 'Combustible',
  veterinario: 'Servicios veterinarios',
  mantenimiento: 'Mantenimiento',
  compra_ganado: 'Compra de ganado',
  arriendo: 'Arriendo',
  impuestos: 'Impuestos',
  otros: 'Otros',
};

interface BovinoFinanceBase extends BovinoStamp {
  id: string;
  date: string;
  money: BovinoMoney;
  /** Movimiento financiero (rubro 'bovino') asociado. */
  movementId?: string;
  notes?: string;
}

export interface BovinoIncome extends BovinoFinanceBase {
  kind: 'ingreso';
  type: BovinoIncomeType;
  unit: BovinoBusinessUnit;
  /** Leche: litros vendidos. */
  liters?: number;
  /** Ganado: kg vendidos (pie o canal). */
  kg?: number;
  /** Precio unitario (por litro o kg) en moneda dual. */
  unitPrice?: BovinoMoney;
  heads?: number;
  animalIds?: string[];
  lotId?: string;
  buyer?: string;
}

export interface BovinoExpense extends BovinoFinanceBase {
  kind: 'gasto';
  /** fijo = gasto general prorrateado; directo = imputado a una unidad. */
  nature: 'fijo' | 'directo';
  category: BovinoExpenseCategory;
  concept: string;
  unit: BovinoBusinessUnit;
  /** % imputado a ceba (el resto a lechería/cría) cuando unit = 'general'. */
  cebaPct?: number;
  prorateMethod?: 'config' | 'cabezas' | 'manual';
  lotId?: string;
  animalId?: string;
  supplier?: string;
}

export interface BovinoLiquidation extends BovinoFinanceBase {
  kind: 'liquidacion';
  lotId: string;
  lotName: string;
  snapshot: BovinoLotLiquidation;
}

export type BovinoFinanceDoc = BovinoIncome | BovinoExpense | BovinoLiquidation;

/** Resultado de la liquidación de un lote de ceba (también se usa como vista previa). */
export interface BovinoLotLiquidation {
  lotId: string;
  lotName: string;
  openedAt: string;
  closedAt: string;
  days: number;
  headsIn: number;
  headsSold: number;
  headsDead: number;
  headsActive: number;
  kgIn: number;
  kgOut: number;
  kgProduced: number;
  purchaseCostUsd: number;
  feedCostUsd: number;
  healthCostUsd: number;
  otherDirectCostUsd: number;
  indirectCostUsd: number;
  totalCostUsd: number;
  incomeUsd: number;
  profitUsd: number;
  marginPct: number;
  roiPct: number;
  costPerKgProducedUsd: number;
  feedKg: number;
  feedConversion: number | null;
  avgDailyGainKg: number | null;
}

// ----------------------------------------------------------------------------
// AUDITORÍA (colección bovino_audit)
// ----------------------------------------------------------------------------

export type BovinoAuditEntity =
  | 'animal'
  | 'lote'
  | 'potrero'
  | 'evento'
  | 'salida_almacen'
  | 'entrada_almacen'
  | 'insumo'
  | 'muerte'
  | 'venta'
  | 'descarte'
  | 'movimiento_financiero'
  | 'liquidacion'
  | 'configuracion'
  | 'tarea';

export interface BovinoAuditEntry {
  id: string;
  at: string;
  uid: string;
  name: string;
  role: FarmRole;
  action: 'crear' | 'editar' | 'eliminar' | 'autorizar';
  entity: BovinoAuditEntity;
  entityId: string;
  summary: string;
  data?: Record<string, any>;
}

// ----------------------------------------------------------------------------
// CONFIGURACIÓN (colección bovino_config, documento 'default')
// ----------------------------------------------------------------------------

export interface BovinoSanitaryPlanItem {
  id: string;
  name: string;
  kind: 'vacuna' | 'desparasitacion' | 'vitamina' | 'otro';
  /** Categorías a las que aplica. */
  categories: BovinoCategoryKey[];
  /** Repetir cada N días (0 = una vez). */
  everyDays: number;
  /** Edad (días) de la primera aplicación (crías). */
  firstAgeDays?: number;
  /** Producto sugerido (texto); el insumo concreto se elige al aplicar. */
  productHint?: string;
  active: boolean;
}

export interface BovinoConfig {
  id: 'default';
  /** Código de moneda local ('' = sin moneda local). */
  localCurrency: string;
  /** Tasa del día: unidades de moneda local por 1 USD (0 = sin tasa). */
  exchangeRate: number;
  exchangeRateDate?: string;
  /** Período de espera voluntario tras el parto (días). */
  pevDays: number;
  /** Duración de la gestación (días). */
  gestationDays: number;
  /** Días de secado antes del parto. */
  dryOffDaysBeforeCalving: number;
  /** Días tras el servicio para el diagnóstico de gestación (palpación). */
  diagnosisDaysAfterService: number;
  /** Aviso de parto próximo (días antes de la FPP). */
  calvingAlertDays: number;
  /** Edad de destete (días). */
  weaningAgeDays: number;
  /** Fin del levante (días): hembras → novilla, machos → novillo. */
  levanteMaxDays: number;
  /** Edad mínima de un toro (días). */
  bullMinAgeDays: number;
  /** Edad mínima recomendada para el primer servicio (días). */
  minServiceAgeDays: number;
  /** GMD (kg/día) desde la cual es verde (óptima). */
  gmdGreenKg: number;
  /** GMD desde la cual es amarilla (baja); por debajo es roja (pérdida/estancamiento). */
  gmdYellowKg: number;
  /** Peso de venta objetivo por defecto (kg). */
  targetSaleWeightKg: number;
  /** Intervalo máximo entre pesajes antes de marcarlo atrasado (días). */
  weighIntervalDays: number;
  /** Caída de producción que dispara alerta (% vs promedio de los 7 días previos). */
  milkDropPct: number;
  /** Topes lógicos (requieren confirmación). */
  maxWeightKgByCategory: Record<BovinoCategoryKey, number>;
  maxLitersPerMilking: number;
  maxLitersPerCowDay: number;
  /** GMD máxima creíble (kg/día). */
  maxGmdKg: number;
  /** Prorrateo por defecto de gastos generales: % a ceba (el resto a lechería/cría). */
  prorateCebaPct: number;
  /** Método de prorrateo por defecto. */
  prorateMethod: 'config' | 'cabezas';
  /** Precio de referencia por kg en pie (USD) por categoría para valorizar el hato. */
  referencePricePerKgUsd: Record<BovinoCategoryKey, number>;
  /** Plan sanitario base (vacunas / desparasitaciones). */
  sanitaryPlan: BovinoSanitaryPlanItem[];
  /** Los aretes de la finca llevan letras (teclado de texto); por defecto solo números (teclado numérico). */
  tagsWithLetters?: boolean;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

/** Constantes técnicas por defecto (no son datos de la granja: todo es editable). */
export const BOVINO_DEFAULT_CONFIG: BovinoConfig = {
  id: 'default',
  localCurrency: '',
  exchangeRate: 0,
  pevDays: 50,
  gestationDays: 283,
  dryOffDaysBeforeCalving: 60,
  diagnosisDaysAfterService: 45,
  calvingAlertDays: 15,
  weaningAgeDays: 240,
  levanteMaxDays: 540,
  bullMinAgeDays: 730,
  minServiceAgeDays: 450,
  gmdGreenKg: 0.6,
  gmdYellowKg: 0.3,
  targetSaleWeightKg: 450,
  weighIntervalDays: 30,
  milkDropPct: 30,
  maxWeightKgByCategory: { cria: 300, levante: 450, novilla: 650, novillo: 800, vaca: 900, toro: 1300 },
  maxLitersPerMilking: 40,
  maxLitersPerCowDay: 60,
  maxGmdKg: 2.5,
  prorateCebaPct: 50,
  prorateMethod: 'config',
  referencePricePerKgUsd: { cria: 0, levante: 0, novilla: 0, novillo: 0, vaca: 0, toro: 0 },
  sanitaryPlan: [
    { id: 'aftosa', name: 'Vacuna contra fiebre aftosa', kind: 'vacuna', categories: ['cria', 'levante', 'novilla', 'novillo', 'vaca', 'toro'], everyDays: 180, firstAgeDays: 90, productHint: 'Aftosa bivalente', active: true },
    { id: 'brucelosis', name: 'Vacuna contra brucelosis (hembras 3-8 meses)', kind: 'vacuna', categories: ['cria', 'levante'], everyDays: 0, firstAgeDays: 120, productHint: 'Cepa 19 / RB51', active: true },
    { id: 'clostridiales', name: 'Vacuna clostridial (carbón/edema)', kind: 'vacuna', categories: ['cria', 'levante', 'novilla', 'novillo', 'vaca', 'toro'], everyDays: 365, firstAgeDays: 90, productHint: 'Polivalente clostridial', active: true },
    { id: 'rabia', name: 'Vacuna antirrábica', kind: 'vacuna', categories: ['levante', 'novilla', 'novillo', 'vaca', 'toro'], everyDays: 365, productHint: 'Antirrábica bovina', active: false },
    { id: 'desparasitacion', name: 'Desparasitación interna', kind: 'desparasitacion', categories: ['cria', 'levante', 'novilla', 'novillo', 'vaca', 'toro'], everyDays: 90, firstAgeDays: 60, productHint: 'Ivermectina / albendazol', active: true },
    { id: 'vitaminas', name: 'Vitaminas ADE', kind: 'vitamina', categories: ['cria', 'levante'], everyDays: 120, firstAgeDays: 30, productHint: 'Vitamina ADE', active: false },
  ],
};

// ----------------------------------------------------------------------------
// ROLES Y PERMISOS
// ----------------------------------------------------------------------------

export type BovinoPermission =
  /** Carga diaria: ordeño, pesaje, nacimiento, ración/consumo de alimento, calostro, observaciones. */
  | 'carga_diaria'
  /** Reproducción, sanidad, movimientos de lotes/potreros, farmacia, alta de animales. */
  | 'manejo'
  /** Ver costos, precios y balances. */
  | 'ver_costos'
  /** Precios, compras, ventas, gastos, cierre de lotes, configuración, eliminaciones. */
  | 'administrar';

export function bovinoRoleOf(role: FarmRole | string | undefined): BovinoRole {
  if (role === 'Administrador') return 'propietario';
  if (role === 'Veterinario') return 'encargado';
  return 'operario';
}

const ROLE_PERMS: Record<BovinoRole, BovinoPermission[]> = {
  operario: ['carga_diaria'],
  encargado: ['carga_diaria', 'manejo'],
  propietario: ['carga_diaria', 'manejo', 'ver_costos', 'administrar'],
};

/** ¿El rol de la granja tiene el permiso bovino indicado? */
export function bovinoCan(role: FarmRole | string | undefined, perm: BovinoPermission): boolean {
  return ROLE_PERMS[bovinoRoleOf(role)].includes(perm);
}

export const BOVINO_ROLE_LABEL: Record<BovinoRole, string> = {
  operario: 'Operario / Ordeñador',
  encargado: 'Veterinario / Encargado',
  propietario: 'Propietario / Administrador',
};
