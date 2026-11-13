/** A8 · Sanidad: retiros activos, aplicar tratamiento, programados, historial clínico y por evaluar. */
import React, { useMemo, useState } from 'react';
import { Stethoscope, Syringe, Timer } from 'lucide-react';
import type { BovinoTreatmentEvent } from '../../../../models/bovinoModel';
import { isBovinoTask } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { TreatmentsList } from '../animales/AnimalFicha';
import { AgendaItemRow } from '../agenda/AgendaItemRow';
import { BottomSheet, ChipFilter, EmptyBlock, ErrorBox, FOCUS_B, PrimaryBtn, Screen, StatusChip, TextField, Chips, fd, useDomainRunner } from '../ui';
import { SegmentedTabs } from '../../avicola/shared';

type Tab = 'programados' | 'historial' | 'evaluar';

export const SanidadHub: React.FC = () => {
  const { index, data, tasks, today, perms, openSheet, navigate } = useBovino();
  const [tab, setTab] = useState<Tab>('programados');
  const [purpose, setPurpose] = useState<'todos' | 'preventivo' | 'curativo'>('todos');
  const retiros = useMemo(() => index.active.filter((v) => v.withdrawal.meatActive || v.withdrawal.milkActive), [index]);
  const treatments = useMemo(() => data.events.filter((e) => e.kind === 'tratamiento') as BovinoTreatmentEvent[], [data.events]);
  const pending = useMemo(() => treatments.filter((t) => t.effectiveness === 'pendiente'), [treatments]);
  const programmed = useMemo(
    () =>
      tasks
        .filter((t) => isBovinoTask(t) && (t.status === 'pendiente' || t.status === 'retrasada'))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => ({
          id: `tarea:${t.id}`,
          kind: 'tarea' as const,
          priority: t.date < today ? ('alta' as const) : ('media' as const),
          date: t.date,
          overdue: t.date < today,
          title: t.title,
          detail: `${t.targetAnimal || t.targetGroup}${t.medicamentUsed ? ` · ${t.medicamentUsed}` : ''}`,
          animalId: t.animalId,
          lotId: t.loteId,
          taskId: t.id,
          manga: true,
        })),
    [tasks, today]
  );
  const hist = purpose === 'todos' ? treatments : treatments.filter((t) => t.purpose === purpose);

  return (
    <Screen>
      {retiros.length > 0 && (
        <section className="rounded-2xl bg-rose-50 border-2 border-rose-300 p-4 space-y-2">
          <p className="text-base font-black text-rose-900 flex items-center gap-2">
            <Timer className="w-5 h-5" /> Retiros activos ({retiros.length})
          </p>
          <ul className="space-y-2">
            {retiros.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => navigate({ s: 'animal', id: v.id }, 'hato')} className={`w-full min-h-14 p-3 rounded-xl bg-white border border-rose-200 flex items-center gap-3 text-left ${FOCUS_B}`}>
                  <span className="text-lg font-black tabular-nums text-slate-900">#{v.tag}</span>
                  <span className="flex-1 min-w-0 text-xs text-slate-800 truncate">{v.withdrawal.products.join(', ') || 'Tratamiento'}</span>
                  <span className="flex flex-col items-end gap-1">
                    {v.withdrawal.meatActive && <StatusChip tone="retiro">{`Carne ${v.withdrawal.meatDaysLeft} d · ${fd(v.withdrawal.meatUntil)}`}</StatusChip>}
                    {v.withdrawal.milkActive && <StatusChip tone="retiro">{`Leche ${v.withdrawal.milkDaysLeft} d · ${fd(v.withdrawal.milkUntil)}`}</StatusChip>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {perms.sanidad && (
        <PrimaryBtn className="w-full" onClick={() => openSheet({ kind: 'tratamiento' })}>
          <Syringe className="w-5 h-5" /> Aplicar tratamiento
        </PrimaryBtn>
      )}

      <SegmentedTabs
        tabs={[
          { id: 'programados', label: `Programados (${programmed.length})` },
          { id: 'historial', label: 'Historial' },
          { id: 'evaluar', label: `Evaluar (${pending.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'programados' && (
        <section className="space-y-2">
          {perms.manejo && (
            <button type="button" onClick={() => openSheet({ kind: 'actividad' })} className={`w-full h-12 rounded-2xl border-2 border-dashed border-slate-400 text-slate-900 font-bold ${FOCUS_B}`}>
              + Programar actividad
            </button>
          )}
          {programmed.length === 0 ? (
            <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">Sin tratamientos programados.</p>
          ) : (
            programmed.map((a) => <AgendaItemRow key={a.id} item={a} />)
          )}
        </section>
      )}

      {tab === 'historial' &&
        (treatments.length === 0 ? (
          <EmptyBlock
            icon={<Stethoscope className="w-8 h-8" />}
            title="Sin tratamientos registrados"
            text="Al aplicar un medicamento se descuenta de la farmacia y se controla su retiro."
            cta={perms.sanidad ? 'Aplicar tratamiento' : undefined}
            onCta={() => openSheet({ kind: 'tratamiento' })}
          />
        ) : (
          <section className="space-y-2">
            <ChipFilter options={[{ key: 'todos', label: 'Todos' }, { key: 'preventivo', label: 'Preventivos' }, { key: 'curativo', label: 'Curativos' }]} value={purpose} onChange={setPurpose} ariaLabel="Tipo" />
            <TreatmentsList events={hist} />
          </section>
        ))}

      {tab === 'evaluar' && (pending.length === 0 ? <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">No hay tratamientos curativos por evaluar.</p> : <TreatmentsList events={pending} />)}
    </Screen>
  );
};

/** Evaluar la efectividad de un tratamiento curativo. "Murió" abre la baja. */
export const EvaluarSheet: React.FC<{ eventId: string; onClose: () => void }> = ({ eventId, onClose }) => {
  const { data, index, actions, openSheet } = useBovino();
  const ev = data.events.find((e) => e.id === eventId) as BovinoTreatmentEvent | undefined;
  const [res, setRes] = useState<'efectivo' | 'parcial' | 'no_efectivo' | 'murio' | undefined>(undefined);
  const [note, setNote] = useState('');
  const { error, run, confirmEl } = useDomainRunner();
  if (!ev) return null;
  const v = ev.animalId ? index.views.get(ev.animalId) : undefined;
  const save = () => {
    if (!res) return;
    if (res === 'murio') {
      run(
        () => actions.updateTreatmentOutcome({ eventId, effectiveness: 'no_efectivo', notes: ['Murió', note.trim()].filter(Boolean).join(' · ') }),
        () => {
          onClose();
          if (ev.animalId) openSheet({ kind: 'baja', animalId: ev.animalId });
        }
      );
      return;
    }
    run(() => actions.updateTreatmentOutcome({ eventId, effectiveness: res, notes: note.trim() || undefined }), () => onClose());
  };
  return (
    <BottomSheet
      title={`Evaluar ${ev.productName}`}
      subtitle={`${v ? `#${v.tag} · ` : ''}${fd(ev.date)}${ev.diagnosis ? ` · ${ev.diagnosis}` : ''}`}
      icon={<Stethoscope className="w-5 h-5" />}
      iconClass="bg-sky-100 text-sky-700"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" disabled={!res} onClick={save}>
            Guardar evaluación
          </PrimaryBtn>
        </div>
      }
    >
      <Chips
        size="lg"
        options={[
          { key: 'efectivo', label: 'Curado' },
          { key: 'parcial', label: 'Mejoró' },
          { key: 'no_efectivo', label: 'Sin respuesta' },
          { key: 'murio', label: 'Murió' },
        ]}
        value={res}
        onChange={setRes}
      />
      <TextField value={note} onChange={setNote} maxLength={160} placeholder="Nota (opcional)" />
      {confirmEl}
    </BottomSheet>
  );
};

