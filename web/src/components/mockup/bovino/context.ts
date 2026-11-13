/**
 * Contexto del módulo bovino: datos y selectores del controlador, acciones de
 * dominio, permisos del usuario actual y navegación interna.
 * No guarda estado de dominio propio: todo cambio pasa por ctx.actions.* (bovinoDomain).
 */
import { createContext, useContext } from 'react';
import type { FinancialMovement, SanitaryTask, WarehouseItem } from '../../../models/FarmModel';
import type { BovinoConfig, FarmRole } from '../../../models/bovinoModel';
import type { BovinoAgendaItem, BovinoData, BovinoHomeSummary, BovinoIndex } from '../../../models/bovinoCalc';
import type { FarmController } from '../../../controllers/FarmController';
import type { AlmacenSub, BovinoRoute, BovinoScreen, BovinoSection } from './routes';
import type { BovinoPerms } from './perms';

export type BovinoActions = FarmController['bovinoActions'];
export type BovinoSelectors = FarmController['bovinoSelectors'];

/** Usuario de la sesión (AppSession.member). */
export interface BovinoMember {
  uid: string;
  name: string;
  role: FarmRole | string;
}

/** Hojas (formularios) que se abren desde varias pantallas; las monta BovinoModule. */
export type BovinoSheet =
  | { kind: 'alta'; lotId?: string; paddockId?: string }
  | { kind: 'tratamiento'; animalIds?: string[]; lotId?: string; itemId?: string; taskId?: string }
  | { kind: 'mover'; lotId?: string; animalIds?: string[]; toPaddockId?: string }
  | { kind: 'salida'; itemId?: string; lotId?: string; animalId?: string }
  | { kind: 'compra'; itemId?: string; category?: AlmacenSub }
  | { kind: 'insumo'; category?: AlmacenSub; itemId?: string }
  | { kind: 'pesaje'; animalId: string }
  | { kind: 'baja'; animalId: string; motivo?: 'muerte'; cause?: string; reportEventId?: string }
  | { kind: 'lote'; lotId?: string }
  | { kind: 'potrero'; paddockId?: string }
  | { kind: 'actividad'; lotId?: string; animalIds?: string[] }
  | { kind: 'evaluar'; eventId: string }
  | { kind: 'cambiarLote'; animalIds: string[] };

export interface BovinoCtx {
  data: BovinoData;
  index: BovinoIndex;
  home: BovinoHomeSummary;
  agenda: BovinoAgendaItem[];
  config: BovinoConfig;
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  /** Todos los insumos (las acciones del dominio los necesitan completos). */
  warehouseItems: WarehouseItem[];
  /** Solo insumos del rubro bovino. */
  bovinoItems: WarehouseItem[];
  today: string;
  actions: BovinoActions;
  selectors: BovinoSelectors;
  perms: BovinoPerms;
  me: BovinoMember;
  /** Nombre de la granja (encabezado de PDF y mensajes). */
  farmName: string;
  members: BovinoMember[];
  // ---- Navegación ----
  route: BovinoRoute;
  /** Abre una pantalla encima de la actual (en la sección actual o en otra). */
  navigate: (screen: BovinoScreen, section?: BovinoSection) => void;
  /** Cambia de sección (reinicia en su raíz). */
  goSection: (section: BovinoSection) => void;
  /** Atrás dentro del módulo (o al Home de la granja desde la raíz del Hato). */
  back: () => void;
  /** Vuelve al Home de la granja. */
  exitModule: () => void;
  /** Abre un formulario del módulo. */
  openSheet: (sheet: BovinoSheet) => void;
  closeSheet: () => void;
}

export const BovinoContext = createContext<BovinoCtx | null>(null);

export function useBovino(): BovinoCtx {
  const c = useContext(BovinoContext);
  if (!c) throw new Error('useBovino debe usarse dentro de BovinoModule');
  return c;
}
