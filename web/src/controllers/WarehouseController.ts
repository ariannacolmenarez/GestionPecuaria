/**
 * ============================================================================
 * CAPA CONTROLADOR (CONTROLLER) - CONTROLADOR DE ALMACÉN E INSUMOS
 * ============================================================================
 * Supervisa:
 * - Detección de insumos críticos con cobertura menor a 2 meses
 * - Entradas y salidas de inventario
 * - Ajuste de costos unitarios
 */

import { WarehouseItem } from '../models/FarmModel';
import { evaluateWarehouseReplenishment } from '../models/PorcinoCalculations';

export const WarehouseController = {
  /**
   * Obtiene la lista de ítems de almacén auditados con estado de reposición
   */
  getAuditItems(items: WarehouseItem[]) {
    return evaluateWarehouseReplenishment(items);
  },

  /**
   * Filtra únicamente los insumos que requieren reposición inmediata (< 2 meses)
   */
  getCriticalItems(items: WarehouseItem[]) {
    return evaluateWarehouseReplenishment(items).filter((i) => i.isCritical);
  },

  /**
   * Incrementa el stock de un producto tras una compra
   */
  restockItem(
    items: WarehouseItem[],
    itemId: string,
    addedQuantity: number
  ): WarehouseItem[] {
    return items.map((item) =>
      item.id === itemId
        ? { ...item, quantity: item.quantity + addedQuantity }
        : item
    );
  },

  /**
   * Descuenta stock tras una aplicación o consumo
   */
  consumeItem(
    items: WarehouseItem[],
    itemId: string,
    consumedQuantity: number
  ): WarehouseItem[] {
    return items.map((item) =>
      item.id === itemId
        ? { ...item, quantity: Math.max(0, item.quantity - consumedQuantity) }
        : item
    );
  },
};
