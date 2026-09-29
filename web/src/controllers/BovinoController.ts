/**
 * ============================================================================
 * CAPA CONTROLADOR (CONTROLLER) - CONTROLADOR DEL MÓDULO BOVINO
 * ============================================================================
 * Lógica de negocio para:
 * - Clasificación y registro de animales bovinos (padrotes, vacas, becerros)
 * - Registro de ordeño diario e ingresos financieros por litro
 * - Control de potreros y días de lactancia
 */

import { BovinoAnimal, FinancialMovement } from '../models/FarmModel';
import { calculateBovinoCounters } from '../models/PorcinoCalculations';

export const BovinoController = {
  getCounters(herd: BovinoAnimal[]) {
    return calculateBovinoCounters(herd);
  },

  registerMilking(
    herd: BovinoAnimal[],
    cowTag: string,
    liters: number,
    pricePerLiter: number = 0.42,
    date: string = new Date().toISOString().split('T')[0]
  ): { updatedHerd: BovinoAnimal[]; movement: FinancialMovement } {
    const updatedHerd = herd.map((cow) =>
      cow.tag === cowTag ? { ...cow, dailyLiters: liters, lastMilkingDate: date } : cow
    );

    const totalIncome = Math.round(liters * pricePerLiter * 100) / 100;
    const movement: FinancialMovement = {
      id: `fm-bov-milk-${Date.now()}`,
      type: 'ingreso',
      concept: `Venta de leche ordeño diario: Vaca ${cowTag} (${liters} L)`,
      rubro: 'bovino',
      amount: totalIncome,
      date,
      category: 'Venta de leche',
      details: `${liters} Litros a $${pricePerLiter}/L. Tanque de refrigeración.`,
    };

    return { updatedHerd, movement };
  },

  addAnimal(
    herd: BovinoAnimal[],
    animalData: Omit<BovinoAnimal, 'id'>
  ): BovinoAnimal[] {
    const newAnimal: BovinoAnimal = {
      ...animalData,
      id: `bov_${Date.now()}`,
    };
    return [newAnimal, ...herd];
  },
};
