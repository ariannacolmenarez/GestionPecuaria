import React from 'react';
import { Binary, CheckSquare, FileBarChart, Package, Receipt, Users } from 'lucide-react';

export interface TabAtajosProps {
  criticalWarehouseCount: number;
  pendingTasksCount: number;
  activeLittersCount: number;
  onOpenWarehouse: () => void;
  onOpenSale: () => void;
  onGoToBalance: () => void;
  onGoToSanitary: () => void;
  onOpenCensus: () => void;
  onOpenWeaning: () => void;
  onOpenBatchConfig: () => void;
  onOpenAddSanitary: () => void;
}

const Shortcut: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}> = ({ icon, iconClass, title, subtitle, badge, onClick }) => (
  <button
    onClick={onClick}
    className="relative bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs transition-all cursor-pointer group"
  >
    {badge && (
      <span className="absolute top-2 right-2 text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
        {badge}
      </span>
    )}
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform ${iconClass}`}>
      {icon}
    </div>
    <h4 className="font-bold text-slate-900 text-xs">{title}</h4>
    <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
  </button>
);

export const TabAtajos: React.FC<TabAtajosProps> = ({
  criticalWarehouseCount,
  pendingTasksCount,
  activeLittersCount,
  onOpenWarehouse,
  onOpenSale,
  onGoToBalance,
  onGoToSanitary,
  onOpenCensus,
  onOpenWeaning,
  onOpenBatchConfig,
  onOpenAddSanitary,
}) => (
  <div className="space-y-4 animate-in fade-in duration-150">
    <div>
      <h3 className="text-sm font-black text-slate-800">Atajos de Gestión Operativa</h3>
      <p className="text-[11px] text-slate-500">Accesos rápidos a las operaciones más usadas</p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <Shortcut
        icon={<Package className="w-6 h-6" />}
        iconClass="bg-emerald-50 text-emerald-600"
        title="Almacén"
        subtitle="Alimentos, medicinas y alerta 2 meses"
        badge={criticalWarehouseCount > 0 ? `${criticalWarehouseCount} críticos` : undefined}
        onClick={onOpenWarehouse}
      />
      <Shortcut
        icon={<Receipt className="w-6 h-6" />}
        iconClass="bg-blue-50 text-blue-600"
        title="Compras"
        subtitle="Alta de insumos con egreso de compra"
        onClick={onOpenWarehouse}
      />
      <Shortcut
        icon={<Users className="w-6 h-6" />}
        iconClass="bg-purple-50 text-purple-600"
        title="Clientes / Ventas"
        subtitle="Venta en pie, en canal y liquidación"
        onClick={onOpenSale}
      />
      <Shortcut
        icon={<FileBarChart className="w-6 h-6" />}
        iconClass="bg-amber-50 text-amber-600"
        title="Reporte General"
        subtitle="Ingresos, egresos y rentabilidad"
        onClick={onGoToBalance}
      />
      <Shortcut
        icon={<CheckSquare className="w-6 h-6" />}
        iconClass="bg-teal-50 text-teal-600"
        title="Tareas"
        subtitle="Asignaciones operativas diarias"
        badge={pendingTasksCount > 0 ? `${pendingTasksCount}` : undefined}
        onClick={onGoToSanitary}
      />
      <Shortcut
        icon={<Binary className="w-6 h-6" />}
        iconClass="bg-rose-50 text-rose-600"
        title="Conteo"
        subtitle="Auditoría física vs inventario digital"
        onClick={onOpenCensus}
      />
    </div>

    <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200 flex items-center justify-between gap-2">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Herramienta Clave de Producción</span>
        <h4 className="font-bold text-slate-900 text-xs mt-0.5">Destete y Prorrateo de Costo de Lechones</h4>
        <p className="text-[11px] text-slate-600">
          {activeLittersCount > 0
            ? `Transfiere el costo de la cerda y la camada a los lechones destetados (${activeLittersCount} camadas activas).`
            : 'No hay camadas en lactancia. Registra un parto para habilitar el destete.'}
        </p>
      </div>
      <button
        onClick={onOpenWeaning}
        disabled={activeLittersCount === 0}
        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Abrir Prorrateo
      </button>
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      <button
        onClick={onOpenBatchConfig}
        className="bg-indigo-50/80 hover:bg-indigo-100/70 border border-indigo-200/80 p-3 rounded-2xl text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-indigo-600 text-white text-xs">⚙️</span>
          <strong className="text-xs font-bold text-indigo-950">Lotes & Protocolos</strong>
        </div>
        <p className="text-[10px] text-indigo-700 leading-tight">
          Configura tipos de producción y genera tareas automáticas al abrir lote.
        </p>
      </button>
      <button
        onClick={onOpenAddSanitary}
        className="bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200/80 p-3 rounded-2xl text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-blue-600 text-white text-xs">📅</span>
          <strong className="text-xs font-bold text-blue-950">+ Nueva Actividad</strong>
        </div>
        <p className="text-[10px] text-blue-700 leading-tight">
          Programa vacunas o tratamientos indicando lote, animal y fecha.
        </p>
      </button>
    </div>
  </div>
);
