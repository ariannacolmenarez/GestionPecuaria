import React, { useId, useMemo, useRef, useState } from 'react';
import { Calendar, User, ShieldCheck, Stethoscope, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { SanitaryTask, WarehouseItem } from '../../types';
import { todayISO, formatShortDate } from '../../utils/dates';
import { round2 } from '../../models/porcinoRules';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';
import {
  Btn,
  ErrorBox,
  FieldError,
  FieldLabel,
  ModalHeader,
  Overlay,
  fieldClass,
  inputClass,
  useBackClose,
  useFocusFirstInvalid,
} from '../common/ui';

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

const fmtDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatShortDate(d) : d || '—');

export const SanitaryProcedureModal: React.FC<SanitaryProcedureModalProps> = ({
  task,
  onClose,
  onComplete,
  warehouseItems,
}) => {
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyRef = useRef<HTMLDivElement>(null);
  const canPickItem = Array.isArray(warehouseItems);
  const usableItems = useMemo(
    () => (warehouseItems || []).filter((i) => i.category !== 'alimentos' || i.id === task?.warehouseItemId),
    [warehouseItems, task?.warehouseItemId]
  );

  const initialQty = task?.warehouseQuantity !== undefined ? String(task.warehouseQuantity) : '';
  const [itemId, setItemId] = useState<string>(task?.warehouseItemId || NO_ITEM);
  const [quantity, setQuantity] = useState<string>(initialQty);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ date?: string; qty?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const dirty = !isDone && (!!notes.trim() || quantity !== initialQty || itemId !== (task?.warehouseItemId || NO_ITEM));
  const { requestClose, confirmDialog } = useBackClose(!!task, onClose, dirty);
  useFocusFirstInvalid(bodyRef, errors.date || errors.qty || null, submitCount);

  if (!task) return null;

  const selectedItem = (warehouseItems || []).find((i) => i.id === itemId);
  const qtyNum = toNumber(quantity);
  const stock = toNumber(selectedItem?.quantity);
  const costPreview = selectedItem ? round2(qtyNum * toNumber(selectedItem.unitCostUsd)) : 0;
  const isClosed = task.status === 'completada' || task.status === 'cancelada';

  const handleComplete = async () => {
    setError(null);
    const next: { date?: string; qty?: string } = {};
    if (!date || date > todayISO()) next.date = 'La fecha no puede ser futura.';
    if (selectedItem) {
      if (qtyNum <= 0) next.qty = 'Indica cuánto insumo usaste.';
      else if (qtyNum > stock) next.qty = `No alcanza: hay ${stock} ${selectedItem.unit} de ${selectedItem.name}.`;
    }
    setErrors(next);
    setSubmitCount((c) => c + 1);
    if (next.date || next.qty) return;
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
    <Overlay className="bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onBackdrop={requestClose}>
      <div
        id="sanitary-procedure-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[94%] sm:max-h-[90vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<Stethoscope />}
          title={task.title}
          subtitle="Actividad sanitaria"
          titleId={titleId}
          onClose={requestClose}
        />

        {isDone ? (
          <div className="p-6 text-center space-y-3 overflow-y-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Actividad completada</h3>
            <p className="text-sm text-slate-700">
              {selectedItem
                ? `Se descontaron ${qtyNum} ${selectedItem.unit} de ${selectedItem.name} del almacén (costo $${costPreview.toFixed(2)}).`
                : 'Quedó marcada como hecha en el calendario y en la historia del animal.'}
            </p>
            <Btn rubro="porcino" size="lg" block onClick={onClose}>
              Volver al calendario
            </Btn>
          </div>
        ) : (
          <>
            <div ref={bodyRef} className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto text-sm">
              {/* Datos de la tarea */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-600 block font-semibold">Fecha programada</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-4 h-4 text-rose-700" aria-hidden="true" /> {fmtDate(task.date)}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 min-w-0">
                  <span className="text-xs text-slate-600 block font-semibold">Responsable</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5 truncate">
                    <User className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" /> {task.responsible || '—'}
                  </span>
                </div>
              </div>

              <dl className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="flex justify-between items-start gap-3">
                  <dt className="text-slate-600 font-medium">Grupo</dt>
                  <dd className="font-bold text-slate-900 text-right">{task.targetGroup}</dd>
                </div>
                {task.targetAnimal && (
                  <div className="flex justify-between items-start gap-3">
                    <dt className="text-slate-600 font-medium">Animal o lote</dt>
                    <dd className="font-bold text-slate-900 text-right">{task.targetAnimal}</dd>
                  </div>
                )}
                {task.medicamentUsed && (
                  <div className="flex justify-between items-start gap-3">
                    <dt className="text-slate-600 font-medium">Medicamento</dt>
                    <dd className="font-bold text-slate-900 text-right">{task.medicamentUsed}</dd>
                  </div>
                )}
                {task.dosage && (
                  <div className="flex justify-between items-start gap-3">
                    <dt className="text-slate-600 font-medium">Dosis</dt>
                    <dd className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-300 text-right">{task.dosage}</dd>
                  </div>
                )}
              </dl>

              {/* Procedimiento */}
              <div>
                <h3 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5 text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" aria-hidden="true" />
                  Cómo hacerlo
                </h3>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-line">
                  {task.procedure || 'Sin pasos escritos.'}
                </div>
              </div>

              {!isClosed && (
                <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <FieldLabel htmlFor={`${uid}-date`}>¿Cuándo se hizo?</FieldLabel>
                    <input
                      id={`${uid}-date`}
                      type="date"
                      max={todayISO()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      aria-invalid={!!errors.date}
                      aria-describedby={errors.date ? `${uid}-date-err` : undefined}
                      className={fieldClass(!!errors.date)}
                    />
                    <FieldError id={`${uid}-date-err`} error={errors.date} />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-notes`}>Observaciones (opcional)</FieldLabel>
                    <input
                      id={`${uid}-notes`}
                      type="text"
                      value={notes}
                      placeholder="Ej: un animal con fiebre"
                      onChange={(e) => setNotes(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  {canPickItem && (
                    <div className="space-y-2">
                      <FieldLabel htmlFor={`${uid}-item`}>
                        <span className="inline-flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-slate-700" aria-hidden="true" /> Insumo del almacén usado
                        </span>
                      </FieldLabel>
                      <select id={`${uid}-item`} value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClass}>
                        <option value={NO_ITEM}>Ninguno (no descontar)</option>
                        {usableItems.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} — hay {i.quantity} {i.unit}
                          </option>
                        ))}
                      </select>
                      {selectedItem && (
                        <div>
                          <label htmlFor={`${uid}-qty`} className="block text-sm font-semibold text-slate-900 mb-1">
                            Cantidad usada ({selectedItem.unit})
                          </label>
                          <input
                            id={`${uid}-qty`}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            max={stock}
                            enterKeyHint="done"
                            value={quantity}
                            placeholder="Ej: 2"
                            onChange={(e) => setQuantity(e.target.value)}
                            aria-invalid={!!errors.qty}
                            aria-describedby={errors.qty ? `${uid}-qty-err` : undefined}
                            className={fieldClass(!!errors.qty, 'font-bold')}
                          />
                          <FieldError id={`${uid}-qty-err`} error={errors.qty} />
                          <p className="text-xs text-slate-700 mt-1">
                            Costo: <strong>${costPreview.toFixed(2)}</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Qué ocurre al completar (coincide con lo que hace el sistema) */}
              {!isClosed && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 flex items-start gap-2 text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
                  <p className="text-xs leading-snug">
                    {selectedItem
                      ? `Al marcarla como hecha se descontarán ${qtyNum || 0} ${selectedItem.unit} de ${selectedItem.name} del almacén, quedará en la historia del animal y su costo se cargará al animal o lote${
                          selectedItem.expensedOnPurchase ? ' (la compra ya se anotó como gasto).' : ' y como gasto en el balance.'
                        }`
                      : 'Al marcarla como hecha se guarda la fecha y queda en la historia del animal. No se descuenta nada del almacén.'}
                  </p>
                </div>
              )}

              {task.status === 'cancelada' && (
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 text-slate-800 text-sm">
                  Tarea cancelada{task.cancelReason ? `: ${task.cancelReason}` : '.'}
                </div>
              )}
            </div>

            {/* Pie fijo */}
            <div className="shrink-0 p-3 border-t border-slate-200 bg-white space-y-2">
              <ErrorBox error={error} />
              {!isClosed ? (
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Btn variant="secondary" size="lg" onClick={requestClose}>
                    Cerrar
                  </Btn>
                  <Btn rubro="porcino" size="lg" block onClick={handleComplete} disabled={isSaving} icon={<CheckCircle2 />}>
                    {isSaving ? 'Guardando…' : 'Marcar como hecha'}
                  </Btn>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <span className="min-h-12 px-3 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-sm flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> {task.status === 'cancelada' ? 'Cancelada' : 'Ya está hecha'}
                  </span>
                  <Btn variant="secondary" size="lg" onClick={onClose}>
                    Cerrar
                  </Btn>
                </div>
              )}
            </div>
          </>
        )}
        {confirmDialog}
      </div>
    </Overlay>
  );
};
