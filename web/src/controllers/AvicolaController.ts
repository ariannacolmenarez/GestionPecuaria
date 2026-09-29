/**
 * ============================================================================
 * CAPA CONTROLADOR (CONTROLLER) - CONTROLADOR DEL MÓDULO AVÍCOLA
 * ============================================================================
 * Lógica de negocio para:
 * - Creación de lotes de pollos de engorde (Cobb 500, Ross 308)
 * - Registro diario de consumo de alimento (kg), mortalidad y peso promedio
 * - Cálculo de conversión alimenticia (FCR) y biomasa total
 * - Liquidación y despacho de lotes a matadero/distribuidora
 */

import { AvicolaLot, FinancialMovement } from '../models/FarmModel';
import { calculateAvicolaCounters } from '../models/PorcinoCalculations';

export const AvicolaController = {
  getCounters(lots: AvicolaLot[]) {
    return calculateAvicolaCounters(lots);
  },

  recordDaily(
    lots: AvicolaLot[],
    lotCode: string,
    feedKg: number,
    mortality: number,
    sampledWeightGrams: number,
    date: string = new Date().toISOString().split('T')[0]
  ): AvicolaLot[] {
    return lots.map((l) => {
      if (l.code === lotCode) {
        const newCurrent = Math.max(0, l.current - mortality);
        const newFeedTotal = l.feedTotalKg + feedKg;
        const biomassKg = (newCurrent * sampledWeightGrams) / 1000;
        const newFcr = biomassKg > 0 ? Math.round((newFeedTotal / biomassKg) * 100) / 100 : l.fcr;

        const newDailyLog = {
          date,
          feedKg,
          mortality,
          sampledWeightGrams,
        };

        return {
          ...l,
          current: newCurrent,
          feedTotalKg: newFeedTotal,
          fcr: newFcr,
          avgWeightGrams: sampledWeightGrams,
          dailyLogs: [...(l.dailyLogs || []), newDailyLog],
        };
      }
      return l;
    });
  },

  liquidateLot(
    lots: AvicolaLot[],
    lotCode: string,
    pricePerKg: number,
    buyerName: string,
    date: string = new Date().toISOString().split('T')[0]
  ): { updatedLots: AvicolaLot[]; movement: FinancialMovement } {
    const lot = lots.find((l) => l.code === lotCode);
    if (!lot) {
      throw new Error(`Lote ${lotCode} no encontrado.`);
    }

    const totalWeightKg = (lot.current * lot.avgWeightGrams) / 1000;
    const grossIncome = Math.round(totalWeightKg * pricePerKg * 100) / 100;

    const updatedLots = lots.map((l) =>
      l.code === lotCode ? { ...l, status: 'Liquidado' as const, current: 0 } : l
    );

    const movement: FinancialMovement = {
      id: `fm-avi-sale-${Date.now()}`,
      type: 'ingreso',
      concept: `Liquidación Lote Aves ${lotCode} (${lot.current} pollos) a ${buyerName}`,
      rubro: 'avicola',
      amount: grossIncome,
      date,
      category: 'Venta de aves',
      details: `${lot.current} aves, biomasa aprox: ${totalWeightKg.toFixed(1)}kg a $${pricePerKg}/kg.`,
    };

    return { updatedLots, movement };
  },

  addLot(
    lots: AvicolaLot[],
    lotData: Omit<AvicolaLot, 'id'>
  ): AvicolaLot[] {
    const newLot: AvicolaLot = {
      ...lotData,
      id: `av_lot_${Date.now()}`,
    };
    return [newLot, ...lots];
  },
};
