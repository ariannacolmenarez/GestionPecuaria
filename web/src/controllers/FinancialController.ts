/**
 * ============================================================================
 * CAPA CONTROLADOR (CONTROLLER) - CONTROLADOR FINANCIERO DE LA GRANJA
 * ============================================================================
 * Maneja:
 * - Registro de ingresos y egresos
 * - Cálculo de utilidad neta por rubro (Porcina, Bovina, Avícola)
 * - Proyecciones de rentabilidad
 */

import { FinancialMovement } from '../models/FarmModel';

export const FinancialController = {
  /**
   * Calcula el balance total de ingresos, gastos y utilidad
   */
  calculateFinancialTotals(movements: FinancialMovement[]) {
    let totalIncome = 0;
    let totalExpenses = 0;

    movements.forEach((m) => {
      if (m.type === 'ingreso') {
        totalIncome += m.amount;
      } else {
        totalExpenses += m.amount;
      }
    });

    return {
      totalIncome,
      totalExpenses,
      netUtility: totalIncome - totalExpenses,
    };
  },

  /**
   * Agrega un nuevo movimiento financiero al historial
   */
  addMovement(
    movements: FinancialMovement[],
    newMovement: FinancialMovement
  ): FinancialMovement[] {
    return [newMovement, ...movements];
  },
};
