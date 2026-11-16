import React from 'react';
import { X, ChevronRight, CalendarDays, Bird } from 'lucide-react';
import { SanitaryTask } from '../../types';
import { MONTH_NAMES_ES, parseISODate, todayISO } from '../../utils/dates';

interface PhoneNotificationBannerProps {
  todayTasks?: SanitaryTask[];
  todayPendingTasks?: SanitaryTask[];
  onOpenAlerts: () => void;
  onDismiss: () => void;
  /** Fecha real (YYYY-MM-DD). */
  today?: string;
  /** Nombre de la granja (no se muestra; se conserva por compatibilidad). */
  farmName?: string;
}

const isOpen = (t: SanitaryTask) => t.status === 'pendiente' || t.status === 'retrasada';
const cleanTitle = (t: SanitaryTask) => (t.targetRubro === 'avicola' ? t.title.replace(/^\[[^\]]*\]\s*/, '') : t.title);

/**
 * Aviso de actividades pendientes (hoy y vencidas) bajo el encabezado.
 * Va dentro del flujo de la pantalla: no tapa el encabezado ni los botones.
 */
export const PhoneNotificationBanner: React.FC<PhoneNotificationBannerProps> = ({ todayTasks, todayPendingTasks, onOpenAlerts, onDismiss, today = todayISO() }) => {
  const d = parseISODate(today);
  const todayLabel = d ? `${d.getDate()} de ${MONTH_NAMES_ES[d.getMonth()]}` : today;
  const tasksList = todayTasks || todayPendingTasks || [];
  const pending = tasksList.filter(isOpen);
  const overdue = pending.filter((t) => t.date < today).length;

  if (tasksList.length === 0) return null;
  const first = tasksList[0];
  const more = tasksList.length - 1;

  return (
    <div id="phone-push-notification-banner" className="mx-3 mt-2 shrink-0 bg-slate-900 text-white rounded-2xl shadow-lg flex items-stretch animate-in slide-in-from-top-2 duration-300">
      <button
        type="button"
        onClick={onOpenAlerts}
        className="flex-1 min-w-0 text-left pl-3 py-2.5 pr-1 rounded-l-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <CalendarDays className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {pending.length} {pending.length === 1 ? 'actividad pendiente' : 'actividades pendientes'}
            {overdue > 0 ? ` · ${overdue} ${overdue === 1 ? 'vencida' : 'vencidas'}` : ` · hoy ${todayLabel}`}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-200 min-w-0">
          {first?.targetRubro === 'avicola' && <Bird className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-label="Avícola" />}
          <span className="truncate">
            {first ? cleanTitle(first) : ''}
            {more > 0 ? ` (+${more} más)` : ''}
          </span>
        </span>
        <span className="mt-0.5 flex items-center text-xs font-bold text-amber-300">
          Ver alertas <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Ocultar aviso"
        className="w-11 min-h-11 shrink-0 self-start mt-1 mr-1 rounded-full flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
