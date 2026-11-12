import { newId } from '../../utils/ids';
import { WarehouseItemDTO, StockMovementDTO, RubroType } from '../types';

/**
 * WarehouseService: Control y gestión modular de inventario pecuario.
 * Almacén de balanceados, fármacos, vacunas e insumos.
 * Implementa alerta temprana preventiva automática si la cobertura es inferior a 2 meses (< 60 días).
 */
class WarehouseService {
  private items: Map<string, WarehouseItemDTO> = new Map();
  private movements: StockMovementDTO[] = [];

  constructor() {
    this.seedWarehouse();
  }

  private seedWarehouse() {
    // Sin datos de ejemplo: el servicio arranca vacío y solo contiene lo que registre el usuario.
  }

  public async getItems(rubro?: RubroType | 'general'): Promise<WarehouseItemDTO[]> {
    let list = Array.from(this.items.values());
    if (rubro && rubro !== 'general') {
      list = list.filter((i) => i.rubro === rubro || i.rubro === 'general');
    }
    return list;
  }

  public async getItemById(id: string): Promise<WarehouseItemDTO | null> {
    return this.items.get(id) || null;
  }

  public async getCriticalItems(): Promise<WarehouseItemDTO[]> {
    const all = Array.from(this.items.values());
    return all.filter((i) => i.hasShortageAlert || i.coverageMonths < 2.0);
  }

  public async recordMovement(params: {
    itemId: string;
    type: 'entrada' | 'salida_consumo' | 'ajuste' | 'baja';
    quantity: number;
    reason: string;
    targetLotOrAnimal?: string;
    registeredBy: string;
  }): Promise<{ item: WarehouseItemDTO; movement: StockMovementDTO }> {
    const item = this.items.get(params.itemId);
    if (!item) {
      throw new Error(`Item ${params.itemId} not found in warehouse.`);
    }

    let newQuantity = item.quantity;
    if (params.type === 'entrada') {
      newQuantity += params.quantity;
    } else {
      newQuantity = Math.max(0, newQuantity - params.quantity);
    }

    const rate = Math.max(1, item.monthlyConsumptionRate);
    const coverageMonths = Math.round((newQuantity / rate) * 100) / 100;
    const hasShortageAlert = coverageMonths < 2.0;

    const updatedItem: WarehouseItemDTO = {
      ...item,
      quantity: newQuantity,
      coverageMonths,
      hasShortageAlert,
    };
    this.items.set(params.itemId, updatedItem);

    const movement: StockMovementDTO = {
      id: newId('mov'),
      itemId: params.itemId,
      type: params.type,
      quantity: params.quantity,
      date: new Date().toISOString().split('T')[0],
      reason: params.reason,
      targetLotOrAnimal: params.targetLotOrAnimal,
      unitCostUsd: item.unitCostUsd,
      totalCostUsd: Math.round(params.quantity * item.unitCostUsd * 100) / 100,
      registeredBy: params.registeredBy,
    };
    this.movements.unshift(movement);

    return { item: updatedItem, movement };
  }

  public async createItem(dto: Omit<WarehouseItemDTO, 'id' | 'coverageMonths' | 'hasShortageAlert'>): Promise<WarehouseItemDTO> {
    const id = newId('wh');
    const rate = Math.max(1, dto.monthlyConsumptionRate);
    const coverageMonths = Math.round((dto.quantity / rate) * 100) / 100;
    const hasShortageAlert = coverageMonths < 2.0;

    const newItem: WarehouseItemDTO = {
      ...dto,
      id,
      coverageMonths,
      hasShortageAlert,
    };
    this.items.set(id, newItem);
    return newItem;
  }
}

export const warehouseService = new WarehouseService();
