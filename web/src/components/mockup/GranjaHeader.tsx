import React from 'react';
import { Settings, ChevronLeft, ChevronRight, CloudOff, CloudUpload, CheckCircle2 } from 'lucide-react';
import { FarmMember } from '../../types';

interface GranjaHeaderProps {
  title?: string;
  members: FarmMember[];
  onOpenMembers: () => void;
  onOpenSettings: () => void;
  showBack?: boolean;
  onBack?: () => void;
  /** Conexión real del teléfono (eventos online/offline). */
  online?: boolean;
  /** Hay cambios guardados en el teléfono que aún no llegan a la nube. */
  pendingSync?: boolean;
  /** Fila de miembros (solo en el Home de la granja). */
  showMembers?: boolean;
}

/** Estado de guardado en palabras simples (no depende solo del color). */
const SyncStatus: React.FC<{ online: boolean; pending: boolean }> = ({ online, pending }) => {
  if (!online)
    return (
      <span className="text-xs font-semibold text-amber-800 flex items-center gap-1">
        <CloudOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Sin señal · se guarda en el teléfono
      </span>
    );
  if (pending)
    return (
      <span className="text-xs font-semibold text-sky-800 flex items-center gap-1">
        <CloudUpload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Subiendo cambios a la nube…
      </span>
    );
  return (
    <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Todo guardado
    </span>
  );
};

export const GranjaHeader: React.FC<GranjaHeaderProps> = ({
  title = 'Mi Granja',
  members,
  onOpenMembers,
  onOpenSettings,
  showBack = false,
  onBack,
  online = true,
  pendingSync = false,
  showMembers = false,
}) => {
  const initials =
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'G';
  const list = members || [];
  return (
    <header id="granja-app-header" className="bg-white border-b border-slate-200 px-3 pt-2 pb-2 shrink-0">
      <div className="flex items-center gap-2">
        {showBack && onBack ? (
          <button
            id="header-back-button"
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="w-11 h-11 -ml-1 shrink-0 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <div aria-hidden="true" className="w-10 h-10 shrink-0 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-black text-sm">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-slate-900 text-base leading-tight truncate">{title}</h1>
          <div role="status" aria-live="polite">
            <SyncStatus online={online} pending={pendingSync} />
          </div>
        </div>
        <button
          id="header-settings-btn"
          type="button"
          onClick={onOpenSettings}
          aria-label="Configuración de la granja"
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {showMembers && (
        <button
          id="btn-ver-todos-miembros"
          type="button"
          onClick={onOpenMembers}
          className="mt-2 w-full min-h-11 flex items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl px-3 border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="flex items-center -space-x-1.5" aria-hidden="true">
              {list.slice(0, 3).map((member) => (
                <img key={member.id} src={member.avatar} alt="" className="w-7 h-7 rounded-full border-2 border-white object-cover" />
              ))}
              {list.length > 3 && (
                <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 border-2 border-white text-xs font-bold flex items-center justify-center">
                  +{list.length - 3}
                </span>
              )}
            </span>
            <span className="text-sm font-semibold text-slate-800 truncate">
              Equipo ({list.length} {list.length === 1 ? 'miembro' : 'miembros'})
            </span>
          </span>
          <span className="text-sm font-bold text-emerald-800 flex items-center shrink-0">
            Ver <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </span>
        </button>
      )}
    </header>
  );
};
