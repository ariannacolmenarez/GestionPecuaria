import React, { useState } from 'react';
import { Bell, X, ChevronRight, CheckCircle2, Calendar } from 'lucide-react';
import { SanitaryTask } from '../../types';

interface PhoneNotificationBannerProps {
  todayTasks?: SanitaryTask[];
  todayPendingTasks?: SanitaryTask[];
  onOpenAlerts: () => void;
  onDismiss: () => void;
}

export const PhoneNotificationBanner: React.FC<PhoneNotificationBannerProps> = ({
  todayTasks,
  todayPendingTasks,
  onOpenAlerts,
  onDismiss,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const tasksList = todayTasks || todayPendingTasks || [];
  const pendingTasks = tasksList.filter((t) => t.status === 'pendiente');

  if (tasksList.length === 0) return null;

  return (
    <div
      id="phone-push-notification-banner"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="absolute top-12 left-3 right-3 z-50 animate-in slide-in-from-top-4 duration-300 select-none cursor-pointer"
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-slate-700/80 ring-1 ring-black/40">
        {/* Top bar of notification: App name and timestamp */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <span className="w-5 h-5 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-[10px] font-black shadow-xs">
              🐖
            </span>
            <span className="tracking-wide">GRANJA ARIANNA</span>
            <span className="text-[10px] text-slate-500">• ahora</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
            title="Descartar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content of notification */}
        <div onClick={onOpenAlerts} className="space-y-1">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-xs text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Actividades para Hoy (19 de Agosto)</span>
            </h5>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {pendingTasks.length} {pendingTasks.length === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
            {tasksList[0]?.title || 'Actividades veterinarias estimadas para el día en curso.'}
            {tasksList.length > 1 ? ` (+${tasksList.length - 1} actividad más)` : ''}
          </p>

          <div className="flex items-center justify-between pt-1 text-[10px] text-emerald-400 font-semibold">
            <span>Toca para ver detalles o marcar como realizada</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
