/** Utilidades puras del almacén bovino (agrupación por producto, FEFO, consumo y textos de dosis). */
import type { WarehouseItem } from '../../../../models/FarmModel';
import type { BovinoEvent, BovinoStockOutEvent, BovinoWarehouseCategory } from '../../../../models/bovinoModel';
import { isItemExpired, itemBovinoCategory } from '../../../../models/bovinoCalc';
import { addDays } from '../../../../utils/dates';

export const UNITS: WarehouseItem['unit'][] = ['kg', 'bultos (40kg)', 'litros', 'ml', 'g', 'unidades'];
export const UNIT_LABEL: Record<WarehouseItem['unit'], string> = {
  kg: 'kg',
  'bultos (40kg)': 'Saco 40 kg',
  litros: 'Litros',
  ml: 'ml',
  g: 'g',
  unidades: 'Unidades / dosis',
};

export const SUB_LABEL: Record<BovinoWarehouseCategory, string> = {
  alimentos: 'Alimentos',
  minerales: 'Minerales',
  farmacia: 'Farmacia',
  otros: 'Otros',
};

/** Un producto puede tener varias filas (una por lote del fabricante en farmacia). */
export interface ProductGroup {
  key: string;
  name: string;
  category: BovinoWarehouseCategory;
  rows: WarehouseItem[];
  quantity: number;
  unit: string;
  critical: boolean;
  expired: number;
  expiringSoon: number;
}

export function groupProducts(items: WarehouseItem[], today: string, isCritical: (i: WarehouseItem) => boolean): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  items.forEach((i) => {
    const cat = itemBovinoCategory(i);
    const key = `${cat}:${i.name.trim().toLowerCase()}`;
    const g = map.get(key) || { key, name: i.name, category: cat, rows: [], quantity: 0, unit: i.unit, critical: false, expired: 0, expiringSoon: 0 };
    g.rows.push(i);
    g.quantity = Math.round((g.quantity + (Number(i.quantity) || 0)) * 100) / 100;
    if (isItemExpired(i, today) && i.quantity > 0) g.expired += 1;
    else if (i.expirationDate && i.expirationDate <= addDays(today, 30) && i.quantity > 0) g.expiringSoon += 1;
    map.set(key, g);
  });
  const out = [...map.values()];
  out.forEach((g) => {
    g.rows.sort((a, b) => (a.expirationDate || '9999').localeCompare(b.expirationDate || '9999'));
    g.critical = g.rows.some(isCritical);
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** FEFO: primera fila vigente con stock (la que vence primero). */
export function fefoRow(rows: WarehouseItem[], today: string): WarehouseItem | undefined {
  return [...rows].filter((r) => !isItemExpired(r, today) && r.quantity > 0).sort((a, b) => (a.expirationDate || '9999').localeCompare(b.expirationDate || '9999'))[0];
}

/** Consumo diario promedio (salidas de los últimos 30 días) de un conjunto de filas. */
export function dailyConsumption(events: BovinoEvent[], itemIds: string[], today: string): number {
  const from = addDays(today, -30);
  const ids = new Set(itemIds);
  const total = events.reduce((s, e) => (e.kind === 'salida' && e.date >= from && ids.has((e as BovinoStockOutEvent).itemId) ? s + ((e as BovinoStockOutEvent).quantity || 0) : s), 0);
  return total / 30;
}

/** "1 ml / 50 kg" o "5 ml por animal". */
export function doseText(i: Pick<WarehouseItem, 'dosePerKg' | 'dosePerHead' | 'doseUnit' | 'unit'>): string | null {
  const u = i.doseUnit || i.unit;
  if (i.dosePerKg && i.dosePerKg > 0) {
    const kgPer1 = 1 / i.dosePerKg;
    return Number.isInteger(Math.round(kgPer1 * 10) / 10) && kgPer1 >= 1 ? `1 ${u} / ${Math.round(kgPer1)} kg` : `${i.dosePerKg} ${u} por kg`;
  }
  if (i.dosePerHead && i.dosePerHead > 0) return `${i.dosePerHead} ${u} por animal`;
  return null;
}
