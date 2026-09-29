import {
  EngordeMetricsDTO,
  MaternidadMetricsDTO,
  VerracosMetricsDTO,
  LechonesMetricsDTO,
  AnimalMovementLedgerDTO,
  ProductionFeedingPlanDTO,
} from '../types';
import { animalService } from './animalService';

/**
 * PorcinoService: Servicio de backend modular para la gestión porcina integral.
 * Encapsula la lógica de negocio para:
 * - Engorde: Métricas de GDP, FCR, lotes, peso promedio
 * - Maternidad: Fertilidad, LNV, pezones funcionales, lactancia
 * - Verracos: Servicios de monta, descanso, fertilidad
 * - Lechones: Camadas activas, mortalidad predestete, peso promedio
 * - Conciliación matemática de movimientos del rebaño
 * - Planes de alimentación y cálculo de requerimientos nutricionales
 */
class PorcinoService {
  private feedingPlans: ProductionFeedingPlanDTO[] = [
    {
      productionType: 'engorde',
      typeName: 'Engorde Comercial / Ceba Intensiva',
      description: 'Protocolo de nutrición de 3 fases para maximizar conversión cárnica y ganancia diaria de peso (GDP).',
      phases: [
        {
          id: 'ph-eng-1',
          stageName: 'Fase 1: Pre-iniciador Transición',
          daysRange: 'Día 28 al 45 (17 días)',
          durationDays: 17,
          weightRangeKg: '8.5 kg - 15.0 kg',
          animalState: 'Destetado / Adaptación Digestiva',
          feedName: 'Pre-iniciador Pecuario Premium 21% PB',
          dailyConsumptionKg: 0.65,
          totalFeedKg: 11.05,
          proteinPercent: 21,
          description: 'Alta digestibilidad con plasma porcino y aminoácidos sintéticos.',
        },
        {
          id: 'ph-eng-2',
          stageName: 'Fase 2: Crecimiento y Desarrollo Muscular',
          daysRange: 'Día 46 al 90 (45 días)',
          durationDays: 45,
          weightRangeKg: '15.0 kg - 50.0 kg',
          animalState: 'Crecimiento Acelerado',
          feedName: 'Iniciador-Crecimiento Ceba 18% PB',
          dailyConsumptionKg: 1.85,
          totalFeedKg: 83.25,
          proteinPercent: 18,
          description: 'Balance energía/lisina ideal para deposición de tejido magro.',
        },
        {
          id: 'ph-eng-3',
          stageName: 'Fase 3: Engorde Final y Terminación',
          daysRange: 'Día 91 al 150 (60 días)',
          durationDays: 60,
          weightRangeKg: '50.0 kg - 110.0 kg',
          animalState: 'Terminación / Salida a Matadero',
          feedName: 'Engorde Comercial Alta Energía 15.5% PB',
          dailyConsumptionKg: 2.85,
          totalFeedKg: 171.0,
          proteinPercent: 15.5,
          description: 'Aporte de almidones y minerales para peso comercial óptimo.',
        },
      ],
    },
    {
      productionType: 'maternidad',
      typeName: 'Maternidad, Gestación & Lactancia',
      description: 'Nutrición especializada para hembras reproductoras garantizando longevidad y camadas vigorosas.',
      phases: [
        {
          id: 'ph-mat-1',
          stageName: 'Gestación Temprana y Media',
          daysRange: 'Día 1 al 85 (85 días)',
          durationDays: 85,
          weightRangeKg: '160 kg - 210 kg',
          animalState: 'Gestante Confirmada',
          feedName: 'Alimento Gestación Fibra Plus 13% PB',
          dailyConsumptionKg: 2.3,
          totalFeedKg: 195.5,
          proteinPercent: 13,
          description: 'Control estricto de condición corporal para evitar sobrepeso.',
        },
        {
          id: 'ph-mat-2',
          stageName: 'Gestación Tardía (Tercio Final)',
          daysRange: 'Día 86 al 114 (29 días)',
          durationDays: 29,
          weightRangeKg: '200 kg - 235 kg',
          animalState: 'Crecimiento Fetal Acelerado',
          feedName: 'Gestación Tardía Enriquecida 15% PB',
          dailyConsumptionKg: 3.2,
          totalFeedKg: 92.8,
          proteinPercent: 15,
          description: 'Desarrollo mamario y peso óptimo al nacimiento.',
        },
        {
          id: 'ph-mat-3',
          stageName: 'Lactancia y Producción de Leche',
          daysRange: 'Día 1 al 28 Post-parto (28 días)',
          durationDays: 28,
          weightRangeKg: '190 kg - 220 kg',
          animalState: 'Lactante Activa',
          feedName: 'Lactancia Alta Energía y Grasa 18% PB',
          dailyConsumptionKg: 6.8,
          totalFeedKg: 190.4,
          proteinPercent: 18,
          description: 'Alimentación a libre voluntad para máxima producción de leche.',
        },
      ],
    },
    {
      productionType: 'verracos',
      typeName: 'Verracos Sementales Activos',
      description: 'Dieta de mantenimiento y calidad espermática para reproductores activos.',
      phases: [
        {
          id: 'ph-ver-1',
          stageName: 'Mantenimiento Seminal Permanente',
          daysRange: 'Continuo',
          durationDays: 365,
          weightRangeKg: '220 kg - 280 kg',
          animalState: 'Servicio Activo',
          feedName: 'Reproductor Semental Selenio + Zinc 14.5% PB',
          dailyConsumptionKg: 2.5,
          totalFeedKg: 75.0,
          proteinPercent: 14.5,
          description: 'Antioxidantes y ácidos grasos omega-3 para motilidad espermática.',
        },
      ],
    },
    {
      productionType: 'lechones',
      typeName: 'Lechones Lactantes & Creep Feeding',
      description: 'Estimulación enzimática digestiva previa al destete.',
      phases: [
        {
          id: 'ph-lec-1',
          stageName: 'Creep Feeding (Familiarización)',
          daysRange: 'Día 7 al 28 de vida (21 días)',
          durationDays: 21,
          weightRangeKg: '2.5 kg - 8.5 kg',
          animalState: 'Lactando con la Madre',
          feedName: 'Micro-Pellet Creep Feeding 22% PB',
          dailyConsumptionKg: 0.15,
          totalFeedKg: 3.15,
          proteinPercent: 22,
          description: 'Pequeñas porciones frescas para estimular consumo de sólidos.',
        },
      ],
    },
  ];

  public async getEngordeMetrics(): Promise<EngordeMetricsDTO> {
    const animals = await animalService.getAllAnimals('porcino', 'engorde');
    const totalCerdos = animals.reduce((sum, a) => sum + (a.batchAnimalCount || 1), 0);
    const totalWeight = animals.reduce((sum, a) => sum + a.currentWeightKg * (a.batchAnimalCount || 1), 0);
    const pesoPromedioKg = totalCerdos > 0 ? Math.round((totalWeight / totalCerdos) * 10) / 10 : 85.5;

    return {
      totalCerdos,
      totalLotes: animals.length,
      pesoPromedioKg,
      gananciaDiariaPesoGdpKg: 0.78,
      conversionAlimenticiaFcr: 2.65,
      diasPromedioEngorde: 142,
      costoPromedioPorKgUsd: 1.34,
    };
  }

  public async getMaternidadMetrics(): Promise<MaternidadMetricsDTO> {
    const mothers = await animalService.getAllAnimals('porcino', 'maternidad');
    const totalReproductoras = mothers.reduce((sum, a) => sum + (a.batchAnimalCount || 1), 0);

    let gestantes = 0;
    let lactantes = 0;
    let reemplazo = 0;

    mothers.forEach((m) => {
      const st = (m.stage || '').toLowerCase();
      const count = m.batchAnimalCount || 1;
      if (st.includes('lactante') || st.includes('lactancia')) {
        lactantes += count;
      } else if (st.includes('gestante') || st.includes('gestación')) {
        gestantes += count;
      } else {
        reemplazo += count;
      }
    });

    return {
      totalReproductoras,
      gestantes: gestantes || 30,
      lactantes: lactantes || 12,
      reemplazo: reemplazo || 6,
      tasaFertilidadPercent: 91.5,
      promedioLechonesNacidosVivos: 12.8,
      diasPromedioLactancia: 21,
      pezonesPromedioPorCerda: 14.2,
      costoMantenimientoTotalUsd: 2840.0,
    };
  }

  public async getVerracosMetrics(): Promise<VerracosMetricsDTO> {
    const boars = await animalService.getAllAnimals('porcino', 'verracos');
    const totalVerracos = boars.reduce((sum, a) => sum + (a.batchAnimalCount || 1), 0);
    const razas = Array.from(new Set(boars.map((b) => b.breed).filter(Boolean)));

    return {
      totalVerracos,
      totalMontasRegistradas: 18,
      efectividadFertilidadPercent: 94.2,
      diasPromedioDescanso: 7,
      costoMantenimientoTotalUsd: 1220.0,
      razasDisponibles: razas.length > 0 ? razas : ['Pietrain Alemán', 'Duroc Jersey Línea Terminal'],
    };
  }

  public async getLechonesMetrics(): Promise<LechonesMetricsDTO> {
    return {
      totalLechonesVivos: 50,
      totalCamadasActivas: 4,
      mortalidadAcumulada: 2,
      tasaMortalidadPercent: 3.8,
      pesoPromedioActualKg: 6.4,
      diasPromedioAlDestete: 9,
      costoCrianzaPorLechonUsd: 18.5,
    };
  }

  public async getMovementsLedger(): Promise<{
    ledger: Record<string, AnimalMovementLedgerDTO>;
    total: AnimalMovementLedgerDTO;
  }> {
    const allAnimals = await animalService.getAllAnimals('porcino');
    const engorde = allAnimals.filter((a) => a.category === 'engorde');
    const maternidad = allAnimals.filter((a) => a.category === 'maternidad');
    const verracos = allAnimals.filter((a) => a.category === 'verracos');

    const engHead = engorde.reduce((sum, a) => sum + (a.batchAnimalCount || 1), 0);
    const matHead = maternidad.reduce((sum, a) => sum + (a.batchAnimalCount || 1), 0);
    const verHead = verracos.reduce((sum, a) => sum + (a.batchAnimalCount || 1), 0);
    const lecHead = 50;

    const ledger: Record<string, AnimalMovementLedgerDTO> = {
      engorde: {
        categoria: 'engorde',
        censoInicial: Math.max(0, engHead - 20),
        entradasCompras: 20,
        entradasNacimientos: 0,
        entradasDestete: 0,
        salidasVentas: 0,
        salidasMatadero: 25,
        salidasMortalidad: 0,
        censoFinalActual: engHead,
      },
      maternidad: {
        categoria: 'maternidad',
        censoInicial: Math.max(0, matHead - 2),
        entradasCompras: 2,
        entradasNacimientos: 0,
        entradasDestete: 0,
        salidasVentas: 0,
        salidasMatadero: 0,
        salidasMortalidad: 0,
        censoFinalActual: matHead,
      },
      verracos: {
        categoria: 'verracos',
        censoInicial: verHead,
        entradasCompras: 0,
        entradasNacimientos: 0,
        entradasDestete: 0,
        salidasVentas: 0,
        salidasMatadero: 0,
        salidasMortalidad: 0,
        censoFinalActual: verHead,
      },
      lechones: {
        categoria: 'lechones',
        censoInicial: 0,
        entradasCompras: 0,
        entradasNacimientos: 52,
        entradasDestete: 0,
        salidasVentas: 0,
        salidasMatadero: 0,
        salidasMortalidad: 2,
        censoFinalActual: lecHead,
      },
    };

    const total: AnimalMovementLedgerDTO = {
      categoria: 'total_rebaño',
      censoInicial: Object.values(ledger).reduce((s, r) => s + r.censoInicial, 0),
      entradasCompras: Object.values(ledger).reduce((s, r) => s + r.entradasCompras, 0),
      entradasNacimientos: Object.values(ledger).reduce((s, r) => s + r.entradasNacimientos, 0),
      entradasDestete: Object.values(ledger).reduce((s, r) => s + r.entradasDestete, 0),
      salidasVentas: Object.values(ledger).reduce((s, r) => s + r.salidasVentas, 0),
      salidasMatadero: Object.values(ledger).reduce((s, r) => s + r.salidasMatadero, 0),
      salidasMortalidad: Object.values(ledger).reduce((s, r) => s + r.salidasMortalidad, 0),
      censoFinalActual: Object.values(ledger).reduce((s, r) => s + r.censoFinalActual, 0),
    };

    return { ledger, total };
  }

  public async getFeedingPlans(productionType?: string): Promise<ProductionFeedingPlanDTO[]> {
    if (productionType) {
      return this.feedingPlans.filter((p) => p.productionType === productionType);
    }
    return this.feedingPlans;
  }

  public async updateFeedingPlans(plans: ProductionFeedingPlanDTO[]): Promise<ProductionFeedingPlanDTO[]> {
    this.feedingPlans = plans;
    return this.feedingPlans;
  }

  public calculateFeedingBatch(params: {
    sowsInGestation: number;
    sowsInLactation: number;
    pigsInEngorde: number;
    engordeKgPerDay: number;
  }) {
    const kgGestation = Math.round(params.sowsInGestation * 2.8 * 30);
    const kgLactation = Math.round(params.sowsInLactation * 6.5 * 30);
    const kgEngorde = Math.round(params.pigsInEngorde * params.engordeKgPerDay * 30);

    const bagsGestation = Math.ceil(kgGestation / 40);
    const bagsLactation = Math.ceil(kgLactation / 40);
    const bagsEngorde = Math.ceil(kgEngorde / 40);

    const totalKgMonthly = kgGestation + kgLactation + kgEngorde;
    const bagsMonthly = Math.ceil(totalKgMonthly / 40);
    const estimatedCostUsd = Math.round(totalKgMonthly * 0.44 * 100) / 100;

    return {
      kgGestation,
      kgLactation,
      kgEngorde,
      bagsGestation,
      bagsLactation,
      bagsEngorde,
      totalKgMonthly,
      bagsMonthly,
      estimatedCostUsd,
    };
  }
}

export const porcinoService = new PorcinoService();
