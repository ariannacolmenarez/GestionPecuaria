/**
 * B3 · Destete: crías aptas (edad ≥ la de Configuración) con multiselección, peso al
 * destete en lista rápida y lote destino. La categoría pasa a Levante.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { normalizeTag, type BovinoAnimalView } from '../../../../models/bovinoCalc';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { LotPickerSheet } from '../pickers';
import { AnimalRow, BigNumberInput, BlockedNotice, ChipFilter, DateField, EmptyBlock, ErrorBox, Field, PickerButton, PrimaryBtn, Screen, ageText, num, toNum, useDomainRunner } from '../ui';

type Vista = 'aptas' | 'proximas';

export default function DestetesScreen(_p: StageBProps) {
  const { index, actions, today, config, perms } = useBovino();
  const [vista, setVista] = useState<Vista>('aptas');
  const [sel, setSel] = useState<string[]>([]);
  const [kg, setKg] = useState<Record<string, string>>({});
  const [toLotId, setToLotId] = useState<string | undefined>();
  const [date, setDate] = useState(today);
  const [picker, setPicker] = useState(false);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const { error, setError, run, confirmEl } = useDomainRunner();

  const crias = useMemo(() => index.active.filter((v) => v.category === 'cria' && !v.weaned).sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0) || normalizeTag(a.tag).localeCompare(normalizeTag(b.tag), 'es', { numeric: true })), [index]);
  const aptas = crias.filter((v) => (v.ageDays ?? 0) >= config.weaningAgeDays);
  const proximas = crias.filter((v) => (v.ageDays ?? 0) < config.weaningAgeDays);
  const list = vista === 'aptas' ? aptas : proximas;
  const selected = sel.map((id) => index.views.get(id)).filter((v): v is BovinoAnimalView => !!v);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const focusNext = (i: number) => {
    const next = selected[i];
    if (!next) return;
    refs.current[next.id]?.querySelector('input')?.focus();
  };
  const save = () => {
    if (!selected.length) return setError('Elige las crías a destetar.');
    run(
      (confirm) =>
        actions.registerWeaning({
          items: selected.map((v) => ({ animalId: v.id, weightKg: toNum(kg[v.id] || '') > 0 ? toNum(kg[v.id]) : undefined })),
          toLotId,
          date,
          confirm,
        }),
      () => {
        setSel([]);
        setKg({});
      }
    );
  };

  if (!perms.cargaDiaria) return <Screen><BlockedNotice title="Sin permiso" /></Screen>;
  if (!crias.length) return <Screen><EmptyBlock icon={<Users className="w-8 h-8" />} title="Sin crías por destetar" text={`Las crías aparecen aquí; se destetan desde los ${config.weaningAgeDays} días de edad.`} /></Screen>;

  return (
    <Screen padBottom>
      <ChipFilter<Vista>
        ariaLabel="Crías"
        value={vista}
        onChange={setVista}
        options={[
          { key: 'aptas', label: 'Aptas', count: aptas.length },
          { key: 'proximas', label: 'Más jóvenes', count: proximas.length },
        ]}
      />
      <p className="text-xs text-slate-700">Edad de destete: {config.weaningAgeDays} días. Toca para elegir.</p>
      <ul className="space-y-2">
        {list.map((v) => (
          <li key={v.id}>
            <AnimalRow v={v} selectable selected={sel.includes(v.id)} onClick={() => toggle(v.id)} subtitle={`${ageText(v.ageDays)}${v.weightKg !== null ? ` · ${num(v.weightKg, 0)} kg` : ''}`} />
          </li>
        ))}
      </ul>
      {selected.length > 0 && (
        <section className="bg-white rounded-2xl border-2 border-sky-300 p-3 space-y-3">
          <p className="text-base font-black text-slate-900">Peso al destete ({selected.length})</p>
          {selected.map((v, i) => (
            <div
              key={v.id}
              ref={(el) => {
                refs.current[v.id] = el;
              }}
              className="flex items-center gap-3"
            >
              <span className="w-20 text-xl font-black tabular-nums text-slate-900">#{v.tag}</span>
              <div className="flex-1">
                <BigNumberInput size="md" decimal unit="kg" ariaLabel={`Peso al destete de ${v.tag}`} value={kg[v.id] || ''} onChange={(x) => setKg((p) => ({ ...p, [v.id]: x }))} onEnter={() => focusNext(i + 1)} />
              </div>
            </div>
          ))}
          <Field label="Lote destino (opcional)">
            <PickerButton label="Lote destino" icon={<Users className="w-5 h-5" />} value={toLotId ? index.lotsById.get(toLotId)?.name : undefined} placeholder="Mismo lote" onClick={() => setPicker(true)} />
          </Field>
          <Field label="Fecha">
            <DateField value={date} onChange={setDate} />
          </Field>
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            Destetar {selected.length}
          </PrimaryBtn>
        </section>
      )}
      {picker && (
        <LotPickerSheet
          title="Lote destino"
          selectedId={toLotId}
          allowNone="Mismo lote"
          onClose={() => setPicker(false)}
          onPick={(x) => {
            setToLotId(x || undefined);
            setPicker(false);
          }}
        />
      )}
      {confirmEl}
    </Screen>
  );
}
