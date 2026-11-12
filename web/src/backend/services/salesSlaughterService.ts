import { newId } from '../../utils/ids';
import { SaleSlaughterDTO } from '../types';
import { financialService } from './financialService';

/**
 * SalesSlaughterService: Módulo unificado para ventas en pie y liquidación de beneficio/matadero.
 * Calcula peso vivo, peso en canal, rendimiento porcentual (dressing percentage),
 * deducción de fletes e inspección veterinaria, e impacta el módulo financiero contable.
 */
class SalesSlaughterService {
  private sales: Map<string, SaleSlaughterDTO> = new Map();

  constructor() {
    this.seedSales();
  }

  private seedSales() {
    // Sin datos de ejemplo: el servicio arranca vacío y solo contiene lo que registre el usuario.
  }

  public async getAllSales(): Promise<SaleSlaughterDTO[]> {
    return Array.from(this.sales.values());
  }

  public async recordSaleOrSlaughter(params: {
    rubro: 'porcino' | 'bovino' | 'avicola';
    targetType: 'individual' | 'lote';
    animalCode?: string;
    batchCode?: string;
    animalCount: number;
    saleDate: string;
    clientOrBuyer: string;
    saleType: 'pie' | 'canal_fria' | 'canal_caliente';
    liveWeightKg: number;
    carcassWeightKg?: number;
    pricePerUnit: number; // Por kg vivo o por kg canal
    slaughterFeeUsd?: number;
    transportFeeUsd?: number;
    accumulatedCostUsd?: number;
    destinationFacility?: string;
    sanitaryInspectionGuideNumber?: string;
  }): Promise<SaleSlaughterDTO> {
    const id = newId('sale');
    const dressingPercentage =
      params.carcassWeightKg && params.liveWeightKg > 0
        ? Math.round((params.carcassWeightKg / params.liveWeightKg) * 1000) / 10
        : params.saleType === 'pie'
        ? 100
        : 78.5;

    // Cálculo de ingresos brutos
    let grossRevenueUsd = 0;
    if (params.saleType === 'pie') {
      grossRevenueUsd = params.liveWeightKg * params.pricePerUnit;
    } else {
      const weight = params.carcassWeightKg || params.liveWeightKg * 0.78;
      grossRevenueUsd = weight * params.pricePerUnit;
    }
    grossRevenueUsd = Math.round(grossRevenueUsd * 100) / 100;

    const slaughterFee = params.slaughterFeeUsd || 0;
    const transportFee = params.transportFeeUsd || 0;
    const netRevenueUsd = Math.round((grossRevenueUsd - slaughterFee - transportFee) * 100) / 100;

    const cost = params.accumulatedCostUsd || 0;
    const netProfitUsd = Math.round((netRevenueUsd - cost) * 100) / 100;
    const profitMarginPercent =
      netRevenueUsd > 0 ? Math.round((netProfitUsd / netRevenueUsd) * 1000) / 10 : 0;

    const record: SaleSlaughterDTO = {
      id,
      rubro: params.rubro,
      targetType: params.targetType,
      animalCode: params.animalCode,
      batchCode: params.batchCode,
      animalCount: params.animalCount,
      saleDate: params.saleDate,
      clientOrBuyer: params.clientOrBuyer,
      saleType: params.saleType,
      liveWeightKg: params.liveWeightKg,
      carcassWeightKg: params.carcassWeightKg,
      dressingPercentage,
      pricePerUnit: params.pricePerUnit,
      grossRevenueUsd,
      slaughterFeeUsd: slaughterFee,
      transportFeeUsd: transportFee,
      netRevenueUsd,
      accumulatedCostUsd: cost,
      netProfitUsd,
      profitMarginPercent,
      destinationFacility: params.destinationFacility,
      sanitaryInspectionGuideNumber: params.sanitaryInspectionGuideNumber,
    };

    this.sales.set(id, record);

    // Registro automático en el balance financiero
    await financialService.createMovement({
      type: 'ingreso',
      concept: `Venta/Liquidación ${params.rubro.toUpperCase()}: ${params.animalCount} cabezas (${params.clientOrBuyer})`,
      rubro: params.rubro,
      amount: netRevenueUsd,
      date: params.saleDate,
      category: 'Venta de animales / Faena',
      details: `Peso vivo total: ${params.liveWeightKg} kg. Tipo: ${params.saleType}. Rendimiento: ${dressingPercentage}%. Utilidad calculada: +$${netProfitUsd} USD.`,
    });

    return record;
  }
}

export const salesSlaughterService = new SalesSlaughterService();
