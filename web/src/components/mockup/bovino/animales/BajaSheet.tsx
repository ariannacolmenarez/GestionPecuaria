/**
 * Baja de un animal (muerte, descarte, traslado, robo/pérdida). Queda en la bitácora.
 * El operario no puede dar de baja (dominio: manejo): reporta la muerte como
 * observación "por confirmar" para que el encargado la registre.
 */
import React, { useState } from 'react';
import { useBovino } from '../context';
import { DEATH_REPORT_TITLE } from '../../../../models/bovinoCalc';
import { BigNumberInput, BlockedNotice, Chips, ConfirmDialog, DateField, ErrorBox, Field, FormSheet, PrimaryBtn, TextField, toNum, useDomainRunner } from '../ui';

type Motivo = 'muerte' | 'descarte' | 'traslado' | 'perdida';

const CAUSAS: Record<Motivo, string[]> = {
  muerte: ['Enfermedad', 'Accidente', 'Parto', 'Mordedura de serpiente', 'Rayo', 'Desconocida', 'Otra'],
  descarte: ['Baja producción', 'Problema reproductivo', 'Edad', 'Cojera', 'Mastitis crónica', 'Otra'],
  traslado: ['Otra finca del dueño', 'Préstamo', 'Otra'],
  perdida: ['Robo', 'Extraviado', 'Otra'],
};

export const BajaSheet: React.FC<{ animalId: string; onClose: () => void; initialCause?: string; reportEventId?: string }> = ({ animalId, onClose, initialCause, reportEventId }) => {
  const { index, actions, today, perms, data } = useBovino();
  const v = index.views.get(animalId);
  const report = reportEventId ? data.events.find((e) => e.id === reportEventId) : undefined;
  const [motivo, setMotivo] = useState<Motivo>('muerte');
  const [causa, setCausa] = useState<string>(() => (initialCause ? (CAUSAS.muerte.includes(initialCause) ? initialCause : 'Otra') : ''));
  const [otra, setOtra] = useState(() => (initialCause && !CAUSAS.muerte.includes(initialCause) ? initialCause : ''));
  const [date, setDate] = useState(report?.date || today);
  const [kg, setKg] = useState('');
  const [nota, setNota] = useState('');
  const [ask, setAsk] = useState(false);
  const { error, setError, run, confirmEl } = useDomainRunner();
  if (!v) return null;
  const causeText = causa === 'Otra' ? otra.trim() : causa;
  const motivoLabel = motivo === 'muerte' ? 'Muerte' : motivo === 'descarte' ? 'Descarte' : motivo === 'traslado' ? 'Traslado' : 'Robo / pérdida';

  const submit = () => {
    setAsk(false);
    if (!perms.bajas) {
      run(() => actions.addNote({ animalId, date, title: DEATH_REPORT_TITLE, notes: [causeText, nota].filter(Boolean).join(' · ') || undefined }), () => onClose());
      return;
    }
    if (motivo === 'muerte') {
      run(() => actions.registerDeath({ animalId, date, cause: causeText, weightKg: toNum(kg) > 0 ? toNum(kg) : undefined, notes: nota || undefined }), () => onClose());
    } else {
      const cause = motivo === 'descarte' ? causeText : `${motivoLabel}: ${causeText}`;
      run(() => actions.registerDiscard({ animalId, date, cause, notes: nota || undefined }), () => onClose());
    }
  };
  const tryOpen = () => {
    if (!causeText) return setError('Elige la causa.');
    setError(null);
    setAsk(true);
  };

  return (
    <FormSheet
      tone="sky"
      title={perms.bajas ? `Dar de baja #${v.tag}` : `Reportar muerte #${v.tag}`}
      subtitle={v.categoryLabel}
      dirty={!!(causa || nota)}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn tone="rose" className="w-full" onClick={tryOpen}>
            {perms.bajas ? `Registrar ${motivoLabel.toLowerCase()}` : 'Enviar reporte'}
          </PrimaryBtn>
        </div>
      }
    >
      {!perms.bajas && <BlockedNotice title="Lo confirma el encargado">Tu reporte llega a la Agenda y a las alertas del encargado como “muerte por confirmar”.</BlockedNotice>}
      {perms.bajas && report && (
        <p className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          Muerte reportada por {report.createdByName || 'el operario'}{report.notes ? `: ${report.notes}` : ''}. Revisa los datos y confirma la baja.
        </p>
      )}
      {perms.bajas && (
        <Field label="Motivo">
          <Chips
            options={[
              { key: 'muerte', label: 'Muerte' },
              { key: 'descarte', label: 'Descarte' },
              { key: 'traslado', label: 'Traslado' },
              { key: 'perdida', label: 'Robo / pérdida' },
            ]}
            value={motivo}
            onChange={(m) => {
              setMotivo(m);
              setCausa('');
            }}
          />
        </Field>
      )}
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Causa">
        <Chips options={CAUSAS[perms.bajas ? motivo : 'muerte'].map((c) => ({ key: c, label: c }))} value={causa} onChange={setCausa} />
        {causa === 'Otra' && <TextField value={otra} onChange={setOtra} placeholder="Escribe la causa" />}
      </Field>
      {motivo === 'muerte' && perms.bajas && (
        <Field label="Peso estimado (opcional)">
          <BigNumberInput decimal value={kg} onChange={setKg} unit="kg" ariaLabel="Peso" />
        </Field>
      )}
      {motivo === 'descarte' && <p className="text-xs text-slate-700">Si el descarte es por venta, regístralo en Balance › Venta de ganado (administrador).</p>}
      <Field label="Nota (opcional)">
        <TextField value={nota} onChange={setNota} maxLength={200} placeholder="Detalle" />
      </Field>
      {ask && (
        <ConfirmDialog
          title={perms.bajas ? `¿Registrar ${motivoLabel.toLowerCase()} de #${v.tag}?` : `¿Reportar la muerte de #${v.tag}?`}
          message={perms.bajas ? 'El animal pasará a solo lectura y sus tareas pendientes se cancelan. Queda en la bitácora.' : 'El encargado lo verá en su Agenda y en las alertas para confirmar la baja.'}
          confirmLabel="Confirmar"
          danger
          requireText={perms.bajas ? v.tag : undefined}
          onConfirm={submit}
          onCancel={() => setAsk(false)}
        />
      )}
      {confirmEl}
    </FormSheet>
  );
};
