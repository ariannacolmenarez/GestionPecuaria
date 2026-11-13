/**
 * ============================================================================
 * PUNTOS DE ENCHUFE DE LA ETAPA B (carga diferida)
 * ============================================================================
 * Cada pantalla de la Etapa B vive en su propio archivo con `export default`
 * (implementadas: ceba, leche, reproducción, manga, reportes, balance, liquidación,
 * exportar, configuración y bitácora). Todas reciben StageBProps y leen datos/acciones
 * con useBovino(); comparten el kit de la Etapa B (kit.tsx: gráficos SVG, periodos, KPIs
 * y useStepRunner para varias acciones del dominio con confirmación de topes).
 *
 *   ruta (BovinoScreen.s)   archivo                               sección
 *   'repro' (raíz)          repro/ReproHub.tsx                    Repro
 *   'ceba'                  ceba/CebaHub.tsx                      Campo › Ceba
 *   'leche'                 leche/LecheHub.tsx                    Campo › Leche
 *   'lactancia'             leche/CurvaLactancia.tsx              Ficha / Leche
 *   'servicios'             repro/ServiciosScreen.tsx             Repro
 *   'diagnosticos'          repro/DiagnosticosScreen.tsx          Repro
 *   'partos'                repro/PartosScreen.tsx                Repro
 *   'destetes'              repro/DestetesScreen.tsx              Repro
 *   'secado'                repro/SecadoList.tsx                  Repro
 *   'calendarioRepro'       repro/CalendarioRepro.tsx             Repro
 *   'manga'                 manga/ModoManga.tsx                   Hato / Agenda
 *   'reportes'              reportes/ReportesKpi.tsx              Más
 *   'balance'               finanzas/BalanceBovino.tsx            Más (solo Admin)
 *   'liquidacion'           finanzas/LiquidacionLote.tsx          Lote › Liquidar (Admin)
 *   'exportar'              exportar/ExportarScreen.tsx           Más
 *   'config'                config/ConfigBovina.tsx               Más
 *   'bitacora'              config/Bitacora.tsx                   Más (solo Admin)
 */
import React, { Suspense, lazy } from 'react';
import type { BovinoScreen } from './routes';

export interface StageBProps {
  /** Pantalla actual con sus parámetros (loteId, vacaId...). */
  screen: BovinoScreen;
}

export type StageBKey =
  | 'reproRoot'
  | 'ceba'
  | 'leche'
  | 'lactancia'
  | 'servicios'
  | 'diagnosticos'
  | 'partos'
  | 'destetes'
  | 'secado'
  | 'calendarioRepro'
  | 'manga'
  | 'reportes'
  | 'balance'
  | 'liquidacion'
  | 'exportar'
  | 'config'
  | 'bitacora';

type Lazy = React.LazyExoticComponent<React.ComponentType<StageBProps>>;

export const STAGE_B: Record<StageBKey, Lazy> = {
  reproRoot: lazy(() => import('./repro/ReproHub')),
  ceba: lazy(() => import('./ceba/CebaHub')),
  leche: lazy(() => import('./leche/LecheHub')),
  lactancia: lazy(() => import('./leche/CurvaLactancia')),
  servicios: lazy(() => import('./repro/ServiciosScreen')),
  diagnosticos: lazy(() => import('./repro/DiagnosticosScreen')),
  partos: lazy(() => import('./repro/PartosScreen')),
  destetes: lazy(() => import('./repro/DestetesScreen')),
  secado: lazy(() => import('./repro/SecadoList')),
  calendarioRepro: lazy(() => import('./repro/CalendarioRepro')),
  manga: lazy(() => import('./manga/ModoManga')),
  reportes: lazy(() => import('./reportes/ReportesKpi')),
  balance: lazy(() => import('./finanzas/BalanceBovino')),
  liquidacion: lazy(() => import('./finanzas/LiquidacionLote')),
  exportar: lazy(() => import('./exportar/ExportarScreen')),
  config: lazy(() => import('./config/ConfigBovina')),
  bitacora: lazy(() => import('./config/Bitacora')),
};

/** Clave de Etapa B de una pantalla (null = pantalla de la Etapa A). */
export function stageBKeyOf(screen: BovinoScreen, isReproRoot: boolean): StageBKey | null {
  if (screen.s === 'root') return isReproRoot ? 'reproRoot' : null;
  return (screen.s in STAGE_B ? screen.s : null) as StageBKey | null;
}

const Loading: React.FC = () => <div className="p-6 text-center text-sm font-semibold text-slate-700">Cargando…</div>;

export const StageBScreen: React.FC<{ k: StageBKey; screen: BovinoScreen }> = ({ k, screen }) => {
  const C = STAGE_B[k];
  return (
    <Suspense fallback={<Loading />}>
      <C screen={screen} />
    </Suspense>
  );
};
