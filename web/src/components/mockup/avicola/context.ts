/**
 * Contexto del módulo avícola: datos del controlador + acciones de dominio.
 * Evita pasar las mismas props por cada pestaña. Sin estado de dominio propio.
 */
import { createContext, useContext } from 'react';
import type { SanitaryTask, WarehouseItem, FinancialMovement } from '../../../models/FarmModel';
import type { AvicolaData, AvicolaHomeSummary } from '../../../models/avicolaDomain';
import type { AvicolaActions } from '../../../controllers/FarmController';
import type { ControlSub, LotTab } from './shared';

export interface AvicolaCtx {
  data: AvicolaData;
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  warehouseItems: WarehouseItem[];
  today: string;
  home: AvicolaHomeSummary;
  actions: AvicolaActions;
  /** Abre el detalle de un lote (o el Home avícola con null). */
  openLot: (loteId: string | null, tab?: LotTab, sub?: ControlSub) => void;
  /** Abre el almacén global de la app. */
  openWarehouse?: () => void;
}

export const AvicolaContext = createContext<AvicolaCtx | null>(null);

export function useAvicola(): AvicolaCtx {
  const c = useContext(AvicolaContext);
  if (!c) throw new Error('useAvicola debe usarse dentro de AvicolaModule');
  return c;
}
