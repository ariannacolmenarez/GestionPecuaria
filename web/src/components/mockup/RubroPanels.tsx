/**
 * Almacén y Balance por rubro (Porcino / Avícola / Bovino).
 * - Dentro de un módulo se abren "bloqueados" en su rubro (solo se ve ese rubro).
 * - Desde el Home de la granja muestran un selector para cambiar de rubro.
 * Cada rubro conecta sus propias acciones: el avícola descuenta stock y carga el gasto al lote.
 */
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Bird, Calculator, PiggyBank, Beef, X, CalendarDays, Package } from 'lucide-react';
import { bovinoCan } from '../../models/bovinoModel';
import type { BovinoScreen, BovinoSection } from './bovino/routes';
import type { FarmController } from '../../controllers/FarmController';
import type { SanitaryTask } from '../../types';
import { isLotActive } from '../../models/avicolaDomain';
import { TabBalance } from './porcino/TabBalance';
import { TabSanitario } from './porcino/TabSanitario';
import { itemMatchesRubro, type WarehouseRubro } from '../../models/warehouseRubro';

const WarehouseModal = lazy(() => import('./WarehouseModal').then((m) => ({ default: m.WarehouseModal })));
const AddSanitaryActivityModal = lazy(() =>
  import('./AddSanitaryActivityModal').then((m) => ({ default: m.AddSanitaryActivityModal }))
);
const SanitaryProcedureModal = lazy(() =>
  import('./SanitaryProcedureModal').then((m) => ({ default: m.SanitaryProcedureModal }))
);

export type Rubro = WarehouseRubro;
export interface RubroPanel {
  rubro: Rubro;
  locked: boolean;
}

/** Abre el módulo bovino en una sección / pantalla (App.tsx › nav.goBovino). */
export type OpenBovino = (opts?: { section?: BovinoSection; screen?: BovinoScreen; nuevoAlta?: boolean; nuevaActividad?: boolean }) => void;

const RUBROS: { key: Rubro; label: string; Icon: React.ElementType; active: string }[] = [
  { key: 'porcino', label: 'Porcino', Icon: PiggyBank, active: 'bg-rose-600 text-white' },
  { key: 'avicola', label: 'Avícola', Icon: Bird, active: 'bg-amber-400 text-slate-900' },
  { key: 'bovino', label: 'Bovino', Icon: Beef, active: 'bg-sky-600 text-white' },
];

/** Selector de rubro (solo desde el Home de la granja). */
export const RubroSwitcher: React.FC<{ value: Rubro; onChange: (r: Rubro) => void; dark?: boolean }> = ({ value, onChange, dark }) => (
  <div role="tablist" aria-label="Rubro" className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}>
    {RUBROS.map(({ key, label, Icon, active }) => (
      <button
        key={key}
        role="tab"
        aria-selected={value === key}
        onClick={() => onChange(key)}
        className={`min-h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
          value === key ? active : dark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-white'
        }`}
      >
        <Icon className="w-4 h-4" /> {label}
      </button>
    ))}
  </div>
);

export const RubroPanels: React.FC<{
  ctrl: FarmController;
  warehouse: RubroPanel | null;
  balance: RubroPanel | null;
  onWarehouseChange: (p: RubroPanel | null) => void;
  onBalanceChange: (p: RubroPanel | null) => void;
  /** Actividades (calendario sanitario) por rubro, abierto desde el Home de la granja. */
  activities?: RubroPanel | null;
  onActivitiesChange?: (p: RubroPanel | null) => void;
  /** Avícola: abrir el lote en Control › Sanidad / el calendario del módulo. */
  onOpenAvicolaLot?: (loteId: string) => void;
  onOpenAvicolaCalendar?: () => void;
  /** Bovino: el almacén, el balance ceba vs leche y la agenda viven en el módulo. */
  onOpenBovino?: OpenBovino;
}> = ({
  ctrl,
  warehouse,
  balance,
  onWarehouseChange,
  onBalanceChange,
  activities,
  onActivitiesChange,
  onOpenAvicolaLot,
  onOpenAvicolaCalendar,
  onOpenBovino,
}) => {
  const P = ctrl.porcinoActions;
  const A = ctrl.avicolaActions;
  const rubro = warehouse?.rubro;
  // Bovino: el almacén vive en el módulo (submódulos, lotes y vencimientos): elegir Bovino abre
  // directamente Más › Almacén, sin un diálogo intermedio.
  const goBovinoWarehouse = rubro === 'bovino' && !!onOpenBovino;
  useEffect(() => {
    if (!goBovinoWarehouse) return;
    onWarehouseChange(null);
    onOpenBovino?.({ section: 'mas', screen: { s: 'almacen' } });
  }, [goBovinoWarehouse]); // eslint-disable-line react-hooks/exhaustive-deps

  const purchases = useMemo(
    () => (rubro ? ctrl.movements.filter((m) => m.category === 'Compra de insumos' && (m.rubro || 'porcino') === rubro) : []),
    [ctrl.movements, rubro]
  );
  const activeLots = useMemo(
    () => ctrl.avicolaLots.filter((l) => isLotActive(l)).map((l) => ({ id: l.id, label: l.name })),
    [ctrl.avicolaLots]
  );

  return (
    <>
      {warehouse && rubro === 'bovino' && !onOpenBovino && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" aria-label="Almacén bovino" className="bg-slate-50 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900">
            <div className="bg-slate-900 text-white p-4 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-base leading-tight">Almacén</h3>
                </div>
                <button onClick={() => onWarehouseChange(null)} aria-label="Cerrar" className="w-12 h-12 rounded-lg text-white hover:bg-slate-800 flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {!warehouse.locked && <RubroSwitcher dark value={rubro} onChange={(r) => onWarehouseChange({ rubro: r, locked: false })} />}
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-900">
                El almacén bovino tiene submódulos (Alimentos, Minerales, Farmacia, Otros) y control de lotes y vencimientos.
              </p>
              <button
                onClick={() => {
                  onWarehouseChange(null);
                  onOpenBovino?.({ section: 'mas', screen: { s: 'almacen' } });
                }}
                className="w-full h-12 rounded-2xl bg-sky-600 text-white font-bold cursor-pointer"
              >
                Abrir almacén bovino
              </button>
            </div>
          </div>
        </div>
      )}

      {warehouse && rubro && rubro !== 'bovino' && (
        <Suspense fallback={null}>
          <WarehouseModal
            key={rubro}
            rubro={rubro}
            items={ctrl.warehouseItems}
            animals={rubro === 'porcino' ? ctrl.animals : undefined}
            lotLocations={rubro === 'avicola' ? activeLots : undefined}
            onClose={() => onWarehouseChange(null)}
            headerExtra={
              warehouse.locked ? undefined : (
                <div className="px-3 pt-3 bg-white shrink-0">
                  <RubroSwitcher value={rubro} onChange={(r) => onWarehouseChange({ rubro: r, locked: false })} />
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

      {balance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" aria-label="Balance" className="bg-slate-50 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[750px] text-slate-900">
            <div className="bg-slate-900 text-white p-4 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">Balance {RUBROS.find((r) => r.key === balance.rubro)?.label}</h3>
                    <p className="text-[11px] text-slate-400">Ingresos y egresos del rubro, por mes o por año</p>
                  </div>
                </div>
                <button onClick={() => onBalanceChange(null)} aria-label="Cerrar" className="w-10 h-10 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {!balance.locked && <RubroSwitcher dark value={balance.rubro} onChange={(r) => onBalanceChange({ rubro: r, locked: false })} />}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {balance.rubro === 'bovino' && onOpenBovino && bovinoCan(ctrl.currentUser?.role, 'ver_costos') && (
                <button
                  onClick={() => {
                    onBalanceChange(null);
                    onOpenBovino({ section: 'mas', screen: { s: 'balance' } });
                  }}
                  className="w-full h-12 rounded-2xl bg-sky-600 text-white font-bold cursor-pointer"
                >
                  Ver balance ceba vs leche
                </button>
              )}
              {balance.rubro === 'bovino' && !bovinoCan(ctrl.currentUser?.role, 'ver_costos') ? (
                <div role="status" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900">
                  <p className="text-base font-black">Balance bovino no disponible</p>
                  <p className="text-sm font-semibold mt-1">Tu rol ({ctrl.currentUser?.role || 'sin rol'}) registra la carga diaria del hato, pero no ve costos ni balances. Pídeselo al administrador.</p>
                </div>
              ) : (
                <TabBalance key={balance.rubro} movements={ctrl.movements} today={ctrl.today} rubro={balance.rubro} />
              )}
            </div>
          </div>
        </div>
      )}

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

/** Actividades (calendario y listado sanitario) de un rubro, con pestañas por rubro. */
const ActivitiesPanel: React.FC<{
  ctrl: FarmController;
  panel: RubroPanel;
  onChange: (p: RubroPanel | null) => void;
  onOpenAvicolaLot?: (loteId: string) => void;
  onOpenAvicolaCalendar?: () => void;
  onOpenBovino?: OpenBovino;
}> = ({ ctrl, panel, onChange, onOpenAvicolaLot, onOpenAvicolaCalendar, onOpenBovino }) => {
  const P = ctrl.porcinoActions;
  const rubro = panel.rubro;
  const [addDate, setAddDate] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasks = useMemo(() => ctrl.tasks.filter((t) => (t.targetRubro || 'porcino') === rubro), [ctrl.tasks, rubro]);
  const selectedTask = useMemo(() => ctrl.tasks.find((t) => t.id === selectedTaskId) || null, [ctrl.tasks, selectedTaskId]);
  const label = RUBROS.find((r) => r.key === rubro)?.label;

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div role="dialog" aria-modal="true" aria-label="Actividades" className="bg-slate-50 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[750px] text-slate-900">
        <div className="bg-slate-900 text-white p-4 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">Actividades {label}</h3>
                <p className="text-[11px] text-slate-400">Calendario sanitario y tareas del rubro</p>
              </div>
            </div>
            <button onClick={() => onChange(null)} aria-label="Cerrar" className="w-10 h-10 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
          {!panel.locked && (
            <RubroSwitcher
              dark
              value={rubro}
              onChange={(r) => {
                setSelectedTaskId(null);
                setAddDate(null);
                onChange({ rubro: r, locked: false });
              }}
            />
          )}
        </div>
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
      </div>

      <Suspense fallback={null}>
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
    </div>
  );
};

/** Insumos críticos de un rubro (para el badge del botón Almacén). */
export const rubroItems = (items: FarmController['warehouseItems'], rubro: Rubro) => items.filter((i) => itemMatchesRubro(i, rubro));
