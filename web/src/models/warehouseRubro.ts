import type { WarehouseItem } from './FarmModel';

/** Rubro de un almacén / balance. */
export type WarehouseRubro = 'porcino' | 'avicola' | 'bovino';

export const WAREHOUSE_RUBRO_LABEL: Record<WarehouseRubro, string> = {
  porcino: 'Porcino',
  avicola: 'Avícola',
  bovino: 'Bovino',
};

/** Insumo del rubro indicado (los insumos sin rubro o 'general' son del almacén porcino histórico). */
export const itemMatchesRubro = (i: Pick<WarehouseItem, 'rubro'>, rubro: WarehouseRubro) =>
  rubro === 'porcino' ? !i.rubro || i.rubro === 'porcino' || i.rubro === 'general' : i.rubro === rubro;
