/**
 * ============================================================================
 * REGLAS BÁSICAS DEL DOMINIO PORCINO (SIN DEPENDENCIAS)
 * ============================================================================
 * Criterio ÚNICO de "animal activo" y helpers de conteo usados por todos los
 * cálculos (censo, métricas, ledger) y por la capa de dominio.
 */

import { PorcinoAnimal, LactatingLitter } from './FarmModel';

/** Cabezas representadas por un registro (lote o individuo). */
export function headCount(a: Pick<PorcinoAnimal, 'batchAnimalCount'>): number {
  const n = a.batchAnimalCount;
  return typeof n === 'number' && isFinite(n) ? Math.max(0, n) : 1;
}

/**
 * Criterio único de animal activo en inventario:
 * - no vendido / no enviado a matadero
 * - estado distinto de 'Matadero' y 'Descarte'
 * - con al menos 1 cabeza en el registro
 */
export function isActiveAnimal(a: PorcinoAnimal | null | undefined): boolean {
  if (!a) return false;
  if (a.isSoldToSlaughter) return false;
  if (a.healthStatus === 'Matadero' || a.healthStatus === 'Descarte') return false;
  return headCount(a) > 0;
}

/** Camada activa = en lactancia (no destetada ni cerrada). */
export function isActiveLitter(l: LactatingLitter | null | undefined): boolean {
  return !!l && l.weaningStatus !== 'destetado';
}

export type SowReproductiveState = 'gestante' | 'lactante' | 'vacia';

/** Estado reproductivo de una cerda según healthStatus / stage. */
export function sowReproductiveState(sow: PorcinoAnimal): SowReproductiveState {
  const st = (sow.stage || '').toLowerCase();
  const hs = (sow.healthStatus || '').toLowerCase();
  if (hs.includes('lactante') || st.includes('lactancia') || st.includes('lactante')) return 'lactante';
  if (hs.includes('gestante') || st.includes('gestación') || st.includes('gestacion') || st.includes('gestante')) return 'gestante';
  return 'vacia';
}

/** Redondeo monetario a 2 decimales seguro ante NaN/undefined. */
export function round2(n: unknown): number {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

/** Número seguro (NaN/undefined -> 0). */
export function num(n: unknown): number {
  const v = Number(n);
  return isFinite(v) ? v : 0;
}
