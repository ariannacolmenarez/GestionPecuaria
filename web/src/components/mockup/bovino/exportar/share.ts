/**
 * Entrega de archivos y textos sin plugins nativos:
 *  1. Compartir (Web Share API con archivos) cuando el sistema lo permite (móvil / navegador).
 *  2. Descargar con un enlace <a download> (navegador de escritorio y Chrome Android).
 *  3. En la app nativa (WebView de Capacitor) sin Web Share: se abre el archivo en una
 *     pestaña nueva para imprimirlo/guardarlo, y el texto se copia al portapapeles.
 * WhatsApp: comparte el texto (Web Share) o abre wa.me con el resumen.
 */

export type DeliverResult = 'compartido' | 'descargado' | 'abierto' | 'cancelado' | 'error';

const isNative = () => {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
};

export async function deliverFile(blob: Blob, filename: string, title: string): Promise<DeliverResult> {
  const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title });
      return 'compartido';
    }
  } catch (e: any) {
    if (e && e.name === 'AbortError') return 'cancelado';
  }
  try {
    const url = URL.createObjectURL(blob);
    if (isNative()) {
      const w = window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return w ? 'abierto' : 'error';
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return 'descargado';
  } catch {
    return 'error';
  }
}

export async function shareText(text: string, title: string): Promise<'compartido' | 'whatsapp' | 'copiado' | 'cancelado'> {
  const nav = navigator as Navigator;
  if (nav.share) {
    try {
      await nav.share({ text, title });
      return 'compartido';
    } catch (e: any) {
      if (e && e.name === 'AbortError') return 'cancelado';
    }
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const w = window.open(url, '_blank');
  if (w) return 'whatsapp';
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* sin portapapeles */
  }
  return 'copiado';
}

/** Nombre de archivo seguro: "ganado-2026-11-13.csv". */
export function safeFileName(base: string, ext: string, today: string): string {
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${clean || 'reporte'}${clean.includes(today) ? '' : `-${today}`}.${ext}`;
}
