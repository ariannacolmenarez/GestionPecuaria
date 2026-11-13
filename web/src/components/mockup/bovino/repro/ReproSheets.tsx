/**
 * B3 · Formularios de reproducción y crías:
 * Servicio (monta / IA / IATF / transferencia de embriones, con toro del hato, pajuela o embrión
 * del almacén; varias vacas para IATF),
 * Diagnóstico (FPP y secado en vivo), Parto (crías + calostro), Secado y Calostro.
 * Estados excluyentes: las vacas preñadas o secas aparecen bloqueadas y no se pueden elegir.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Baby, Package, Plus, Trash2 } from 'lucide-react';
import type { BovinoSex } from '../../../../models/bovinoModel';
import { itemBovinoCategory, normalizeTag, type BovinoAnimalView } from '../../../../models/bovinoCalc';
import { addDays, daysBetween } from '../../../../utils/dates';
import { useBovino } from '../context';
import { ItemPickerSheet, searchAnimals } from '../pickers';
import {
  AnimalRow,
  AreteInput,
  BigNumberInput,
  BlockedNotice,
  Chips,
  DateField,
  ErrorBox,
  Field,
  FormSheet,
  PickerButton,
  PrimaryBtn,
  SecondaryBtn,
  TagField,
  TextField,
  Toggle,
  WarnNotice,
  fd,
  fdy,
  num,
  toNum,
  usePaged,
  RecentChoice,
} from '../ui';
import { useStepRunner, type DomainStep } from '../kit';
import { isReproFemale, serviceEligibility } from './reproUtils';

// ---------------------------------------------------------------------------
// Selector de vacas con elegibilidad
// ---------------------------------------------------------------------------
export const CowPicker: React.FC<{
  candidates: BovinoAnimalView[];
  selected: string[];
  onChange: (ids: string[]) => void;
  multi?: boolean;
  blockReason?: (v: BovinoAnimalView) => string | null;
  subtitle?: (v: BovinoAnimalView) => string | undefined;
  rank?: (v: BovinoAnimalView) => number;
}> = ({ candidates, selected, onChange, multi, blockReason, subtitle, rank }) => {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const base = q ? searchAnimals(candidates, q, 200) : candidates;
    return [...base].sort((a, b) => {
      const ba = blockReason?.(a) ? 1 : 0;
      const bb = blockReason?.(b) ? 1 : 0;
      return ba - bb || (rank ? rank(a) - rank(b) : 0) || normalizeTag(a.tag).localeCompare(normalizeTag(b.tag), 'es', { numeric: true });
    });
  }, [candidates, q, blockReason, rank]);
  const { shown, more } = usePaged<BovinoAnimalView>(list, 30);
  const one = !multi && selected.length === 1 ? candidates.find((c) => c.id === selected[0]) : undefined;
  if (one && !q)
    return (
      <div className="space-y-2">
        <AnimalRow v={one} selectable selected onClick={() => onChange([])} subtitle="Toca para cambiar" />
      </div>
    );
  return (
    <div className="space-y-2">
      <AreteInput value={q} onChange={setQ} placeholder="Buscar arete" />
      {list.length === 0 && <p className="text-sm text-slate-800">No hay animales que coincidan.</p>}
      <ul className="space-y-2">
        {shown.map((v) => {
          const reason = blockReason?.(v) || null;
          const on = selected.includes(v.id);
          return (
            <li key={v.id}>
              <AnimalRow
                v={v}
                selectable
                selected={on}
                disabled={!!reason}
                disabledReason={reason || undefined}
                subtitle={subtitle?.(v)}
                onClick={() => {
                  if (reason) return;
                  if (multi) onChange(on ? selected.filter((x) => x !== v.id) : [...selected, v.id]);
                  else {
                    onChange(on ? [] : [v.id]);
                    setQ('');
                  }
                }}
              />
            </li>
          );
        })}
      </ul>
      {more}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------
/** Tipo de servicio en pantalla; IATF es una opción de la inseminación ("Con protocolo IATF"). */
type Metodo = 'monta' | 'ia' | 'te';
const IATF_PROTOCOLS = ['J-Synch', 'Ovsynch', 'Implante 7 d', 'Implante 8 d', 'Otro'];

export const ServicioSheet: React.FC<{ animalId?: string; onClose: () => void }> = ({ animalId, onClose }) => {
  const { index, actions, today, config, bovinoItems, members, me } = useBovino();
  const [ids, setIds] = useState<string[]>(animalId ? [animalId] : []);
  const [method, setMethodRaw] = useState<Metodo>('ia');
  const [iatf, setIatf] = useState(false);
  const isIatf = method === 'ia' && iatf;
  const domainMethod = method === 'ia' && iatf ? 'iatf' : method;
  const [bullId, setBullId] = useState<string>('');
  const [sire, setSire] = useState('');
  const [semenId, setSemenId] = useState<string | undefined>();
  const [tech, setTech] = useState(me.name || '');
  const [protocol, setProtocol] = useState('');
  const [date, setDate] = useState(today);
  const [picker, setPicker] = useState(false);
  const { error, setError, runSteps, confirmEl } = useStepRunner();

  const females = useMemo(() => index.active.filter(isReproFemale), [index]);
  const elig = useMemo(() => new Map(females.map((v) => [v.id, serviceEligibility(v, config, fd)])), [females, config]);
  const bulls = useMemo(() => index.active.filter((v) => v.sex === 'macho' && (v.category === 'toro' || v.purpose === 'reproductor')), [index]);
  const semen = useMemo(
    () => bovinoItems.filter((i) => itemBovinoCategory(i) === 'farmacia' && i.pharmacyType === (method === 'te' ? 'embrion' : 'pajuela')),
    [bovinoItems, method]
  );
  const setMethod = (m: Metodo) => {
    setMethodRaw(m);
    setSemenId(undefined);
    setSire('');
    if (m !== 'ia' && ids.length > 1) setIds(ids.slice(0, 1));
  };
  const semenItem = semenId ? semen.find((i) => i.id === semenId) : undefined;
  const warns = ids.map((id) => elig.get(id)?.warn).filter(Boolean) as string[];

  const save = () => {
    if (!ids.length) return setError('Elige la vaca o novilla.');
    if (method === 'monta' && !bullId && !sire.trim()) return setError('Elige el toro (o escribe su nombre).');
    if (method === 'ia' && !semenId && !sire.trim()) return setError('Elige la pajuela del almacén (o escribe el toro).');
    if (method === 'te' && !semenId && !sire.trim()) return setError('Elige el embrión del almacén (o escribe el embrión / donante).');
    if (semenItem && semenItem.quantity < ids.length) return setError(`Solo hay ${num(semenItem.quantity)} ${method === 'te' ? 'embrión(es)' : 'pajuela(s)'} de ${semenItem.name}.`);
    const notes = isIatf && protocol ? `Protocolo ${protocol}` : undefined;
    const steps: DomainStep[] = ids.map((id) => ({
      call: (confirm) =>
        actions.registerService({
          animalId: id,
          method: domainMethod,
          bullId: method === 'monta' && bullId ? bullId : undefined,
          semenItemId: method !== 'monta' ? semenId : undefined,
          sireLabel: sire.trim() || undefined,
          technician: method !== 'monta' ? tech.trim() || undefined : undefined,
          notes,
          date,
          confirm,
        }),
    }));
    runSteps(steps, (o) => {
      if (!o.stopped) onClose();
    });
  };

  if (picker)
    return (
      <ItemPickerSheet
        title={method === 'te' ? '¿Qué embrión?' : '¿Qué pajuela?'}
        items={semen}
        forUse
        onClose={() => setPicker(false)}
        onPick={(x) => {
          setSemenId(x);
          setPicker(false);
        }}
      />
    );

  return (
    <FormSheet
      tone="sky"
      title="Registrar servicio"
      subtitle={ids.length > 1 ? `${ids.length} vacas` : undefined}
      dirty={ids.length > 0 && !animalId}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save} disabled={!ids.length}>
            {ids.length > 1 ? `Servir ${ids.length} vacas` : 'Guardar servicio'}
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Tipo de servicio">
        <Chips<Metodo>
          size="lg"
          options={[
            { key: 'monta', label: 'Monta natural' },
            { key: 'ia', label: 'Inseminación (IA)' },
            { key: 'te', label: 'Transf. embriones' },
          ]}
          value={method}
          onChange={setMethod}
        />
      </Field>
      {method === 'ia' && (
        <Toggle
          checked={iatf}
          onChange={(x) => {
            setIatf(x);
            if (!x && ids.length > 1) setIds(ids.slice(0, 1));
          }}
          label="Con protocolo IATF"
          hint="Inseminación a tiempo fijo: permite elegir varias vacas."
        />
      )}
      <Field label={isIatf ? 'Vacas (puedes elegir varias)' : method === 'te' ? 'Receptora (vaca o novilla)' : 'Vaca o novilla'} hint="Las preñadas y secas no se pueden servir.">
        <CowPicker
          candidates={females}
          selected={ids}
          onChange={setIds}
          multi={isIatf}
          blockReason={(v) => elig.get(v.id)?.block || null}
          rank={(v) => (elig.get(v.id)?.ready ? 0 : 1)}
          subtitle={(v) => (elig.get(v.id)?.ready ? 'Lista: PEV cumplido' : elig.get(v.id)?.warn || undefined)}
        />
      </Field>
      {warns.length > 0 && (
        <WarnNotice>
          {warns.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </WarnNotice>
      )}
      {method === 'monta' ? (
        <Field label="Toro">
          {bulls.length > 0 ? (
            <Chips options={bulls.map((b) => ({ key: b.id, label: `#${b.tag}${b.animal.name ? ` ${b.animal.name}` : ''}` }))} value={bullId} onChange={(x) => setBullId(x === bullId ? '' : x)} />
          ) : (
            <p className="text-sm text-slate-800">No hay toros activos en el hato. Escribe el nombre del toro.</p>
          )}
          {!bullId && <TextField value={sire} onChange={setSire} placeholder="Toro (si no está en el hato)" />}
        </Field>
      ) : (
        <>
          <Field
            label={method === 'te' ? 'Embrión (farmacia)' : 'Pajuela (farmacia)'}
            hint={
              semen.length
                ? `Descuenta 1 ${method === 'te' ? 'embrión' : 'pajuela'} por vaca.`
                : method === 'te'
                  ? 'No hay embriones en el almacén: regístralos en Farmacia (tipo Embrión) o escribe el embrión / donante.'
                  : 'No hay pajuelas en el almacén: regístralas en Farmacia o escribe el toro.'
            }
          >
            <PickerButton
              label={method === 'te' ? 'Embrión' : 'Pajuela'}
              icon={<Package className="w-5 h-5" />}
              value={semenItem ? `${semenItem.name} · quedan ${num(semenItem.quantity)}` : undefined}
              placeholder={method === 'te' ? 'Elegir embrión' : 'Elegir pajuela'}
              onClick={() => setPicker(true)}
            />
            {!semenId && <TextField value={sire} onChange={setSire} placeholder={method === 'te' ? 'Embrión / donante × toro (texto)' : 'Toro / pajuela (texto)'} />}
          </Field>
          <Field label={method === 'te' ? 'Técnico' : 'Inseminador'}>
            <RecentChoice options={members.slice(0, 5).map((m) => m.name)} value={tech} onChange={setTech} placeholder="Nombre del inseminador" ariaLabel="Inseminador" />
          </Field>
          {isIatf && (
            <Field label="Protocolo IATF (opcional)">
              <Chips options={IATF_PROTOCOLS.map((p) => ({ key: p, label: p }))} value={protocol} onChange={(x) => setProtocol(x === protocol ? '' : x)} />
            </Field>
          )}
        </>
      )}
      <Field label="Fecha del servicio">
        <DateField value={date} onChange={setDate} />
      </Field>
      <p className="text-sm text-slate-900 bg-sky-50 border-2 border-sky-200 rounded-2xl p-3">
        Palpación sugerida: <strong>{fdy(addDays(date, config.diagnosisDaysAfterService))}</strong> ({config.diagnosisDaysAfterService} días). Aparecerá en la Agenda.
      </p>
      {confirmEl}
    </FormSheet>
  );
};

// ---------------------------------------------------------------------------
// Diagnóstico de gestación
// ---------------------------------------------------------------------------
type Resultado = 'preñada' | 'vacia' | 'dudosa';
const HALLAZGOS = ['Quiste', 'Metritis', 'Gemelar', 'Otro'];

export const DiagnosticoSheet: React.FC<{ animalId?: string; onClose: () => void }> = ({ animalId, onClose }) => {
  const { index, actions, today, config } = useBovino();
  const [ids, setIds] = useState<string[]>(animalId ? [animalId] : []);
  const [method, setMethod] = useState<'palpacion' | 'ecografia'>('palpacion');
  const [result, setResult] = useState<Resultado | null>(null);
  const [gest, setGest] = useState('');
  const [hall, setHall] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [recontrol, setRecontrol] = useState(true);
  const { error, setError, runSteps, confirmEl } = useStepRunner();

  const females = useMemo(() => index.active.filter(isReproFemale), [index]);
  const v = ids[0] ? index.views.get(ids[0]) : undefined;
  const r = v?.repro;
  const svcDate = r?.lastServiceDate && (!r.lastCalvingDate || r.lastServiceDate >= r.lastCalvingDate) ? r.lastServiceDate : undefined;
  const autoGest = svcDate ? daysBetween(svcDate, date) : null;
  const g = toNum(gest) > 0 ? toNum(gest) : autoGest;
  const conception = g ? addDays(date, -Math.round(g)) : undefined;
  const fpp = result === 'preñada' && conception ? addDays(conception, config.gestationDays) : undefined;
  const dry = fpp ? addDays(fpp, -config.dryOffDaysBeforeCalving) : undefined;
  const mismatch = autoGest !== null && toNum(gest) > 0 && Math.abs(toNum(gest) - autoGest) > 21;

  const save = () => {
    if (!v) return setError('Elige la vaca.');
    if (!result) return setError('Elige el resultado.');
    if (result === 'preñada' && !svcDate && !(toNum(gest) > 0)) return setError('No tiene servicio registrado: escribe los días de gestación estimados.');
    const notes = [hall.join(', '), note.trim()].filter(Boolean).join(' · ') || undefined;
    const steps: DomainStep[] = [
      {
        call: () =>
          actions.registerDiagnosis({
            animalId: v.id,
            method,
            result,
            gestationDays: result === 'preñada' && toNum(gest) > 0 ? Math.round(toNum(gest)) : undefined,
            notes,
            date,
          }),
      },
    ];
    if (result === 'dudosa' && recontrol) steps.push({ call: () => actions.addTask({ title: `Recontrol de preñez #${v.tag}`, date: addDays(date, 21), animalIds: [v.id], activityKind: 'diagnostico' }) });
    runSteps(steps, (o) => {
      if (!o.stopped) onClose();
    });
  };

  return (
    <FormSheet
      tone="sky"
      title="Diagnóstico de gestación"
      subtitle={v ? `#${v.tag}` : undefined}
      dirty={!!result}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save} disabled={!v || !result}>
            Guardar diagnóstico
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Vaca o novilla" hint="Primero las servidas con palpación pendiente.">
        <CowPicker
          candidates={females}
          selected={ids}
          onChange={(x) => {
            setIds(x);
            setGest('');
          }}
          rank={(x) => (x.repro?.pendingDiagnosis ? (x.repro.diagnosisDueDate && x.repro.diagnosisDueDate <= today ? 0 : 1) : 2)}
          subtitle={(x) => (x.repro?.pendingDiagnosis ? `Servida el ${fd(x.repro.lastServiceDate)} · palpar ${fd(x.repro.diagnosisDueDate)}` : x.repro?.pregnant ? `Preñada · FPP ${fd(x.repro.fpp)}` : undefined)}
        />
      </Field>
      <Field label="Método">
        <Chips
          options={[
            { key: 'palpacion', label: 'Palpación' },
            { key: 'ecografia', label: 'Ecografía' },
          ]}
          value={method}
          onChange={setMethod}
        />
      </Field>
      <Field label="Resultado">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Resultado">
          {(
            [
              ['preñada', 'Preñada', 'bg-emerald-600 border-emerald-600 text-white'],
              ['vacia', 'Vacía', 'bg-slate-700 border-slate-700 text-white'],
              ['dudosa', 'Dudosa', 'bg-amber-400 border-amber-400 text-slate-900'],
            ] as [Resultado, string, string][]
          ).map(([k, label, on]) => (
            <button key={k} type="button" role="radio" aria-checked={result === k} onClick={() => setResult(k)} className={`h-16 rounded-2xl border-2 text-base font-black ${result === k ? on : 'bg-white border-slate-300 text-slate-900'}`}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      {result === 'preñada' && (
        <>
          <Field label="Días de gestación" hint={svcDate ? `Desde el último servicio (${fd(svcDate)}): ${autoGest} días. Déjalo vacío para usar el servicio.` : 'Sin servicio registrado: obligatorio.'}>
            <BigNumberInput value={gest} onChange={setGest} unit="días" placeholder={autoGest !== null ? String(autoGest) : '0'} ariaLabel="Días de gestación" />
          </Field>
          {mismatch && <WarnNotice>Los días no coinciden con el último servicio ({autoGest} días). Se usará lo que escribiste.</WarnNotice>}
          {fpp && (
            <div className="rounded-2xl bg-sky-50 border-2 border-sky-300 p-4">
              <p className="text-xl font-black text-sky-950">FPP {fdy(fpp)}</p>
              <p className="text-xl font-black text-amber-900">Secar {fdy(dry)}</p>
            </div>
          )}
        </>
      )}
      {result === 'dudosa' && <Toggle checked={recontrol} onChange={setRecontrol} label="Programar recontrol en 21 días" hint="Crea la tarea en la Agenda." />}
      <Field label="Hallazgos">
        <div className="flex flex-wrap gap-2">
          {HALLAZGOS.map((h) => {
            const on = hall.includes(h);
            return (
              <button key={h} type="button" aria-pressed={on} onClick={() => setHall(on ? hall.filter((x) => x !== h) : [...hall, h])} className={`h-12 px-4 rounded-2xl border-2 text-sm font-bold ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                {h}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Nota (opcional)">
        <TextField value={note} onChange={setNote} placeholder="Observaciones" maxLength={140} />
      </Field>
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      {confirmEl}
    </FormSheet>
  );
};

// ---------------------------------------------------------------------------
// Parto y crías (con calostro)
// ---------------------------------------------------------------------------
type Evento = 'nacimiento' | 'aborto' | 'mortinato';
interface CalfForm {
  key: string;
  sex: BovinoSex;
  weight: string;
  tag: string;
  alive: boolean;
  colostrum: boolean;
  hours: string;
  liters: string;
  method: 'mamada' | 'tetero' | 'sonda';
}
const newCalf = (n: number): CalfForm => ({ key: `c${n}-${Date.now()}`, sex: 'hembra', weight: '', tag: '', alive: true, colostrum: true, hours: '2', liters: '', method: 'mamada' });

export const PartoSheet: React.FC<{ animalId?: string; onClose: () => void }> = ({ animalId, onClose }) => {
  const { index, actions, today, perms } = useBovino();
  const [ids, setIds] = useState<string[]>(animalId ? [animalId] : []);
  const [evento, setEvento] = useState<Evento>('nacimiento');
  const [distocico, setDistocico] = useState(false);
  const [cesarea, setCesarea] = useState(false);
  const [calves, setCalves] = useState<CalfForm[]>([newCalf(1)]);
  const [date, setDate] = useState(today);
  const calfIds = useRef<string[]>([]);
  const { error, setError, runSteps, confirmEl } = useStepRunner();

  const females = useMemo(() => index.active.filter(isReproFemale), [index]);
  const v = ids[0] ? index.views.get(ids[0]) : undefined;
  const setCalf = (i: number, patch: Partial<CalfForm>) => setCalves((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const save = () => {
    if (!v) return setError('Elige la vaca que parió.');
    if (evento !== 'aborto' && !calves.length) return setError('Agrega al menos una cría.');
    const list = evento === 'aborto' ? [] : calves;
    for (const c of list) {
      const w = toNum(c.weight);
      if (c.weight && !(w > 0)) return setError('Revisa el peso de las crías.');
    }
    const alive = evento === 'nacimiento' ? list.filter((c) => c.alive) : [];
    const steps: DomainStep[] = [
      {
        call: (confirm) =>
          actions.registerCalving({
            motherId: v.id,
            difficulty: evento === 'aborto' ? 'aborto' : cesarea ? 'cesarea' : distocico ? 'asistido' : 'normal',
            calves: list.map((c) => ({ sex: c.sex, weightKg: toNum(c.weight) > 0 ? toNum(c.weight) : undefined, alive: evento === 'mortinato' ? false : c.alive, tag: c.tag.trim() || undefined })),
            notes: evento === 'mortinato' ? 'Mortinato' : undefined,
            date,
            confirm,
          }),
        onOk: (res) => {
          calfIds.current = (res.meta?.calfIds as string[]) || [];
        },
      },
    ];
    alive.forEach((c, i) => {
      if (!c.colostrum) return;
      steps.push({
        call: () => {
          const id = calfIds.current[i];
          if (!id) return { ok: false, error: 'No se encontró la cría para registrar el calostro.' };
          return actions.registerColostrum({ animalId: id, hoursAfterBirth: Math.max(0, toNum(c.hours) || 0), liters: toNum(c.liters) > 0 ? toNum(c.liters) : undefined, method: c.method, date });
        },
      });
    });
    runSteps(steps, (o) => {
      if (!o.stopped) onClose();
    });
  };

  return (
    <FormSheet
      tone="sky"
      title="Registrar parto"
      subtitle={v ? `#${v.tag}` : undefined}
      dirty={!!v && !animalId}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save} disabled={!v}>
            <Baby className="w-5 h-5" /> Guardar parto
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Vaca" hint="Primero las preñadas, por fecha probable de parto.">
        <CowPicker
          candidates={females}
          selected={ids}
          onChange={setIds}
          rank={(x) => (x.repro?.pregnant && x.repro.fpp ? daysBetween(today, x.repro.fpp) : 9999)}
          subtitle={(x) => (x.repro?.pregnant ? `Preñada · FPP ${fd(x.repro.fpp)}` : 'Sin preñez registrada')}
        />
      </Field>
      {v && !v.repro?.pregnant && <WarnNotice>#{v.tag} no tiene preñez registrada. Se puede registrar (pudo venir preñada de otra finca); se pedirá confirmación.</WarnNotice>}
      <Field label="Evento">
        <Chips<Evento>
          size="lg"
          options={[
            { key: 'nacimiento', label: 'Nacimiento' },
            { key: 'aborto', label: 'Aborto' },
            { key: 'mortinato', label: 'Mortinato' },
          ]}
          value={evento}
          onChange={setEvento}
        />
      </Field>
      {evento === 'nacimiento' && (
        <div className="space-y-1">
          <Toggle checked={distocico} onChange={setDistocico} label="Parto distócico (asistido)" />
          <Toggle checked={cesarea} onChange={setCesarea} label="Cesárea" />
        </div>
      )}
      <Field label="Fecha del parto">
        <DateField value={date} onChange={setDate} />
      </Field>

      {evento !== 'aborto' &&
        calves.map((c, i) => (
          <div key={c.key} className="rounded-2xl border-2 border-slate-200 bg-white p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-base font-black text-slate-900">{calves.length > 1 ? `Cría ${i + 1}` : 'Cría'}</p>
              {calves.length > 1 && (
                <button type="button" aria-label="Quitar cría" onClick={() => setCalves((cs) => cs.filter((_, j) => j !== i))} className="w-11 h-11 rounded-xl flex items-center justify-center text-rose-700">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <Chips<BovinoSex>
              options={[
                { key: 'hembra', label: 'Hembra ♀' },
                { key: 'macho', label: 'Macho ♂' },
              ]}
              value={c.sex}
              onChange={(sex) => setCalf(i, { sex })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Peso al nacer">
                <BigNumberInput size="md" decimal unit="kg" value={c.weight} onChange={(weight) => setCalf(i, { weight })} ariaLabel="Peso al nacer" />
              </Field>
              <Field label="Arete (opcional)">
                <TagField value={c.tag} onChange={(tag) => setCalf(i, { tag })} placeholder="Se asigna después" ariaLabel={`Arete de la cría ${i + 1}`} />
              </Field>
            </div>
            {toNum(c.weight) > 60 && <WarnNotice>¿{c.weight} kg al nacer? Es más de lo normal.</WarnNotice>}
            {evento === 'nacimiento' && <Toggle checked={c.alive} onChange={(alive) => setCalf(i, { alive })} label="Nació viva" />}
            {evento === 'nacimiento' && c.alive && (
              <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 space-y-2">
                <Toggle checked={c.colostrum} onChange={(colostrum) => setCalf(i, { colostrum })} label="¿Tomó calostro?" hint="Si no se registra, la Agenda avisa con urgencia." />
                {c.colostrum && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Horas de vida">
                        <BigNumberInput size="md" decimal unit="h" value={c.hours} onChange={(hours) => setCalf(i, { hours })} ariaLabel="Horas de vida" />
                      </Field>
                      <Field label="Litros">
                        <BigNumberInput size="md" decimal unit="L" value={c.liters} onChange={(liters) => setCalf(i, { liters })} ariaLabel="Litros de calostro" />
                      </Field>
                    </div>
                    <Chips
                      options={[
                        { key: 'mamada', label: 'Mamó' },
                        { key: 'tetero', label: 'Biberón' },
                        { key: 'sonda', label: 'Sonda' },
                      ]}
                      value={c.method}
                      onChange={(method) => setCalf(i, { method })}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      {evento !== 'aborto' && calves.length < 3 && (
        <SecondaryBtn className="w-full" onClick={() => setCalves((cs) => [...cs, newCalf(cs.length + 1)])}>
          <Plus className="w-4 h-4" /> Gemelo
        </SecondaryBtn>
      )}
      <p className="text-xs text-slate-700">
        Cada cría viva se crea como animal (categoría Cría, madre #{v?.tag || '—'}, lote de la madre). Sin arete se asigna uno automático.
        {perms.reproduccion ? ' La vaca pasa a En ordeño y empieza a correr su PEV.' : ''}
      </p>
      {confirmEl}
    </FormSheet>
  );
};

// ---------------------------------------------------------------------------
// Secado (con tratamiento de secado opcional de la farmacia)
// ---------------------------------------------------------------------------
export const SecadoSheet: React.FC<{ animalId: string; onClose: () => void }> = ({ animalId, onClose }) => {
  const { index, actions, today, bovinoItems, perms } = useBovino();
  const v = index.views.get(animalId);
  const [date, setDate] = useState(today);
  const [itemId, setItemId] = useState<string | undefined>();
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const { error, setError, runSteps, confirmEl } = useStepRunner();
  const pharmacy = useMemo(() => bovinoItems.filter((i) => itemBovinoCategory(i) === 'farmacia' && i.pharmacyType !== 'pajuela' && i.pharmacyType !== 'embrion' && i.pharmacyType !== 'material'), [bovinoItems]);
  const item = itemId ? pharmacy.find((i) => i.id === itemId) : undefined;
  if (!v) return null;
  const save = () => {
    const steps: DomainStep[] = [{ call: (confirm) => actions.registerDryOff({ animalId, date, treatment: item ? item.name : text.trim() || undefined, confirm }) }];
    if (item && perms.sanidad) steps.push({ call: (confirm) => actions.applyTreatment({ animalIds: [animalId], itemId: item.id, purpose: 'preventivo', route: 'intramamaria', diagnosis: 'Secado', date, confirm }) });
    runSteps(steps, (o) => {
      if (!o.stopped) onClose();
    });
  };
  if (picker)
    return (
      <ItemPickerSheet
        title="Tratamiento de secado"
        items={pharmacy}
        forUse
        onClose={() => setPicker(false)}
        onPick={(x) => {
          setItemId(x);
          setPicker(false);
        }}
      />
    );
  return (
    <FormSheet
      tone="sky"
      title={`Secar #${v.tag}`}
      subtitle={v.repro?.fpp ? `Parto probable ${fd(v.repro.fpp)}` : undefined}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            Registrar secado
          </PrimaryBtn>
        </div>
      }
    >
      {!v.repro?.lactating && <BlockedNotice title={`#${v.tag} no está en ordeño`}>Solo se secan vacas en lactancia.</BlockedNotice>}
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Tratamiento de secado (opcional)" hint={item ? `Aplica el retiro de leche${item.withdrawalMilkDays ? ` (${item.withdrawalMilkDays} d)` : ''} y descuenta del almacén.` : 'Elige el producto de la farmacia (intramamario).'}>
        {perms.sanidad ? (
          <PickerButton label="Producto" icon={<Package className="w-5 h-5" />} value={item ? `${item.name}${item.mfgLot ? ` · lote ${item.mfgLot}` : ''}` : undefined} placeholder="Elegir de la farmacia" onClick={() => setPicker(true)} />
        ) : null}
        {!item && <TextField value={text} onChange={setText} placeholder="O escribe el tratamiento" />}
      </Field>
      <p className="text-sm text-slate-800">La vaca pasa a Seca y deja de aparecer en el ordeño hasta su próximo parto.</p>
      {confirmEl}
    </FormSheet>
  );
};

// ---------------------------------------------------------------------------
// Calostro de una cría (desde la agenda o la lista de partos)
// ---------------------------------------------------------------------------
export const CalostroSheet: React.FC<{ animalId: string; onClose: () => void }> = ({ animalId, onClose }) => {
  const { index, actions, today } = useBovino();
  const v = index.views.get(animalId);
  const [hours, setHours] = useState(() => (v?.ageDays !== null && v?.ageDays !== undefined ? String(Math.max(1, v.ageDays * 24)) : '2'));
  const [liters, setLiters] = useState('');
  const [method, setMethod] = useState<'mamada' | 'tetero' | 'sonda'>('mamada');
  const { error, setError, runSteps, confirmEl } = useStepRunner();
  if (!v) return null;
  const save = () => {
    if (!(toNum(hours) >= 0)) return setError('Escribe las horas de vida.');
    runSteps([{ call: () => actions.registerColostrum({ animalId, hoursAfterBirth: toNum(hours), liters: toNum(liters) > 0 ? toNum(liters) : undefined, method, date: today }) }], (o) => {
      if (!o.stopped) onClose();
    });
  };
  return (
    <FormSheet
      tone="sky"
      title={`Calostro · #${v.tag}`}
      question="¿Cuándo tomó calostro?"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            Guardar calostro
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Horas de vida al tomarlo">
        <BigNumberInput decimal unit="h" value={hours} onChange={setHours} ariaLabel="Horas de vida" />
      </Field>
      {toNum(hours) > 6 && <WarnNotice>Lo ideal es dentro de las primeras 6 horas de vida.</WarnNotice>}
      <Field label="Litros (opcional)">
        <BigNumberInput decimal unit="L" value={liters} onChange={setLiters} ariaLabel="Litros" />
      </Field>
      <Field label="Cómo">
        <Chips
          options={[
            { key: 'mamada', label: 'Mamó' },
            { key: 'tetero', label: 'Biberón' },
            { key: 'sonda', label: 'Sonda' },
          ]}
          value={method}
          onChange={setMethod}
        />
      </Field>
      {confirmEl}
    </FormSheet>
  );
};
