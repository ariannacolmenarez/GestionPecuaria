import React from 'react';
import { X, Calendar, User, ShieldCheck, Stethoscope, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SanitaryTask } from '../../types';

interface SanitaryProcedureModalProps {
  task: SanitaryTask | null;
  onClose: () => void;
  onComplete: (taskId: string) => void;
}

export const SanitaryProcedureModal: React.FC<SanitaryProcedureModalProps> = ({
  task,
  onClose,
  onComplete,
}) => {
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        id="sanitary-procedure-dialog"
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Stethoscope className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                Protocolo Veterinario Oficial
              </span>
              <h3 className="font-bold text-base leading-tight text-white mt-0.5">
                {task.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 overflow-y-auto text-xs">
          {/* Metadata badges */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">Fecha Programada</span>
              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> {task.date}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">Responsable</span>
              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                <User className="w-3.5 h-3.5 text-blue-600" /> {task.responsible}
              </span>
            </div>
          </div>

          {/* Grupo objetivo & Dosis */}
          <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Grupo Objetivo:</span>
              <span className="font-bold text-slate-800">{task.targetGroup}</span>
            </div>
            {task.medicamentUsed && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Medicamento:</span>
                <span className="font-bold text-blue-700">{task.medicamentUsed}</span>
              </div>
            )}
            {task.dosage && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Dosis Recomendada:</span>
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-blue-200">
                  {task.dosage}
                </span>
              </div>
            )}
          </div>

          {/* Leyenda y Procedimiento Específico */}
          <div>
            <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Procedimiento Operativo Específico
            </h4>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
              {task.procedure}
            </div>
          </div>

          {/* Advertencia de deducción automática */}
          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-tight">
              Al marcar esta actividad como completada, se descontará automáticamente el stock del Almacén en mililitros/dosis y se imputará al gasto del lote.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-100 text-xs transition-colors"
          >
            Cerrar
          </button>
          {task.status !== 'completada' ? (
            <button
              onClick={() => {
                onComplete(task.id);
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Marcar Realizada
            </button>
          ) : (
            <span className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Ya Completada
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
