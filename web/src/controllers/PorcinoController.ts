/**
 * ============================================================================
 * CAPA CONTROLADOR (CONTROLLER) - CONTROLADOR DEL MÓDULO PORCINO
 * ============================================================================
 * Contiene la lógica y orquestación para:
 * - Altas y edición de animales porcinos (cerdas, verracos, engorde)
 * - Registro de partos y creación de lotes de lactancia
 * - Destete y prorrateo de costos hacia el lote de ceba
 * - Registro de mortalidades
 * - Ventas y despachos a matadero
 */

import { PorcinoAnimal, LactatingLitter, FarrowingRecord, UnifiedSaleResult } from '../models/FarmModel';
import { newId } from '../utils/ids';
import { calculateWeaningProrating } from '../models/PorcinoCalculations';

export const PorcinoController = {
  /**
   * Procesa el parto de una cerda:
   * Genera el registro de parto, actualiza el estado de la cerda a 'Lactante' y
   * da de alta una nueva camada lactante en el modelo.
   */
  processFarrowing(
    currentAnimals: PorcinoAnimal[],
    currentLitters: LactatingLitter[],
    record: FarrowingRecord
  ): { updatedAnimals: PorcinoAnimal[]; updatedLitters: LactatingLitter[] } {
    const updatedAnimals = currentAnimals.map((animal) => {
      if (animal.code === record.sowCode) {
        return {
          ...animal,
          healthStatus: 'Lactante' as const,
          stage: 'Maternidad Lactante',
          traceability: [
            ...(animal.traceability || []),
            {
              id: newId('parto'),
              date: record.date,
              type: 'parto' as const,
              title: `Parto Registrado: Camada ${record.litterBatchCode}`,
              description: `Nacidos vivos: ${record.bornAlive}, Muertos: ${record.stillborn}, Momias: ${record.mummies}. Machos: ${record.malesCount}, Hembras: ${record.femalesCount}.`,
              costUsd: 0,
            },
          ],
        };
      }
      return animal;
    });

    const newLitter: LactatingLitter = {
      id: newId('litter'),
      batchCode: record.litterBatchCode,
      sowCode: record.sowCode,
      birthDate: record.date,
      currentCount: record.bornAlive,
      initialCount: record.bornAlive,
      malesCount: record.malesCount,
      femalesCount: record.femalesCount,
      mortalityCount: 0,
      mortalityHistory: [],
      weaningStatus: 'en_lactancia',
    };

    return {
      updatedAnimals,
      updatedLitters: [newLitter, ...currentLitters],
    };
  },

  /**
   * Ejecuta el destete y prorrateo de costos:
   * 1. Marca la camada como destetada.
   * 2. Regresa la cerda a condición post-lactancia o descanso.
   * 3. Crea el nuevo lote de animales en categoría 'engorde' con su costo inicial prorrateado.
   */
  processWeaning(
    currentAnimals: PorcinoAnimal[],
    currentLitters: LactatingLitter[],
    params: {
      litterId: string;
      sowCode: string;
      weanedPigletsCount: number;
      sowCostToProrate: number;
      additionalLactationCost: number;
      destinationPen: string;
      batchCode: string;
    }
  ): { updatedAnimals: PorcinoAnimal[]; updatedLitters: LactatingLitter[] } {
    const { costPerPiglet, totalCostToProrate } = calculateWeaningProrating({
      sowAccumulatedCostUsd: params.sowCostToProrate,
      additionalLactationCostUsd: params.additionalLactationCost,
      weanedPigletsCount: params.weanedPigletsCount,
    });

    const updatedLitters = currentLitters.map((l) =>
      l.id === params.litterId ? { ...l, weaningStatus: 'destetado' as const } : l
    );

    const updatedAnimals = currentAnimals.map((a) => {
      if (a.code === params.sowCode) {
        return {
          ...a,
          healthStatus: 'Optimo' as const,
          stage: 'Descanso / Re-servicio',
          traceability: [
            ...(a.traceability || []),
            {
              id: newId('destete'),
              date: new Date().toISOString().split('T')[0],
              type: 'traslado' as const,
              title: `Destete completado - Camada ${params.batchCode}`,
              description: `Destetados ${params.weanedPigletsCount} lechones. Costo prorrateado transferido: $${totalCostToProrate.toFixed(2)}.`,
            },
          ],
        };
      }
      return a;
    });

    // Nuevo lote de engorde
    const newEngordeBatch: PorcinoAnimal = {
      id: newId('engorde-batch'),
      code: params.batchCode,
      name: `Lote Destetado ${params.batchCode}`,
      category: 'engorde',
      birthDate: new Date().toISOString().split('T')[0],
      currentWeightKg: 8.5,
      healthStatus: 'Optimo',
      stage: 'Iniciación / Crecimiento',
      accumulatedCostUsd: totalCostToProrate,
      photoUrl: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=200&auto=format&fit=crop&q=80',
      origin: 'destetado',
      penLocation: params.destinationPen,
      batchAnimalCount: params.weanedPigletsCount,
      traceability: [
        {
          id: newId('init'),
          date: new Date().toISOString().split('T')[0],
          type: 'traslado',
          title: 'Ingreso al área de ceba tras destete',
          description: `Ingresan ${params.weanedPigletsCount} lechones a razón de $${costPerPiglet} c/u provenientes de cerda ${params.sowCode}.`,
          costUsd: totalCostToProrate,
        },
      ],
    };

    return {
      updatedAnimals: [newEngordeBatch, ...updatedAnimals],
      updatedLitters,
    };
  },

  /**
   * Registra una venta o despacho a matadero
   */
  processSaleOrSlaughter(
    currentAnimals: PorcinoAnimal[],
    saleResult: UnifiedSaleResult
  ): PorcinoAnimal[] {
    return currentAnimals.map((animal) => {
      if (animal.id === saleResult.animalId || animal.code === saleResult.animalCode) {
        return {
          ...animal,
          isSoldToSlaughter: true,
          healthStatus: 'Matadero' as const,
          slaughterData: {
            date: saleResult.date,
            totalWeightKg: saleResult.totalLiveWeightKg,
            averageWeightKg: saleResult.averageLiveWeightKg,
            animalsCount: saleResult.animalsCount,
            salePriceUsd: saleResult.grossRevenueUsd,
            pricePerKgUsd: saleResult.pricePerKg,
            buyer: saleResult.buyer,
            lotCode: saleResult.animalCode,
            accumulatedCostUsd: saleResult.accumulatedCostUsd,
            netProfitUsd: saleResult.netProfitUsd,
          },
          traceability: [
            ...(animal.traceability || []),
            {
              id: newId('sale'),
              date: saleResult.date,
              type: 'matadero' as const,
              title: `Despacho a Matadero / Venta: ${saleResult.buyer}`,
              description: `Venta en ${saleResult.saleMode === 'pie' ? 'Pie' : 'Canal'}. Ingreso Neto: $${saleResult.netRevenueUsd.toFixed(2)}, Utilidad: $${saleResult.netProfitUsd.toFixed(2)}.`,
              costUsd: saleResult.grossRevenueUsd,
            },
          ],
        };
      }
      return animal;
    });
  },
};
