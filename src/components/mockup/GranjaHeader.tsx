import React from 'react';
import { Settings, Users, Wifi, ChevronLeft } from 'lucide-react';
import { FarmMember } from '../../types';

interface GranjaHeaderProps {
  title?: string;
  members: FarmMember[];
  onOpenMembers: () => void;
  onOpenSettings: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

export const GranjaHeader: React.FC<GranjaHeaderProps> = ({
  title = 'Granja Arianna',
  members,
  onOpenMembers,
  onOpenSettings,
  showBack = false,
  onBack,
}) => {
  return (
    <header
      id="granja-app-header"
      className="bg-white border-b border-slate-100 px-4 pt-3 pb-3 shrink-0"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {showBack && onBack ? (
            <button
              id="header-back-button"
              onClick={onBack}
              className="p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Volver"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
              GA
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-slate-800 text-base leading-tight tracking-tight">
                {title}
              </h1>
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" title="En línea" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Wifi className="w-2.5 h-2.5 text-emerald-500" /> Sincronizado con Firebase
            </span>
          </div>
        </div>

        <button
          id="header-settings-btn"
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
          title="Configuración de la granja"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Miembros / Avatars Bar - as shown in the screenshot */}
      <div className="flex items-center justify-between bg-slate-50/80 rounded-xl px-2.5 py-1.5 border border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Miembros:
          </span>
          <div className="flex items-center -space-x-1.5">
            {members.slice(0, 3).map((member) => (
              <img
                key={member.id}
                src={member.avatar}
                alt={member.name}
                title={`${member.name} (${member.role})`}
                className="w-6 h-6 rounded-full border-2 border-white object-cover shadow-xs"
              />
            ))}
            {members.length > 3 && (
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 border-2 border-white text-[10px] font-bold flex items-center justify-center">
                +{members.length - 3}
              </span>
            )}
          </div>
        </div>

        <button
          id="btn-ver-todos-miembros"
          onClick={onOpenMembers}
          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
        >
          Ver todos
        </button>
      </div>
    </header>
  );
};
