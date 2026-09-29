// ==========================================================
// BACKEND TYPES & DATA TRANSFER OBJECTS (DTOs)
// Arquitectura Modular Pecuaria: Porcino, Bovino, Avícola
// ==========================================================

export type RubroType = 'porcino' | 'bovino' | 'avicola';
export type PorcinoCategory = 'engorde' | 'maternidad' | 'verracos' | 'lechones';

// ----------------------------------------------------------
// ANIMAL & HERD DTOs
// ----------------------------------------------------------

export interface AnimalDTO {
  id: string;
  code: string;
  name: string;
  rubro: RubroType;
  category: string;
  breed: string;
  birthDate: string;
  currentWeightKg: number;
  healthStatus: 'Optimo' | 'Tratamiento' | 'Cuarentena' | 'Descarte';
  stage: string;
  penLocation?: string;
  provenance?: string;
  admissionDate?: string;
  admissionWeightKg?: number;
  admissionPriceUsd?: number;
  accumulatedCostUsd?: number;
  batchAnimalCount?: number;
  photoUrl?: string;
  updatedAt?: string;
}

export interface CreateAnimalDTO {
  code: string;
  name: string;
  rubro: RubroType;
  category: string;
  breed: string;
  birthDate: string;
  currentWeightKg: number;
  healthStatus?: 'Optimo' | 'Tratamiento' | 'Cuarentena' | 'Descarte';
  stage?: string;
  penLocation?: string;
  provenance?: string;
  admissionWeightKg?: number;
  admissionPriceUsd?: number;
  batchAnimalCount?: number;
  photoUrl?: string;
}

// ----------------------------------------------------------
// REPRODUCTION DTOs
// ----------------------------------------------------------

export interface MatingEventDTO {
  id: string;
  boarCode: string;
  sowCode: string;
  date: string;
  matingType: 'natural' | 'inseminacion';
  isExternalBoar: boolean;
  externalBoarName?: string;
  externalCostUsd?: number;
  expectedReturnToHeatDate: string; // +21 días
  expectedUltrasoundDate: string;    // +35 días
  expectedFarrowingDate: string;     // +114 días
  confirmedPregnant?: boolean;
  notes?: string;
}

export interface FarrowingRecordDTO {
  id: string;
  sowCode: string;
  farrowingDate: string;
  liveBorn: number;
  stillborn: number;
  mummified: number;
  totalBorn: number;
  averageBirthWeightKg: number;
  lactatingPigletsCount: number;
  penMaternity: string;
  assignedBoarCode?: string;
  notes?: string;
}

export interface WeaningCalculationDTO {
  sowCode: string;
  weaningDate: string;
  lactationDays: number;
  totalPigletsWeaned: number;
  averageWeaningWeightKg: number;
  totalLactationCostUsd: number;
  costPerPigletUsd: number;
  distribution: {
    engorde: number;
    reemplazoMadres: number;
    reemplazoVerracos: number;
    ventaDirecta: number;
  };
  salePricePerPiglet?: number;
  buyerName?: string;
}

// ----------------------------------------------------------
// SANITARY DTOs
// ----------------------------------------------------------

export interface SanitaryTaskDTO {
  id: string;
  rubro: RubroType;
  title: string;
  animalCode?: string;
  animalCategory?: string;
  batchCode?: string;
  date: string;
  time?: string;
  status: 'pendiente' | 'completada' | 'cancelada';
  category: 'vacunacion' | 'desparasitacion' | 'tratamiento' | 'revision' | 'suplemento';
  medicationName?: string;
  dosage?: string;
  administrationRoute?: 'Intramuscular' | 'Subcutánea' | 'Oral' | 'Tópica' | 'En agua';
  withdrawalDays?: number; // Tiempo de retiro para carne/leche
  withdrawalEndDate?: string;
  responsible: string;
  costUsd?: number;
  notes?: string;
  completedAt?: string;
  completedBy?: string;
}

// ----------------------------------------------------------
// WAREHOUSE & INVENTORY DTOs
// ----------------------------------------------------------

export interface WarehouseItemDTO {
  id: string;
  name: string;
  rubro: RubroType | 'general';
  category: 'alimentos' | 'medicamentos' | 'vacunas' | 'suplementos' | 'materiales';
  quantity: number;
  unit: string;
  unitCostUsd: number;
  monthlyConsumptionRate: number; // Consumo mensual estimado
  minimumStock: number;
  coverageMonths: number; // Cobertura calculada
  hasShortageAlert: boolean; // < 2.0 meses
  expirationDate?: string;
  supplier?: string;
  storageLocation?: string;
}

export interface StockMovementDTO {
  id: string;
  itemId: string;
  type: 'entrada' | 'salida_consumo' | 'ajuste' | 'baja';
  quantity: number;
  date: string;
  reason: string;
  targetLotOrAnimal?: string;
  unitCostUsd: number;
  totalCostUsd: number;
  registeredBy: string;
}

// ----------------------------------------------------------
// SALES & SLAUGHTER DTOs
// ----------------------------------------------------------

export interface SaleSlaughterDTO {
  id: string;
  rubro: RubroType;
  targetType: 'individual' | 'lote';
  animalCode?: string;
  batchCode?: string;
  animalCount: number;
  saleDate: string;
  clientOrBuyer: string;
  saleType: 'pie' | 'canal_fria' | 'canal_caliente';
  liveWeightKg: number;
  carcassWeightKg?: number;
  dressingPercentage?: number; // Rendimiento %
  pricePerUnit: number;
  grossRevenueUsd: number;
  slaughterFeeUsd?: number;
  transportFeeUsd?: number;
  netRevenueUsd: number;
  accumulatedCostUsd?: number;
  netProfitUsd: number;
  profitMarginPercent: number;
  destinationFacility?: string;
  sanitaryInspectionGuideNumber?: string;
}

// ----------------------------------------------------------
// FINANCIAL DTOs
// ----------------------------------------------------------

export interface FinancialMovementDTO {
  id: string;
  type: 'ingreso' | 'egreso';
  concept: string;
  rubro: RubroType | 'general';
  amount: number;
  date: string;
  category: string;
  paymentMethod?: string;
  receiptNumber?: string;
  details?: string;
}

export interface FinancialBalanceDTO {
  period: string;
  mode?: 'mes' | 'año';
  selectedMonth?: number;
  selectedYear?: number;
  totalIncome: number;
  totalExpenses: number;
  netUtility: number;
  utilityMarginPercent: number;
  monthlyTrend?: {
    month: string;
    monthIndex: number;
    income: number;
    expenses: number;
    net: number;
  }[];
  byRubro: {
    rubro: RubroType;
    income: number;
    expenses: number;
    utility: number;
    marginPercent: number;
  }[];
}

// ----------------------------------------------------------
// BOVINO HERD DTOs
// ----------------------------------------------------------

export interface BovinoAnimalDTO {
  id: string;
  tagNumber: string; // Número de caravana
  name: string;
  type: 'padrote' | 'vaca_lactante' | 'vaca_seca' | 'novilla' | 'becerro' | 'macho_ceba';
  breed: string; // p. ej. Girolando, Brahman, Holstein
  birthDate: string;
  currentWeightKg: number;
  dailyMilkProductionLiters?: number; // Para vacas en ordeño
  lactationDays?: number;
  inseminationDate?: string;
  healthStatus: 'Optimo' | 'Mastitis' | 'Tratamiento' | 'Cuarentena';
  lastMilkingDate?: string;
  paddockLocation?: string;
}

// ----------------------------------------------------------
// AVICOLA LOT DTOs
// ----------------------------------------------------------

export interface AvicolaLotDTO {
  id: string;
  batchCode: string; // p. ej. LOTE-ENG-05
  shedNumber: string; // Galpón 1, 2, etc.
  lineBreed: string; // Cobb 500, Ross 308
  initialChicks: number;
  currentBirds: number;
  entryDate: string;
  currentAgeDays: number;
  currentAverageWeightGrams: number;
  totalFeedConsumedKg: number;
  feedConversionRatio: number; // FCR = Consumo Alimento / Ganancia Peso
  accumulatedMortalityCount: number;
  mortalityRatePercent: number;
  targetSlaughterAgeDays: number;
  status: 'iniciacion' | 'crecimiento' | 'engorde_final' | 'listo_faena' | 'liquidado';
}

// ----------------------------------------------------------
// UNIFIED ALERTS DTOs
// ----------------------------------------------------------

export interface SystemAlertDTO {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  rubro: RubroType | 'general';
  category: 'sanitario' | 'almacen' | 'reproduccion' | 'mortalidad' | 'peso';
  title: string;
  message: string;
  date: string;
  actionRoute?: string;
  actionLabel?: string;
}

// ----------------------------------------------------------
// PORCINO SPECIALIZED METRICS & FEEDING DTOs
// ----------------------------------------------------------

export interface EngordeMetricsDTO {
  totalCerdos: number;
  totalLotes: number;
  pesoPromedioKg: number;
  gananciaDiariaPesoGdpKg: number;
  conversionAlimenticiaFcr: number;
  diasPromedioEngorde: number;
  costoPromedioPorKgUsd: number;
}

export interface MaternidadMetricsDTO {
  totalReproductoras: number;
  gestantes: number;
  lactantes: number;
  reemplazo: number;
  tasaFertilidadPercent: number;
  promedioLechonesNacidosVivos: number;
  diasPromedioLactancia: number;
  pezonesPromedioPorCerda: number;
  costoMantenimientoTotalUsd: number;
}

export interface VerracosMetricsDTO {
  totalVerracos: number;
  totalMontasRegistradas: number;
  efectividadFertilidadPercent: number;
  diasPromedioDescanso: number;
  costoMantenimientoTotalUsd: number;
  razasDisponibles: string[];
}

export interface LechonesMetricsDTO {
  totalLechonesVivos: number;
  totalCamadasActivas: number;
  mortalidadAcumulada: number;
  tasaMortalidadPercent: number;
  pesoPromedioActualKg: number;
  diasPromedioAlDestete: number;
  costoCrianzaPorLechonUsd: number;
}

export interface AnimalMovementLedgerDTO {
  categoria: string;
  censoInicial: number;
  entradasCompras: number;
  entradasNacimientos: number;
  entradasDestete: number;
  salidasVentas: number;
  salidasMatadero: number;
  salidasMortalidad: number;
  censoFinalActual: number;
}

export interface FeedingPhaseDTO {
  id: string;
  stageName: string;
  daysRange: string;
  durationDays: number;
  weightRangeKg: string;
  animalState: string;
  feedName: string;
  dailyConsumptionKg: number;
  totalFeedKg: number;
  proteinPercent?: number;
  description?: string;
}

export interface ProductionFeedingPlanDTO {
  productionType: 'engorde' | 'maternidad' | 'verracos' | 'lechones';
  typeName: string;
  description: string;
  phases: FeedingPhaseDTO[];
}
