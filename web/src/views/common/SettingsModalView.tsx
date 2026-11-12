import React, { useState } from 'react';
import { Settings, X, Database, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';

interface SettingsModalViewProps {
  onClose: () => void;
  /** Nombre real de la granja (summary.name). */
  farmName?: string;
  location?: string;
  /** Borra TODOS los registros de la granja (deja la granja en blanco). */
  onClearAllData?: () => void | Promise<void>;
  /** Re-sincroniza el estado local con la base de datos. */
  onResync?: () => void | Promise<void>;
}

export const SettingsModalView: React.FC<SettingsModalViewProps> = ({
  onClose,
  farmName,
  location,
  onClearAllData,
  onResync,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn?: () => void | Promise<void>) => {
    if (!fn) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 text-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-slate-700" /> Configuración de la Granja
          </h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
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
            <span className="font-semibold text-slate-700">Porcino (Principal), Bovino y Avícola</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-bold">ARQUITECTURA DE SOFTWARE</span>
            <span className="font-bold text-blue-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Modelo - Vista - Controlador (MVC)
            </span>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-600 block font-bold">BASE DE DATOS & SINCRONIZACIÓN</span>
            <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-600" /> Conectado a Firebase Cloud Firestore
            </span>
          </div>
        </div>

        {(onResync || onClearAllData) && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <span className="text-[10px] text-slate-400 block font-bold">GESTIÓN DE DATOS</span>
            {onResync && (
              <button
                disabled={busy}
                onClick={() => run(onResync)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sincronizar con la base de datos
              </button>
            )}
            {onClearAllData &&
              (confirmClear ? (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <p className="text-[11px] text-rose-800 font-semibold">
                    Se eliminarán TODOS los animales, camadas, tareas, movimientos e insumos. Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => setConfirmClear(false)}
                      className="flex-1 py-2 bg-white border border-slate-300 rounded-xl font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => run(onClearAllData)}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-60"
                    >
                      {busy ? 'Eliminando...' : 'Sí, eliminar todo'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar todos los datos (iniciar en blanco)
                </button>
              ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold mt-2 cursor-pointer hover:bg-slate-800 transition-colors shadow-xs"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
