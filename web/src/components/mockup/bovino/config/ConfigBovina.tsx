/**
 * B8 · Configuración bovina (Más › Configuración). Secciones plegables con "Guardar" propio;
 * cada cambio queda en la bitácora (updateConfig). Editar es del Administrador (el dominio lo
 * exige); el encargado ve los parámetros y puede programar el plan sanitario en la Agenda.
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { BovinoCategoryKey, BovinoConfig, BovinoSanitaryPlanItem, BovinoConfig as Cfg } from '../../../../models/bovinoModel';
import { BOVINO_CATEGORIES, BOVINO_CATEGORY_LABEL, BOVINO_DEFAULT_CONFIG } from '../../../../models/bovinoModel';
import { headsCebaPct } from '../../../../models/bovinoCalc';
import { newId } from '../../../../utils/ids';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { BigNumberInput, BlockedNotice, Chips, DateField, ErrorBox, FOCUS_B, Field, PrimaryBtn, Screen, SecondaryBtn, TextField, Toggle, WarnNotice, fd, num, toNum, useDomainRunner } from '../ui';

/** Monedas locales frecuentes (código ISO + símbolo). */
const CURRENCIES: { code: string; symbol: string }[] = [
  { code: 'VES', symbol: 'Bs' },
  { code: 'COP', symbol: '$' },
  { code: 'PEN', symbol: 'S/' },
  { code: 'ARS', symbol: '$' },
  { code: 'MXN', symbol: '$' },
  { code: 'BOB', symbol: 'Bs' },
];
const currencyLabel = (code: string) => {
  const c = CURRENCIES.find((x) => x.code === code);
  return c ? `${c.code} (${c.symbol})` : code;
};

/** Selector de moneda local: chips con los códigos ISO frecuentes, "Solo USD" y "Otra" (texto). */
const CurrencyPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const known = CURRENCIES.some((c) => c.code === value);
  const [other, setOther] = useState(() => !!value && !known);
  const NONE = '__usd__';
  const OTHER = '__otra__';
  return (
    <div className="space-y-2">
      <Chips
        ariaLabel="Moneda local"
        options={[...CURRENCIES.map((c) => ({ key: c.code, label: `${c.code} · ${c.symbol}` })), { key: NONE, label: 'Solo USD' }, { key: OTHER, label: 'Otra' }]}
        value={other ? OTHER : value ? value : NONE}
        onChange={(k) => {
          if (k === OTHER) {
            setOther(true);
            if (known) onChange('');
          } else {
            setOther(false);
            onChange(k === NONE ? '' : k);
          }
        }}
      />
      {other && <TextField value={value} onChange={(v) => onChange(v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} maxLength={3} placeholder="Código ISO de 3 letras (ej. CLP)" />}
    </div>
  );
};

type Draft = Record<string, string>;

const Section: React.FC<{ title: string; hint?: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, hint, open, onToggle, children }) => (
  <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
    <button type="button" aria-expanded={open} onClick={onToggle} className={`w-full min-h-14 px-4 py-2 flex items-center gap-3 text-left ${FOCUS_B}`}>
      <span className="flex-1">
        <span className="block text-base font-black text-slate-900">{title}</span>
        {hint && <span className="block text-xs text-slate-700">{hint}</span>}
      </span>
      <ChevronDown className={`w-5 h-5 text-slate-700 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
  </section>
);

const NumRow: React.FC<{ label: string; hint?: string; k: string; d: Draft; set: (k: string, v: string) => void; unit?: string; decimal?: boolean; ro: boolean }> = ({ label, hint, k, d, set, unit, decimal, ro }) => (
  <Field label={label} hint={hint}>
    {ro ? <p className="text-lg font-black tabular-nums text-slate-900">{d[k] || '—'} {unit}</p> : <BigNumberInput size="md" decimal={decimal} unit={unit} value={d[k] ?? ''} onChange={(v) => set(k, v)} ariaLabel={label} />}
  </Field>
);

const NUM_KEYS: (keyof Cfg)[] = [
  'exchangeRate',
  'pevDays',
  'gestationDays',
  'dryOffDaysBeforeCalving',
  'diagnosisDaysAfterService',
  'calvingAlertDays',
  'weaningAgeDays',
  'levanteMaxDays',
  'bullMinAgeDays',
  'minServiceAgeDays',
  'gmdGreenKg',
  'gmdYellowKg',
  'targetSaleWeightKg',
  'weighIntervalDays',
  'milkDropPct',
  'maxLitersPerMilking',
  'maxLitersPerCowDay',
  'maxGmdKg',
  'prorateCebaPct',
];

function draftOf(c: BovinoConfig): Draft {
  const d: Draft = { localCurrency: c.localCurrency || '' };
  NUM_KEYS.forEach((k) => (d[k] = String(c[k] ?? '')));
  BOVINO_CATEGORIES.forEach((cat) => {
    d[`max_${cat}`] = String(c.maxWeightKgByCategory[cat] ?? '');
    d[`ref_${cat}`] = String(c.referencePricePerKgUsd[cat] ?? '');
  });
  return d;
}

export default function ConfigBovina(_p: StageBProps) {
  const { config, perms, actions, data, index, today, members } = useBovino();
  const ro = !perms.config;
  const [d, setD] = useState<Draft>(() => draftOf(config));
  const [method, setMethod] = useState<BovinoConfig['prorateMethod']>(config.prorateMethod);
  const [open, setOpen] = useState<string | null>(perms.config ? 'moneda' : 'repro');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const { error, setError, run, confirmEl } = useDomainRunner();
  const set = (k: string, v: string) => setD((x) => ({ ...x, [k]: v }));
  const toggle = (s: string) => {
    setOpen(open === s ? null : s);
    setError(null);
    setSavedMsg(null);
  };

  const save = (keys: string[], extra: Partial<Cfg> = {}) => {
    const patch: Record<string, any> = { ...extra };
    for (const k of keys) {
      if (k === 'localCurrency') patch.localCurrency = d.localCurrency.trim().toUpperCase();
      else if (k === 'maxWeight') patch.maxWeightKgByCategory = Object.fromEntries(BOVINO_CATEGORIES.map((c) => [c, toNum(d[`max_${c}`])]));
      else if (k === 'refPrice') patch.referencePricePerKgUsd = Object.fromEntries(BOVINO_CATEGORIES.map((c) => [c, toNum(d[`ref_${c}`]) || 0]));
      else {
        const n = toNum(d[k]);
        if (!isFinite(n)) return setError('Revisa los números: hay un campo vacío o no válido.');
        patch[k] = n;
      }
    }
    if (patch.maxWeightKgByCategory && Object.values(patch.maxWeightKgByCategory).some((x) => !isFinite(x as number))) return setError('Revisa los topes de peso.');
    run(() => actions.updateConfig({ patch }), () => setSavedMsg('Guardado. Queda en la bitácora.'));
  };

  const rateHistory = useMemo(
    () =>
      data.audit
        .filter((a) => a.entity === 'configuracion' && a.data?.patch && a.data.patch.exchangeRate !== undefined)
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 10),
    [data.audit]
  );

  const footer = (keys: string[], extra?: () => Partial<Cfg>) =>
    ro ? null : (
      <div className="space-y-2">
        <ErrorBox error={error} />
        {savedMsg && <p className="text-sm font-bold text-emerald-800">{savedMsg}</p>}
        <PrimaryBtn className="w-full" onClick={() => save(keys, extra?.())}>
          Guardar
        </PrimaryBtn>
      </div>
    );

  return (
    <Screen>
      {ro && <WarnNotice>Solo el administrador cambia la configuración. Puedes consultar los parámetros y programar el plan sanitario.</WarnNotice>}

      <Section title="Moneda y tasa del día" hint={config.exchangeRate > 0 ? `${config.localCurrency} ${num(config.exchangeRate, 2)} por US$ · ${config.exchangeRateDate === today ? 'de hoy' : `del ${fd(config.exchangeRateDate)}`}` : 'Sin moneda local'} open={open === 'moneda'} onToggle={() => toggle('moneda')}>
        {config.exchangeRate > 0 && config.exchangeRateDate !== today && <WarnNotice>La tasa no es de hoy ({fd(config.exchangeRateDate)}). Actualízala para registrar montos en moneda local.</WarnNotice>}
        <Field label="Moneda local" hint="Se guarda el código ISO en cada registro con monto. Sin moneda local = solo USD.">
          {ro ? <p className="text-lg font-black">{d.localCurrency ? currencyLabel(d.localCurrency) : '—'}</p> : <CurrencyPicker value={d.localCurrency} onChange={(v) => set('localCurrency', v)} />}
        </Field>
        <NumRow label="Tasa del día (moneda local por 1 US$)" k="exchangeRate" d={d} set={set} decimal ro={ro} />
        {rateHistory.length > 0 && (
          <div className="rounded-xl border border-slate-200">
            <p className="px-3 pt-2 text-xs font-bold text-slate-800">Historial de tasas</p>
            <ul className="divide-y divide-slate-100">
              {rateHistory.map((a) => (
                <li key={a.id} className="px-3 py-1.5 flex justify-between text-sm">
                  <span className="text-slate-800">
                    {fd(a.at.slice(0, 10))} · {a.name}
                  </span>
                  <span className="font-black tabular-nums">{num(a.data?.patch?.exchangeRate, 2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {footer(['localCurrency', 'exchangeRate'])}
      </Section>

      <Section title="Reproducción" hint={`PEV ${config.pevDays} d · gestación ${config.gestationDays} d · secado ${config.dryOffDaysBeforeCalving} d antes`} open={open === 'repro'} onToggle={() => toggle('repro')}>
        <NumRow label="Período de espera voluntario (PEV)" k="pevDays" d={d} set={set} unit="días" ro={ro} />
        <NumRow label="Días de gestación" hint="Entre 260 y 300." k="gestationDays" d={d} set={set} unit="días" ro={ro} />
        <NumRow label="Secar antes del parto" k="dryOffDaysBeforeCalving" d={d} set={set} unit="días" ro={ro} />
        <NumRow label="Del servicio a la palpación" k="diagnosisDaysAfterService" d={d} set={set} unit="días" ro={ro} />
        <NumRow label="Aviso de parto próximo" k="calvingAlertDays" d={d} set={set} unit="días" ro={ro} />
        <NumRow label="Edad mínima de novilla para servicio" k="minServiceAgeDays" d={d} set={set} unit="días" ro={ro} />
        {footer(['pevDays', 'gestationDays', 'dryOffDaysBeforeCalving', 'diagnosisDaysAfterService', 'calvingAlertDays', 'minServiceAgeDays'])}
      </Section>

      <Section title="Ceba" hint={`Faena ${config.targetSaleWeightKg} kg · GMD óptima ≥ ${config.gmdGreenKg}`} open={open === 'ceba'} onToggle={() => toggle('ceba')}>
        <NumRow label="Peso objetivo de faena" k="targetSaleWeightKg" d={d} set={set} unit="kg" ro={ro} />
        <NumRow label="GMD óptima desde (verde)" k="gmdGreenKg" d={d} set={set} unit="kg/d" decimal ro={ro} />
        <NumRow label="GMD baja desde (amarillo)" hint="Por debajo es pérdida o estancamiento (rojo)." k="gmdYellowKg" d={d} set={set} unit="kg/d" decimal ro={ro} />
        <NumRow label="Intervalo sugerido de pesaje" k="weighIntervalDays" d={d} set={set} unit="días" ro={ro} />
        {footer(['targetSaleWeightKg', 'gmdGreenKg', 'gmdYellowKg', 'weighIntervalDays'])}
      </Section>

      <Section title="Leche" hint={`Alerta de caída > ${config.milkDropPct} %`} open={open === 'leche'} onToggle={() => toggle('leche')}>
        <NumRow label="Caída que genera alerta" hint="Frente al promedio de los 7 días previos." k="milkDropPct" d={d} set={set} unit="%" ro={ro} />
        {footer(['milkDropPct'])}
      </Section>

      <Section title="Categorías por edad" hint={`Destete ${config.weaningAgeDays} d · levante hasta ${config.levanteMaxDays} d`} open={open === 'cat'} onToggle={() => toggle('cat')}>
        <NumRow label="Edad de destete (Cría → Levante)" k="weaningAgeDays" d={d} set={set} unit="días" ro={ro} />
        <NumRow label="Fin del levante (→ Novilla / Novillo)" k="levanteMaxDays" d={d} set={set} unit="días" ro={ro} />
        <NumRow label="Edad mínima de un toro" k="bullMinAgeDays" d={d} set={set} unit="días" ro={ro} />
        {footer(['weaningAgeDays', 'levanteMaxDays', 'bullMinAgeDays'])}
      </Section>

      <Section title="Permisos de campo" hint={config.tagsWithLetters ? 'Aretes con letras (teclado de texto)' : 'Aretes solo numéricos (teclado numérico)'} open={open === 'campo'} onToggle={() => toggle('campo')}>
        <Toggle
          checked={!!config.tagsWithLetters}
          onChange={(v) => {
            if (ro) return;
            run(() => actions.updateConfig({ patch: { tagsWithLetters: v } }));
          }}
          label="Aretes con letras"
        />
        <p className="text-sm text-slate-800">Apagado: la búsqueda por arete abre el teclado numérico (más rápido con guantes en la manga).</p>
      </Section>

      <Section title="Topes lógicos" hint="Piden confirmación, no bloquean" open={open === 'topes'} onToggle={() => toggle('topes')}>
        {BOVINO_CATEGORIES.map((c) => (
          <NumRow key={c} label={`Peso máximo · ${BOVINO_CATEGORY_LABEL[c]}`} k={`max_${c}`} d={d} set={set} unit="kg" ro={ro} />
        ))}
        <NumRow label="Litros máximos por ordeño" k="maxLitersPerMilking" d={d} set={set} unit="L" decimal ro={ro} />
        <NumRow label="Litros máximos por vaca al día" k="maxLitersPerCowDay" d={d} set={set} unit="L" decimal ro={ro} />
        <NumRow label="GMD máxima creíble" k="maxGmdKg" d={d} set={set} unit="kg/d" decimal ro={ro} />
        {footer(['maxWeight', 'maxLitersPerMilking', 'maxLitersPerCowDay', 'maxGmdKg'])}
      </Section>

      {perms.verCostos && (
        <Section title="Prorrateo de gastos fijos" hint={config.prorateMethod === 'cabezas' ? `Por animales (${num(headsCebaPct(index), 0)} % ceba hoy)` : `${config.prorateCebaPct} % Ceba / ${100 - config.prorateCebaPct} % Leche y cría`} open={open === 'pr'} onToggle={() => toggle('pr')}>
          <Chips
            options={[
              { key: 'config', label: '% fijo' },
              { key: 'cabezas', label: 'Por animales' },
            ]}
            value={method}
            onChange={(m) => !ro && setMethod(m)}
          />
          {method === 'config' && <NumRow label="% a Ceba" hint="El resto va a Leche y cría." k="prorateCebaPct" d={d} set={set} unit="%" ro={ro} />}
          {method === 'cabezas' && <p className="text-sm text-slate-800">Se reparte según los animales de ceba frente al resto del hato (hoy {num(headsCebaPct(index), 0)} % ceba).</p>}
          {footer(['prorateCebaPct'], () => ({ prorateMethod: method }))}
        </Section>
      )}

      {perms.verCostos && (
        <Section title="Precios de referencia" hint="Para proyectar el valor del hato" open={open === 'ref'} onToggle={() => toggle('ref')}>
          {BOVINO_CATEGORIES.map((c) => (
            <NumRow key={c} label={`US$/kg en pie · ${BOVINO_CATEGORY_LABEL[c]}`} k={`ref_${c}`} d={d} set={set} unit="US$" decimal ro={ro} />
          ))}
          {footer(['refPrice'])}
        </Section>
      )}

      <Section title="Plan sanitario base" hint={`${config.sanitaryPlan.filter((p) => p.active).length} actividades activas`} open={open === 'plan'} onToggle={() => toggle('plan')}>
        <PlanSanitario ro={ro} />
      </Section>

      <p className="text-xs text-slate-700 text-center">
        Última modificación: {config.updatedAt ? `${fd(config.updatedAt.slice(0, 10))} · ${config.updatedByName || members.find((m) => m.uid === config.updatedBy)?.name || ''}` : 'valores por defecto'}
      </p>
      {confirmEl}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Plan sanitario base (plantilla editable + programar en la agenda)
// ---------------------------------------------------------------------------
const KIND_LABEL: Record<BovinoSanitaryPlanItem['kind'], string> = { vacuna: 'Vacuna', desparasitacion: 'Desparasitación', vitamina: 'Vitamina', otro: 'Otro' };

const PlanSanitario: React.FC<{ ro: boolean }> = ({ ro }) => {
  const { config, actions, data, index, perms, today } = useBovino();
  const [plan, setPlan] = useState<BovinoSanitaryPlanItem[]>(config.sanitaryPlan);
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [target, setTarget] = useState<string>('hato');
  const [start, setStart] = useState(today);
  const [msg, setMsg] = useState<string | null>(null);
  const { error, setError, run, confirmEl } = useDomainRunner();
  const upd = (i: number, patch: Partial<BovinoSanitaryPlanItem>) => {
    setPlan((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const lots = data.lots.filter((l) => l.status === 'abierto');

  const schedule = () => {
    if (!sel.length) return setError('Elige las actividades a programar.');
    const items = config.sanitaryPlan.filter((p) => sel.includes(p.id));
    const cats = new Set(items.flatMap((p) => p.categories));
    const input =
      target === 'hato'
        ? { planItemIds: sel, animalIds: index.active.filter((v) => cats.has(v.category)).map((v) => v.id), startDate: start }
        : { planItemIds: sel, lotId: target, startDate: start };
    if ('animalIds' in input && !input.animalIds?.length) return setError('No hay animales activos de esas categorías.');
    setMsg(null);
    run(() => actions.scheduleSanitaryPlan(input), () => {
      setSel([]);
      setMsg('Programado en la Agenda.');
    });
  };

  return (
    <div className="space-y-3">
      {plan.map((p, i) => (
        <div key={p.id} className={`rounded-xl border-2 p-3 space-y-2 ${p.active ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {ro ? <p className="text-sm font-black text-slate-900">{p.name}</p> : <TextField value={p.name} onChange={(name) => upd(i, { name })} ariaLabel="Actividad" />}
              <p className="text-xs text-slate-700 mt-1">
                {KIND_LABEL[p.kind]} · {p.everyDays ? `cada ${p.everyDays} días` : 'una vez'}
                {p.firstAgeDays ? ` · desde ${p.firstAgeDays} días de edad` : ''}
                {p.productHint ? ` · ${p.productHint}` : ''}
              </p>
            </div>
            {!ro && (
              <button type="button" aria-label="Quitar actividad" onClick={() => { setPlan((x) => x.filter((_, j) => j !== i)); setDirty(true); }} className={`w-11 h-11 rounded-xl flex items-center justify-center text-rose-700 ${FOCUS_B}`}>
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
          {!ro && (
            <>
              <Toggle checked={p.active} onChange={(active) => upd(i, { active })} label="Activa" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Repetir cada (días)">
                  <BigNumberInput size="md" value={String(p.everyDays)} onChange={(v) => upd(i, { everyDays: Number(v) || 0 })} unit="d" ariaLabel="Repetir cada" />
                </Field>
                <Field label="Primera a los (días)">
                  <BigNumberInput size="md" value={p.firstAgeDays ? String(p.firstAgeDays) : ''} onChange={(v) => upd(i, { firstAgeDays: Number(v) || undefined })} unit="d" ariaLabel="Primera aplicación" />
                </Field>
              </div>
              <Field label="Categorías">
                <div className="flex flex-wrap gap-1.5">
                  {BOVINO_CATEGORIES.map((c: BovinoCategoryKey) => {
                    const on = p.categories.includes(c);
                    return (
                      <button key={c} type="button" aria-pressed={on} onClick={() => upd(i, { categories: on ? p.categories.filter((x) => x !== c) : [...p.categories, c] })} className={`h-10 px-3 rounded-xl border-2 text-xs font-bold ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                        {BOVINO_CATEGORY_LABEL[c]}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Producto sugerido">
                <TextField value={p.productHint || ''} onChange={(productHint) => upd(i, { productHint })} placeholder="Ej. Ivermectina 1 %" />
              </Field>
            </>
          )}
        </div>
      ))}
      {!ro && (
        <div className="grid grid-cols-2 gap-2">
          <SecondaryBtn onClick={() => { setPlan((x) => [...x, { id: newId('plan'), name: 'Nueva actividad', kind: 'otro', categories: ['vaca'], everyDays: 0, active: true }]); setDirty(true); }}>
            <Plus className="w-4 h-4" /> Actividad
          </SecondaryBtn>
          <SecondaryBtn onClick={() => { setPlan(BOVINO_DEFAULT_CONFIG.sanitaryPlan); setDirty(true); }}>
            <RotateCcw className="w-4 h-4" /> Restaurar plantilla
          </SecondaryBtn>
        </div>
      )}
      {!ro && dirty && (
        <PrimaryBtn className="w-full" onClick={() => run(() => actions.updateConfig({ patch: { sanitaryPlan: plan } }), () => { setDirty(false); setMsg('Plan guardado.'); })}>
          Guardar plan
        </PrimaryBtn>
      )}

      {perms.sanidad ? (
        <div className="rounded-xl border-2 border-slate-200 p-3 space-y-2">
          <p className="text-sm font-black text-slate-900">Programar en la Agenda</p>
          {dirty && <p className="text-xs text-amber-900">Guarda el plan antes de programarlo.</p>}
          <div className="flex flex-wrap gap-1.5">
            {config.sanitaryPlan
              .filter((p) => p.active)
              .map((p) => {
                const on = sel.includes(p.id);
                return (
                  <button key={p.id} type="button" aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== p.id) : [...sel, p.id])} className={`min-h-10 px-3 rounded-xl border-2 text-xs font-bold text-left ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                    {p.name}
                  </button>
                );
              })}
          </div>
          <Field label="A quién">
            <Chips options={[{ key: 'hato', label: 'Todo el hato (por categoría)' }, ...lots.map((l) => ({ key: l.id, label: l.name }))]} value={target} onChange={setTarget} />
          </Field>
          <Field label="Desde">
            <DateField value={start} onChange={setStart} max={null} />
          </Field>
          <PrimaryBtn className="w-full" onClick={schedule} disabled={dirty}>
            Programar
          </PrimaryBtn>
        </div>
      ) : (
        <BlockedNotice title="El plan sanitario lo programa el encargado" />
      )}
      <ErrorBox error={error} />
      {msg && <p className="text-sm font-bold text-emerald-800">{msg}</p>}
      {confirmEl}
    </div>
  );
};
