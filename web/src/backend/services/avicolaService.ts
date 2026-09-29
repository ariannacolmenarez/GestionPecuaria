import { AvicolaLotDTO } from '../types';
import { financialService } from './financialService';
import { dbService, FARM_ID } from '../../services/dbService';

/**
 * AvicolaService: Gestión modular de lotes de pollos de engorde y galpones.
 * Seguimiento de conversión alimenticia (FCR), curvas de peso, mortalidad acumulada
 * y despacho de lote a beneficio.
 */
class AvicolaService {
  private lots: Map<string, AvicolaLotDTO> = new Map();

  constructor() {
    this.seedAvicolaLots();
  }

  private seedAvicolaLots() {
    const seed: AvicolaLotDTO[] = [
      {
        id: 'avi-001',
        batchCode: 'LOTE-ENG-04',
        shedNumber: 'Galpón 2 (Sección Norte)',
        lineBreed: 'Cobb 500 Fast Growth',
        initialChicks: 650,
        currentBirds: 632,
        entryDate: '2026-07-10',
        currentAgeDays: 40,
        currentAverageWeightGrams: 2350,
        totalFeedConsumedKg: 2850,
        feedConversionRatio: 1.92, // kg alimento / kg ave
        accumulatedMortalityCount: 18,
        mortalityRatePercent: 2.77,
        targetSlaughterAgeDays: 42,
        status: 'listo_faena',
      },
      {
        id: 'avi-002',
        batchCode: 'LOTE-ENG-05',
        shedNumber: 'Galpón 2 (Sección Sur)',
        lineBreed: 'Ross 308 Plus',
        initialChicks: 650,
        currentBirds: 618,
        entryDate: '2026-07-25',
        currentAgeDays: 25,
        currentAverageWeightGrams: 1280,
        totalFeedConsumedKg: 1350,
        feedConversionRatio: 1.71,
        accumulatedMortalityCount: 32,
        mortalityRatePercent: 4.92,
        targetSlaughterAgeDays: 42,
        status: 'crecimiento',
      },
    ];

    seed.forEach((lot) => this.lots.set(lot.id, lot));
  }

  public async getAllLots(): Promise<AvicolaLotDTO[]> {
    try {
      const dbLots = await dbService.getAvicolaLots(FARM_ID);
      if (dbLots && dbLots.length > 0) {
        return dbLots.map((l) => ({
          id: l.id,
          batchCode: l.code || l.batchCode,
          shedNumber: l.shed || l.shedNumber,
          lineBreed: l.breed || l.lineBreed,
          initialChicks: l.initial || l.initialChicks,
          currentBirds: l.current || l.currentBirds,
          entryDate: l.startDate || l.entryDate || '2026-07-15',
          currentAgeDays: l.age || l.currentAgeDays || 30,
          currentAverageWeightGrams: l.avgWeightGrams || l.currentAverageWeightGrams || 2000,
          totalFeedConsumedKg: l.feedTotalKg || l.totalFeedConsumedKg || 1000,
          feedConversionRatio: l.fcr || l.feedConversionRatio || 1.8,
          accumulatedMortalityCount: (l.initial || l.initialChicks || 650) - (l.current || l.currentBirds || 630),
          mortalityRatePercent: 2.5,
          targetSlaughterAgeDays: 42,
          status: l.status === 'Liquidado' ? 'liquidado' : l.status === 'Listo para Faena' ? 'listo_faena' : 'crecimiento',
        })) as AvicolaLotDTO[];
      }
    } catch (e) {
      console.warn('avicolaService fallback to in-memory:', e);
    }
    return Array.from(this.lots.values());
  }

  public async getTotalBirdsCount(): Promise<number> {
    const lots = await this.getAllLots();
    return lots.filter((l) => l.status !== 'liquidado').reduce((acc, l) => acc + l.currentBirds, 0);
  }

  public async createLot(dto: {
    batchCode: string;
    shedNumber: string;
    lineBreed: string;
    initialChicks: number;
    entryDate: string;
  }): Promise<AvicolaLotDTO> {
    const id = `avi_${Date.now()}`;
    const newLot: AvicolaLotDTO = {
      id,
      batchCode: dto.batchCode,
      shedNumber: dto.shedNumber,
      lineBreed: dto.lineBreed,
      initialChicks: dto.initialChicks,
      currentBirds: dto.initialChicks,
      entryDate: dto.entryDate,
      currentAgeDays: 1,
      currentAverageWeightGrams: 42,
      totalFeedConsumedKg: 0,
      feedConversionRatio: 1.0,
      accumulatedMortalityCount: 0,
      mortalityRatePercent: 0,
      targetSlaughterAgeDays: 42,
      status: 'iniciacion',
    };
    this.lots.set(id, newLot);

    dbService.saveAvicolaLot(FARM_ID, {
      id,
      code: dto.batchCode,
      shed: dto.shedNumber,
      breed: dto.lineBreed,
      initial: dto.initialChicks,
      current: dto.initialChicks,
      age: 1,
      avgWeightGrams: 42,
      feedTotalKg: 0,
      fcr: 1.0,
      status: 'Iniciación',
      startDate: dto.entryDate,
    }).catch(console.warn);

    return newLot;
  }

  public async recordDailyFeedAndMortality(
    batchCode: string,
    feedConsumedKg: number,
    deadBirdsCount: number,
    sampledAverageWeightGrams?: number
  ): Promise<AvicolaLotDTO> {
    let lot = Array.from(this.lots.values()).find((l) => l.batchCode === batchCode);
    if (!lot) {
      const all = await this.getAllLots();
      lot = all.find((l) => l.batchCode === batchCode);
    }
    if (!lot) {
      throw new Error(`Lot ${batchCode} not found.`);
    }

    const newCurrentBirds = Math.max(0, lot.currentBirds - deadBirdsCount);
    const newMortality = lot.accumulatedMortalityCount + deadBirdsCount;
    const mortalityRatePercent =
      Math.round((newMortality / lot.initialChicks) * 1000) / 10;
    const newTotalFeed = lot.totalFeedConsumedKg + feedConsumedKg;
    const avgWeight = sampledAverageWeightGrams || lot.currentAverageWeightGrams;

    // FCR = Consumo total de alimento / Biomasa total generada
    const totalBiomassKg = (newCurrentBirds * avgWeight) / 1000;
    const fcr =
      totalBiomassKg > 0 ? Math.round((newTotalFeed / totalBiomassKg) * 100) / 100 : 1.75;

    const updated: AvicolaLotDTO = {
      ...lot,
      currentBirds: newCurrentBirds,
      accumulatedMortalityCount: newMortality,
      mortalityRatePercent,
      totalFeedConsumedKg: newTotalFeed,
      currentAverageWeightGrams: avgWeight,
      feedConversionRatio: fcr,
      currentAgeDays: lot.currentAgeDays + 1,
      status:
        lot.currentAgeDays + 1 >= lot.targetSlaughterAgeDays ? 'listo_faena' : lot.status,
    };

    this.lots.set(lot.id, updated);

    dbService.saveAvicolaLot(FARM_ID, {
      id: lot.id,
      code: batchCode,
      current: newCurrentBirds,
      feedTotalKg: newTotalFeed,
      avgWeightGrams: avgWeight,
      fcr,
      status: updated.status === 'listo_faena' ? 'Listo para Faena' : 'Crecimiento',
    }).catch(console.warn);

    return updated;
  }

  public async liquidateLotSale(
    batchCode: string,
    salePricePerKg: number,
    buyerName: string
  ): Promise<{ lot: AvicolaLotDTO; grossIncomeUsd: number }> {
    let lot = Array.from(this.lots.values()).find((l) => l.batchCode === batchCode);
    if (!lot) {
      const all = await this.getAllLots();
      lot = all.find((l) => l.batchCode === batchCode);
    }
    if (!lot) {
      throw new Error(`Lot ${batchCode} not found.`);
    }

    const totalWeightKg = (lot.currentBirds * lot.currentAverageWeightGrams) / 1000;
    const grossIncomeUsd = Math.round(totalWeightKg * salePricePerKg * 100) / 100;

    const updated: AvicolaLotDTO = {
      ...lot,
      status: 'liquidado',
    };
    this.lots.set(lot.id, updated);

    dbService.saveAvicolaLot(FARM_ID, {
      id: lot.id,
      code: batchCode,
      current: 0,
      status: 'Liquidado',
    }).catch(console.warn);

    // Registrar ingreso financiero
    await financialService.createMovement({
      type: 'ingreso',
      concept: `Liquidación total Avícola: ${lot.batchCode} (${lot.currentBirds} pollos a ${buyerName})`,
      rubro: 'avicola',
      amount: grossIncomeUsd,
      date: new Date().toISOString().split('T')[0],
      category: 'Venta de aves de engorde',
      details: `Peso total despachado: ${totalWeightKg.toFixed(1)} kg. Precio unitario: $${salePricePerKg}/kg. FCR final del lote: ${lot.feedConversionRatio}.`,
    });

    return { lot: updated, grossIncomeUsd };
  }
}

export const avicolaService = new AvicolaService();
