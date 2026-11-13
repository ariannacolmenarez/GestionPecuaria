/** "+ Actividad" de la Agenda (Encargado / Admin): tarea sanitaria bovina para un animal, varios, un lote o todo el hato. */
import React, { useMemo, useState } from 'react';
import { Pill, Users } from 'lucide-react';
import { itemBovinoCategory } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { AnimalSearch, ItemPickerSheet, LotPickerSheet } from '../pickers';
import { Chips, DateField, ErrorBox, Field, FOCUS_B, FormSheet, PickerButton, PrimaryBtn, TextField, useDomainRunner } from '../ui';

const TITLES = ['Vacunación', 'Desparasitación', 'Vitaminas', 'Palpación', 'Baño garrapaticida', 'Otro'];

export const NuevaActividadSheet: React.FC<{ lotId?: string; animalIds?: string[]; onClose: () => void }> = ({ lotId: lot0, animalIds: ids0, onClose }) => {
  const { actions, today, index, bovinoItems, members } = useBovino();
  const [kind, setKind] = useState('Vacunación');
  const [other, setOther] = useState('');
  const [date, setDate] = useState(today);
  const [who, setWho] = useState<'animales' | 'lote' | 'hato'>(lot0 ? 'lote' : ids0?.length ? 'animales' : 'lote');
  const [lotId, setLotId] = useState<string | undefined>(lot0);
  const [ids, setIds] = useState<string[]>(ids0 || []);
  const [itemId, setItemId] = useState<string | undefined>(undefined);
  const [responsible, setResponsible] = useState<string>('');
  const [picker, setPicker] = useState<'lote' | 'item' | null>(null);
  const { error, setError, run, confirmEl } = useDomainRunner();
  const pharmacy = useMemo(() => bovinoItems.filter((i) => itemBovinoCategory(i) === 'farmacia'), [bovinoItems]);
  const item = itemId ? pharmacy.find((i) => i.id === itemId) : undefined;
  const title = kind === 'Otro' ? other.trim() : kind;

  const save = () => {
    if (!title) return setError('Escribe la actividad.');
    const target = who === 'lote' ? { lotId } : who === 'hato' ? { animalIds: index.active.map((v) => v.id) } : { animalIds: ids };
    if (who === 'lote' && !lotId) return setError('Elige el lote.');
    if (who !== 'lote' && !target.animalIds?.length) return setError('Elige al menos un animal.');
    run(() => actions.addTask({ title, date, ...target, itemId, responsible: responsible || undefined, activityKind: kind.toLowerCase(), procedure: title }), () => onClose());
  };

  if (picker === 'item')
    return (
      <ItemPickerSheet
        title="Producto (opcional)"
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
      title="Nueva actividad"
      dirty={!!(other || ids.length)}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            Programar
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Actividad">
        <Chips options={TITLES.map((t) => ({ key: t, label: t }))} value={kind} onChange={setKind} />
        {kind === 'Otro' && <TextField value={other} onChange={setOther} placeholder="¿Qué hay que hacer?" />}
      </Field>
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} max={null} />
      </Field>
      <Field label="¿A quién?">
        <Chips options={[{ key: 'lote', label: 'Lote' }, { key: 'animales', label: 'Animales' }, { key: 'hato', label: 'Todo el hato' }]} value={who} onChange={setWho} />
      </Field>
      {who === 'lote' && <PickerButton label="Lote" icon={<Users className="w-5 h-5" />} value={lotId ? index.lotsById.get(lotId)?.name : undefined} placeholder="Elegir lote" onClick={() => setPicker('lote')} />}
      {who === 'animales' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {ids.map((x) => (
              <button key={x} type="button" onClick={() => setIds((l) => l.filter((y) => y !== x))} className={`h-10 px-3 rounded-full bg-sky-600 text-white text-sm font-bold ${FOCUS_B}`}>
                #{index.views.get(x)?.tag} ✕
              </button>
            ))}
          </div>
          <AnimalSearch excludeIds={ids} onPick={(v) => setIds((l) => [...l, v.id])} />
        </div>
      )}
      {who === 'hato' && <p className="text-sm font-bold text-slate-900">{index.active.length} animales activos</p>}
      <Field label="Producto de la farmacia (opcional)" hint="Al marcarla hecha se aplica y se descuenta de la farmacia.">
        <PickerButton label="Producto" icon={<Pill className="w-5 h-5" />} value={item?.name} placeholder="Sin producto" onClick={() => setPicker('item')} />
      </Field>
      {members.length > 0 && (
        <Field label="Responsable">
          <Chips options={members.map((m) => ({ key: m.name, label: m.name }))} value={responsible} onChange={setResponsible} />
        </Field>
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
