import React, { useState } from 'react';
import { Settings, X, Database, CheckCircle2, RefreshCw, LogOut, UserCircle2 } from 'lucide-react';

interface SettingsModalViewProps {
  onClose: () => void;
  /** Nombre real de la granja (summary.name). */
  farmName?: string;
  location?: string;
  /** Re-sincroniza el estado local con la base de datos. */
  onResync?: () => void | Promise<void>;
  /** Sesión actual. */
  userEmail?: string;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void | Promise<void>;
}

export const SettingsModalView: React.FC<SettingsModalViewProps> = ({
  onClose,
  farmName,
  location,
  onResync,
  userEmail,
  userName,
  userRole,
  onSignOut,
}) => {
  const [busy, setBusy] = useState(false);

  const run = async (fn?: () => void | Promise<void>) => {
    if (!fn) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-slate-700" /> Configuración de la Granja
          </h4>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 w-10 h-10 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-bold">NOMBRE DE LA EXPLOTACIÓN</span>
            <span className="font-bold text-slate-800 text-sm">{farmName || 'Sin nombre'}</span>
            {location && <span className="block text-[11px] text-slate-500">{location}</span>}
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-bold">RUBROS HABILITADOS</span>
            <span className="font-semibold text-slate-700">Porcino, Avícola y Bovino</span>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-600 block font-bold">BASE DE DATOS & SINCRONIZACIÓN</span>
            <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-600" /> Conectado a Firebase Cloud Firestore
            </span>
            <span className="text-[11px] text-emerald-700 flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Datos compartidos entre los miembros de la granja
            </span>
          </div>
        </div>

        {userEmail && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <span className="text-[10px] text-slate-400 block font-bold">SESIÓN</span>
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <UserCircle2 className="w-8 h-8 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">{userName || userEmail}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {userEmail}
                  {userRole ? ` · ${userRole}` : ''}
                </p>
              </div>
            </div>
            {onSignOut && (
              <button
                disabled={busy}
                onClick={() => run(onSignOut)}
                className="w-full min-h-10 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
              </button>
            )}
          </div>
        )}

        {onResync && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <span className="text-[10px] text-slate-400 block font-bold">GESTIÓN DE DATOS</span>
            <button
              disabled={busy}
              onClick={() => run(onResync)}
              className="w-full min-h-10 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sincronizar con la base de datos
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full min-h-10 py-2.5 bg-slate-900 text-white rounded-xl font-bold mt-2 cursor-pointer hover:bg-slate-800 transition-colors shadow-xs"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
