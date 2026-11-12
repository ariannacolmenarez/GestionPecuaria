import {
  FarmSummary,
  PorcinoAnimal,
  WarehouseItem,
  SanitaryTask,
  FinancialMovement,
  FeedingPhaseData,
  BatchProductionConfig,
  ProductionBatch,
  LactatingLitter,
  ProductionFeedingPlan,
  ProductionFeedingPhase,
  ProductionType,
} from '../types';
import { ageInDays, addDays, currentPeriodLabel, todayISO } from '../utils/dates';
import { newId } from '../utils/ids';

export const granjaSummaryData: FarmSummary = {
  name: 'Granja Arianna',
  location: 'Sector El Recreo, Finca Ganadera & Porcina',
  totalMembers: 1,
  members: [
    {
      id: 'm-1',
      name: 'Arianna Pérez',
      role: 'Administrador',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      email: 'arianna@granja.com',
    },
  ],
  finances: {
    period: currentPeriodLabel(),
    totalExpenses: 0,
    totalIncome: 0,
    netUtility: 0,
    byRubro: [
      {
        rubro: 'Porcina',
        expenses: 0,
        income: 0,
        utility: 0,
        color: '#f43f5e',
      },
      {
        rubro: 'Bovina',
        expenses: 0,
        income: 0,
        utility: 0,
        color: '#3b82f6',
      },
      {
        rubro: 'Avícola',
        expenses: 0,
        income: 0,
        utility: 0,
        color: '#eab308',
      },
    ],
  },
  counts: {
    avicola: {
      pollosEngorde: 0,
    },
    porcino: {
      productoras: 0,
      lechones: 0,
      verracos: 0,
      engorde: 0,
    },
    bovino: {
      padrotes: 0,
      becerros: 0,
      vacas: 0,
    },
  },
};

export const porcinoAnimalsSample: PorcinoAnimal[] = [];

export const initialLactatingLitters: LactatingLitter[] = [];

export const warehouseItemsData: WarehouseItem[] = [];

export const sanitaryTasksAugust2026: SanitaryTask[] = [];

export const financialMovementsPorcino: FinancialMovement[] = [];

/** @deprecated Histórico inventado eliminado: usar calculateBalanceByPeriod(movements, ...).monthlyTrend. */
export const monthlyFinancialHistory: { month: string; income: number; expenses: number; utility: number }[] = [];

export const feedingPhasesData: FeedingPhaseData[] = [
  {
    phaseNumber: 1,
    title: 'Fase 1: Gestación Temprana',
    daysRange: 'Días 1 - 85',
    state: 'Gestación',
    dailyConsumptionBase: '2.2 a 2.5 kg/día',
    estimatedFeedKg: 187,
    description: 'Implantación embrionaria y mantenimiento corporal óptimo. Evitar sobrealimentación para prevenir mortalidad embrionaria y facilitar aplomos firmes.',
  },
  {
    phaseNumber: 2,
    title: 'Fase 2: Gestación Avanzada',
    daysRange: 'Días 86 - 114',
    state: 'Gestación',
    dailyConsumptionBase: '3.0 a 3.5 kg/día',
    estimatedFeedKg: 92,
    description: 'Crecimiento exponencial de los fetos y desarrollo mamario. Aumento estratégico de energía y proteína para asegurar pesos de nacimiento superiores a 1.35 kg por lechón.',
    transitionProtocol: {
      title: 'Protocolo de Transición de Gestación a Lactancia (Días 110 al 114 - 5 días previo al parto)',
      days: [
        {
          dayLabel: 'Día 1 (Día 110)',
          formula: '75% Alimento Gestación (2.25 kg) + 25% Alimento Lactancia (0.75 kg)',
          totalPerDay: '3.0 kg/día',
        },
        {
          dayLabel: 'Día 2 (Día 111)',
          formula: '50% Alimento Gestación (1.50 kg) + 50% Alimento Lactancia (1.50 kg)',
          totalPerDay: '3.0 kg/día',
        },
        {
          dayLabel: 'Día 3 (Día 112)',
          formula: '50% Alimento Gestación (1.50 kg) + 50% Alimento Lactancia (1.50 kg)',
          totalPerDay: '3.0 kg/día',
        },
        {
          dayLabel: 'Día 4 (Día 113)',
          formula: '25% Alimento Gestación (0.75 kg) + 75% Alimento Lactancia (2.25 kg)',
          totalPerDay: '3.0 kg/día',
        },
        {
          dayLabel: 'Día 5 (Día 114 / Parto)',
          formula: '100% Alimento Lactancia (3.0 kg inicio de curva a libre consumo progresivo)',
          totalPerDay: '3.0 kg a libre consumo',
        },
      ],
    },
  },
  {
    phaseNumber: 3,
    title: 'Fase 3: Lactancia (21 a 28 días)',
    daysRange: 'Días 115 - 142',
    state: 'Lactante',
    dailyConsumptionBase: '6.0 a 7.5 kg/día (A voluntad según lechones)',
    estimatedFeedKg: 135,
    description: 'Máxima producción lechera para la camada. Alimentación hiperenergética fraccionada en 3 a 4 tomas diarias para minimizar pérdida de condición corporal de la cerda.',
    transitionProtocol: {
      title: 'Transición del Alimento: Lactancia a Mantenimiento (Días 142 al 144)',
      days: [
        {
          dayLabel: 'Día 1 (Día 142 / Destete)',
          formula: 'Restricción de Lactancia a 2.0 kg para cortar drásticamente la producción láctea e inducir secado.',
          totalPerDay: '2.0 kg/día',
        },
        {
          dayLabel: 'Día 2 (Día 143)',
          formula: '50% Alimento Lactancia (1.75 kg) + 50% Alimento Mantenimiento / Flushing (1.75 kg)',
          totalPerDay: '3.5 kg/día',
        },
        {
          dayLabel: 'Día 3 en adelante (Días 144-147)',
          formula: '100% Alimento Mantenimiento / Flushing para estimular tasa ovulatoria rápida hacia el celo.',
          totalPerDay: '3.5 a 4.0 kg/día',
        },
      ],
    },
  },
  {
    phaseNumber: 4,
    title: 'Fase 4: Reacondicionamiento / Post-Destete',
    daysRange: 'Días 143 - 147 (Ciclo Total: 150 días)',
    state: 'Vacía / En Celo',
    dailyConsumptionBase: '3.5 a 4.0 kg/día',
    estimatedFeedKg: 18,
    description: 'Efecto "Flushing" nutricional para elevar picos de LH y FSH. Servicio e inseminación artificial entre el día 146 y 150 para reiniciar el ciclo.',
  },
];

export const batchProductionConfigsDefault: BatchProductionConfig[] = [
  {
    id: 'cfg-engorde',
    productionType: 'engorde',
    typeName: 'Lote de Engorde / Cebo Intensivo',
    cycleDurationDays: 95,
    description: 'Protocolo de recepción, sanidad, desparasitación bimestral y pesajes para lechones en desarrollo hasta peso final de mercado (100 - 110 kg).',
    activities: [
      {
        id: 'act-eng-1',
        dayOffset: 1,
        title: 'Recepción del Lote, Pesaje Inicial y Vitamina ADE',
        procedure: 'Ingreso al galpón desinfectado, pesaje testigo individual y aplicación de complejo vitamínico ADE hidrosoluble para mitigar estrés de transporte.',
        medicament: 'Complejo Vitamínico ADE + Electrolitos',
        dosage: '2 ml / animal intramuscular',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-eng-2',
        dayOffset: 7,
        title: 'Desparasitación Interna con Ivermectina 1%',
        procedure: 'Aplicación subcutánea en la base de la oreja para control profiláctico de nematodos gastrointestinales y pulmonares.',
        medicament: 'Ivermectina 1% L.A.',
        dosage: '1 ml / 33 kg de peso',
        responsibleRole: 'Operador de Granja',
      },
      {
        id: 'act-eng-3',
        dayOffset: 14,
        title: 'Vacunación Mycoplasma Hyopneumoniae y Circovirus PCV2',
        procedure: 'Inoculación intramuscular profunda en tabla del cuello para blindaje respiratorio y prevención de desmedro multisistémico.',
        medicament: 'Vacuna Combinada Myco + PCV2',
        dosage: '2 ml / animal',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-eng-4',
        dayOffset: 35,
        title: 'Pesaje de Control Intermedio y Revisión de Conversión',
        procedure: 'Muestreo del 30% del lote en báscula digital para evaluar Ganancia Diaria de Peso (GDP meta: 820g/día) y ajustar ración.',
        medicament: 'Báscula y registro biométrico',
        dosage: 'Control de Lote',
        responsibleRole: 'Operador de Granja',
      },
      {
        id: 'act-eng-5',
        dayOffset: 75,
        title: 'Control Pre-Salida y Tiempo de Retiro Farmacológico',
        procedure: 'Inspección zoosanitaria general. Certificar periodo de carencia libre de antibióticos y antiparasitarios previo a matadero o venta en pie.',
        medicament: 'Certificación zoosanitaria oficial',
        dosage: 'Evaluación Clínica',
        responsibleRole: 'Médico Veterinario',
      },
    ],
  },
  {
    id: 'cfg-lechones',
    productionType: 'lechones',
    typeName: 'Lote de Lechones (Lactancia y Pre-inicio)',
    cycleDurationDays: 35,
    description: 'Protocolo neonatal intensivo: prevención de anemia ferropénica, control de colibacilosis, corte profiláctico y destete al día 28.',
    activities: [
      {
        id: 'act-lec-1',
        dayOffset: 1,
        title: 'Atención Neonatal y Desinfección de Cordón Umbilical',
        procedure: 'Secado con polvo secante higienizante, desinfección de cordón umbilical con tintura de yodo al 10% y garantía de ingesta de calostro antes de 6 horas.',
        medicament: 'Yodo antiséptico 10%',
        dosage: 'Inmersión local tópica',
        responsibleRole: 'Operador de Maternidad',
      },
      {
        id: 'act-lec-2',
        dayOffset: 3,
        title: 'Aplicación de Hierro Dextrano y Corte de Colmillos',
        procedure: 'Inyección intramuscular profunda de 200mg de Hierro Dextrano en la tabla del cuello para evitar anemia. Despunte cauterizado de colmillos.',
        medicament: 'Hierro Dextrano 200mg (Gleptoferron)',
        dosage: '1.5 ml / lechón',
        responsibleRole: 'Operador de Maternidad',
      },
      {
        id: 'act-lec-3',
        dayOffset: 5,
        title: 'Prevención de Coccidiosis Neonatal',
        procedure: 'Administración oral obligatoria de Toltrazuril para prevenir diarreas por Isospora suis en la segunda y tercera semana.',
        medicament: 'Toltrazuril 5% suspensión oral',
        dosage: '1 ml / lechón vía oral',
        responsibleRole: 'Operador de Maternidad',
      },
      {
        id: 'act-lec-4',
        dayOffset: 14,
        title: 'Primera Dosis Vacuna Neumonía Enzoótica (Mycoplasma)',
        procedure: 'Inoculación intramuscular en cuello para inducción de inmunidad humoral temprana.',
        medicament: 'Bacterina Mycoplasma Hyopneumoniae',
        dosage: '2 ml / lechón IM',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-lec-5',
        dayOffset: 28,
        title: 'Pesaje de Destete, Prorrateo de Costos y Refuerzo PCV2',
        procedure: 'Separación de la madre a los 28 días, pesaje individual (meta > 7.5 kg), segunda dosis PCV2 y asignación a corral de pre-cebo.',
        medicament: 'Vacuna PCV2 + Vitamina B12',
        dosage: '1 ml / lechón',
        responsibleRole: 'Médico Veterinario',
      },
    ],
  },
  {
    id: 'cfg-maternidad',
    productionType: 'maternidad',
    typeName: 'Lote de Cerdas Maternidad / Reproductoras',
    cycleDurationDays: 145,
    description: 'Protocolo integral de inmunización de vientres para protección pasiva de camadas, preparación de parición y secado.',
    activities: [
      {
        id: 'act-mat-1',
        dayOffset: 5,
        title: 'Vacunación Parvovirus Porcino y Leptospirosis en Celo',
        procedure: 'Inmunización de hembras de reposición y multíparas previo a monta o inseminación para prevenir absorción fetal.',
        medicament: 'Vacuna Parvo + Lepto + Erisipela',
        dosage: '2 ml / hembra IM',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-mat-2',
        dayOffset: 95,
        title: 'Desparasitación Externa e Interna Pre-Parto',
        procedure: 'Tratamiento profiláctico con Ivermectina para asegurar que la cerda entre limpia de parásitos a la sala de partos.',
        medicament: 'Ivermectina 1% L.A.',
        dosage: '1 ml / 33 kg subcutánea',
        responsibleRole: 'Operador de Granja',
      },
      {
        id: 'act-mat-3',
        dayOffset: 105,
        title: 'Vacuna E. Coli y Clostridium a Madres Gestantes',
        procedure: 'Estimulación de anticuerpos calostrales para inmunidad pasiva de los lechones contra la colibacilosis enterotoxigénica.',
        medicament: 'Bacterina E. Coli + Clostridium perfringens',
        dosage: '2 ml / hembra IM profunda',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-mat-4',
        dayOffset: 114,
        title: 'Atención de Parto y Lavado Uterino Preventivo',
        procedure: 'Supervisión de expulsión placentaria, secado de camada y administración de antibiótico preventivo a la madre.',
        medicament: 'Oxitetraciclina L.A. + Oxitocina',
        dosage: '10 ml IM cerda',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-mat-5',
        dayOffset: 142,
        title: 'Destete, Secado y Vitamina E + Selenio para Nuevo Celo',
        procedure: 'Retiro de lechones, restricción de dieta de lactancia a 2kg e inyección de antioxidantes para reactivar ciclo ovulatorio.',
        medicament: 'Vitamina E + Selenio inyectable',
        dosage: '5 ml IM',
        responsibleRole: 'Operador de Granja',
      },
    ],
  },
  {
    id: 'cfg-verracos',
    productionType: 'verracos',
    typeName: 'Verracos Reproductores y Sementales',
    cycleDurationDays: 180,
    description: 'Protocolo preventivo semestral para mantenimiento de líbido, calidad espermática y salud podal en sementales.',
    activities: [
      {
        id: 'act-ver-1',
        dayOffset: 15,
        title: 'Desparasitación General y Revisión Podal',
        procedure: 'Inyección subcutánea de Ivermectina 1% y recorte higiénico de pezuñas con desinfección preventiva de almohadillas.',
        medicament: 'Ivermectina 1% + Sulfato de Cobre podal',
        dosage: '1 ml / 33 kg peso vivo',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-ver-2',
        dayOffset: 45,
        title: 'Vacunación Semestral Parvo, Lepto y Erisipela',
        procedure: 'Inoculación intramuscular para garantizar bioseguridad del semen y evitar transmisión venérea.',
        medicament: 'Bacterina Parvo-Lepto-Erisipela',
        dosage: '2 ml IM profunda en cuello',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-ver-3',
        dayOffset: 90,
        title: 'Evaluación Andrológica y Calidad Espermática',
        procedure: 'Extracción de eyaculado en potro artificial, evaluación de motilidad masal (>80%), concentración y morfología.',
        medicament: 'Diluyente espermático + Microscopía',
        dosage: 'Espermiograma de control',
        responsibleRole: 'Médico Veterinario',
      },
      {
        id: 'act-ver-4',
        dayOffset: 150,
        title: 'Refuerzo Vitamínico A-D3-E y Selenio',
        procedure: 'Suplementación antioxidante para protección de membrana espermática y vitalidad durante periodos de monta intensiva.',
        medicament: 'Complejo ADE + Selenio inyectable',
        dosage: '5 ml vía intramuscular',
        responsibleRole: 'Operador de Granja',
      },
    ],
  },
];

export const productionBatchesSample: ProductionBatch[] = [];

export const productionFeedingPlansDefault: ProductionFeedingPlan[] = [
  {
    productionType: 'engorde',
    typeName: 'Engorde y Acabado Comercial',
    description: 'Protocolo nutricional por etapas desde el destete hasta el peso final de mercado (105-115 kg).',
    phases: [
      {
        id: 'feed-eng-1',
        phaseNumber: 1,
        stageName: 'Iniciación / Pre-cebo',
        feedName: 'Iniciador Porcino 18% PB (Micro-pellet)',
        weightRangeKg: '8 kg - 25 kg',
        minWeightKg: 8,
        maxWeightKg: 25,
        daysRange: 'Días 1 - 28 (28 días)',
        durationDays: 28,
        dailyConsumptionKg: 1.1,
        totalFeedKg: 30.8,
        animalState: 'Crecimiento Inicial / Adaptación post-destete',
        description: 'Alta digestibilidad con aporte de aminoácidos esenciales y prebióticos entéricos.',
      },
      {
        id: 'feed-eng-2',
        phaseNumber: 2,
        stageName: 'Crecimiento y Desarrollo',
        feedName: 'Desarrollo Porcino 16% PB',
        weightRangeKg: '25 kg - 60 kg',
        minWeightKg: 25,
        maxWeightKg: 60,
        daysRange: 'Días 29 - 63 (35 días)',
        durationDays: 35,
        dailyConsumptionKg: 2.2,
        totalFeedKg: 77.0,
        animalState: 'Desarrollo Muscular Esquelético',
        description: 'Maximización de ganancia diaria de peso magro con óptima conversión alimenticia.',
      },
      {
        id: 'feed-eng-3',
        phaseNumber: 3,
        stageName: 'Engorde y Acabado Final',
        feedName: 'Finalizador Porcino 14% PB',
        weightRangeKg: '60 kg - 110 kg',
        minWeightKg: 60,
        maxWeightKg: 110,
        daysRange: 'Días 64 - 95 (32 días)',
        durationDays: 32,
        dailyConsumptionKg: 3.2,
        totalFeedKg: 102.4,
        animalState: 'Finalización Cárnica para Salida a Matadero',
        description: 'Consolidación de grasa dorsal controlada y óptima conformación de jamón y lomo.',
      },
    ],
  },
  {
    productionType: 'maternidad',
    typeName: 'Maternidad y Cerdas Reproductoras',
    description: 'Raciones dinámicas para el ciclo de 150 días: gestación temprana, gestación avanzada, lactancia intensiva y flushing.',
    phases: [
      {
        id: 'feed-mat-1',
        phaseNumber: 1,
        stageName: 'Gestación Temprana y Media',
        feedName: 'Ración Gestación Mantenimiento 13% PB',
        weightRangeKg: '160 kg - 210 kg',
        minWeightKg: 160,
        maxWeightKg: 210,
        daysRange: 'Días 1 - 85 (85 días)',
        durationDays: 85,
        dailyConsumptionKg: 2.3,
        totalFeedKg: 195.5,
        animalState: 'Gestante (Implantación y desarrollo embrionario)',
        description: 'Restricción calórica controlada para evitar engrasamiento uterino y distocias al parto.',
      },
      {
        id: 'feed-mat-2',
        phaseNumber: 2,
        stageName: 'Gestación Avanzada',
        feedName: 'Ración Gestación Alta Energía 15% PB',
        weightRangeKg: '210 kg - 235 kg',
        minWeightKg: 210,
        maxWeightKg: 235,
        daysRange: 'Días 86 - 114 (29 días)',
        durationDays: 29,
        dailyConsumptionKg: 3.2,
        totalFeedKg: 92.8,
        animalState: 'Gestante Avanzada (Fuerte hipertrofia fetal)',
        description: 'Aumento proteico y mineral para el 65% del crecimiento de la camada previo al parto.',
      },
      {
        id: 'feed-mat-3',
        phaseNumber: 3,
        stageName: 'Lactancia y Producción Lechera',
        feedName: 'Lactancia Hiperenergética 17.5% PB',
        weightRangeKg: '200 kg - 225 kg',
        minWeightKg: 200,
        maxWeightKg: 225,
        daysRange: 'Días 115 - 142 (28 días)',
        durationDays: 28,
        dailyConsumptionKg: 6.5,
        totalFeedKg: 182.0,
        animalState: 'Lactante (Pico de producción de calostro y leche)',
        description: 'Alimentación progresiva ad libitum para sustentar camadas de alta prolificidad sin catabolismo materno.',
      },
      {
        id: 'feed-mat-4',
        phaseNumber: 4,
        stageName: 'Post-Destete y Flushing Reproductivo',
        feedName: 'Flushing Pre-Servicio 16% PB + Vitaminas A-D-E',
        weightRangeKg: '190 kg - 210 kg',
        minWeightKg: 190,
        maxWeightKg: 210,
        daysRange: 'Días 143 - 150 (8 días)',
        durationDays: 8,
        dailyConsumptionKg: 3.8,
        totalFeedKg: 30.4,
        animalState: 'Vacía / En preparación de celo fértil',
        description: 'Choque energético para inducir ovulación vigorosa e intervalo destete-cubrición corto (<6 días).',
      },
    ],
  },
  {
    productionType: 'verracos',
    typeName: 'Verracos (Sementales Reproductores)',
    description: 'Protocolo de soporte androgénico, libido, calidad seminal y salud articular de machos adultos.',
    phases: [
      {
        id: 'feed-ver-1',
        phaseNumber: 1,
        stageName: 'Mantenimiento Reproductivo',
        feedName: 'Ración Machos Reproductores 14% PB',
        weightRangeKg: '200 kg - 280 kg',
        minWeightKg: 200,
        maxWeightKg: 280,
        daysRange: 'Continuo (Ciclo 90 días)',
        durationDays: 90,
        dailyConsumptionKg: 2.6,
        totalFeedKg: 234.0,
        animalState: 'Semental Activo / Mantenimiento Físico',
        description: 'Control de condición corporal para mantener agilidad y evitar aplomos vencidos.',
      },
      {
        id: 'feed-ver-2',
        phaseNumber: 2,
        stageName: 'Temporada de Alta Cubrición / Extracción',
        feedName: 'Ración Alta Fertilidad (Zinc + Selenio + Omega 3)',
        weightRangeKg: '220 kg - 285 kg',
        minWeightKg: 220,
        maxWeightKg: 285,
        daysRange: 'Días de montas intensivas (30 días)',
        durationDays: 30,
        dailyConsumptionKg: 3.3,
        totalFeedKg: 99.0,
        animalState: 'Semental en Alta Demanda Reproductiva',
        description: 'Refuerzo de antioxidantes para volumen de eyaculado y viabilidad espermática.',
      },
    ],
  },
  {
    productionType: 'lechones',
    typeName: 'Lechones Lactantes y Transición',
    description: 'Estimulación enzimática digestiva previa al destete completo.',
    phases: [
      {
        id: 'feed-lec-1',
        phaseNumber: 1,
        stageName: 'Calostro y Lactancia Materna',
        feedName: 'Leche Materna + Creep Feeding Líquido',
        weightRangeKg: '1.4 kg - 4.5 kg',
        minWeightKg: 1.4,
        maxWeightKg: 4.5,
        daysRange: 'Días 1 - 14 (14 días)',
        durationDays: 14,
        dailyConsumptionKg: 0.08,
        totalFeedKg: 1.12,
        animalState: 'Lactante Neonatal / Calostrado',
        description: 'Inmunidad pasiva materna con estímulo de micro-raciones de papilla tibia.',
      },
      {
        id: 'feed-lec-2',
        phaseNumber: 2,
        stageName: 'Pre-iniciador Transición Sólido',
        feedName: 'Micro-Pellet Pre-iniciador Fase 1 (21% PB)',
        weightRangeKg: '4.5 kg - 8.5 kg',
        minWeightKg: 4.5,
        maxWeightKg: 8.5,
        daysRange: 'Días 15 - 28 (14 días)',
        durationDays: 14,
        dailyConsumptionKg: 0.25,
        totalFeedKg: 3.5,
        animalState: 'Lactante con Consumo Sólido Activo',
        description: 'Proteínas hidrolizadas de alta digestibilidad para evitar diarreas al destete.',
      },
    ],
  },
];

export function getAnimalFeedingAndGrowthInfo(
  animal: PorcinoAnimal,
  feedingPlans: ProductionFeedingPlan[] = productionFeedingPlansDefault,
  referenceDate: string = todayISO()
) {
  // Edad real calculada contra la fecha del sistema (o la referencia indicada)
  const ageDays = Math.max(0, ageInDays(animal.birthDate, referenceDate));

  const ageWeeks = (ageDays / 7).toFixed(1);
  const ageMonths = (ageDays / 30.4).toFixed(1);
  const ageText = `${ageDays} días (${ageWeeks} sem / ${ageMonths} meses)`;

  const plans = feedingPlans && feedingPlans.length > 0 ? feedingPlans : productionFeedingPlansDefault;
  const plan = plans.find((p) => p.productionType === animal.category) || plans[0];

  let matchedPhase = plan.phases.find(
    (ph) => animal.currentWeightKg >= ph.minWeightKg && animal.currentWeightKg <= ph.maxWeightKg
  );

  if (!matchedPhase) {
    if (animal.currentWeightKg < (plan.phases[0]?.minWeightKg || 0)) {
      matchedPhase = plan.phases[0];
    } else {
      matchedPhase = plan.phases[plan.phases.length - 1];
    }
  }

  return {
    ageDays,
    ageWeeks,
    ageMonths,
    ageText,
    planTypeName: plan.typeName,
    stageName: matchedPhase.stageName,
    animalState: matchedPhase.animalState,
    feedName: matchedPhase.feedName,
    expectedWeightRangeKg: matchedPhase.weightRangeKg,
    minExpectedWeight: matchedPhase.minWeightKg,
    maxExpectedWeight: matchedPhase.maxWeightKg,
    dailyConsumptionKg: matchedPhase.dailyConsumptionKg,
    daysRange: matchedPhase.daysRange,
    totalStageConsumptionKg: matchedPhase.totalFeedKg,
    weightDiff: (animal.currentWeightKg - (matchedPhase.minWeightKg + matchedPhase.maxWeightKg) / 2).toFixed(1),
  };
}

export function generateSanitaryTasksForBatch(
  productionType: ProductionType,
  batchOrAnimalCode: string,
  startDateStr: string,
  location: string,
  animalCount: number,
  configs: BatchProductionConfig[]
): SanitaryTask[] {
  const config = configs.find((c) => c.productionType === productionType) || configs[0];
  if (!config || !config.activities) return [];

  return config.activities.map((act) => {
    const scheduledDate = addDays(startDateStr || todayISO(), act.dayOffset - 1);

    return {
      id: newId('st-auto'),
      title: `[${batchOrAnimalCode}] ${act.title}`,
      date: scheduledDate,
      targetRubro: 'porcino',
      targetGroup: `${batchOrAnimalCode} (${animalCount} animales en ${location})`,
      targetAnimal: `${batchOrAnimalCode}`,
      batchCode: batchOrAnimalCode,
      procedure: act.procedure,
      medicamentUsed: act.medicament,
      dosage: act.dosage,
      responsible: act.responsibleRole,
      status: 'pendiente',
      sourceEvent: 'protocolo',
      protocolKey: act.id,
    };
  });
}


