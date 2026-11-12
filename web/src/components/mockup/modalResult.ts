/**
 * ============================================================================
 * RESULTADO DE ACCIONES DE MODALES
 * ============================================================================
 * Los callbacks de confirmación de los modales pueden devolver:
 *  - void / undefined          -> se asume éxito (compatibilidad con handlers antiguos)
 *  - boolean                   -> true = éxito, false = error genérico
 *  - DomainResult ({ok, ...})  -> resultado de porcinoActions del controlador
 *  - Promise de cualquiera de los anteriores
 * El modal muestra la pantalla de éxito SOLO si el resultado es ok, y nunca se
 * cierra en el mismo callback: el usuario cierra desde la pantalla de éxito.
 */

export type ModalActionValue =
  | void
  | undefined
  | boolean
  | { ok: boolean; error?: string; message?: string; meta?: Record<string, any> };

export type ModalActionReturn = ModalActionValue | Promise<ModalActionValue>;

export interface NormalizedModalResult {
  ok: boolean;
  error?: string;
  message?: string;
  meta?: Record<string, any>;
}

function normalize(value: ModalActionValue): NormalizedModalResult {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value === 'boolean') {
    return value ? { ok: true } : { ok: false, error: 'No se pudo completar la operación.' };
  }
  if (typeof value === 'object' && 'ok' in value) {
    return value.ok
      ? { ok: true, message: value.message, meta: value.meta }
      : { ok: false, error: value.error || 'No se pudo completar la operación.' };
  }
  return { ok: true };
}

/** Ejecuta el callback del modal y normaliza su resultado (captura excepciones). */
export async function runModalAction(fn: () => ModalActionReturn): Promise<NormalizedModalResult> {
  try {
    const out = await fn();
    return normalize(out as ModalActionValue);
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error inesperado al guardar.' };
  }
}

/** Convierte un texto de input numérico en número finito (NaN -> fallback). */
export function toNumber(value: string | number | undefined | null, fallback = 0): number {
  if (value === '' || value === undefined || value === null) return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}
