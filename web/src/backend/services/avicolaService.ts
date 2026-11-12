import { newId } from '../../utils/ids';
import { todayISO, daysBetween } from '../../utils/dates';
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
    // Sin datos de ejemplo: el servicio arranca vacío y solo contiene lo que registre el usuario.
  }

  public async getAllLots(): Promise<AvicolaLotDTO[]> {
    try {
      const dbLots = await dbService.getAvicolaLots(FARM_ID);
      if (dbLots && dbLots.length > 0) {
        // Sin valores inventados: todo se deriva del registro real (0 si falta el dato).
        return dbLots.map((l) => {
          const initial = l.initial || l.initialChicks || 0;
          const current = l.current ?? l.currentBirds ?? initial;
          const entryDate = l.startDate || l.entryDate || todayISO();
          const dead = Math.max(0, initial - current);
          return {
            id: l.id,
            batchCode: l.code || l.batchCode,
            shedNumber: l.shed || l.shedNumber,
            lineBreed: l.breed || l.lineBreed,
            initialChicks: initial,
            currentBirds: current,
            entryDate,
            currentAgeDays: l.age || l.currentAgeDays || Math.max(0, daysBetween(entryDate, todayISO())),
            currentAverageWeightGrams: l.avgWeightGrams || l.currentAverageWeightGrams || 0,
            totalFeedConsumedKg: l.feedTotalKg || l.totalFeedConsumedKg || 0,
            feedConversionRatio: l.fcr || l.feedConversionRatio || 0,
            accumulatedMortalityCount: dead,
            mortalityRatePercent: initial > 0 ? Math.round((dead / initial) * 1000) / 10 : 0,
            targetSlaughterAgeDays: 42,
            status: l.status === 'Liquidado' ? 'liquidado' : l.status === 'Listo para Faena' ? 'listo_faena' : 'crecimiento',
          };
        }) as AvicolaLotDTO[];
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
    const id = newId('avi');
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
