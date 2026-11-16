/**
 * Estado de pantalla que sobrevive al volver atrás (búsqueda, filtros, orden, "ver más", scroll).
 * BovinoModule remonta cada pantalla con key={screenKey}; aquí se guarda su estado por
 * screenKey en memoria del módulo. Al ENTRAR de nuevo a una pantalla (navigate / cambio de
 * sección) BovinoModule borra su estado; al VOLVER (Atrás) se conserva.
 * Solo estado de la interfaz: nada de dominio ni nada que se guarde en la nube.
 */
import { useEffect, useState } from 'react';
import { useBovino } from './context';
import { screenKeyOf } from './routes';

const store = new Map<string, unknown>();

export function readView<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function writeView(key: string, value: unknown): void {
  store.set(key, value);
}

/** Borra todo el estado guardado de una pantalla (al entrar de nuevo a ella). */
export function clearView(screenKey: string): void {
  const prefix = `${screenKey}|`;
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

/** Como useState, pero recuerda el valor por `key` (null = no recordar). */
export function useViewState<T>(key: string | null, init: T | (() => T)) {
  const [v, setV] = useState<T>(() => (key && store.has(key) ? (store.get(key) as T) : typeof init === 'function' ? (init as () => T)() : init));
  useEffect(() => {
    if (key) store.set(key, v);
  }, [key, v]);
  return [v, setV] as const;
}

/** Prefijo de estado de la pantalla visible ("<screenKey>|"). */
export function useScreenKey(): string {
  return `${screenKeyOf(useBovino().route)}|`;
}
