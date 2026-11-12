/**
 * Almacén y Balance por rubro (Porcino / Avícola / Bovino).
 * - Dentro de un módulo se abren "bloqueados" en su rubro (solo se ve ese rubro).
 * - Desde el Home de la granja muestran un selector para cambiar de rubro.
 * Cada rubro conecta sus propias acciones: el avícola descuenta stock y carga el gasto al lote.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { Bird, Calculator, PiggyBank, Beef, X } from 'lucide-react';
import type { FarmController } from '../../controllers/FarmController';
import { isLotActive } from '../../models/avicolaDomain';
import { TabBalance } from './porcino/TabBalance';
import { itemMatchesRubro, type WarehouseRubro } from '../../models/warehouseRubro';

const WarehouseModal = lazy(() => import('./WarehouseModal').then((m) => ({ default: m.WarehouseModal })));

export type Rubro = WarehouseRubro;
export interface RubroPanel {
  rubro: Rubro;
  locked: boolean;
}

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
}> = ({ ctrl, warehouse, balance, onWarehouseChange, onBalanceChange }) => {
  const P = ctrl.porcinoActions;
  const A = ctrl.avicolaActions;
  const rubro = warehouse?.rubro;

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
      {warehouse && rubro && (
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
            <div className="flex-1 overflow-y-auto p-3">
              <TabBalance key={balance.rubro} movements={ctrl.movements} today={ctrl.today} rubro={balance.rubro} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** Insumos críticos de un rubro (para el badge del botón Almacén). */
export const rubroItems = (items: FarmController['warehouseItems'], rubro: Rubro) => items.filter((i) => itemMatchesRubro(i, rubro));
