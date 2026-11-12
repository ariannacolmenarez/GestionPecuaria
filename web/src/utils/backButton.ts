/**
 * Pila de manejadores del botón "Atrás" (hardware Android / Escape).
 * Cada hoja o modal abierto registra su cierre; el botón Atrás cierra
 * primero la capa superior antes de navegar entre pantallas.
 */
type BackHandler = () => void;

const stack: BackHandler[] = [];

/** Registra un manejador; devuelve la función para quitarlo. */
export function pushBackHandler(h: BackHandler): () => void {
  stack.push(h);
  return () => {
    const i = stack.lastIndexOf(h);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** ¿Es este el manejador de la capa superior? */
export function isTopBackHandler(h: BackHandler): boolean {
  return stack[stack.length - 1] === h;
}

/** Ejecuta el manejador superior. Devuelve false si no hay ninguno. */
export function runTopBackHandler(): boolean {
  const h = stack[stack.length - 1];
  if (!h) return false;
  h();
  return true;
}
