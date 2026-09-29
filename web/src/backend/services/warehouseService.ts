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
    const seedItems: WarehouseItemDTO[] = [
      {
        id: 'wh-01',
        name: 'Alimento Balanceado Lactancia Porcina',
        rubro: 'porcino',
        category: 'alimentos',
        quantity: 650, // kg
        unit: 'kg',
        unitCostUsd: 0.44,
        monthlyConsumptionRate: 850, // 850 kg/mes -> 650/850 = 0.76 meses (< 2 meses! Alerta crítica)
        minimumStock: 1700,
        coverageMonths: 0.76,
        hasShortageAlert: true,
        expirationDate: '2026-11-15',
        supplier: 'NutriPig Alimentos Balanceados',
        storageLocation: 'Bodega 1 - Tarima C',
      },
      {
        id: 'wh-02',
        name: 'Alimento Engorde Fase 2 (Pellet)',
        rubro: 'porcino',
        category: 'alimentos',
        quantity: 3400, // kg
        unit: 'kg',
        unitCostUsd: 0.38,
        monthlyConsumptionRate: 1500, // 3400/1500 = 2.27 meses (OK)
        minimumStock: 3000,
        coverageMonths: 2.27,
        hasShortageAlert: false,
        expirationDate: '2026-12-30',
        supplier: 'NutriPig Alimentos Balanceados',
        storageLocation: 'Silo Exterior 02',
      },
      {
        id: 'wh-03',
        name: 'Vacuna Suvaxyn Circo+Myco (50 dosis)',
        rubro: 'porcino',
        category: 'vacunas',
        quantity: 3, // frascos
        unit: 'frascos',
        unitCostUsd: 55.0,
        monthlyConsumptionRate: 2, // 1.5 meses (< 2 meses! Alerta preventiva)
        minimumStock: 4,
        coverageMonths: 1.5,
        hasShortageAlert: true,
        expirationDate: '2027-02-10',
        supplier: 'Laboratorios Zoetis',
        storageLocation: 'Refrigerador Veterinario (4°C)',
      },
      {
        id: 'wh-04',
        name: 'Hierro Dextrano Gleptosil 200mg/ml',
        rubro: 'porcino',
        category: 'medicamentos',
        quantity: 8,
        unit: 'frascos 100ml',
        unitCostUsd: 14.5,
        monthlyConsumptionRate: 3,
        minimumStock: 6,
        coverageMonths: 2.67,
        hasShortageAlert: false,
        expirationDate: '2027-06-20',
        supplier: 'Distribuidora AgroVet',
        storageLocation: 'Botiquín Central',
      },
      {
        id: 'wh-05',
        name: 'Sales Minerales Bovinas con Fósforo 8%',
        rubro: 'bovino',
        category: 'suplementos',
        quantity: 1200,
        unit: 'kg',
        unitCostUsd: 0.65,
        monthlyConsumptionRate: 400,
        minimumStock: 800,
        coverageMonths: 3.0,
        hasShortageAlert: false,
        expirationDate: '2027-08-01',
        supplier: 'Minerales del Llano',
        storageLocation: 'Bodega 2 - Bovinos',
      },
      {
        id: 'wh-06',
        name: 'Alimento Inicio Pollos de Engorde',
        rubro: 'avicola',
        category: 'alimentos',
        quantity: 450,
        unit: 'kg',
        unitCostUsd: 0.48,
        monthlyConsumptionRate: 600, // 0.75 meses (< 2 meses! Alerta crítica)
        minimumStock: 1200,
        coverageMonths: 0.75,
        hasShortageAlert: true,
        expirationDate: '2026-10-30',
        supplier: 'Avicampo Nutrición',
        storageLocation: 'Bodega 3 - Galpones',
      }
    ];

    seedItems.forEach((item) => this.items.set(item.id, item));
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
      id: `mov_${Date.now()}`,
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
    const id = `wh_${Date.now()}`;
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
