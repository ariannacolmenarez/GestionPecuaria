/**
 * Almacén, Balance y Actividades por rubro (Porcino / Avícola / Bovino).
 * Se abren preseleccionados en el rubro de la pantalla actual y con un selector para
 * cambiar de rubro (o "bloqueados" en un rubro cuando un módulo lo pide).
 * Cada rubro conecta sus propias acciones: el avícola descuenta stock y carga el gasto al lote.
 * Todos se cierran con el botón Atrás de Android (pila global de utils/backButton).
 */
import React, { Suspense, lazy, useId, useMemo, useState } from 'react';
import { Calculator, CalendarDays, Loader2, Package, ChevronRight } from 'lucide-react';
import { bovinoCan } from '../../models/bovinoModel';
import type { BovinoScreen, BovinoSection } from './bovino/routes';
import type { FarmController } from '../../controllers/FarmController';
import type { SanitaryTask } from '../../types';
import { isLotActive } from '../../models/avicolaDomain';
import { TabBalance } from './porcino/TabBalance';
import { TabSanitario } from './porcino/TabSanitario';
import { itemMatchesRubro, type WarehouseRubro } from '../../models/warehouseRubro';
import { ModalHeader, RUBRO_UI, btnClass, useBackClose } from '../common/ui';

const WarehouseModal = lazy(() => import('./WarehouseModal').then((m) => ({ default: m.WarehouseModal })));
const AddSanitaryActivityModal = lazy(() => import('./AddSanitaryActivityModal').then((m) => ({ default: m.AddSanitaryActivityModal })));
const SanitaryProcedureModal = lazy(() => import('./SanitaryProcedureModal').then((m) => ({ default: m.SanitaryProcedureModal })));

export type Rubro = WarehouseRubro;
export interface RubroPanel {
  rubro: Rubro;
  locked: boolean;
}

/** Abre el módulo bovino en una sección / pantalla (App.tsx › nav.goBovino). */
export type OpenBovino = (opts?: { section?: BovinoSection; screen?: BovinoScreen; nuevoAlta?: boolean; nuevaActividad?: boolean }) => void;

const RUBROS: Rubro[] = ['porcino', 'avicola', 'bovino'];

/** Indicador de carga mientras llega un módulo perezoso (en vez de pantalla en blanco). */
export const LoadingOverlay: React.FC = () => (
  <div role="status" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl px-5 py-4 flex items-center gap-3 text-base font-semibold text-slate-800 shadow-xl">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-700" aria-hidden="true" /> Cargando…
    </div>
  </div>
);

/** Selector de rubro (pestañas de 44 px con el color de cada rubro). */
export const RubroSwitcher: React.FC<{ value: Rubro; onChange: (r: Rubro) => void; dark?: boolean }> = ({ value, onChange, dark }) => (
  <div role="tablist" aria-label="Rubro" className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}>
    {RUBROS.map((key) => {
      const r = RUBRO_UI[key];
      const Icon = r.Icon;
      const on = value === key;
      return (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(key)}
          className={`min-h-11 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${
            dark ? 'focus-visible:ring-white' : 'focus-visible:ring-slate-900'
          } ${on ? r.solid : dark ? 'text-slate-100 hover:bg-slate-700' : 'text-slate-700 hover:bg-white'}`}
        >
          <Icon className="w-4 h-4" aria-hidden="true" /> {r.label}
        </button>
      );
    })}
  </div>
);

/** Contenedor común de los paneles (diálogo de pantalla casi completa). */
const PanelShell: React.FC<{ titleId: string; tall?: boolean; onBackdrop: () => void; children: React.ReactNode }> = ({ titleId, tall, onBackdrop, children }) => (
  <div
    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
    onClick={(e) => e.target === e.currentTarget && onBackdrop()}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`bg-slate-50 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 ${tall ? 'h-[90vh] max-h-[750px]' : 'max-h-[90vh]'}`}
    >
      {children}
    </div>
  </div>
);

export const RubroPanels: React.FC<{
  ctrl: FarmController;
  warehouse: RubroPanel | null;
  balance: RubroPanel | null;
  onWarehouseChange: (p: RubroPanel | null) => void;
  onBalanceChange: (p: RubroPanel | null) => void;
  /** Actividades (calendario sanitario) por rubro. */
  activities?: RubroPanel | null;
  onActivitiesChange?: (p: RubroPanel | null) => void;
  /** Avícola: abrir el lote en Control › Sanidad / el calendario del módulo. */
  onOpenAvicolaLot?: (loteId: string) => void;
  onOpenAvicolaCalendar?: () => void;
  /** Bovino: el almacén, el balance ceba vs leche y la agenda viven en el módulo. */
  onOpenBovino?: OpenBovino;
}> = ({ ctrl, warehouse, balance, onWarehouseChange, onBalanceChange, activities, onActivitiesChange, onOpenAvicolaLot, onOpenAvicolaCalendar, onOpenBovino }) => {
  const P = ctrl.porcinoActions;
  const A = ctrl.avicolaActions;
  const rubro = warehouse?.rubro;

  const purchases = useMemo(
    () => (rubro ? ctrl.movements.filter((m) => m.category === 'Compra de insumos' && (m.rubro || 'porcino') === rubro) : []),
    [ctrl.movements, rubro]
  );
  const activeLots = useMemo(() => ctrl.avicolaLots.filter((l) => isLotActive(l)).map((l) => ({ id: l.id, label: l.name })), [ctrl.avicolaLots]);

  return (
    <>
      {/* Bovino: su almacén vive en el módulo (submódulos, lotes y vencimientos). Se avisa antes de salir. */}
      {warehouse && rubro === 'bovino' && (
        <BovinoWarehouseCard panel={warehouse} onChange={onWarehouseChange} onOpenBovino={onOpenBovino} />
      )}

      {warehouse && rubro && rubro !== 'bovino' && (
        <Suspense fallback={<LoadingOverlay />}>
          <WarehouseModal
            key={rubro}
            rubro={rubro}
            items={ctrl.warehouseItems}
            animals={rubro === 'porcino' ? ctrl.animals : undefined}
            lotLocations={rubro === 'avicola' ? activeLots : undefined}
            onClose={() => onWarehouseChange(null)}
            headerExtra={
              warehouse.locked ? undefined : (
                <div className="px-3 py-2 bg-slate-900 shrink-0">
                  <RubroSwitcher dark value={rubro} onChange={(r) => onWarehouseChange({ rubro: r, locked: false })} />
                </div>
              )
            }
            onConsumeItem={(itemId, amount, target, targetId) =>
              rubro === 'avicola'
                ? A.consumeWarehouseForLot({ loteId: targetId || '', itemId, amount })
                : P.consumeWarehouseItem({
                    itemId,
                    amount,
                    targetAnimalId: rubro === 'porcino' ? targetId || undefined : undefined,
                    targetLabel: target || undefined,
                  })
            }
            onAddItem={(newItem, options) => {
              const { id: _id, rubro: _r, loteId, animalId, ...item } = newItem;
              const registerPurchase = !!options?.registerPurchase || !!item.expensedOnPurchase;
              if (rubro === 'avicola') return A.addWarehouseItem({ item, loteId: loteId || undefined, registerPurchase });
              return P.addWarehouseItem({ item: { ...item, rubro, animalId: rubro === 'porcino' ? animalId : undefined }, registerPurchase });
            }}
            onDeleteItem={(itemId) => P.deleteWarehouseItem({ itemId })}
            onPurchaseItem={(p) => P.purchaseWarehouseItem(p)}
            purchases={purchases}
            onAssignLocation={rubro === 'porcino' ? (p) => P.assignWarehouseItemLocation(p) : undefined}
          />
        </Suspense>
      )}

      {balance && <BalancePanel ctrl={ctrl} panel={balance} onChange={onBalanceChange} onOpenBovino={onOpenBovino} />}

      {activities && onActivitiesChange && (
        <ActivitiesPanel
          ctrl={ctrl}
          panel={activities}
          onChange={onActivitiesChange}
          onOpenAvicolaLot={onOpenAvicolaLot}
          onOpenAvicolaCalendar={onOpenAvicolaCalendar}
          onOpenBovino={onOpenBovino}
        />
      )}
    </>
  );
};

/** Almacén bovino desde fuera del módulo: tarjeta que explica y abre el almacén del módulo. */
const BovinoWarehouseCard: React.FC<{ panel: RubroPanel; onChange: (p: RubroPanel | null) => void; onOpenBovino?: OpenBovino }> = ({ panel, onChange, onOpenBovino }) => {
  const titleId = useId();
  const close = () => onChange(null);
  const { requestClose } = useBackClose(true, close);
  return (
    <PanelShell titleId={titleId} onBackdrop={requestClose}>
      <ModalHeader title="Almacén bovino" titleId={titleId} rubro="bovino" onClose={requestClose} />
      {!panel.locked && (
        <div className="px-3 py-2 bg-slate-900 shrink-0">
          <RubroSwitcher dark value="bovino" onChange={(r) => onChange({ rubro: r, locked: false })} />
        </div>
      )}
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-900">
          El almacén bovino está dentro del módulo Bovino: alimentos, minerales, farmacia y otros, con control de lotes y vencimientos.
        </p>
        {onOpenBovino && (
          <button
            type="button"
            onClick={() => {
              close();
              onOpenBovino({ section: 'mas', screen: { s: 'almacen' } });
            }}
            className={btnClass({ rubro: 'bovino', size: 'lg', block: true })}
          >
            <Package className="w-5 h-5" aria-hidden="true" /> Abrir almacén bovino <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </PanelShell>
  );
};

/** Balance de un rubro, por mes o por año. */
const BalancePanel: React.FC<{ ctrl: FarmController; panel: RubroPanel; onChange: (p: RubroPanel | null) => void; onOpenBovino?: OpenBovino }> = ({
  ctrl,
  panel,
  onChange,
  onOpenBovino,
}) => {
  const titleId = useId();
  const { requestClose } = useBackClose(true, () => onChange(null));
  const canSeeBovino = bovinoCan(ctrl.currentUser?.role, 'ver_costos');
  return (
    <PanelShell titleId={titleId} tall onBackdrop={requestClose}>
      <ModalHeader
        title={`Balance ${RUBRO_UI[panel.rubro].label}`}
        subtitle="Ingresos y gastos del rubro, por mes o por año"
        titleId={titleId}
        icon={<Calculator />}
        rubro={panel.rubro}
        onClose={requestClose}
      />
      {!panel.locked && (
        <div className="px-3 py-2 bg-slate-900 shrink-0">
          <RubroSwitcher dark value={panel.rubro} onChange={(r) => onChange({ rubro: r, locked: false })} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {panel.rubro === 'bovino' && onOpenBovino && canSeeBovino && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onOpenBovino({ section: 'mas', screen: { s: 'balance' } });
            }}
            className={btnClass({ rubro: 'bovino', size: 'lg', block: true })}
          >
            Ver balance ceba y leche <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
        {panel.rubro === 'bovino' && !canSeeBovino ? (
          <div role="status" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900">
            <p className="text-base font-black">Balance bovino no disponible</p>
            <p className="text-sm font-semibold mt-1">
              Tu rol ({ctrl.currentUser?.role || 'sin rol'}) registra el trabajo diario del hato, pero no ve costos ni balances. Pídeselo al administrador.
            </p>
          </div>
        ) : (
          <TabBalance key={panel.rubro} movements={ctrl.movements} today={ctrl.today} rubro={panel.rubro} />
        )}
      </div>
    </PanelShell>
  );
};

/** Actividades (calendario y listado sanitario) de un rubro, con pestañas por rubro. */
const ActivitiesPanel: React.FC<{
  ctrl: FarmController;
  panel: RubroPanel;
  onChange: (p: RubroPanel | null) => void;
  onOpenAvicolaLot?: (loteId: string) => void;
  onOpenAvicolaCalendar?: () => void;
  onOpenBovino?: OpenBovino;
}> = ({ ctrl, panel, onChange, onOpenAvicolaLot, onOpenAvicolaCalendar, onOpenBovino }) => {
  const titleId = useId();
  const P = ctrl.porcinoActions;
  const rubro = panel.rubro;
  const [addDate, setAddDate] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Atrás: si hay un formulario interno abierto y no registró su propio manejador, se cierra
  // ese primero; si no, el panel. (Si el formulario registra el suyo, queda encima en la pila.)
  useBackClose(true, () => {
    if (addDate !== null) setAddDate(null);
    else if (selectedTaskId) setSelectedTaskId(null);
    else onChange(null);
  });

  const tasks = useMemo(() => ctrl.tasks.filter((t) => (t.targetRubro || 'porcino') === rubro), [ctrl.tasks, rubro]);
  const selectedTask = useMemo(() => ctrl.tasks.find((t) => t.id === selectedTaskId) || null, [ctrl.tasks, selectedTaskId]);

  const onSelectTask = (t: SanitaryTask) => {
    // Las tareas avícolas se gestionan en su lote (Control › Sanidad)
    if (rubro === 'avicola') {
      if (t.loteId && onOpenAvicolaLot) onOpenAvicolaLot(t.loteId);
      else onOpenAvicolaCalendar?.();
      return;
    }
    // Las tareas bovinas se gestionan en la Agenda del módulo bovino
    if (rubro === 'bovino' && onOpenBovino) {
      onChange(null);
      onOpenBovino({ section: 'agenda' });
      return;
    }
    setSelectedTaskId(t.id);
  };

  const onAddActivity = (date: string) => {
    // Avícola: las actividades se programan dentro de cada lote (calendario del módulo)
    if (rubro === 'avicola') onOpenAvicolaCalendar?.();
    else if (rubro === 'bovino' && onOpenBovino) {
      onChange(null);
      onOpenBovino({ section: 'agenda', nuevaActividad: true });
    } else setAddDate(date);
  };

  return (
    <PanelShell titleId={titleId} tall onBackdrop={() => onChange(null)}>
      <ModalHeader
        title={`Actividades ${RUBRO_UI[rubro].label}`}
        subtitle="Vacunas, tratamientos y tareas del rubro"
        titleId={titleId}
        icon={<CalendarDays />}
        rubro={rubro}
        onClose={() => onChange(null)}
      />
      {!panel.locked && (
        <div className="px-3 py-2 bg-slate-900 shrink-0">
          <RubroSwitcher
            dark
            value={rubro}
            onChange={(r) => {
              setSelectedTaskId(null);
              setAddDate(null);
              onChange({ rubro: r, locked: false });
            }}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        <TabSanitario
          key={rubro}
          tasks={tasks}
          today={ctrl.today}
          addLabel={rubro === 'avicola' ? 'Programar en un lote' : rubro === 'bovino' ? 'Abrir agenda bovina' : undefined}
          onAddActivity={onAddActivity}
          onSelectTask={onSelectTask}
          onToggleTask={(t) => ctrl.handleToggleTaskStatus(t.id)}
        />
      </div>

      <Suspense fallback={<LoadingOverlay />}>
        {addDate !== null && (
          <AddSanitaryActivityModal
            animals={rubro === 'porcino' ? ctrl.animals : []}
            warehouseItems={ctrl.warehouseItems.filter((i) => itemMatchesRubro(i, rubro))}
            onClose={() => setAddDate(null)}
            onAddTask={(task) => {
              const res = P.addSanitaryTask({ task: { ...task, targetRubro: rubro } });
              if (res.ok) setAddDate(null);
              return res;
            }}
            defaultDate={addDate}
            initialDate={addDate}
          />
        )}
        {selectedTask && (
          <SanitaryProcedureModal
            task={selectedTask}
            warehouseItems={ctrl.warehouseItems.filter((i) => itemMatchesRubro(i, rubro))}
            onClose={() => setSelectedTaskId(null)}
            onComplete={(taskId, opts) => P.completeSanitaryTask({ taskId, ...(opts || {}) })}
          />
        )}
      </Suspense>
    </PanelShell>
  );
};

/** Insumos de un rubro (para el badge del botón Almacén). */
export const rubroItems = (items: FarmController['warehouseItems'], rubro: Rubro) => items.filter((i) => itemMatchesRubro(i, rubro));
