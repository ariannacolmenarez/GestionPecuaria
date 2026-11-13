/**
 * Mover en dos toques + confirmar (A6): lote → potrero, potrero ← lote, o animales
 * sueltos a otro lote / potrero. Crea eventos de movimiento (el potrero de origen
 * queda "En descanso" por cálculo). Advertencias que no bloquean: descanso
 * incompleto y potrero ocupado.
 */
import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Map as MapIcon, Users } from 'lucide-react';
import { useBovino } from '../context';
import { LotPickerSheet, PaddockPickerSheet, paddockStatusInfo } from '../pickers';
import { BottomSheet, DateField, ErrorBox, FOCUS_B, PrimaryBtn, WarnNotice, plural, useDomainRunner } from '../ui';

type Target = 'potrero' | 'lote';

export const MoverSheet: React.FC<{
  lotId?: string;
  animalIds?: string[];
  toPaddockId?: string;
  /** Preselecciona "a lote" (Cambiar lote). */
  preset?: Target;
  onClose: () => void;
}> = ({ lotId: lot0, animalIds, toPaddockId: pad0, preset, onClose }) => {
  const { home, index, actions, today } = useBovino();
  const loose = !!animalIds?.length;
  const [lotId, setLotId] = useState<string | undefined>(lot0);
  const [paddockId, setPaddockId] = useState<string | undefined>(pad0);
  const [target, setTarget] = useState<Target | undefined>(loose ? preset : 'potrero');
  const [toLotId, setToLotId] = useState<string | null | undefined>(undefined);
  const [date, setDate] = useState(today);
  const { error, run, confirmEl } = useDomainRunner();

  const lotView = lotId ? home.lots.find((l) => l.lot.id === lotId) : undefined;
  const pv = paddockId ? home.paddocks.find((p) => p.paddock.id === paddockId) : undefined;
  const lotName = (id: string) => index.lotsById.get(id)?.name;
  const who = loose ? plural(animalIds!.length, 'animal', 'animales') : lotView?.lot.name || 'el lote';

  // Paso pendiente
  const needLot = !loose && !lotId;
  const needPaddock = !needLot && (loose ? target === 'potrero' : true) && !paddockId;
  const needTarget = loose && !target;
  const needToLot = loose && target === 'lote' && toLotId === undefined;

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (pv && (loose ? target === 'potrero' : true)) {
      if (pv.status === 'descanso') w.push(`${pv.paddock.name}: descanso incompleto (${pv.restingDays}/${pv.paddock.restDays || 0} días).`);
      if (pv.status === 'ocupado' && !(lotId && pv.lotIds.length === 1 && pv.lotIds[0] === lotId))
        w.push(`${pv.paddock.name} ya tiene ${pv.lotIds.map(lotName).filter(Boolean).join(', ') || `${pv.heads} animales`}: se juntarán en el potrero.`);
      if (pv.status === 'mantenimiento') w.push(`${pv.paddock.name} está en mantenimiento.`);
    }
    return w;
  }, [pv, loose, target, lotId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (loose) {
      if (target === 'potrero' && paddockId) run((confirm) => actions.moveAnimals({ animalIds: animalIds!, toPaddockId: paddockId, date, confirm }), () => onClose());
      else if (target === 'lote' && toLotId !== undefined) run((confirm) => actions.moveAnimals({ animalIds: animalIds!, toLotId, date, confirm }), () => onClose());
    } else if (lotId && paddockId) run((confirm) => actions.moveLot({ lotId, toPaddockId: paddockId, date, confirm }), () => onClose());
  };

  if (needLot)
    return (
      <LotPickerSheet
        title={pad0 ? `¿Qué lote entra a ${index.paddocksById.get(pad0)?.name || 'el potrero'}?` : '¿Qué lote vas a mover?'}
        onClose={onClose}
        onPick={(id) => (id ? setLotId(id) : onClose())}
      />
    );
  if (needTarget)
    return (
      <BottomSheet title={`Mover ${who}`} subtitle="¿A lote o a potrero?" icon={<ArrowRightLeft className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={onClose}>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['lote', 'A otro lote', <Users key="u" className="w-8 h-8" />],
            ['potrero', 'A otro potrero', <MapIcon key="m" className="w-8 h-8" />],
          ] as const).map(([k, l, icon]) => (
            <button key={k} type="button" onClick={() => setTarget(k)} className={`h-28 rounded-2xl border-2 border-slate-300 bg-white flex flex-col items-center justify-center gap-2 text-base font-black text-slate-900 ${FOCUS_B}`}>
              {icon}
              {l}
            </button>
          ))}
        </div>
      </BottomSheet>
    );
  if (needPaddock) return <PaddockPickerSheet title="¿A qué potrero?" excludeId={lotView?.paddockId} onClose={onClose} onPick={setPaddockId} />;
  if (needToLot) return <LotPickerSheet title="¿A qué lote?" allowNone="Sacar del lote (sin lote)" allowCreate onClose={onClose} onPick={(id) => setToLotId(id)} />;

  const dest = loose && target === 'lote' ? (toLotId ? lotName(toLotId) : 'sin lote') : pv?.paddock.name;
  return (
    <BottomSheet
      title={`Mover ${who}`}
      subtitle="Confirma el movimiento"
      icon={<ArrowRightLeft className="w-5 h-5" />}
      iconClass="bg-sky-100 text-sky-700"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={submit}>
            Mover
          </PrimaryBtn>
        </div>
      }
    >
      <p className="text-lg font-black text-slate-900">
        Mover {who} a {loose && target === 'lote' ? (toLotId ? `${dest}` : 'sin lote') : dest}
      </p>
      {pv && (loose ? target === 'potrero' : true) && (
        <div className="flex items-center gap-2 text-sm text-slate-900">
          {paddockStatusInfo(pv, lotName).chip}
          <span>{paddockStatusInfo(pv, lotName).detail}</span>
        </div>
      )}
      {warnings.map((w) => (
        <WarnNotice key={w}>{w}</WarnNotice>
      ))}
      <DateField compact value={date} onChange={setDate} ariaLabel="Fecha del movimiento" />
      <button
        type="button"
        onClick={() => (loose && target === 'lote' ? setToLotId(undefined) : setPaddockId(undefined))}
        className={`h-11 px-4 rounded-2xl border-2 border-slate-300 bg-white text-sm font-bold text-slate-900 ${FOCUS_B}`}
      >
        Cambiar destino
      </button>
      {confirmEl}
    </BottomSheet>
  );
};
