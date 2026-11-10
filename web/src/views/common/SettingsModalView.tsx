import React, { useState } from 'react';
import { Settings, X, Database, CheckCircle2, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';

interface SettingsModalViewProps {
  onClose: () => void;
  onClearTestData?: () => void;
  onRestoreSampleData?: () => void;
}

export const SettingsModalView: React.FC<SettingsModalViewProps> = ({
  onClose,
  onClearTestData,
  onRestoreSampleData,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-slate-700" /> Configuración de la Granja
          </h4>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-bold">NOMBRE DE LA EXPLOTACIÓN</span>
            <span className="font-bold text-slate-800 text-sm">Granja Arianna</span>
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

        {/* Sección de Gestión de Datos de Prueba */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <span className="text-[10px] text-slate-400 block font-bold tracking-wider">GESTIÓN DE DATOS & PRUEBAS</span>

          {confirmClear ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-tight font-medium">
                  ¿Estás seguro de vaciar todos los registros de prueba? Los animales, tareas y movimientos se pondrán en cero para registrar tus datos reales.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClear(false);
                    onClearTestData?.();
                  }}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Sí, limpiar todo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmClear(true);
                setConfirmRestore(false);
              }}
              className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-600" /> Limpiar datos de prueba (Iniciar en blanco)
            </button>
          )}

          {confirmRestore ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2 text-blue-800">
                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-tight font-medium">
                  ¿Restaurar los datos de demostración predeterminados (140 cerdos, bovinos, tareas y lotes avícolas)?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRestore(false);
                    onRestoreSampleData?.();
                  }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Sí, restaurar demo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRestore(false)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmRestore(true);
                setConfirmClear(false);
              }}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors text-[11px]"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Restaurar datos de demostración
            </button>
          )}
        </div>

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
