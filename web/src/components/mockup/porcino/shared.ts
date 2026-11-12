/**
 * Utilidades compartidas por las pestañas del Menú Porcino.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type PorcinoTab = 'porcinos' | 'atajos' | 'sanitario' | 'balance' | 'alimentacion';

export const PORCINO_TABS: { id: PorcinoTab; label: string }[] = [
  { id: 'porcinos', label: 'Porcinos' },
  { id: 'atajos', label: 'Atajos' },
  { id: 'sanitario', label: 'Plan sanitario' },
  { id: 'balance', label: 'Balance' },
  { id: 'alimentacion', label: 'Alimentación' },
];

/** Muestra "—" cuando la métrica no tiene datos (0 / NaN / undefined). */
export function metric(value: number | null | undefined, suffix = '', decimals?: number): string {
  const v = Number(value);
  if (!isFinite(v) || v === 0) return '—';
  const shown = decimals !== undefined ? v.toFixed(decimals) : v.toLocaleString();
  return suffix ? `${shown}${suffix}` : shown;
}

/** Formato monetario seguro (sin NaN). */
export function money(value: number | null | undefined): string {
  const v = Number(value);
  return (isFinite(v) ? Math.round(v * 100) / 100 : 0).toLocaleString();
}

/**
 * Borrador local con persistencia diferida (debounce): evita escribir en Firestore
 * en cada pulsación de tecla de los modales de configuración. El borrador se
 * persiste tras `delay` ms sin cambios o inmediatamente con `flush()` (al cerrar).
 */
export function useDebouncedDraft<T>(source: T, persist: ((value: T) => void) | undefined, delay = 1200) {
  const [draft, setDraft] = useState<T | null>(null);
  const pending = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current !== null) {
      const v = pending.current;
      pending.current = null;
      persistRef.current?.(v);
    }
    setDraft(null);
  }, []);

  const update = useCallback(
    (value: T) => {
      setDraft(value);
      pending.current = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (pending.current !== null) {
          const v = pending.current;
          pending.current = null;
          persistRef.current?.(v);
        }
      }, delay);
    },
    [delay]
  );

  // Persistir lo pendiente al desmontar
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) persistRef.current?.(pending.current);
    },
    []
  );

  return { value: draft ?? source, update, flush };
}
