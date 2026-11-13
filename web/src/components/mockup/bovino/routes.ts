/**
 * ============================================================================
 * MÓDULO BOVINO · Rutas internas (puras, sin React)
 * ============================================================================
 * La ruta vive en usePhoneNavigation (App.tsx) para que el Atrás de la cabecera y
 * el botón físico de Android usen la misma lógica (popRoute).
 * Orden del Atrás: hoja abierta (pila pushBackHandler) → subpantalla → raíz del
 * Hato → Home de la granja (popRoute devuelve null).
 */
import type { BovinoCategoryKey } from '../../../models/bovinoModel';

export type BovinoSection = 'hato' | 'agenda' | 'campo' | 'repro' | 'mas';

export type AnimalEstadoFiltro = 'ordeno' | 'seca' | 'preñada' | 'vacia' | 'servida' | 'retiro' | 'tratamiento';

/** Filtro inicial de la lista de animales (desde contadores, lotes o potreros). */
export interface AnimalFiltro {
  category?: BovinoCategoryKey;
  lotId?: string;
  paddockId?: string;
  estado?: AnimalEstadoFiltro;
  sexo?: 'hembra' | 'macho';
  situacion?: 'activos' | 'vendidos' | 'muertos' | 'todos';
}

export type AlmacenSub = 'alimentos' | 'minerales' | 'farmacia' | 'otros';

export type BovinoScreen =
  | { s: 'root' }
  // ---- Etapa A ----
  | { s: 'animales'; filtro?: AnimalFiltro }
  | { s: 'animal'; id: string }
  | { s: 'lotes' }
  | { s: 'lote'; id: string }
  | { s: 'potreros' }
  | { s: 'potrero'; id: string }
  | { s: 'sanidad' }
  | { s: 'movimientosHato' }
  | { s: 'almacen'; sub?: AlmacenSub }
  | { s: 'insumo'; id: string }
  // ---- Etapa B (placeholders "Próximamente" en archivos propios, ver stageB.tsx) ----
  | { s: 'ceba'; loteId?: string; pesar?: boolean; racion?: boolean; animalIds?: string[] }
  | { s: 'leche'; ordenar?: boolean }
  | { s: 'lactancia'; vacaId: string }
  | { s: 'servicios'; animalId?: string }
  | { s: 'diagnosticos'; animalId?: string }
  | { s: 'partos'; animalId?: string; nuevo?: boolean }
  | { s: 'destetes' }
  | { s: 'secado' }
  | { s: 'calendarioRepro' }
  | { s: 'balance'; venta?: string[] }
  | { s: 'liquidacion'; loteId: string }
  | { s: 'reportes' }
  | { s: 'exportar' }
  | { s: 'config' }
  | { s: 'bitacora' }
  | { s: 'manga'; lotId?: string; agenda?: boolean };

export type BovinoScreenKey = BovinoScreen['s'];

export interface BovinoRoute {
  section: BovinoSection;
  /** stack[0] siempre es { s: 'root' }. */
  stack: BovinoScreen[];
}

/** Petición de navegación externa (Home de la granja, alertas, RubroPanels). */
export interface BovinoFocusRequest {
  nonce: number;
  section?: BovinoSection;
  screen?: BovinoScreen;
  /** Abre el formulario "Ingresar ganado". */
  nuevoAlta?: boolean;
  /** Abre la hoja "+ Actividad" en la Agenda. */
  nuevaActividad?: boolean;
  /** Abre el modo manga (Etapa B). */
  abrirManga?: boolean;
}

export const BOVINO_SECTIONS: BovinoSection[] = ['hato', 'agenda', 'campo', 'repro', 'mas'];

export const SECTION_TITLE: Record<BovinoSection, string> = {
  hato: 'Ganado Bovino',
  agenda: 'Agenda de hoy',
  campo: 'Operación de campo',
  repro: 'Reproducción',
  mas: 'Más opciones',
};

/** Ruta inicial de una sección. */
export function rootRoute(section: BovinoSection = 'hato'): BovinoRoute {
  return { section, stack: [{ s: 'root' }] };
}

/** Ruta con una pantalla encima de la raíz de la sección. */
export function routeTo(section: BovinoSection, screen?: BovinoScreen): BovinoRoute {
  return !screen || screen.s === 'root' ? rootRoute(section) : { section, stack: [{ s: 'root' }, screen] };
}

/** Apila una pantalla (si ya es la de arriba, la reemplaza para no duplicar). */
export function pushRoute(r: BovinoRoute, screen: BovinoScreen): BovinoRoute {
  if (screen.s === 'root') return rootRoute(r.section);
  const top = r.stack[r.stack.length - 1];
  if (top && top.s === screen.s && JSON.stringify(top) === JSON.stringify(screen)) return r;
  return { ...r, stack: [...r.stack, screen] };
}

/** Pantalla visible. */
export function topScreen(r: BovinoRoute): BovinoScreen {
  return r.stack[r.stack.length - 1] || { s: 'root' };
}

/** ¿Está en la raíz de una sección? (muestra la sub-cabecera del módulo). */
export function isSectionRoot(r: BovinoRoute): boolean {
  return r.stack.length <= 1;
}

/**
 * Atrás: subpantalla → raíz de la sección → Hato → null (salir al Home de la granja).
 * Pura: la usan la cabecera, el botón físico de Android y las pruebas.
 */
export function popRoute(r: BovinoRoute | null | undefined): BovinoRoute | null {
  if (!r) return null;
  if (r.stack.length > 1) return { ...r, stack: r.stack.slice(0, -1) };
  if (r.section !== 'hato') return rootRoute('hato');
  return null;
}

/** Datos mínimos para nombrar las pantallas con su lote / animal / potrero / insumo. */
export interface ScreenTitleLookup {
  lotName?: (id: string) => string | undefined;
  animalLabel?: (id: string) => string | undefined;
  paddockName?: (id: string) => string | undefined;
  itemName?: (id: string) => string | undefined;
}

/** Título de GranjaHeader según la ruta ("Ganado Bovino", "Lote Ceba 2", "Vaca #402"...). */
export function screenTitle(r: BovinoRoute | null | undefined, look: ScreenTitleLookup = {}): string {
  if (!r) return SECTION_TITLE.hato;
  const sc = topScreen(r);
  switch (sc.s) {
    case 'root':
      return SECTION_TITLE[r.section];
    case 'animales':
      return 'Animales';
    case 'animal':
      return look.animalLabel?.(sc.id) || 'Ficha del animal';
    case 'lotes':
      return 'Lotes';
    case 'lote':
      return look.lotName?.(sc.id) || 'Lote';
    case 'potreros':
      return 'Potreros';
    case 'potrero':
      return look.paddockName?.(sc.id) ? `Potrero ${look.paddockName(sc.id)}` : 'Potrero';
    case 'sanidad':
      return 'Sanidad';
    case 'movimientosHato':
      return 'Entradas y salidas';
    case 'almacen':
      return 'Almacén bovino';
    case 'insumo':
      return look.itemName?.(sc.id) || 'Insumo';
    case 'ceba':
      return 'Ceba';
    case 'leche':
      return 'Leche';
    case 'lactancia':
      return 'Curva de lactancia';
    case 'servicios':
      return 'Servicios';
    case 'diagnosticos':
      return 'Diagnósticos';
    case 'partos':
      return 'Partos y crías';
    case 'destetes':
      return 'Destetes';
    case 'secado':
      return 'Secado';
    case 'calendarioRepro':
      return 'Calendario reproductivo';
    case 'balance':
      return 'Balance bovino';
    case 'liquidacion':
      return 'Liquidación de lote';
    case 'reportes':
      return 'Reportes y KPIs';
    case 'exportar':
      return 'Exportar y respaldo';
    case 'config':
      return 'Configuración bovina';
    case 'bitacora':
      return 'Bitácora';
    case 'manga':
      return 'Modo manga';
    default:
      return SECTION_TITLE.hato;
  }
}
