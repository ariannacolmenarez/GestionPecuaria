/**
 * A8 · Aplicar tratamiento a un animal, varios aretes o un lote. Dosis automática por
 * peso (autoDose del dominio), descuento de farmacia (FEFO, bloqueo de vencidos),
 * retiros de carne/leche visibles y repeticiones programadas en la Agenda.
 */
import React, { useMemo, useState } from 'react';
import { Pill, Users } from 'lucide-react';
import type { BovinoTreatmentEvent } from '../../../../models/bovinoModel';
import { autoDose, itemBovinoCategory, withdrawalUntil, type BovinoAnimalView } from '../../../../models/bovinoCalc';
import { addDays } from '../../../../utils/dates';
import { useBovino } from '../context';
import { AnimalSearch, ItemPickerSheet, LotPickerSheet, itemBlockReason } from '../pickers';
import { doseText } from '../almacen/almacenUtils';
import {
  BigNumberInput,
  BlockedNotice,
  Chips,
  DateField,
  ErrorBox,
  Field,
  FOCUS_B,
  FormSheet,
  PickerButton,
  PrimaryBtn,
  TextField,
  Toggle,
  WarnNotice,
  fd,
  num,
  toNum,
  usd,
  useDomainRunner,
} from '../ui';

type Who = 'animal' | 'varios' | 'lote';
type Route = NonNullable<BovinoTreatmentEvent['route']>;
const DIAGS = ['Fiebre', 'Diarrea', 'Neumonía', 'Mastitis', 'Cojera', 'Garrapatas', 'Herida', 'Otro'];
const ROUTES: { key: Route; label: string }[] = [
  { key: 'IM', label: 'IM' },
  { key: 'SC', label: 'SC' },
  { key: 'IV', label: 'IV' },
  { key: 'oral', label: 'Oral' },
  { key: 'topica', label: 'Tópica' },
  { key: 'intramamaria', label: 'Intramamaria' },
];

export const TratamientoSheet: React.FC<{ animalIds?: string[]; lotId?: string; itemId?: string; taskId?: string; onClose: () => void }> = ({ animalIds: ids0, lotId: lot0, itemId: item0, taskId, onClose }) => {
  const { index, bovinoItems, actions, today, perms, home } = useBovino();
  const [who, setWho] = useState<Who>(lot0 ? 'lote' : ids0 && ids0.length > 1 ? 'varios' : 'animal');
  const [ids, setIds] = useState<string[]>(ids0 || []);
  const [lotId, setLotId] = useState<string | undefined>(lot0);
  const [purpose, setPurpose] = useState<'preventivo' | 'curativo'>('preventivo');
  const [diag, setDiag] = useState<string>('');
  const [symptoms, setSymptoms] = useState('');
  const [itemId, setItemId] = useState<string | undefined>(item0);
  const [route, setRoute] = useState<Route | undefined>(undefined);
  const [date, setDate] = useState(today);
  const [manual, setManual] = useState(false);
  const [manualDose, setManualDose] = useState('');
  const [estWeight, setEstWeight] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [every, setEvery] = useState('21');
  const [times, setTimes] = useState('1');
  const [picker, setPicker] = useState<'item' | 'lote' | null>(null);
  const { error, setError, run, confirmEl } = useDomainRunner();

  const pharmacy = useMemo(() => bovinoItems.filter((i) => itemBovinoCategory(i) === 'farmacia'), [bovinoItems]);
  const item = itemId ? pharmacy.find((i) => i.id === itemId) : undefined;
  const block = item ? itemBlockReason(item, today) : null;

  const targets: BovinoAnimalView[] = useMemo(() => {
    if (who === 'lote') return lotId ? index.active.filter((v) => v.lotId === lotId) : [];
    return (who === 'animal' ? ids.slice(0, 1) : ids).map((id) => index.views.get(id)).filter((v): v is BovinoAnimalView => !!v && v.active);
  }, [who, lotId, ids, index]);

  const lotAvg = useMemo(() => {
    const ws = targets.map((v) => v.weightKg).filter((w): w is number => w !== null);
    return ws.length ? ws.reduce((s, x) => s + x, 0) / ws.length : null;
  }, [targets]);
  const isManual = manual || (!!item && !doseText(item));
  const fallbackKg = toNum(estWeight) > 0 ? toNum(estWeight) : lotAvg;

  /** Dosis por animal: manual, automática por su peso, o por peso promedio/estimado si no tiene pesaje. */
  const rows = useMemo(
    () =>
      targets.map((v) => {
        if (!item) return { v, kg: v.weightKg, dose: null as number | null, basis: '' };
        if (isManual) return { v, kg: v.weightKg, dose: toNum(manualDose) > 0 ? toNum(manualDose) : null, basis: 'manual' };
        const own = autoDose(item, v.weightKg);
        if (own) return { v, kg: v.weightKg, dose: own.dose, basis: own.basis === 'cabeza' ? 'fija' : 'peso' };
        const est = autoDose(item, fallbackKg);
        return { v, kg: fallbackKg, dose: est ? est.dose : null, basis: toNum(estWeight) > 0 ? 'estimado' : 'promedio' };
      }),
    [targets, item, isManual, manualDose, fallbackKg, estWeight]
  );
  const total = Math.round(rows.reduce((s, r) => s + (r.dose || 0), 0) * 100) / 100;
  const missing = rows.filter((r) => r.dose === null);
  const noOwnWeight = rows.filter((r) => r.basis === 'promedio' || r.basis === 'estimado');
  const needsWeight = !!item && !isManual && !!item.dosePerKg && missing.length > 0;
  const lactating = targets.filter((v) => v.repro?.lactating);
  const meatUntil = item ? withdrawalUntil(date, item.withdrawalMeatDays || 0) : undefined;
  const milkUntil = item ? withdrawalUntil(date, item.withdrawalMilkDays || 0) : undefined;
  const unit = item?.doseUnit || item?.unit || '';
  const stockShort = !!item && total > item.quantity;
  const lotName = lotId ? index.lotsById.get(lotId)?.name : undefined;
  const costUnit = who === 'lote' && lotId ? home.lots.find((l) => l.lot.id === lotId)?.unit : targets[0]?.unit;

  const scheduleRepeats = () => {
    if (!repeat || !item) return;
    const n = Math.max(1, Math.min(12, Math.round(toNum(times) || 1)));
    const step = Math.max(1, Math.round(toNum(every) || 1));
    for (let k = 1; k <= n; k++) {
      actions.addTask({
        title: `${item.name} (repetición ${k})`,
        date: addDays(date, step * k),
        lotId: who === 'lote' ? lotId : undefined,
        animalIds: who === 'lote' ? undefined : targets.map((v) => v.id),
        itemId: item.id,
        procedure: purpose === 'curativo' ? `Tratamiento curativo${diag ? `: ${diag}` : ''}` : 'Tratamiento preventivo',
        activityKind: 'tratamiento',
      });
    }
  };

  const save = () => {
    if (!targets.length) return setError(who === 'lote' ? 'Elige el lote.' : 'Agrega al menos un animal.');
    if (!item) return setError('Elige el producto de la farmacia.');
    if (block) return setError(block);
    if (missing.length) return setError(isManual ? 'Escribe la dosis por animal.' : `Falta el peso para calcular la dosis de ${missing.map((r) => `#${r.v.tag}`).join(', ')}: escribe un peso estimado.`);
    if (stockShort) return setError(`Solo hay ${num(item.quantity, 2)} ${item.unit} de ${item.name}${item.mfgLot ? ` (lote ${item.mfgLot})` : ''}: se necesitan ${num(total, 2)}. Usa otro lote o registra una compra.`);
    const base = { itemId: item.id, purpose, diagnosis: purpose === 'curativo' ? diag || undefined : undefined, symptoms: symptoms.trim() || undefined, route, date, taskId };
    // Eventos creados (una o dos llamadas): con tarea de la Agenda, se cierra con ellos sin volver a aplicar
    const created: string[] = [];
    const collect = (res: { meta?: Record<string, any> }) => {
      const ids = res.meta?.eventIds;
      if (Array.isArray(ids)) created.push(...ids);
    };
    const done = (res?: { meta?: Record<string, any> }) => {
      if (res) collect(res);
      if (taskId && created.length) actions.completeTask({ taskId, treatmentEventIds: created, date });
      scheduleRepeats();
      onClose();
    };
    if (isManual) {
      const dose = toNum(manualDose);
      run((confirm) => actions.applyTreatment({ ...base, dose, confirm, ...(who === 'lote' ? { lotId } : { animalIds: targets.map((v) => v.id) }) }), done);
      return;
    }
    if (!noOwnWeight.length) {
      // Todos con peso propio (o dosis fija): el dominio calcula la dosis de cada uno
      run((confirm) => actions.applyTreatment({ ...base, confirm, ...(who === 'lote' ? { lotId } : { animalIds: targets.map((v) => v.id) }) }), done);
      return;
    }
    // Mezcla: con pesaje → dosis automática; sin pesaje → dosis por peso promedio/estimado
    const withW = rows.filter((r) => r.basis === 'peso' || r.basis === 'fija').map((r) => r.v.id);
    const estDose = noOwnWeight[0].dose as number;
    const second = () => run((confirm) => actions.applyTreatment({ ...base, animalIds: noOwnWeight.map((r) => r.v.id), dose: estDose, confirm }), done);
    if (withW.length)
      run((confirm) => actions.applyTreatment({ ...base, animalIds: withW, confirm }), (res) => {
        collect(res);
        second();
      });
    else second();
  };

  if (picker === 'item')
    return (
      <ItemPickerSheet
        title="Producto de la farmacia"
        items={pharmacy}
        forUse
        onClose={() => setPicker(null)}
        onPick={(x) => {
          setItemId(x);
          setPicker(null);
        }}
      />
    );

  return (
    <FormSheet
      tone="sky"
      title={taskId ? 'Registrar actividad' : 'Aplicar tratamiento'}
      subtitle={lotName || (targets.length === 1 ? `#${targets[0].tag}` : undefined)}
      dirty={!!(itemId || ids.length)}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" disabled={!targets.length || !item || !!block} onClick={save}>
            Aplicar a {targets.length} {targets.length === 1 ? 'animal' : 'animales'}
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="¿A quién?">
        <Chips
          options={[
            { key: 'animal', label: 'Animal' },
            { key: 'varios', label: 'Varios aretes' },
            { key: 'lote', label: 'Lote' },
          ]}
          value={who}
          onChange={setWho}
        />
      </Field>
      {who === 'lote' ? (
        <PickerButton label="Lote" icon={<Users className="w-5 h-5" />} value={lotName ? `${lotName} · ${targets.length} animales` : undefined} placeholder="Elegir lote" onClick={() => setPicker('lote')} />
      ) : (
        <div className="space-y-2">
          {targets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {targets.map((v) => (
                <button key={v.id} type="button" onClick={() => setIds((l) => l.filter((x) => x !== v.id))} aria-label={`Quitar #${v.tag}`} className={`h-10 px-3 rounded-full bg-sky-600 text-white text-sm font-bold ${FOCUS_B}`}>
                  #{v.tag} ✕
                </button>
              ))}
            </div>
          )}
          {(who === 'varios' || targets.length === 0) && <AnimalSearch excludeIds={ids} onPick={(v) => setIds((l) => (who === 'animal' ? [v.id] : [...l, v.id]))} />}
        </div>
      )}

      <Field label="Tipo">
        <Chips options={[{ key: 'preventivo', label: 'Preventivo' }, { key: 'curativo', label: 'Curativo' }]} value={purpose} onChange={setPurpose} />
      </Field>
      {purpose === 'curativo' && (
        <Field label="Diagnóstico o síntomas">
          <Chips options={DIAGS.map((d) => ({ key: d, label: d }))} value={diag} onChange={setDiag} />
          <TextField value={symptoms} onChange={setSymptoms} maxLength={160} placeholder="Nota (opcional)" />
        </Field>
      )}

      <Field label="Producto">
        <PickerButton label="Producto" icon={<Pill className="w-5 h-5" />} value={item ? `${item.name}${item.mfgLot ? ` · lote ${item.mfgLot}` : ''}` : undefined} placeholder="Elegir de la farmacia" onClick={() => setPicker('item')} />
        {item && <p className="text-xs text-slate-700">Hay {num(item.quantity, 2)} {item.unit}{item.expirationDate ? ` · vence ${fd(item.expirationDate)}` : ''}</p>}
      </Field>
      {pharmacy.length === 0 && <WarnNotice>No hay productos en la farmacia bovina. Regístralos en Más › Almacén bovino › Farmacia.</WarnNotice>}
      {block && <BlockedNotice title="No se puede usar">{block}</BlockedNotice>}

      {item && !block && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-900">Dosis {doseText(item) ? `por ${item.dosePerKg ? 'peso' : 'animal'}: ${doseText(item)}` : 'sin referencia: escríbela a mano'}</p>
          <Toggle checked={isManual} onChange={setManual} label="Dosis manual" hint="Se registra como dosis manual por animal." />
          {isManual && <BigNumberInput decimal value={manualDose} onChange={setManualDose} unit={unit} ariaLabel="Dosis por animal" />}
          {!isManual && targets.length === 1 && rows[0] && (
            <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-3">
              <p className="text-xs text-slate-800">
                {rows[0].basis === 'peso' ? `Peso usado: ${num(rows[0].kg, 1)} kg (pesaje del ${fd(targets[0].weightDate)})` : rows[0].basis === 'fija' ? 'Dosis fija por animal' : 'Sin pesaje: usa el peso estimado'}
              </p>
              <p className="text-3xl font-black text-sky-700 tabular-nums">{rows[0].dose !== null ? `${num(rows[0].dose, 1)} ${unit}` : '—'}</p>
            </div>
          )}
          {needsWeight || (noOwnWeight.length > 0 && !isManual) ? (
            <Field label="Peso estimado (para animales sin pesaje)" hint={lotAvg !== null ? `Si lo dejas vacío se usa el promedio: ${num(lotAvg)} kg` : undefined}>
              <BigNumberInput decimal value={estWeight} onChange={setEstWeight} unit="kg" ariaLabel="Peso estimado" />
            </Field>
          ) : null}
          {targets.length > 1 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-700 text-left bg-slate-50">
                    <th className="px-2 py-1.5 font-bold">Arete</th>
                    <th className="px-2 py-1.5 font-bold text-right">Peso</th>
                    <th className="px-2 py-1.5 font-bold text-right">Dosis</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.v.id} className="border-t border-slate-100 text-slate-900">
                      <td className="px-2 py-1.5 font-black">#{r.v.tag}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.kg !== null && r.kg !== undefined ? `${num(r.kg)} kg` : '—'}
                        {(r.basis === 'promedio' || r.basis === 'estimado') && <span className="block text-xs text-amber-800">{r.basis === 'promedio' ? 'peso promedio' : 'estimado'}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{r.dose !== null ? `${num(r.dose, 1)} ${unit}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={`text-base font-black ${stockShort ? 'text-rose-700' : 'text-slate-900'}`}>
            Total a descontar: {num(total, 2)} {unit}
            {stockShort ? ` (hay ${num(item.quantity, 2)})` : ''}
          </p>
          <Field label="Vía (opcional)">
            <Chips options={ROUTES} value={route} onChange={setRoute} />
          </Field>
          {(item.withdrawalMeatDays || item.withdrawalMilkDays) ? (
            <WarnNotice>
              Retiro hasta: {meatUntil ? <strong>carne {fd(meatUntil)}</strong> : 'carne sin retiro'} · {milkUntil ? <strong>leche {fd(milkUntil)}</strong> : 'leche sin retiro'}
              {lactating.length > 0 && milkUntil && (
                <span className="block mt-1">
                  La leche de {lactating.slice(0, 5).map((v) => `#${v.tag}`).join(', ')}
                  {lactating.length > 5 ? ` y ${lactating.length - 5} más` : ''} se marcará como descarte hasta el {fd(milkUntil)}.
                </span>
              )}
            </WarnNotice>
          ) : (
            <p className="text-xs text-slate-700">Este producto no tiene días de retiro.</p>
          )}
          {perms.verCostosInsumos && item.unitCostUsd > 0 && (
            <p className="text-sm font-bold text-slate-900">
              Costo: {usd(total * item.unitCostUsd)} → Sanidad {lotName || ''} ({costUnit === 'ceba' ? 'Ceba' : costUnit === 'leche' ? 'Leche y cría' : 'General'})
            </p>
          )}
        </div>
      )}

      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>

      {perms.manejo && (
        <div className="space-y-2">
          <Toggle checked={repeat} onChange={setRepeat} label="Programar repeticiones" hint="Crea las tareas en la Agenda." />
          {repeat && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cada">
                <BigNumberInput size="md" value={every} onChange={setEvery} unit="días" ariaLabel="Cada cuántos días" />
              </Field>
              <Field label="Veces">
                <BigNumberInput size="md" value={times} onChange={setTimes} ariaLabel="Número de repeticiones" />
              </Field>
            </div>
          )}
        </div>
      )}

      {picker === 'lote' && (
        <LotPickerSheet
          selectedId={lotId}
          onClose={() => setPicker(null)}
          onPick={(x) => {
            setLotId(x || undefined);
            setPicker(null);
          }}
        />
      )}
      {confirmEl}
    </FormSheet>
  );
};
