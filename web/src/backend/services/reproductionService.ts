import { newId } from '../../utils/ids';
import { MatingEventDTO, FarrowingRecordDTO, WeaningCalculationDTO } from '../types';

/**
 * ReproductionService: Módulo especializado en reproducción porcina y gestión del ciclo reproductivo.
 * Maneja montas naturales e inseminación, proyección de ecografía y partos (114 días),
 * registro de nacimientos (vivos/muertos/momias) y prorrateo financiero de destete.
 */
class ReproductionService {
  private matings: Map<string, MatingEventDTO> = new Map();
  private farrowings: Map<string, FarrowingRecordDTO> = new Map();

  constructor() {
    this.seedReproductionData();
  }

  private seedReproductionData() {
    // Sin datos de ejemplo: el servicio arranca vacío y solo contiene lo que registre el usuario.
  }

  /**
   * Helper para calcular fechas biológicas de la cerda:
   * Retorno celo: +21 días
   * Ecografía: +35 días
   * Parto estimado: +114 días (3 meses, 3 semanas, 3 días)
   */
  public calculateReproductiveMilestones(matingDateStr: string) {
    const matingDate = new Date(matingDateStr);

    const heatDate = new Date(matingDate);
    heatDate.setDate(heatDate.getDate() + 21);

    const ultrasoundDate = new Date(matingDate);
    ultrasoundDate.setDate(ultrasoundDate.getDate() + 35);

    const farrowingDate = new Date(matingDate);
    farrowingDate.setDate(farrowingDate.getDate() + 114);

    return {
      expectedReturnToHeatDate: heatDate.toISOString().split('T')[0],
      expectedUltrasoundDate: ultrasoundDate.toISOString().split('T')[0],
      expectedFarrowingDate: farrowingDate.toISOString().split('T')[0],
    };
  }

  public async registerMating(data: {
    boarCode: string;
    sowCode: string;
    date: string;
    matingType: 'natural' | 'inseminacion';
    isExternalBoar?: boolean;
    externalBoarName?: string;
    externalCostUsd?: number;
    notes?: string;
  }): Promise<MatingEventDTO> {
    const milestones = this.calculateReproductiveMilestones(data.date);
    const id = newId('mat');

    const newMating: MatingEventDTO = {
      id,
      boarCode: data.boarCode,
      sowCode: data.sowCode,
      date: data.date,
      matingType: data.matingType,
      isExternalBoar: !!data.isExternalBoar,
      externalBoarName: data.externalBoarName,
      externalCostUsd: data.externalCostUsd || 0,
      expectedReturnToHeatDate: milestones.expectedReturnToHeatDate,
      expectedUltrasoundDate: milestones.expectedUltrasoundDate,
      expectedFarrowingDate: milestones.expectedFarrowingDate,
      confirmedPregnant: false,
      notes: data.notes,
    };

    this.matings.set(id, newMating);
    return newMating;
  }

  public async getMatings(sowCode?: string): Promise<MatingEventDTO[]> {
    const all = Array.from(this.matings.values());
    if (sowCode) {
      return all.filter((m) => m.sowCode.toUpperCase() === sowCode.toUpperCase());
    }
    return all;
  }

  public async registerFarrowing(dto: {
    sowCode: string;
    farrowingDate: string;
    liveBorn: number;
    stillborn: number;
    mummified: number;
    averageBirthWeightKg: number;
    penMaternity: string;
    assignedBoarCode?: string;
    notes?: string;
  }): Promise<FarrowingRecordDTO> {
    const id = newId('far');
    const totalBorn = dto.liveBorn + dto.stillborn + dto.mummified;
    const record: FarrowingRecordDTO = {
      id,
      ...dto,
      totalBorn,
      lactatingPigletsCount: dto.liveBorn,
    };
    this.farrowings.set(id, record);
    return record;
  }

  public async getFarrowings(sowCode?: string): Promise<FarrowingRecordDTO[]> {
    const all = Array.from(this.farrowings.values());
    if (sowCode) {
      return all.filter((f) => f.sowCode.toUpperCase() === sowCode.toUpperCase());
    }
    return all;
  }

  /**
   * Calcula el costo total y unitario prorrateado de destete,
   * y calcula la distribución entre engorde, reposición y venta directa.
   */
  public calculateWeaningProrating(params: {
    sowCode: string;
    weaningDate: string;
    lactationDays: number;
    totalPigletsWeaned: number;
    averageWeaningWeightKg: number;
    sowDailyFeedKg?: number;
    feedCostPerKg?: number;
    healthCostPerPiglet?: number;
    fixedFacilityCostUsd?: number;
    distribution: {
      engorde: number;
      reemplazoMadres: number;
      reemplazoVerracos: number;
      ventaDirecta: number;
    };
    salePricePerPiglet?: number;
    buyerName?: string;
  }): WeaningCalculationDTO {
    const sowFeed = params.sowDailyFeedKg || 6.5; // kg/día en lactancia
    const feedPrice = params.feedCostPerKg || 0.42; // USD/kg
    const healthPerPiglet = params.healthCostPerPiglet || 4.5; // USD (hierro, vacunas)
    const fixedFacility = params.fixedFacilityCostUsd || 25.0; // USD instalaciones

    // Costo alimentación cerda durante la lactancia
    const totalSowFeedCost = params.lactationDays * sowFeed * feedPrice;
    // Costo sanitario camada
    const totalLitterHealthCost = params.totalPigletsWeaned * healthPerPiglet;
    // Costo total de camada
    const totalLactationCostUsd = Math.round((totalSowFeedCost + totalLitterHealthCost + fixedFacility) * 100) / 100;

    const count = Math.max(1, params.totalPigletsWeaned);
    const costPerPigletUsd = Math.round((totalLactationCostUsd / count) * 100) / 100;

    return {
      sowCode: params.sowCode,
      weaningDate: params.weaningDate,
      lactationDays: params.lactationDays,
      totalPigletsWeaned: params.totalPigletsWeaned,
      averageWeaningWeightKg: params.averageWeaningWeightKg,
      totalLactationCostUsd,
      costPerPigletUsd,
      distribution: params.distribution,
      salePricePerPiglet: params.salePricePerPiglet,
      buyerName: params.buyerName,
    };
  }
}

export const reproductionService = new ReproductionService();
