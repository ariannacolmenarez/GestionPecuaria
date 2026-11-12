/**
 * ============================================================================
 * GENERADOR DE IDENTIFICADORES ÚNICOS
 * ============================================================================
 * Reemplaza Date.now() / Math.random() por crypto.randomUUID() (con fallback
 * RFC4122 v4 basado en crypto.getRandomValues para WebViews antiguos).
 */

function uuidV4(): string {
  const c: Crypto | undefined = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Devuelve un id único con prefijo legible, ej. newId('lit') -> 'lit-3f2a...'. */
export function newId(prefix?: string): string {
  const id = uuidV4();
  return prefix ? `${prefix}-${id}` : id;
}
