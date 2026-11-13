/**
 * ============================================================================
 * B4 · MODO MANGA (pantalla completa, alto contraste, botones enormes)
 * ============================================================================
 * 1. Preparación: qué se hace hoy (pesar, tratamientos del día, un producto para todos,
 *    palpación) y el grupo (lote, todo el hato o la lista de la agenda).
 * 2. Captura en bucle: teclado propio → arete → SOLO las acciones del día para ese animal
 *    (mangaLookup) con la dosis calculada con el peso recién digitado (o el último).
 *    "Guardar y siguiente" escribe sus eventos en ese momento (no se acumula al final).
 * 3. Resumen: trabajados, pesados (GMD prom.), tratamientos por producto y pendientes.
 * Permisos: el operario pesa; los tratamientos y la palpación los registra el encargado.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Check, Delete, List, Scale, Stethoscope, Syringe, X } from 'lucide-react';
import type { SanitaryTask, WarehouseItem } from '../../../../models/FarmModel';
import type { BovinoTreatmentEvent } from '../../../../models/bovinoModel';
import { autoDose, gmdColorOf, itemBovinoCategory, normalizeTag, type BovinoAnimalView } from '../../../../models/bovinoCalc';
import { daysBetween } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { ItemPickerSheet, itemBlockReason } from '../pickers';
import { BlockedNotice, BottomSheet, ConfirmDialog, ErrorBox, FOCUS_B, GmdChip, Overlay, ReproChip, StatusChip, fd, num, toNum, useEscape } from '../ui';
import { useStepRunner, type DomainStep } from '../kit';

type Grupo = 'lote' | 'hato' | 'agenda';
type Phase = 'setup' | 'captura' | 'resumen';
type Target = 'tag' | 'peso';

interface Worked {
  id: string;
  tag: string;
  kg?: number;
  gmd?: number | null;
  treatments: { name: string; qty: number; unit: string }[];
  diag?: string;
}

interface TreatPlan {
  key: string;
  item: WarehouseItem;
  task?: SanitaryTask;
  label: string;
}

const BIG = 'h-16 rounded-2xl text-xl font-black';

// ---------------------------------------------------------------------------
// Teclado en pantalla (no tapa la pantalla como el del sistema)
// ---------------------------------------------------------------------------
const Keypad: React.FC<{ onKey: (k: string) => void; decimal: boolean; okLabel: string; okDisabled?: boolean }> = ({ onKey, decimal, okLabel, okDisabled }) => (
  <div className="space-y-2">
    <div className="grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
        <button key={k} type="button" onClick={() => onKey(k)} className={`h-16 rounded-2xl bg-slate-100 text-3xl font-black text-slate-950 active:bg-sky-200 ${FOCUS_B}`}>
          {k}
        </button>
      ))}
      <button type="button" disabled={!decimal} onClick={() => onKey(',')} aria-label="Coma decimal" className={`h-16 rounded-2xl bg-slate-100 text-3xl font-black text-slate-950 active:bg-sky-200 disabled:opacity-30 ${FOCUS_B}`}>
        ,
      </button>
      <button type="button" onClick={() => onKey('0')} className={`h-16 rounded-2xl bg-slate-100 text-3xl font-black text-slate-950 active:bg-sky-200 ${FOCUS_B}`}>
        0
      </button>
      <button type="button" onClick={() => onKey('del')} aria-label="Borrar" className={`h-16 rounded-2xl bg-slate-200 text-slate-950 flex items-center justify-center active:bg-sky-200 ${FOCUS_B}`}>
        <Delete className="w-8 h-8" />
      </button>
    </div>
    <button type="button" disabled={okDisabled} onClick={() => onKey('ok')} className={`w-full ${BIG} bg-slate-900 text-white disabled:opacity-40 ${FOCUS_B}`}>
      {okLabel}
    </button>
  </div>
);

const Big: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode; tone?: 'sky' | 'emerald' | 'slate' | 'amber' }> = ({ on, onClick, children, tone = 'sky' }) => {
  const onCls = tone === 'emerald' ? 'bg-emerald-600 border-emerald-600 text-white' : tone === 'amber' ? 'bg-amber-400 border-amber-400 text-slate-950' : tone === 'slate' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-sky-600 border-sky-600 text-white';
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-16 px-4 rounded-2xl border-2 text-left text-lg font-black ${on ? onCls : 'bg-white border-slate-400 text-slate-950'} ${FOCUS_B}`}>
      {children}
    </button>
  );
};

export default function ModoManga({ screen }: StageBProps) {
  const sc = screen.s === 'manga' ? screen : undefined;
  const { index, data, agenda, tasks, bovinoItems, selectors, actions, perms, today, back } = useBovino();

  // ---- Preparación ----
  const agendaManga = useMemo(() => agenda.filter((a) => a.manga && a.date <= today), [agenda, today]);
  const dayTasks = useMemo(() => agendaManga.filter((a) => a.kind === 'tarea' && a.taskId), [agendaManga]);
  const cebaLot = data.lots.find((l) => l.status === 'abierto' && l.type === 'ceba');
  const [phase, setPhase] = useState<Phase>('setup');
  const [pesar, setPesar] = useState<boolean>(!!cebaLot || agendaManga.some((a) => a.kind === 'pesaje_atrasado') || !dayTasks.length);
  const [tratDia, setTratDia] = useState<boolean>(dayTasks.length > 0);
  const [palpar, setPalpar] = useState<boolean>(perms.reproduccion && agendaManga.some((a) => a.kind === 'palpar'));
  const [todosItemId, setTodosItemId] = useState<string | undefined>();
  const [grupo, setGrupo] = useState<Grupo>(sc?.agenda ? 'agenda' : sc?.lotId || cebaLot ? 'lote' : 'hato');
  const [lotId, setLotId] = useState<string | undefined>(sc?.lotId || cebaLot?.id || data.lots.find((l) => l.status === 'abierto')?.id);
  const [picker, setPicker] = useState(false);
  const pharmacy = useMemo(() => bovinoItems.filter((i) => itemBovinoCategory(i) === 'farmacia' && i.pharmacyType !== 'pajuela' && i.pharmacyType !== 'embrion' && i.pharmacyType !== 'material'), [bovinoItems]);
  const todosItem = todosItemId ? pharmacy.find((i) => i.id === todosItemId) : undefined;

  const groupIds = useMemo(() => {
    if (grupo === 'lote') return index.active.filter((v) => v.lotId === lotId).map((v) => v.id);
    if (grupo === 'hato') return index.active.map((v) => v.id);
    const ids = new Set<string>();
    agendaManga.forEach((a) => {
      if (a.animalId) ids.add(a.animalId);
      else if (a.lotId) index.active.filter((v) => v.lotId === a.lotId).forEach((v) => ids.add(v.id));
    });
    return [...ids];
  }, [grupo, lotId, index, agendaManga]);

  // ---- Captura ----
  const [typed, setTyped] = useState('');
  const [target, setTarget] = useState<Target>('tag');
  const [curId, setCurId] = useState<string | null>(null);
  const [kg, setKg] = useState('');
  const [forceWeigh, setForceWeigh] = useState(false);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [doneKeys, setDoneKeys] = useState<string[]>([]);
  const [diag, setDiag] = useState<'preñada' | 'vacia' | 'dudosa' | null>(null);
  const [worked, setWorked] = useState<Worked[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [askExit, setAskExit] = useState(false);
  const partial = useRef<Worked | null>(null);
  const { error, setError, runSteps, confirmEl } = useStepRunner();

  const cur: BovinoAnimalView | undefined = curId ? index.views.get(curId) : undefined;
  const look = useMemo(() => (cur ? selectors.manga(cur.tag) : null), [cur, selectors]);
  const w = toNum(kg);
  const weightForDose = w > 0 ? w : cur?.weightKg ?? null;
  const gmdLive = cur && w > 0 && cur.weightKg !== null && cur.weightDate ? (daysBetween(cur.weightDate, today) > 0 ? (w - cur.weightKg) / daysBetween(cur.weightDate, today) : null) : null;

  const treatedToday = (taskId: string, animalId: string) =>
    (index.eventsByAnimal.get(animalId) || []).some((e) => e.kind === 'tratamiento' && e.date === today && (e as BovinoTreatmentEvent).taskId === taskId);

  const plans: TreatPlan[] = useMemo(() => {
    if (!cur || !look) return [];
    const out: TreatPlan[] = [];
    if (tratDia)
      look.actions.forEach((a) => {
        if (a.agenda.kind !== 'tarea' || !a.task || !a.item || treatedToday(a.task.id, cur.id)) return;
        out.push({ key: `t:${a.task.id}`, item: a.item, task: a.task, label: a.task.title });
      });
    if (todosItem && !out.some((p) => p.item.id === todosItem.id)) out.push({ key: `all:${todosItem.id}`, item: todosItem, label: 'Para todos los que pasan' });
    return out.filter((p) => !doneKeys.includes(p.key));
  }, [cur, look, tratDia, todosItem, doneKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const palpAction = !!look && palpar && perms.reproduccion && look.actions.some((a) => a.agenda.kind === 'palpar');
  const infoActions = look ? look.actions.filter((a) => !['tarea', 'palpar', 'pesaje_atrasado'].includes(a.agenda.kind)) : [];
  const showWeigh = !!cur && (pesar || forceWeigh);
  const nothing = !!cur && !showWeigh && !plans.length && !palpAction;

  const matches = useMemo(() => {
    const t = normalizeTag(typed);
    if (!t) return [];
    const exact = index.byTag.get(t);
    const starts = index.active.filter((v) => normalizeTag(v.tag).startsWith(t) && v.id !== exact?.id).slice(0, 5);
    return exact && exact.active ? [exact, ...starts] : starts;
  }, [typed, index]);

  const resetAnimal = () => {
    setCurId(null);
    setKg('');
    setTyped('');
    setTarget('tag');
    setForceWeigh(false);
    setApplied({});
    setDoneKeys([]);
    setDiag(null);
    setError(null);
    partial.current = null;
  };
  const load = (v: BovinoAnimalView) => {
    resetAnimal();
    setCurId(v.id);
    setTarget('peso');
  };

  const onKey = (k: string) => {
    const field = target === 'tag' ? typed : kg;
    const set = target === 'tag' ? setTyped : setKg;
    if (k === 'del') return set(field.slice(0, -1));
    if (k === 'ok') {
      if (target === 'tag') {
        if (matches.length === 1 || (matches[0] && normalizeTag(matches[0].tag) === normalizeTag(typed))) load(matches[0]);
        else if (!matches.length && typed) setError(`No hay un animal activo con el arete ${typed}.`);
        return;
      }
      return saveNext();
    }
    if (k === ',' && (target === 'tag' || field.includes(','))) return;
    if (field.length >= 7) return;
    set(field + k);
    if (target === 'tag') setError(null);
  };

  const saveNext = () => {
    if (!cur) return;
    const v = cur;
    const rec: Worked = partial.current || { id: v.id, tag: v.tag, treatments: [] };
    partial.current = rec;
    const steps: DomainStep[] = [];
    if (showWeigh && w > 0)
      steps.push({
        call: (confirm) => actions.registerWeighings({ items: [{ animalId: v.id, weightKg: w }], date: today, confirm }),
        onOk: (res) => {
          const r = (res.meta?.results as { gmdKg: number | null }[] | undefined)?.[0];
          rec.kg = w;
          rec.gmd = r ? r.gmdKg : null;
          setKg('');
        },
      });
    if (perms.sanidad)
      plans
        .filter((p) => applied[p.key])
        .forEach((p) => {
          const dose = autoDose(p.item, weightForDose);
          const individual = p.task && !p.task.loteId && (p.task.animalId === v.id || (p.task.animalIds && p.task.animalIds.length === 1 && p.task.animalIds[0] === v.id));
          steps.push({
            call: (confirm) =>
              individual && p.task
                ? actions.completeTask({ taskId: p.task.id, itemId: p.item.id, dose: dose?.dose, date: today, confirm })
                : actions.applyTreatment({ animalIds: [v.id], itemId: p.item.id, dose: dose?.dose, purpose: 'preventivo', taskId: p.task?.id, date: today, confirm }),
            onOk: () => {
              rec.treatments.push({ name: p.item.name, qty: dose?.dose || 0, unit: dose?.unit || p.item.unit });
              setDoneKeys((d) => [...d, p.key]);
            },
          });
        });
    if (palpAction && diag)
      steps.push({
        call: () => actions.registerDiagnosis({ animalId: v.id, method: 'palpacion', result: diag, date: today }),
        onOk: () => {
          rec.diag = diag === 'preñada' ? 'Preñada' : diag === 'vacia' ? 'Vacía' : 'Dudosa';
          setDiag(null);
        },
      });
    if (!steps.length) {
      if (showWeigh && !(w > 0) && !plans.some((p) => applied[p.key])) return setError('Escribe el peso o toca "Saltar".');
      setWorked((x) => [...x.filter((y) => y.id !== v.id), rec]);
      resetAnimal();
      return;
    }
    runSteps(steps, (o) => {
      if (o.saved > 0) setWorked((x) => [...x.filter((y) => y.id !== v.id), rec]);
      if (!o.stopped) {
        actions.notify(`#${v.tag} guardado`);
        resetAnimal();
      }
    });
  };

  const skip = () => {
    if (cur && !worked.some((x) => x.id === cur.id)) setSkipped((s) => [...new Set([...s, cur.id])]);
    resetAnimal();
  };

  const requestExit = () => {
    if (phase === 'captura' && worked.length) setAskExit(true);
    else if (phase === 'captura') setPhase('setup');
    else back();
  };
  useEscape(requestExit);

  const pending = groupIds.filter((id) => !worked.some((x) => x.id === id));

  // ===================== RENDER =====================
  let body: React.ReactNode;
  if (phase === 'setup') {
    body = (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h2 className="text-2xl font-black text-slate-950">¿Qué vas a hacer hoy en la manga?</h2>
        <div className="grid gap-2">
          <Big on={pesar} onClick={() => setPesar(!pesar)}>
            <span className="flex items-center gap-3">
              <Scale className="w-7 h-7" /> Pesar
            </span>
          </Big>
          <Big on={tratDia} onClick={() => setTratDia(!tratDia)}>
            <span className="flex items-center gap-3">
              <Syringe className="w-7 h-7" /> Tratamientos del día
            </span>
            <span className="block text-sm font-bold opacity-90">{dayTasks.length ? dayTasks.slice(0, 3).map((t) => t.title).join(' · ') : 'Sin tratamientos en la agenda de hoy'}</span>
          </Big>
          {perms.sanidad && (
            <Big on={!!todosItem} onClick={() => (todosItem ? setTodosItemId(undefined) : setPicker(true))} tone="emerald">
              <span className="flex items-center gap-3">
                <Syringe className="w-7 h-7" /> + Tratamiento para todos
              </span>
              <span className="block text-sm font-bold opacity-90">{todosItem ? `${todosItem.name} · dosis por peso` : 'Elige el producto (ej. desparasitante)'}</span>
            </Big>
          )}
          {perms.reproduccion && (
            <Big on={palpar} onClick={() => setPalpar(!palpar)} tone="slate">
              <span className="flex items-center gap-3">
                <Stethoscope className="w-7 h-7" /> Palpación
              </span>
              <span className="block text-sm font-bold opacity-90">{agendaManga.filter((a) => a.kind === 'palpar').length} vacas tocan palpar</span>
            </Big>
          )}
        </div>
        {!perms.sanidad && <p className="text-sm font-bold text-slate-800">Los tratamientos los aplica el encargado: en la manga los verás como información.</p>}
        <h3 className="text-lg font-black text-slate-950">Grupo</h3>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['lote', 'Lote'],
              ['hato', 'Todo el hato'],
              ['agenda', 'Agenda de hoy'],
            ] as [Grupo, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={grupo === k} onClick={() => setGrupo(k)} className={`min-h-14 rounded-2xl border-2 text-base font-black ${grupo === k ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-400 text-slate-950'} ${FOCUS_B}`}>
              {l}
            </button>
          ))}
        </div>
        {grupo === 'lote' && (
          <div className="flex flex-wrap gap-2">
            {data.lots
              .filter((l) => l.status === 'abierto')
              .map((l) => (
                <button key={l.id} type="button" aria-pressed={lotId === l.id} onClick={() => setLotId(l.id)} className={`h-12 px-4 rounded-2xl border-2 text-base font-bold ${lotId === l.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-400 text-slate-950'} ${FOCUS_B}`}>
                  {l.name}
                </button>
              ))}
          </div>
        )}
        <p className="text-base font-bold text-slate-900">{groupIds.length} animales en el grupo.</p>
        <button type="button" disabled={!pesar && !tratDia && !todosItem && !palpar} onClick={() => setPhase('captura')} className={`w-full ${BIG} bg-sky-600 text-white disabled:opacity-40 ${FOCUS_B}`}>
          Empezar
        </button>
      </div>
    );
  } else if (phase === 'captura') {
    body = (
      <>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!cur ? (
            <>
              <p className="text-center text-base font-bold text-slate-800">Digita el arete</p>
              <p className="text-center text-6xl font-black tracking-wider tabular-nums text-slate-950 min-h-[4.5rem]">{typed || '—'}</p>
              {matches.length > 0 && (
                <div className="grid gap-2">
                  {matches.map((v) => (
                    <button key={v.id} type="button" onClick={() => load(v)} className={`h-14 rounded-2xl border-2 border-slate-300 bg-white px-4 text-left text-lg font-black text-slate-950 flex items-center justify-between ${FOCUS_B}`}>
                      <span>
                        #{v.tag} · {v.categoryLabel}
                      </span>
                      <span className="text-sm font-bold text-slate-700 truncate ml-2">{v.lotId ? index.lotsById.get(v.lotId)?.name : ''}</span>
                    </button>
                  ))}
                </div>
              )}
              <ErrorBox error={error} />
            </>
          ) : (
            <>
              <div className="rounded-3xl border-2 border-slate-300 p-4 space-y-2">
                <div className="flex items-end justify-between gap-2">
                  <p className="text-5xl font-black tabular-nums text-slate-950 leading-none">#{cur.tag}</p>
                  <button type="button" onClick={resetAnimal} className={`h-11 px-3 rounded-xl border-2 border-slate-300 text-sm font-bold ${FOCUS_B}`}>
                    Otro arete
                  </button>
                </div>
                <p className="text-base font-bold text-slate-900">
                  {cur.categoryLabel} · {cur.lotId ? index.lotsById.get(cur.lotId)?.name : 'Sin lote'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {cur.repro && cur.sex === 'hembra' && <ReproChip state={cur.repro.state} />}
                  {worked.some((x) => x.id === cur.id) && <StatusChip tone="ok">Ya trabajado hoy</StatusChip>}
                </div>
              </div>
              {(cur.withdrawal.meatActive || cur.withdrawal.milkActive) && (
                <BlockedNotice title="Retiro activo">
                  {cur.withdrawal.meatActive ? `Carne hasta el ${fd(cur.withdrawal.meatUntil)}. ` : ''}
                  {cur.withdrawal.milkActive ? `Leche hasta el ${fd(cur.withdrawal.milkUntil)}.` : ''}
                </BlockedNotice>
              )}

              {showWeigh && (
                <button type="button" onClick={() => setTarget('peso')} className={`w-full text-left rounded-3xl border-4 p-4 ${target === 'peso' ? 'border-sky-600' : 'border-slate-300'} ${FOCUS_B}`}>
                  <p className="text-lg font-black text-slate-950">Peso</p>
                  <p className="h-20 flex items-center justify-end text-5xl font-black tabular-nums text-slate-950">
                    {kg || '—'} <span className="text-2xl ml-2">kg</span>
                  </p>
                  <p className="text-base font-bold text-slate-800">
                    {cur.weightKg !== null ? `Anterior ${num(cur.weightKg, 0)} kg · hace ${cur.daysSinceWeigh ?? '?'} d` : 'Primer pesaje'}
                  </p>
                  {gmdLive !== null && <GmdChip gmd={Math.round(gmdLive * 1000) / 1000} color={gmdColorOf(gmdLive, index.config)} />}
                </button>
              )}

              {plans.map((p) => {
                const dose = autoDose(p.item, weightForDose);
                const block = itemBlockReason(p.item, today);
                const on = !!applied[p.key];
                return (
                  <div key={p.key} className="rounded-3xl border-2 border-slate-300 p-4 space-y-2">
                    <p className="text-xl font-black text-slate-950">{p.item.name}</p>
                    <p className="text-sm font-bold text-slate-800">{p.label}</p>
                    {dose ? (
                      <>
                        <p className="text-5xl font-black tabular-nums text-sky-700">
                          {num(dose.dose, 1)} {dose.unit}
                        </p>
                        <p className="text-sm font-bold text-slate-800">{dose.basis === 'peso' ? `Peso usado: ${num(weightForDose, 0)} kg (${w > 0 ? 'hoy' : 'último pesaje'})` : 'Dosis fija por cabeza'}</p>
                      </>
                    ) : (
                      <p className="text-base font-bold text-amber-900">Sin peso o sin dosis por kg: escribe el peso para calcular la dosis.</p>
                    )}
                    {block && <BlockedNotice title="No se puede usar">{block}</BlockedNotice>}
                    {perms.sanidad ? (
                      <button
                        type="button"
                        disabled={!dose || !!block}
                        aria-pressed={on}
                        onClick={() => setApplied((a) => ({ ...a, [p.key]: !on }))}
                        className={`w-full h-16 rounded-2xl border-2 text-xl font-black flex items-center justify-center gap-2 disabled:opacity-40 ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-400 text-slate-950'} ${FOCUS_B}`}
                      >
                        {on ? (
                          <>
                            <Check className="w-7 h-7" /> Aplicado
                          </>
                        ) : (
                          'Marcar aplicado'
                        )}
                      </button>
                    ) : (
                      <p className="text-base font-bold text-slate-800">Lo aplica el encargado.</p>
                    )}
                  </div>
                );
              })}

              {palpAction && (
                <div className="rounded-3xl border-2 border-slate-300 p-4 space-y-2">
                  <p className="text-xl font-black text-slate-950">Palpación</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['preñada', 'Preñada', 'emerald'],
                        ['vacia', 'Vacía', 'slate'],
                        ['dudosa', 'Dudosa', 'amber'],
                      ] as ['preñada' | 'vacia' | 'dudosa', string, 'emerald' | 'slate' | 'amber'][]
                    ).map(([k, l, t]) => (
                      <Big key={k} on={diag === k} tone={t} onClick={() => setDiag(diag === k ? null : k)}>
                        <span className="block text-center">{l}</span>
                      </Big>
                    ))}
                  </div>
                </div>
              )}

              {infoActions.length > 0 && (
                <ul className="space-y-1">
                  {infoActions.map((a) => (
                    <li key={a.agenda.id} className="rounded-2xl bg-amber-50 border-2 border-amber-300 px-3 py-2 text-base font-bold text-amber-950">
                      {a.agenda.title}
                    </li>
                  ))}
                </ul>
              )}

              {nothing && (
                <div className="rounded-3xl bg-slate-100 p-4 text-center space-y-3">
                  <p className="text-xl font-black text-slate-950">Sin tareas para #{cur.tag} hoy</p>
                  <button type="button" onClick={() => setForceWeigh(true)} className={`h-14 px-6 rounded-2xl bg-white border-2 border-slate-400 text-lg font-black ${FOCUS_B}`}>
                    Pesar de todas formas
                  </button>
                </div>
              )}
              <ErrorBox error={error} />
            </>
          )}
        </div>
        <div className="shrink-0 border-t-2 border-slate-200 p-3 space-y-2 bg-white">
          {(!cur || (showWeigh && target === 'peso')) && <Keypad onKey={onKey} decimal={target === 'peso'} okLabel={!cur ? 'OK' : 'Guardar y siguiente'} okDisabled={!cur && !matches.length} />}
          {cur && !(showWeigh && target === 'peso') && (
            <button type="button" onClick={saveNext} className={`w-full ${BIG} bg-sky-600 text-white ${FOCUS_B}`}>
              Guardar y siguiente
            </button>
          )}
          {cur && (
            <button type="button" onClick={skip} className={`w-full h-12 rounded-2xl border-2 border-slate-400 bg-white text-base font-bold text-slate-950 ${FOCUS_B}`}>
              Saltar
            </button>
          )}
        </div>
      </>
    );
  } else {
    const weighed = worked.filter((x) => x.kg);
    const gmds = weighed.map((x) => x.gmd).filter((g): g is number => g !== null && g !== undefined);
    const byProduct = new Map<string, { qty: number; unit: string; n: number }>();
    worked.forEach((x) =>
      x.treatments.forEach((t) => {
        const cur0 = byProduct.get(t.name) || { qty: 0, unit: t.unit, n: 0 };
        byProduct.set(t.name, { qty: cur0.qty + t.qty, unit: t.unit, n: cur0.n + 1 });
      })
    );
    body = (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h2 className="text-2xl font-black text-slate-950">Resumen de la jornada</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border-2 border-slate-300 p-3">
            <p className="text-4xl font-black tabular-nums">{worked.length}</p>
            <p className="text-sm font-bold text-slate-800">Animales trabajados</p>
          </div>
          <div className="rounded-2xl border-2 border-slate-300 p-3">
            <p className="text-4xl font-black tabular-nums">{weighed.length}</p>
            <p className="text-sm font-bold text-slate-800">Pesados{gmds.length ? ` · GMD ${num(gmds.reduce((s, g) => s + g, 0) / gmds.length, 2)}` : ''}</p>
          </div>
        </div>
        {byProduct.size > 0 && (
          <div className="rounded-2xl border-2 border-slate-300 p-3 space-y-1">
            <p className="text-lg font-black">Tratamientos (descontado de farmacia)</p>
            {[...byProduct.entries()].map(([name, t]) => (
              <p key={name} className="text-base font-bold text-slate-900">
                {name}: {t.n} animales · {num(t.qty, 1)} {t.unit}
              </p>
            ))}
          </div>
        )}
        {worked.some((x) => x.diag) && <p className="text-base font-bold text-slate-900">Palpaciones: {worked.filter((x) => x.diag).length}</p>}
        {pending.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
            <p className="text-lg font-black text-amber-950">Pendientes no vistos: {pending.length}</p>
            <p className="text-sm font-bold text-amber-950">
              {pending
                .slice(0, 30)
                .map((id) => `#${index.views.get(id)?.tag || '?'}`)
                .join(' · ')}
              {pending.length > 30 ? '…' : ''}
            </p>
            <button type="button" onClick={() => setPhase('captura')} className={`w-full h-14 rounded-2xl bg-slate-900 text-white text-lg font-black ${FOCUS_B}`}>
              Seguir en la manga
            </button>
          </div>
        )}
        <button type="button" onClick={back} className={`w-full ${BIG} bg-sky-600 text-white ${FOCUS_B}`}>
          Terminar
        </button>
      </div>
    );
  }

  return (
    <Overlay className="bg-white text-slate-950 flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b-2 border-slate-200 bg-white">
        <button type="button" onClick={requestExit} aria-label="Salir del modo manga" className={`w-12 h-12 rounded-2xl border-2 border-slate-300 flex items-center justify-center ${FOCUS_B}`}>
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-black leading-tight">Modo manga</p>
          {phase === 'captura' && (
            <p className="text-sm font-bold text-slate-800">
              {worked.length} / {groupIds.length} · faltan {pending.length}
            </p>
          )}
        </div>
        {phase === 'captura' && (
          <button type="button" onClick={() => setListOpen(true)} className={`h-12 px-4 rounded-2xl border-2 border-slate-300 text-base font-black flex items-center gap-2 ${FOCUS_B}`}>
            <List className="w-5 h-5" /> Lista
          </button>
        )}
      </div>
      {body}
      {listOpen && (
        <BottomSheet title="Lista del grupo" subtitle={`${worked.length} hechos · ${pending.length} pendientes`} icon={<List className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={() => setListOpen(false)}>
          <p className="text-sm font-black text-slate-900">Pendientes</p>
          <div className="grid grid-cols-3 gap-2">
            {pending.map((id) => {
              const v = index.views.get(id);
              if (!v) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setListOpen(false);
                    load(v);
                  }}
                  className={`h-12 rounded-xl border-2 text-base font-black ${skipped.includes(id) ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'} ${FOCUS_B}`}
                >
                  #{v.tag}
                </button>
              );
            })}
          </div>
          {worked.length > 0 && <p className="text-sm font-black text-slate-900 pt-2">Hechos</p>}
          <div className="grid grid-cols-3 gap-2">
            {worked.map((x) => (
              <span key={x.id} className="h-12 rounded-xl bg-emerald-100 text-emerald-900 text-base font-black flex items-center justify-center">
                #{x.tag} ✓
              </span>
            ))}
          </div>
        </BottomSheet>
      )}
      {picker && (
        <ItemPickerSheet
          title="Producto para todos"
          items={pharmacy}
          forUse
          onClose={() => setPicker(false)}
          onPick={(x) => {
            setTodosItemId(x);
            setPicker(false);
          }}
        />
      )}
      {askExit && (
        <ConfirmDialog
          title="¿Terminar la jornada?"
          message={`${worked.length} animales guardados. Todo lo guardado ya quedó registrado.`}
          confirmLabel="Terminar"
          onCancel={() => setAskExit(false)}
          onConfirm={() => {
            setAskExit(false);
            resetAnimal();
            setPhase('resumen');
          }}
        />
      )}
      {confirmEl}
    </Overlay>
  );
}
