/** Sub-cabecera de las raíces de sección: fecha de hoy, tasa del día y campana de alertas. */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Bell, ChevronRight } from 'lucide-react';
import { useBovino } from './context';
import { pendingPurchaseGroups, type BovinoAgendaItem, type BovinoPendingPurchase } from '../../../models/bovinoCalc';
import { CostoCompraSheet } from './finanzas/CostoCompraSheet';
import { BottomSheet, FOCUS_B, fdw, num, StatusChip } from './ui';

/** Alertas del hato: lo urgente de la agenda (sin las tareas, que están en Agenda). */
export function useBovinoAlerts(): BovinoAgendaItem[] {
  const { agenda } = useBovino();
  return useMemo(() => agenda.filter((a) => a.kind !== 'tarea' && (a.priority === 'alta' || a.kind === 'stock_critico' || a.kind === 'vencimiento' || a.kind === 'parto')), [agenda]);
}

export const SubHeader: React.FC = () => {
  const { today, config, perms, navigate, index } = useBovino();
  const alerts = useBovinoAlerts();
  // Compras sin costo: solo el propietario las ve (y las resuelve)
  const pending = useMemo(() => (perms.administrar ? pendingPurchaseGroups(index) : []), [perms.administrar, index]);
  const total = alerts.length + pending.length;
  const [open, setOpen] = useState(false);
  const rateStale = config.exchangeRate > 0 && config.exchangeRateDate !== today;
  return (
    <div className="bg-white border-b border-slate-200 px-4 h-12 flex items-center gap-2 shrink-0">
      <span className="text-sm font-bold text-slate-900 capitalize">{fdw(today)}</span>
      <span className="flex-1" />
      {(perms.manejo || perms.verCostos) && config.localCurrency && config.exchangeRate > 0 && (
        <button
          type="button"
          onClick={() => navigate({ s: 'config' }, 'mas')}
          className={`text-xs font-bold px-2.5 h-8 rounded-full ${rateStale ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-800'} ${FOCUS_B}`}
          title={rateStale ? 'La tasa no es de hoy' : 'Tasa del día'}
        >
          Tasa {num(config.exchangeRate, 2)}
        </button>
      )}
      <button type="button" onClick={() => setOpen(true)} aria-label={`Alertas del hato: ${total}`} className={`relative w-12 h-12 -mr-2 rounded-full flex items-center justify-center text-slate-900 ${FOCUS_B}`}>
        <Bell className="w-6 h-6" />
        {total > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-slate-900 text-[12px] font-black flex items-center justify-center">{total}</span>
        )}
      </button>
      {open && <AlertasSheet items={alerts} pending={pending} onClose={() => setOpen(false)} />}
    </div>
  );
};

const AlertasSheet: React.FC<{ items: BovinoAgendaItem[]; pending: BovinoPendingPurchase[]; onClose: () => void }> = ({ items, pending, onClose }) => {
  const { navigate } = useBovino();
  const [cost, setCost] = useState<BovinoPendingPurchase | null>(null);
  if (cost) return <CostoCompraSheet group={cost} onClose={() => setCost(null)} />;
  const count = items.length + pending.length;
  const go = (a: BovinoAgendaItem) => {
    onClose();
    if (a.itemId) navigate({ s: 'insumo', id: a.itemId }, 'mas');
    else if (a.animalId) navigate({ s: 'animal', id: a.animalId });
    else if (a.lotId) navigate({ s: 'lote', id: a.lotId }, 'campo');
  };
  return (
    <BottomSheet title="Alertas del hato" subtitle={`${count} pendiente(s)`} icon={<AlertTriangle className="w-5 h-5" />} iconClass="bg-amber-100 text-amber-800" onClose={onClose}>
      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((g) => (
            <li key={g.key}>
              <button type="button" onClick={() => setCost(g)} className={`w-full min-h-16 p-3 rounded-2xl border-2 border-amber-300 bg-amber-50 flex items-center gap-3 text-left ${FOCUS_B}`}>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black text-slate-900">
                    Compra sin costo · {g.lotName || 'Sin lote'} · {g.heads} cab.
                  </span>
                  <span className="block text-xs font-semibold text-slate-800">Ingreso {fdw(g.entryDate)} · toca para cargar el costo</span>
                </span>
                <StatusChip tone="warn">Costo</StatusChip>
                <ChevronRight className="w-5 h-5 text-slate-700 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 ? (
        pending.length === 0 && <p className="text-sm text-slate-800 text-center py-6">Sin alertas por ahora.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => go(a)} className={`w-full min-h-16 p-3 rounded-2xl border-2 border-slate-200 bg-white flex items-center gap-3 text-left ${FOCUS_B}`}>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900">{a.title}</span>
                  <span className="block text-xs text-slate-700">{a.detail}</span>
                </span>
                {a.overdue ? <StatusChip tone="bad">Vencida</StatusChip> : a.priority === 'alta' ? <StatusChip tone="warn">Urgente</StatusChip> : null}
                <ChevronRight className="w-5 h-5 text-slate-700 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
};
