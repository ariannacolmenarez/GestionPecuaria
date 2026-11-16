import React from 'react';
import {
  Baby,
  Binary,
  CalendarPlus,
  ChevronRight,
  ClipboardCheck,
  HeartPulse,
  Package,
  Settings2,
  Skull,
  Truck,
} from 'lucide-react';

export interface TabAtajosProps {
  criticalWarehouseCount: number;
  pendingTasksCount: number;
  activeLittersCount: number;
  /** Cerdas preñadas (sin ellas no se puede registrar un parto). */
  gestatingCount: number;
  /** Animales activos (sin ellos no hay nada que vender). */
  activeAnimalsCount: number;
  onOpenMating: () => void;
  onOpenFarrowing: () => void;
  onOpenWeaning: () => void;
  onOpenMortality: () => void;
  onOpenSale: () => void;
  onGoToSanitary: () => void;
  onOpenWarehouse: () => void;
  onOpenCensus: () => void;
  onOpenBatchConfig: () => void;
  onOpenAddSanitary: () => void;
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2';

/** Tarjeta grande de tarea diaria. Si está desactivada dice por qué con texto visible. */
const TaskCard: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  status: string;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon, iconClass, title, status, badge, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative min-h-28 bg-white border-2 border-slate-200 hover:border-slate-300 active:bg-slate-50 p-3 rounded-2xl flex flex-col items-start gap-2 text-left transition-colors disabled:bg-slate-50 disabled:cursor-not-allowed ${FOCUS}`}
  >
    {!!badge && badge > 0 && (
      <span className="absolute top-2.5 right-2.5 min-w-7 h-7 px-2 rounded-full bg-rose-600 text-white text-sm font-bold flex items-center justify-center">
        {badge}
        <span className="sr-only"> pendientes</span>
      </span>
    )}
    <span
      aria-hidden="true"
      className={`w-11 h-11 rounded-xl flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6 ${disabled ? 'bg-slate-200 text-slate-600' : iconClass}`}
    >
      {icon}
    </span>
    <span className={`text-base font-bold leading-tight ${disabled ? 'text-slate-600' : 'text-slate-900'}`}>{title}</span>
    <span className="text-xs text-slate-600 leading-snug">{status}</span>
  </button>
);

/** Fila de opción secundaria (lista simple, ancho completo). */
const RowLink: React.FC<{ icon: React.ReactNode; title: string; hint?: string; badge?: string; onClick: () => void }> = ({
  icon,
  title,
  hint,
  badge,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full min-h-14 px-3 py-2 flex items-center gap-3 text-left hover:bg-slate-50 active:bg-slate-100 ${FOCUS}`}
  >
    <span aria-hidden="true" className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5">
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-bold text-slate-900">{title}</span>
      {hint && <span className="block text-xs text-slate-600">{hint}</span>}
    </span>
    {badge && <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-1 rounded-lg shrink-0">{badge}</span>}
    <ChevronRight aria-hidden="true" className="w-5 h-5 text-slate-600 shrink-0" />
  </button>
);

export const TabAtajos: React.FC<TabAtajosProps> = ({
  criticalWarehouseCount,
  pendingTasksCount,
  activeLittersCount,
  gestatingCount,
  activeAnimalsCount,
  onOpenMating,
  onOpenFarrowing,
  onOpenWeaning,
  onOpenMortality,
  onOpenSale,
  onGoToSanitary,
  onOpenWarehouse,
  onOpenCensus,
  onOpenBatchConfig,
  onOpenAddSanitary,
}) => (
  <div className="space-y-5 animate-in fade-in duration-150">
    <section aria-labelledby="atajos-hoy" className="space-y-2.5">
      <h3 id="atajos-hoy" className="text-base font-bold text-slate-900">
        ¿Qué vas a registrar?
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <TaskCard
          icon={<ClipboardCheck />}
          iconClass="bg-teal-100 text-teal-800"
          title="Tareas de hoy"
          status={pendingTasksCount > 0 ? `${pendingTasksCount} por hacer (hoy y atrasadas)` : 'Todo al día'}
          badge={pendingTasksCount}
          onClick={onGoToSanitary}
        />
        <TaskCard
          icon={<HeartPulse />}
          iconClass="bg-blue-100 text-blue-800"
          title="Monta"
          status="Cerda servida por un verraco"
          onClick={onOpenMating}
        />
        <TaskCard
          icon={<Baby />}
          iconClass="bg-rose-100 text-rose-800"
          title="Parto"
          status={gestatingCount > 0 ? `${gestatingCount} cerdas preñadas` : 'No hay cerdas preñadas: registra primero una monta'}
          disabled={gestatingCount === 0}
          onClick={onOpenFarrowing}
        />
        <TaskCard
          icon={<Baby />}
          iconClass="bg-amber-100 text-amber-900"
          title="Destete"
          status={activeLittersCount > 0 ? `${activeLittersCount} camadas criando` : 'No hay camadas criando: registra primero un parto'}
          disabled={activeLittersCount === 0}
          onClick={onOpenWeaning}
        />
        <TaskCard
          icon={<Skull />}
          iconClass="bg-slate-200 text-slate-800"
          title="Muerte de lechones"
          status={activeLittersCount > 0 ? 'Lechones muertos en una camada' : 'No hay camadas criando'}
          disabled={activeLittersCount === 0}
          onClick={onOpenMortality}
        />
        <TaskCard
          icon={<Truck />}
          iconClass="bg-emerald-100 text-emerald-800"
          title="Venta"
          status={activeAnimalsCount > 0 ? 'En pie o a matadero' : 'No hay animales para vender'}
          disabled={activeAnimalsCount === 0}
          onClick={onOpenSale}
        />
      </div>
    </section>

    <section aria-labelledby="atajos-mas" className="space-y-2">
      <h3 id="atajos-mas" className="text-sm font-bold text-slate-700">
        Más opciones
      </h3>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
        <RowLink
          icon={<Package />}
          title="Almacén y compras"
          hint="Alimento y medicinas"
          badge={criticalWarehouseCount > 0 ? `${criticalWarehouseCount} por acabarse` : undefined}
          onClick={onOpenWarehouse}
        />
        <RowLink icon={<CalendarPlus />} title="Programar vacuna o tratamiento" onClick={onOpenAddSanitary} />
        <RowLink icon={<Binary />} title="Conteo de animales" hint="Cuántos hay por grupo y por corral" onClick={onOpenCensus} />
        <RowLink icon={<Settings2 />} title="Lotes y planes sanitarios" hint="Se configura una vez por lote" onClick={onOpenBatchConfig} />
      </div>
    </section>
  </div>
);
