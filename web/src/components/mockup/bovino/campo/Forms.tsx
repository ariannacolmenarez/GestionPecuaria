/** Formularios de lote (A5) y potrero (A6). */
import React, { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useBovino } from '../context';
import { BOVINO_LOT_TYPE_LABEL, BOVINO_UNIT_LABEL, type BovinoLotType } from '../../../../models/bovinoModel';
import { lotUnit } from '../../../../models/bovinoCalc';
import { PaddockPickerSheet } from '../pickers';
import { BigNumberInput, Chips, ErrorBox, Field, FormSheet, PickerButton, PrimaryBtn, TextField, Toggle, toNum, useDomainRunner } from '../ui';

const LOT_TYPES: BovinoLotType[] = ['ceba', 'leche', 'cria', 'levante', 'otro'];

export const LoteForm: React.FC<{ lotId?: string; onClose: () => void }> = ({ lotId, onClose }) => {
  const { data, actions, config, index } = useBovino();
  const lot = lotId ? data.lots.find((l) => l.id === lotId) : undefined;
  const [type, setType] = useState<BovinoLotType>(lot?.type || 'ceba');
  const suggested = `${BOVINO_LOT_TYPE_LABEL[type]} ${data.lots.filter((l) => l.type === type).length + 1}`;
  const [name, setName] = useState(lot?.name || '');
  const [paddockId, setPaddockId] = useState<string | undefined>(undefined);
  const [target, setTarget] = useState(lot?.targetSaleWeightKg ? String(lot.targetSaleWeightKg) : '');
  const [notes, setNotes] = useState(lot?.notes || '');
  const [picker, setPicker] = useState(false);
  const { error, run, confirmEl } = useDomainRunner();
  const save = () => {
    const finalName = name.trim() || suggested;
    const t = toNum(target);
    const targetSaleWeightKg = type === 'ceba' && t > 0 ? t : undefined;
    if (lot) run(() => actions.updateLot({ lotId: lot.id, patch: { name: finalName, type, targetSaleWeightKg, notes: notes.trim() || undefined } }), () => onClose());
    else run(() => actions.createLot({ name: finalName, type, paddockId, targetSaleWeightKg, notes: notes.trim() || undefined }), () => onClose());
  };
  return (
    <FormSheet
      tone="sky"
      title={lot ? `Editar ${lot.name}` : 'Nuevo lote'}
      dirty={!!(name || target || notes)}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            {lot ? 'Guardar cambios' : 'Crear lote'}
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Propósito">
        <Chips options={LOT_TYPES.map((t) => ({ key: t, label: BOVINO_LOT_TYPE_LABEL[t] }))} value={type} onChange={setType} />
      </Field>
      <Field label="Nombre" hint={!name ? `Si lo dejas vacío se llamará “${suggested}”.` : undefined}>
        <TextField value={name} onChange={setName} placeholder={suggested} />
      </Field>
      <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-3 text-sm text-sky-950">
        Unidad productiva: <strong>{BOVINO_UNIT_LABEL[lotUnit({ type })]}</strong>. Decide a qué balance van sus costos (ceba o lechería y cría).
      </div>
      {!lot && (
        <Field label="Potrero inicial (opcional)">
          <PickerButton label="Potrero" icon={<MapIcon className="w-5 h-5" />} value={paddockId ? index.paddocksById.get(paddockId)?.name : undefined} placeholder="Sin potrero" onClick={() => setPicker(true)} />
        </Field>
      )}
      {type === 'ceba' && (
        <Field label="Peso objetivo de faena" hint={`Por defecto ${config.targetSaleWeightKg} kg (configuración).`}>
          <BigNumberInput decimal value={target} onChange={setTarget} unit="kg" placeholder={String(config.targetSaleWeightKg)} ariaLabel="Peso objetivo" />
        </Field>
      )}
      <Field label="Notas (opcional)">
        <TextField value={notes} onChange={setNotes} maxLength={200} placeholder="Observaciones del lote" />
      </Field>
      {picker && (
        <PaddockPickerSheet
          allowCreate
          selectedId={paddockId}
          onClose={() => setPicker(false)}
          onPick={(id) => {
            setPaddockId(id);
            setPicker(false);
          }}
        />
      )}
      {confirmEl}
    </FormSheet>
  );
};

const GRASSES = ['Brachiaria', 'Estrella', 'Guinea', 'Pangola', 'Kikuyo', 'Tanzania', 'Mixto', 'Otro'];

export const PotreroForm: React.FC<{ paddockId?: string; onClose: () => void }> = ({ paddockId, onClose }) => {
  const { data, actions } = useBovino();
  const p = paddockId ? data.paddocks.find((x) => x.id === paddockId) : undefined;
  const [name, setName] = useState(p?.name || '');
  const [area, setArea] = useState(p?.areaHa ? String(p.areaHa) : '');
  const [grass, setGrass] = useState(p?.grass && GRASSES.includes(p.grass) ? p.grass : p?.grass ? 'Otro' : '');
  const [grassOther, setGrassOther] = useState(p?.grass && !GRASSES.includes(p.grass) ? p.grass : '');
  const [rest, setRest] = useState(p?.restDays ? String(p.restDays) : '30');
  const [cap, setCap] = useState(p?.capacityHeads ? String(p.capacityHeads) : '');
  const [maint, setMaint] = useState(p?.status === 'mantenimiento');
  const [notes, setNotes] = useState(p?.notes || '');
  const { error, setError, run, confirmEl } = useDomainRunner();
  const save = () => {
    if (!name.trim()) return setError('Escribe el nombre del potrero.');
    const input = {
      name: name.trim(),
      areaHa: toNum(area) > 0 ? toNum(area) : undefined,
      grass: (grass === 'Otro' ? grassOther.trim() : grass) || undefined,
      restDays: toNum(rest) >= 0 ? Math.round(toNum(rest)) : undefined,
      capacityHeads: toNum(cap) > 0 ? Math.round(toNum(cap)) : undefined,
      status: maint ? ('mantenimiento' as const) : ('disponible' as const),
      notes: notes.trim() || undefined,
    };
    if (p) run(() => actions.updatePaddock({ paddockId: p.id, patch: input }), () => onClose());
    else run(() => actions.createPaddock(input), () => onClose());
  };
  return (
    <FormSheet
      tone="sky"
      title={p ? `Editar ${p.name}` : 'Registrar potrero'}
      dirty={!!(name || area || cap)}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            {p ? 'Guardar cambios' : 'Crear potrero'}
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Nombre">
        <TextField value={name} onChange={setName} placeholder="Ej. La Ceiba" />
      </Field>
      <Field label="Área (opcional)">
        <BigNumberInput decimal value={area} onChange={setArea} unit="ha" ariaLabel="Área" />
      </Field>
      <Field label="Tipo de pasto">
        <Chips options={GRASSES.map((g) => ({ key: g, label: g }))} value={grass} onChange={setGrass} />
        {grass === 'Otro' && <TextField value={grassOther} onChange={setGrassOther} placeholder="Escribe el pasto" />}
      </Field>
      <Field label="Días de descanso objetivo" hint="Al salir el ganado, el potrero queda “En descanso” hasta cumplirlos.">
        <BigNumberInput value={rest} onChange={setRest} unit="días" ariaLabel="Días de descanso" />
      </Field>
      <Field label="Capacidad (cabezas, opcional)" hint="Se avisa al mover más animales de los que caben.">
        <BigNumberInput value={cap} onChange={setCap} unit="cab." ariaLabel="Capacidad" />
      </Field>
      {p && <Toggle tone="sky" checked={maint} onChange={setMaint} label="En mantenimiento" hint="No se puede usar para pastoreo." />}
      <Field label="Notas (opcional)">
        <TextField value={notes} onChange={setNotes} maxLength={200} placeholder="Agua, cercas, sombra…" />
      </Field>
      {confirmEl}
    </FormSheet>
  );
};
