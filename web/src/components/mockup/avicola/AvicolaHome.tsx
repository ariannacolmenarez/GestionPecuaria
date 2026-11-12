/**
 * Home avícola "Pollos de Engorde": balance general, campana de alertas,
 * calendario, Mis Lotes (activos y finalizados) y FAB "Nuevo lote".
 */
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Bird, CalendarDays, ChevronDown, ChevronRight, Flag, MoreVertical, Pencil, Syringe, Trash2, Undo2 } from 'lucide-react';
import type { AvicolaLotCard } from '../../../models/avicolaDomain';
import { useAvicola } from './context';
import { BalanceCard, ConfirmDialog, EmptyState, FabButton, FOCUS, STAGE_STYLES, StageProgressBar, shortDate, usd, plural } from './shared';
import { EditLoteDialog } from './LoteForms';
import { PlanTemplateSheet } from './PlanTemplate';
import { pushBackHandler } from '../../../utils/backButton';

const Bullet: React.FC<{ cls: string; dot: string; children: React.ReactNode }> = ({ cls, dot, children }) => (
  <li className={`flex items-center gap-1.5 ${cls}`}>
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
    <span className="truncate">{children}</span>
  </li>
);

type MenuAction = 'edit' | 'finalize' | 'reactivate' | 'delete';

const LoteCard: React.FC<{ card: AvicolaLotCard; onOpen: () => void; onAction: (a: MenuAction) => void }> = ({ card, onOpen, onAction }) => {
  const { lot, stage, birds, financials } = card;
  const finished = lot.status === 'finalizado' || lot.status === 'Liquidado';
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    // Botón Atrás de Android: cierra el menú ⋮ antes de salir del Home avícola.
    const unregisterBack = pushBackHandler(() => setMenu(false));
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      window.removeEventListener('keydown', esc);
      unregisterBack();
    };
  }, [menu]);
  const st = STAGE_STYLES[stage.stage];
  const showReady = !finished && stage.readyToSell && birds.available > 0;
  const overdue = card.alerts;

  return (
    <div ref={ref} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
        className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden text-left active:scale-[0.99] transition cursor-pointer ${FOCUS}`}
      >
        <div className={`h-24 relative flex items-center justify-center ${finished ? 'bg-slate-100' : 'bg-amber-50'}`}>
          <Bird className={`w-14 h-14 ${finished ? 'text-slate-300' : 'text-amber-300'}`} />
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${finished ? 'bg-slate-200 text-slate-700' : st.chip}`}>
            {finished ? 'Finalizado' : stage.notStarted ? 'Por iniciar' : stage.stage}
          </span>
          {showReady && (
            <span className="absolute bottom-2 left-2 bg-amber-400 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-900" /> Para vender
            </span>
          )}
        </div>
        <div className="p-3 space-y-2">
          <p className="text-sm font-bold text-slate-900 truncate">{lot.name}</p>
          {!finished && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-x-1">
                <p className="tabular-nums whitespace-nowrap">
                  <span className="text-xl font-black text-slate-900">{stage.notStarted ? 'Día —' : `Día ${stage.day}`}</span>
                  <span className="text-sm text-slate-400"> / {stage.productionDays}</span>
                </p>
                <span className={`text-[11px] font-bold whitespace-nowrap ${stage.readyToSell ? 'text-amber-700' : 'text-slate-500'}`}>
                  {stage.notStarted ? `en ${1 - stage.day} d` : stage.readyToSell ? 'listo' : `faltan ${stage.daysToSlaughter} d`}
                </span>
              </div>
              <StageProgressBar day={stage.day} totalDays={stage.productionDays} ranges={stage.ranges} />
            </>
          )}
          <ul className="text-[11px] space-y-0.5">
            {finished ? (
              <>
                <Bullet cls="text-slate-600" dot="bg-slate-400">Vendidos {num0(birds.sold)}</Bullet>
                <Bullet cls={financials.isProfit ? 'text-emerald-700' : 'text-rose-700'} dot={financials.isProfit ? 'bg-emerald-500' : 'bg-rose-500'}>
                  Balance {financials.balance >= 0 ? '+' : ''}
                  {usd(financials.balance)}
                </Bullet>
                {lot.finalizedAt && <Bullet cls="text-slate-500" dot="bg-slate-400">Finalizado el {shortDate(lot.finalizedAt)}</Bullet>}
              </>
            ) : (
              <>
                <Bullet cls="text-amber-700" dot="bg-amber-500">{card.toSellLabel}</Bullet>
                <Bullet cls={birds.deaths ? 'text-rose-700' : 'text-slate-500'} dot={birds.deaths ? 'bg-rose-500' : 'bg-slate-400'}>
                  {card.deathsLabel}
                </Bullet>
                <Bullet cls={stage.slaughterPassed || stage.daysToSlaughter === 0 ? 'text-amber-700' : 'text-slate-500'} dot={stage.slaughterPassed ? 'bg-amber-500' : 'bg-slate-400'}>
                  {card.slaughterLabel}
                </Bullet>
                {overdue > 0 && (
                  <li className="flex items-center gap-1 text-rose-700 font-semibold">
                    <AlertTriangle className="w-3 h-3" /> {plural(overdue, 'tarea por hacer', 'tareas por hacer')}
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      </div>
      <button
        aria-label="Opciones del lote"
        aria-expanded={menu}
        onClick={(e) => {
          e.stopPropagation();
          setMenu((m) => !m);
        }}
        className={`absolute top-1 right-1 w-10 h-10 rounded-full bg-white/90 text-slate-700 flex items-center justify-center ${FOCUS}`}
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      {menu && (
        <div role="menu" className="absolute right-0 top-11 z-20 w-40 max-w-full bg-white rounded-xl shadow-lg border border-slate-200 py-1">
          {(
            [
              ['edit', 'Editar', <Pencil key="i" className="w-4 h-4" />, 'text-slate-800'],
              finished ? ['reactivate', 'Reactivar', <Undo2 key="i" className="w-4 h-4" />, 'text-slate-800'] : ['finalize', 'Finalizar lote', <Flag key="i" className="w-4 h-4" />, 'text-slate-800'],
              ['delete', 'Eliminar', <Trash2 key="i" className="w-4 h-4" />, 'text-rose-600'],
            ] as [MenuAction, string, React.ReactNode, string][]
          ).map(([a, label, icon, cls]) => (
            <button
              key={a}
              role="menuitem"
              onClick={() => {
                setMenu(false);
                onAction(a);
              }}
              className={`w-full h-11 px-3 text-sm flex items-center gap-2 hover:bg-slate-50 ${cls} ${FOCUS}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const num0 = (n: number) => n.toLocaleString('es-ES');

export const AvicolaHome: React.FC<{ onNewLot: () => void; openCalendarRequest?: number; onCalendarRequestHandled?: () => void }> = ({
  onNewLot,
  openCalendarRequest = 0,
  onCalendarRequestHandled,
}) => {
  const { home, actions, openLot, planTemplate } = useAvicola();
  const [showFinished, setShowFinished] = useState(false);
  const [editing, setEditing] = useState<AvicolaLotCard | null>(null);
  const [confirm, setConfirm] = useState<{ action: 'finalize' | 'delete'; card: AvicolaLotCard } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'alerts' | 'calendar' | 'plan' | null>(null);
  // Desde el centro de alertas global: abrir directamente el calendario de lotes
  useEffect(() => {
    if (openCalendarRequest > 0) {
      setSheet('calendar');
      // Se consume una sola vez: al volver de un lote no debe reabrirse solo
      onCalendarRequestHandled?.();
    }
  }, [openCalendarRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = (card: AvicolaLotCard, a: MenuAction) => {
    if (a === 'edit') return setEditing(card);
    if (a === 'reactivate') {
      const r = actions.reactivateLot({ loteId: card.lot.id });
      if (!r.ok) actions.notify(r.error);
      return;
    }
    setConfirmError(null);
    setConfirm({ action: a, card });
  };

  const runConfirm = () => {
    if (!confirm) return;
    const r = confirm.action === 'finalize' ? actions.finalizeLot({ loteId: confirm.card.lot.id }) : actions.deleteLot({ loteId: confirm.card.lot.id });
    if (!r.ok) return setConfirmError(r.error);
    setConfirm(null);
  };

  const hasLots = home.activeCount + home.finishedCount > 0;
  const cardHasRecords = (c: AvicolaLotCard) => c.financials.salesCount + c.financials.expensesCount > 0 || c.birds.deaths > 0 || c.financials.incomesTotal > 0;

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-slate-100">
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="bg-gradient-to-b from-amber-100 to-slate-100 px-4 pt-3 pb-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center">
              <Bird className="w-5 h-5" />
            </span>
            {/* El título "Pollos de Engorde" ya está en la cabecera de la granja: aquí solo el subtítulo */}
            <p className="text-sm font-bold text-slate-800 flex-1">
              {home.activeCount === 0
                ? 'Sin lotes activos'
                : `${num0(home.birdsInShed)} ${home.birdsInShed === 1 ? 'pollo' : 'pollos'} en galpón · ${home.todayTasks.length} ${home.todayTasks.length === 1 ? 'tarea' : 'tareas'} hoy`}
            </p>
            <button aria-label="Calendario sanitario" onClick={() => setSheet('calendar')} className={`w-10 h-10 rounded-xl bg-white/80 border border-amber-200 text-slate-700 flex items-center justify-center ${FOCUS}`}>
              <CalendarDays className="w-5 h-5" />
            </button>
            <button
              aria-label={`Alertas avícolas${home.alertsCount ? `: ${home.alertsCount}` : ''}`}
              onClick={() => setSheet('alerts')}
              className={`relative w-10 h-10 rounded-xl bg-white/80 border border-amber-200 text-slate-700 flex items-center justify-center ${FOCUS}`}
            >
              <Bell className="w-5 h-5" />
              {home.alertsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {home.alertsCount > 99 ? '99+' : home.alertsCount}
                </span>
              )}
            </button>
          </div>
          <BalanceCard income={home.totalIncome} expenses={home.totalExpenses} scopeLabel="Todos los lotes" />
          {/* Plantilla del plan sanitario: se aplica a cada lote nuevo (como los protocolos porcinos) */}
          <button
            onClick={() => setSheet('plan')}
            className={`w-full flex items-center gap-3 bg-white rounded-2xl border border-indigo-200 p-3 text-left ${FOCUS}`}
          >
            <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Syringe className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-900">Plan de vacunas y cuidados</span>
              <span className="block text-[11px] text-slate-500 truncate">
                {planTemplate.length} actividades · {planTemplate.filter((p) => p.defaultEnabled).length} por defecto en cada lote nuevo
              </span>
            </span>
            <span className="text-xs font-bold text-indigo-700 flex items-center gap-0.5 shrink-0">
              Configurar <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        </div>

        <div className="px-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-black text-slate-900">Mis Lotes</h3>
            <span className="text-xs text-slate-500">
              {home.activeCount} activos · {home.finishedCount} finalizados
            </span>
          </div>

          {!hasLots ? (
            <div className="bg-white rounded-2xl p-2 text-center border border-dashed border-amber-300">
              <EmptyState
                icon={<Bird className="w-8 h-8 text-amber-500" />}
                title="Aún no tienes lotes"
                hint="Crea tu primer lote de pollos de engorde: anota cuántos entraron y cuándo empiezan."
                action={
                  <button onClick={onNewLot} className={`h-11 px-5 rounded-full bg-amber-400 text-slate-900 font-bold text-sm ${FOCUS}`}>
                    Crear lote
                  </button>
                }
              />
            </div>
          ) : home.activeCount === 0 ? (
            <p className="text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 p-4 text-center">No hay lotes activos. Toca «Nuevo lote» para empezar otro ciclo.</p>
          ) : (
            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-3">
              {home.activeLots.map((c) => (
                <LoteCard key={c.lot.id} card={c} onOpen={() => openLot(c.lot.id)} onAction={(a) => onAction(c, a)} />
              ))}
            </div>
          )}

          {home.finishedCount > 0 && (
            <div className="space-y-3 pt-1">
              <button onClick={() => setShowFinished((s) => !s)} aria-expanded={showFinished} className={`h-10 text-sm font-bold text-slate-600 flex items-center gap-1 ${FOCUS}`}>
                Finalizados ({home.finishedCount}) <ChevronDown className={`w-4 h-4 transition-transform ${showFinished ? 'rotate-180' : ''}`} />
              </button>
              {showFinished && (
                <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-3">
                  {home.finishedLots.map((c) => (
                    <LoteCard key={c.lot.id} card={c} onOpen={() => openLot(c.lot.id)} onAction={(a) => onAction(c, a)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <FabButton label="Nuevo lote" onClick={onNewLot} variant="amber" className="bottom-4 right-4" />

      {editing && <EditLoteDialog lot={editing.lot} onClose={() => setEditing(null)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.action === 'finalize' ? `¿Finalizar ${confirm.card.lot.name}?` : `¿Eliminar ${confirm.card.lot.name}?`}
          danger={confirm.action === 'delete'}
          icon={confirm.action === 'finalize' ? <Flag className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
          confirmLabel={confirm.action === 'finalize' ? 'Finalizar' : 'Eliminar'}
          requireText={confirm.action === 'delete' && cardHasRecords(confirm.card) ? confirm.card.lot.name : undefined}
          error={confirmError}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirm}
          message={
            confirm.action === 'finalize' ? (
              <>
                <p>
                  El lote pasará a Finalizados.{' '}
                  {confirm.card.pendingTasks > 0 ? `Las ${confirm.card.pendingTasks} actividades pendientes se cancelarán. ` : ''}Ventas, gastos e ingresos se conservan.
                </p>
                {confirm.card.birds.inShed > 0 && (
                  <p className="p-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">Aún hay {confirm.card.birds.inShed} pollos en galpón.</p>
                )}
              </>
            ) : (
              <p>
                Se borrarán sus ventas, gastos, ingresos, bajas y pesajes, y se cancelarán sus actividades. Los movimientos financieros asociados se eliminarán. Esta acción no se puede deshacer.
              </p>
            )
          }
        />
      )}
      {sheet === 'alerts' && <LazyAlerts onClose={() => setSheet(null)} />}
      {sheet === 'calendar' && <LazyCalendar onClose={() => setSheet(null)} />}
      {sheet === 'plan' && <PlanTemplateSheet onClose={() => setSheet(null)} />}
    </div>
  );
};

const AlertsSheet = React.lazy(() => import('./Sanidad').then((m) => ({ default: m.AvicolaAlertsSheet })));
const CalendarSheet = React.lazy(() => import('./Sanidad').then((m) => ({ default: m.AvicolaCalendarSheet })));
const LazyAlerts: React.FC<{ onClose: () => void }> = (p) => (
  <React.Suspense fallback={null}>
    <AlertsSheet {...p} />
  </React.Suspense>
);
const LazyCalendar: React.FC<{ onClose: () => void }> = (p) => (
  <React.Suspense fallback={null}>
    <CalendarSheet {...p} />
  </React.Suspense>
);
