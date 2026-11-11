import React from 'react';
import { Settings, X, Database, CheckCircle2 } from 'lucide-react';

interface SettingsModalViewProps {
  onClose: () => void;
}

export const SettingsModalView: React.FC<SettingsModalViewProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 text-xs">
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
