import React, { useMemo, useState } from 'react';
import { X, Calendar, User, ShieldCheck, Stethoscope, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { SanitaryTask, WarehouseItem } from '../../types';
import { todayISO } from '../../utils/dates';
import { round2 } from '../../models/porcinoRules';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';

/** Datos opcionales al completar la tarea (se pasan a porcinoActions.completeSanitaryTask). */
export interface CompleteTaskOptions {
  date?: string;
  warehouseItemId?: string;
  quantityUsed?: number;
  responsible?: string;
  notes?: string;
}

interface SanitaryProcedureModalProps {
  task: SanitaryTask | null;
  onClose: () => void;
  /**
   * options trae el insumo/cantidad elegidos: conectar a
   * porcinoActions.completeSanitaryTask({taskId, ...options}). Puede devolver un DomainResult.
   */
  onComplete: (taskId: string, options?: CompleteTaskOptions) => ModalActionReturn;
  /** Insumos del almacén: si se proveen, permite elegir el insumo usado y la cantidad. */
  warehouseItems?: WarehouseItem[];
}

const NO_ITEM = '';

export const SanitaryProcedureModal: React.FC<SanitaryProcedureModalProps> = ({
  task,
  onClose,
  onComplete,
  warehouseItems,
}) => {
  const canPickItem = Array.isArray(warehouseItems);
  const usableItems = useMemo(
    () => (warehouseItems || []).filter((i) => i.category !== 'alimentos' || i.id === task?.warehouseItemId),
    [warehouseItems, task?.warehouseItemId]
  );

  const [itemId, setItemId] = useState<string>(task?.warehouseItemId || NO_ITEM);
  const [quantity, setQuantity] = useState<string>(
    task?.warehouseQuantity !== undefined ? String(task.warehouseQuantity) : ''
  );
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!task) return null;

  const selectedItem = (warehouseItems || []).find((i) => i.id === itemId);
  const qtyNum = toNumber(quantity);
  const stock = toNumber(selectedItem?.quantity);
  const costPreview = selectedItem ? round2(qtyNum * toNumber(selectedItem.unitCostUsd)) : 0;
  const isClosed = task.status === 'completada' || task.status === 'cancelada';

  const handleComplete = async () => {
    setError(null);
    if (!date || date > todayISO()) {
      setError('La fecha de realización no puede ser futura.');
      return;
    }
    if (selectedItem) {
      if (qtyNum <= 0) {
        setError('Indica la cantidad del insumo utilizada.');
        return;
      }
      if (qtyNum > stock) {
        setError(`Stock insuficiente de ${selectedItem.name}: hay ${stock} ${selectedItem.unit}.`);
        return;
      }
    }
    const options: CompleteTaskOptions = {
      date,
      notes: notes.trim() || undefined,
      warehouseItemId: selectedItem ? selectedItem.id : undefined,
      quantityUsed: selectedItem ? qtyNum : undefined,
    };
    setIsSaving(true);
    const res = await runModalAction(() => onComplete(task.id, options));
    setIsSaving(false);
    if (!res.ok) {
      setError(res.error || 'No se pudo completar la tarea.');
      return;
    }
    setIsDone(true);
  };

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
                Protocolo Veterinario
              </span>
              <h3 className="font-bold text-base leading-tight text-white mt-0.5">{task.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isDone ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">¡Actividad Completada!</h4>
            <p className="text-xs text-slate-600">
              {selectedItem
                ? `Se descontaron ${qtyNum} ${selectedItem.unit} de ${selectedItem.name} y se imputó el costo ($${costPreview.toFixed(2)}).`
                : 'La tarea quedó registrada como realizada en el calendario y en la trazabilidad.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
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
                    <User className="w-3.5 h-3.5 text-blue-600" /> {task.responsible || '—'}
                  </span>
                </div>
              </div>

              {/* Grupo objetivo & Dosis */}
              <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Grupo Objetivo:</span>
                  <span className="font-bold text-slate-800">{task.targetGroup}</span>
                </div>
                {task.targetAnimal && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Animal / Lote:</span>
                    <span className="font-bold text-slate-800">{task.targetAnimal}</span>
                  </div>
                )}
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

              {/* Procedimiento */}
              <div>
                <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Procedimiento Operativo Específico
                </h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                  {task.procedure || 'Sin procedimiento detallado.'}
                </div>
              </div>

              {!isClosed && (
                <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Fecha de realización:</label>
                      <input
                        type="date"
                        max={todayISO()}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Observaciones:</label>
                      <input
                        type="text"
                        value={notes}
                        placeholder="Opcional"
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                      />
                    </div>
                  </div>

                  {canPickItem && (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-500" /> Insumo de almacén utilizado:
                      </label>
                      <select
                        value={itemId}
                        onChange={(e) => setItemId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                      >
                        <option value={NO_ITEM}>Ninguno (no descontar stock)</option>
                        {usableItems.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} — stock {i.quantity} {i.unit}
                          </option>
                        ))}
                      </select>
                      {selectedItem && (
                        <div className="grid grid-cols-2 gap-2 items-end">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              Cantidad usada ({selectedItem.unit}):
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={stock}
                              value={quantity}
                              placeholder="0"
                              onChange={(e) => setQuantity(e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-slate-900"
                            />
                          </div>
                          <span className="text-[10px] text-slate-600 pb-1.5">
                            Costo imputado: <strong>${costPreview.toFixed(2)}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Qué ocurre al completar (coincide con lo que hace el sistema) */}
              {!isClosed && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-2 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-tight">
                    {selectedItem
                      ? `Al marcarla como realizada se descontarán ${qtyNum || 0} ${selectedItem.unit} de ${selectedItem.name} del almacén, se registrará el evento en la trazabilidad y su costo se imputará al animal o lote${
                          selectedItem.expensedOnPurchase ? ' (la compra ya fue registrada como egreso).' : ' y como egreso en el balance.'
                        }`
                      : 'Al marcarla como realizada se registrará la fecha de cierre y el evento en la trazabilidad. No se descontará stock del almacén.'}
                  </p>
                </div>
              )}

              {task.status === 'cancelada' && (
                <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-700 text-[11px]">
                  Tarea cancelada{task.cancelReason ? `: ${task.cancelReason}` : '.'}
                </div>
              )}

              {error && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-100 text-xs transition-colors"
              >
                Cerrar
              </button>
              {!isClosed ? (
                <button
                  onClick={handleComplete}
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> {isSaving ? 'Guardando...' : 'Marcar Realizada'}
                </button>
              ) : (
                <span className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {task.status === 'cancelada' ? 'Cancelada' : 'Ya Completada'}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
