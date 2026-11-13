/**
 * ============================================================================
 * MÓDULO BOVINO · Tokens y componentes de UI (modo sol, acento sky)
 * ============================================================================
 * Alto contraste para uso en campo: fondos claros, texto slate-900, mínimo
 * text-xs en slate-700, botones ≥ 48 px. Se reutilizan Overlay, FormSheet,
 * BottomSheet, ConfirmDialog y ErrorBox del módulo avícola sin modificarlo.
 * Sin lógica de dominio: los cálculos vienen de models/bovinoCalc y bovinoDomain.
 */
import React, { useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban, CalendarDays, ChevronRight, Plus, Search, X } from 'lucide-react';
import type { BovinoMoney, BovinoMoneyInput, BovinoConfig } from '../../../models/bovinoModel';
import type { BovinoAnimalView, BovinoReproState, BovinoWithdrawal, GmdColor } from '../../../models/bovinoCalc';
import { BOVINO_REPRO_LABEL, isTagAvailable, normalizeTag } from '../../../models/bovinoCalc';
import type { BovinoDomainResult, BovinoDomainSuccess } from '../../../models/bovinoDomain';
import { parseISODate, todayISO } from '../../../utils/dates';
import {
  Overlay,
  useEscape,
  FormSheet as FormSheetBase,
  BottomSheet as BottomSheetBase,
  ConfirmDialog as ConfirmDialogBase,
} from '../avicola/shared';
import { BovinoContext, useBovino } from './context';
import type { BovinoPermKey } from './perms';

export { ErrorBox, Overlay, useEscape, parseNum } from '../avicola/shared';

/**
 * Hojas y diálogos compartidos con el avícola, siempre en modo sol (spec §0 y §3.2):
 * subtítulos text-xs slate-700, mensajes text-sm slate-900, botones y X de 48 px, foco sky.
 */
export const FormSheet: React.FC<Omit<React.ComponentProps<typeof FormSheetBase>, 'contrast'>> = (props) => <FormSheetBase {...props} contrast="sol" />;
export const BottomSheet: React.FC<Omit<React.ComponentProps<typeof BottomSheetBase>, 'contrast'>> = (props) => <BottomSheetBase {...props} contrast="sol" />;
export const ConfirmDialog: React.FC<Omit<React.ComponentProps<typeof ConfirmDialogBase>, 'contrast'>> = (props) => <ConfirmDialogBase {...props} contrast="sol" />;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
export const B = {
  accent: 'bg-sky-600 text-white',
  accentHover: 'hover:bg-sky-700 active:bg-sky-800',
  soft: 'bg-sky-50 text-sky-800 border-sky-200',
  chip: 'bg-sky-100 text-sky-800',
  text: 'text-sky-700',
  ring: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-1',
  card: 'bg-white rounded-2xl border border-slate-200 shadow-xs',
  screen: 'bg-slate-50',
  label: 'text-sm font-bold text-slate-900',
  hint: 'text-xs text-slate-700',
  number: 'tabular-nums font-black text-slate-900',
};
export const FOCUS_B = B.ring;

// ---------------------------------------------------------------------------
// Formateadores
// ---------------------------------------------------------------------------
const safe = (n: unknown) => {
  const v = Number(n);
  return isFinite(v) ? v : 0;
};

export function num(n: unknown, decimals = 0): string {
  return safe(n).toLocaleString('es-ES', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

export function usd(n: unknown): string {
  const v = Math.round(safe(n) * 100) / 100;
  return `${v < 0 ? '−' : ''}US$ ${Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "13 nov" */
export function fd(iso?: string): string {
  const d = parseISODate(iso);
  if (!d) return iso || '—';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** "vie 13 nov" */
export function fdw(iso?: string): string {
  const d = parseISODate(iso);
  if (!d) return iso || '—';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '');
}

/** "13 nov 2026" */
export function fdy(iso?: string): string {
  const d = parseISODate(iso);
  if (!d) return iso || '—';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
}

/** Hora local "7:42" de un ISO completo. */
export function hm(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit' });
}

/** Edad legible: "3 a 4 m", "8 m", "12 d". */
export function ageText(days: number | null | undefined): string {
  if (days === null || days === undefined || days < 0) return '—';
  if (days < 60) return `${days} d`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} m`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} a ${m} m` : `${y} a`;
}

export const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`;

/** Lee un número escrito (acepta coma decimal). NaN si está vacío. */
export function toNum(s: string): number {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return NaN;
  return Number(t);
}

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------
/** Muestra el contenido solo si el usuario tiene el permiso. */
export const Can: React.FC<{ do: BovinoPermKey; children: React.ReactNode; fallback?: React.ReactNode }> = ({ do: perm, children, fallback = null }) => {
  const { perms } = useBovino();
  return <>{perms[perm] ? children : fallback}</>;
};

// ---------------------------------------------------------------------------
// Ejecución de acciones del dominio con confirmación de topes
// ---------------------------------------------------------------------------
/**
 * Llama a una acción del dominio. Si el dominio pide confirmación (FUERA_DE_RANGO),
 * muestra LimitConfirm con los avisos y reintenta la misma acción con confirm:true.
 * RETIRO_ACTIVO no se confirma aquí: se muestra como bloqueo (BlockedNotice).
 */
export function useDomainRunner() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ warnings: string[]; retry: () => void } | null>(null);

  const run = useCallback((call: (confirm: boolean) => BovinoDomainResult, onOk?: (res: BovinoDomainSuccess) => void) => {
    setError(null);
    const res = call(false);
    if ('error' in res) {
      if (res.needsConfirmation && res.code !== 'RETIRO_ACTIVO') {
        setPending({
          warnings: res.warnings && res.warnings.length ? res.warnings : [res.error],
          retry: () => {
            setPending(null);
            const again = call(true);
            if ('error' in again) setError(again.error);
            else onOk?.(again);
          },
        });
      } else setError(res.error);
      return false;
    }
    onOk?.(res);
    return true;
  }, []);

  const confirmEl = pending ? <LimitConfirm warnings={pending.warnings} onConfirm={pending.retry} onCancel={() => setPending(null)} /> : null;
  return { error, setError, run, confirmEl };
}

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------
/** Confirmación de topes lógicos: "Corregir" / "Sí, es correcto". */
export const LimitConfirm: React.FC<{ warnings: string[]; onConfirm: () => void; onCancel: () => void; title?: string }> = ({
  warnings,
  onConfirm,
  onCancel,
  title = '¿Los datos son correctos?',
}) => {
  useEscape(onCancel);
  return (
    <Overlay className="bg-black/70 flex items-center justify-center p-4 z-[60]" onBackdrop={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-3">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <ul className="space-y-2">
          {warnings.map((w, i) => (
            <li key={i} className="text-sm text-slate-900 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              {w}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={onCancel} className={`h-12 rounded-2xl bg-slate-100 text-slate-900 font-bold text-sm border-2 border-slate-300 ${FOCUS_B}`}>
            Corregir
          </button>
          <button onClick={onConfirm} className={`h-12 rounded-2xl bg-sky-600 text-white font-bold text-sm ${FOCUS_B}`}>
            Sí, es correcto
          </button>
        </div>
      </div>
    </Overlay>
  );
};

/** Bloqueo que no se puede saltar (estados excluyentes, retiros, vencidos). */
export const BlockedNotice: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div role="alert" className="rounded-2xl bg-rose-50 border-2 border-rose-300 p-4 flex gap-3">
    <Ban className="w-6 h-6 text-rose-700 shrink-0" />
    <div className="min-w-0">
      <p className="text-base font-black text-rose-900">{title}</p>
      {children && <div className="text-sm text-rose-900 mt-0.5">{children}</div>}
    </div>
  </div>
);

/** Aviso informativo amber. */
export const WarnNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-3 flex gap-2 text-sm text-amber-950">
    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
    <div className="min-w-0">{children}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------
export const Field: React.FC<{ label: string; hint?: React.ReactNode; error?: string | null; htmlFor?: string; children: React.ReactNode }> = ({
  label,
  hint,
  error,
  htmlFor,
  children,
}) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-bold text-slate-900">
      {label}
    </label>
    {children}
    {hint && <div className="text-xs text-slate-700">{hint}</div>}
    {error && <p className="text-sm text-rose-700 font-semibold">{error}</p>}
  </div>
);

export const TextField: React.FC<{
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  ariaLabel?: string;
  numeric?: boolean;
}> = ({ id, value, onChange, placeholder, maxLength = 80, ariaLabel, numeric }) => (
  <input
    id={id}
    aria-label={ariaLabel}
    value={value}
    maxLength={maxLength}
    placeholder={placeholder}
    inputMode={numeric ? 'numeric' : undefined}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full h-12 rounded-2xl bg-white border-2 border-slate-300 px-4 text-base text-slate-900 placeholder:text-slate-500 ${FOCUS_B}`}
  />
);

/** Número grande con unidad (kg, L, ml). */
export const BigNumberInput: React.FC<{
  id?: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  unit?: string;
  invalid?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  onEnter?: () => void;
  size?: 'md' | 'lg';
}> = ({ id, value, onChange, decimal, unit, invalid, placeholder = '0', ariaLabel, onEnter, size = 'lg' }) => (
  <div className="relative">
    <input
      id={id}
      aria-label={ariaLabel}
      value={value}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint={onEnter ? 'next' : 'done'}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      onChange={(e) => onChange(e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, ''))}
      className={`w-full ${size === 'lg' ? 'h-14 text-2xl' : 'h-12 text-xl'} rounded-2xl border-2 ${
        invalid ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white'
      } px-4 ${unit ? 'pr-16' : ''} text-right font-black tabular-nums text-slate-900 placeholder:text-slate-400 ${FOCUS_B}`}
    />
    {unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-700 pointer-events-none">{unit}</span>}
  </div>
);

/** Búsqueda por arete con teclado numérico. */
export const AreteInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Teclado de texto. Por defecto sigue Configuración › Aretes con letras (si no, numérico). */
  allowLetters?: boolean;
  autoFocus?: boolean;
  id?: string;
  /** Enter en el teclado (p. ej. saltar a la fila del arete). */
  onEnter?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}> = ({ value, onChange, placeholder = 'Buscar arete', allowLetters: allowProp, autoFocus, id, onEnter, inputRef }) => {
  const ctx = useContext(BovinoContext);
  const allowLetters: boolean = allowProp ?? !!ctx?.config.tagsWithLetters;
  return (
  <div className="relative flex items-center gap-2">
    <Search className="absolute left-4 w-6 h-6 text-slate-700 pointer-events-none" />
    <input
      ref={inputRef}
      id={id}
      value={value}
      autoFocus={autoFocus}
      aria-label={placeholder}
      inputMode={allowLetters ? 'text' : 'numeric'}
      enterKeyHint={onEnter ? 'go' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`flex-1 min-w-0 h-14 rounded-2xl border-2 border-slate-300 bg-white pl-12 pr-3 text-xl font-black tabular-nums text-slate-900 placeholder:text-base placeholder:font-semibold placeholder:text-slate-500 ${FOCUS_B}`}
    />
    {value && (
      <button type="button" onClick={() => onChange('')} aria-label="Borrar búsqueda" className={`w-12 h-14 rounded-2xl bg-slate-100 border-2 border-slate-300 text-slate-900 flex items-center justify-center shrink-0 ${FOCUS_B}`}>
        <X className="w-5 h-5" />
      </button>
    )}
  </div>
  );
};


/**
 * Campo de arete para altas (alta de ganado, crías del parto): teclado según Configuración ›
 * Aretes con letras y aviso en vivo si el arete ya es de un animal activo.
 */
export const TagField: React.FC<{
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onEnter?: () => void;
}> = ({ id, value, onChange, placeholder = 'Número de arete', ariaLabel, onEnter }) => {
  const ctx = useContext(BovinoContext);
  const letters = !!ctx?.config.tagsWithLetters;
  let owner: string | null = null;
  if (ctx && normalizeTag(value) && !isTagAvailable(ctx.data.animals, value, undefined, ctx.index)) {
    const v = ctx.index.byTag.get(normalizeTag(value));
    owner = v ? `El arete ${value} ya es de ${v.animal.name || v.categoryLabel}${v.lotId ? ` (${ctx.index.lotsById.get(v.lotId)?.name || 'lote'})` : ''}` : `El arete ${value} ya existe`;
  }
  return (
    <div className="space-y-1">
      <input
        id={id}
        value={value}
        aria-label={ariaLabel || placeholder}
        aria-invalid={!!owner}
        inputMode={letters ? 'text' : 'numeric'}
        autoCapitalize={letters ? 'characters' : undefined}
        autoComplete="off"
        maxLength={20}
        enterKeyHint={onEnter ? 'next' : 'done'}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-12 rounded-2xl border-2 ${owner ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white'} px-4 text-xl font-black tabular-nums text-slate-900 placeholder:text-sm placeholder:font-semibold placeholder:text-slate-600 ${FOCUS_B}`}
      />
      {owner && <p className="text-sm font-bold text-rose-800">{owner}</p>}
    </div>
  );
};

/**
 * Buscador de arete FIJO arriba de una lista rápida (pesaje, ordeño): los animales no llegan
 * en el orden de la lista. Salta a la fila cuando el arete coincide exacto y ningún otro arete
 * de la lista empieza igual (si no, con Enter o tocando una coincidencia). Se limpia al saltar.
 */
export const TagJump: React.FC<{
  rows: { id: string; tag: string }[];
  onJump: (id: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  placeholder?: string;
}> = ({ rows, onJump, inputRef, placeholder = 'Ir al arete…' }) => {
  const [q, setQ] = useState('');
  const nq = normalizeTag(q);
  const matches = nq ? rows.filter((r) => normalizeTag(r.tag).includes(nq)) : [];
  const exact = nq ? rows.find((r) => normalizeTag(r.tag) === nq) : undefined;
  const jump = (id: string) => {
    setQ('');
    onJump(id);
  };
  const change = (v: string) => {
    setQ(v);
    const n = normalizeTag(v);
    if (!n) return;
    const ex = rows.find((r) => normalizeTag(r.tag) === n);
    if (ex && !rows.some((r) => r.id !== ex.id && normalizeTag(r.tag).startsWith(n))) jump(ex.id);
  };
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-2 bg-white border-b-2 border-slate-200 space-y-2">
      <AreteInput value={q} onChange={change} placeholder={placeholder} inputRef={inputRef} onEnter={() => (exact || matches[0]) && jump((exact || matches[0]).id)} />
      {nq && !exact && (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {matches.length === 0 && <p className="text-sm font-bold text-slate-900">Ningún arete de la lista coincide.</p>}
          {matches.slice(0, 6).map((r) => (
            <button key={r.id} type="button" onClick={() => jump(r.id)} className={`min-h-12 px-4 rounded-xl bg-sky-100 text-sky-900 text-lg font-black tabular-nums border-2 border-sky-300 ${FOCUS_B}`}>
              #{r.tag}
            </button>
          ))}
          {matches.length > 6 && <p className="text-sm font-bold text-slate-900 self-center">+{matches.length - 6} más: sigue escribiendo</p>}
        </div>
      )}
    </div>
  );
};

/** Fecha con calendario nativo; por defecto no acepta fechas futuras. */
export const DateField: React.FC<{ value: string; onChange: (v: string) => void; min?: string; max?: string | null; ariaLabel?: string; compact?: boolean }> = ({
  value,
  onChange,
  min,
  max,
  ariaLabel = 'Fecha',
  compact,
}) => (
  <label className={`relative ${compact ? 'h-11' : 'h-12'} px-4 bg-white border-2 border-slate-300 rounded-2xl font-bold text-base text-slate-900 flex items-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-sky-600`}>
    <CalendarDays className="w-5 h-5 text-sky-700" />
    <span className="whitespace-nowrap">{value ? fdw(value) : 'Elegir fecha'}</span>
    <input
      type="date"
      aria-label={ariaLabel}
      value={value}
      min={min}
      max={max === null ? undefined : max || todayISO()}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="absolute inset-0 opacity-0 cursor-pointer"
    />
  </label>
);

/** Interruptor grande (alto contraste). */
export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; tone?: string }> = ({ checked, onChange, label, hint }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`w-full flex items-center justify-between gap-3 min-h-12 text-left rounded-xl ${FOCUS_B}`}>
    <span className="min-w-0">
      <span className="block text-sm font-bold text-slate-900">{label}</span>
      {hint && <span className="block text-xs text-slate-700">{hint}</span>}
    </span>
    <span className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${checked ? 'bg-sky-600' : 'bg-slate-400'}`}>
      <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

/**
 * Selector de valores recientes (proveedor, inseminador...): chips con las opciones y "Otro"
 * que abre el campo de texto. Así no hay que volver a escribir el mismo nombre.
 */
export const RecentChoice: React.FC<{ options: string[]; value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string }> = ({ options, value, onChange, placeholder, ariaLabel }) => {
  const opts = options.filter((o, i) => o && options.indexOf(o) === i).slice(0, 6);
  const [other, setOther] = useState(() => !!value && !opts.includes(value));
  const OTHER = '__otro__';
  if (!opts.length) return <TextField value={value} onChange={onChange} placeholder={placeholder} />;
  return (
    <div className="space-y-2">
      <Chips
        ariaLabel={ariaLabel}
        options={[...opts.map((o) => ({ key: o, label: o })), { key: OTHER, label: 'Otro' }]}
        value={other ? OTHER : value || null}
        onChange={(k) => {
          if (k === OTHER) {
            setOther(true);
            onChange('');
          } else {
            setOther(false);
            onChange(k);
          }
        }}
      />
      {other && <TextField value={value} onChange={onChange} placeholder={placeholder} />}
    </div>
  );
};

/** Chips grandes para elegir una opción (formularios). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  options: { key: T; label: string; icon?: React.ReactNode; disabled?: boolean }[];
  value: T | undefined | null;
  onChange: (v: T) => void;
  size?: 'md' | 'lg';
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.key)}
            className={`${size === 'lg' ? 'h-14 px-5 text-base' : 'h-12 px-4 text-sm'} rounded-2xl border-2 font-bold flex items-center gap-2 disabled:opacity-50 ${
              on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'
            } ${FOCUS_B}`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Filtros de una fila con scroll horizontal (con contador opcional). */
export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.key)}
            className={`h-11 px-4 rounded-full border-2 text-sm font-bold shrink-0 flex items-center gap-1.5 ${
              on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-800'
            } ${FOCUS_B}`}
          >
            {o.label}
            {o.count !== undefined && <span className={`tabular-nums ${on ? 'text-sky-100' : 'text-slate-700'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Botón que abre un selector (potrero, lote, insumo...). */
export const PickerButton: React.FC<{ label: string; value?: string; placeholder: string; onClick: () => void; icon?: React.ReactNode; invalid?: boolean; dashed?: boolean }> = ({
  label,
  value,
  placeholder,
  onClick,
  icon,
  invalid,
  dashed,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${label}: ${value || placeholder}`}
    className={`w-full ${dashed && !value ? 'h-16 border-dashed border-slate-400' : 'h-14 border-slate-300'} ${invalid ? 'border-rose-500 bg-rose-50' : 'bg-white'} border-2 rounded-2xl px-4 flex items-center gap-3 text-left ${FOCUS_B}`}
  >
    {icon && <span className="text-sky-700 shrink-0">{icon}</span>}
    <span className={`flex-1 min-w-0 truncate text-base ${value ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>{value || placeholder}</span>
    <ChevronRight className="w-5 h-5 text-slate-700 shrink-0" />
  </button>
);

// ---------------------------------------------------------------------------
// Moneda dual
// ---------------------------------------------------------------------------
export interface MoneyValue {
  amount: string;
  in: 'USD' | 'LOCAL';
}
export const emptyMoney = (): MoneyValue => ({ amount: '', in: 'USD' });

/** Convierte el valor del campo a la entrada del dominio (null si está vacío o no es válido). */
export function toMoneyInput(v: MoneyValue, cfg: Pick<BovinoConfig, 'exchangeRate'>): BovinoMoneyInput | null {
  const a = toNum(v.amount);
  if (!isFinite(a) || a < 0) return null;
  return { amount: a, in: v.in, rate: v.in === 'LOCAL' && cfg.exchangeRate > 0 ? cfg.exchangeRate : undefined };
}

/** Monto en USD o moneda local con la conversión a la tasa del día. Nunca se muestra al operario. */
export const MoneyField: React.FC<{ id?: string; value: MoneyValue; onChange: (v: MoneyValue) => void; suffix?: string; invalid?: boolean }> = ({ id, value, onChange, suffix, invalid }) => {
  const { config } = useBovino();
  const local = config.localCurrency;
  const rate = config.exchangeRate;
  const hasLocal = !!local && rate > 0;
  const a = toNum(value.amount);
  const conv = isFinite(a) && hasLocal ? (value.in === 'USD' ? `≈ ${num(a * rate, 2)} ${local}` : `≈ ${usd(a / rate)}`) : '';
  return (
    <div className="space-y-1.5">
      {hasLocal && (
        <div role="radiogroup" aria-label="Moneda" className="grid grid-cols-2 gap-2">
          {(['USD', 'LOCAL'] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={value.in === c}
              onClick={() => onChange({ ...value, in: c })}
              className={`h-10 rounded-xl border-2 text-sm font-bold ${value.in === c ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-800'} ${FOCUS_B}`}
            >
              {c === 'USD' ? 'USD' : local}
            </button>
          ))}
        </div>
      )}
      <BigNumberInput id={id} decimal value={value.amount} onChange={(amount) => onChange({ ...value, amount })} unit={`${value.in === 'USD' ? 'US$' : local}${suffix || ''}`} invalid={invalid} />
      {hasLocal ? (
        <p className="text-xs text-slate-700">
          {conv} · tasa {num(rate, 2)}
          {config.exchangeRateDate ? ` del ${fd(config.exchangeRateDate)}` : ''}
        </p>
      ) : (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">Configura la moneda local y la tasa del día para registrar en moneda local.</p>
      )}
    </div>
  );
};

/** Muestra un monto (USD + equivalente local). Devuelve null si el rol no ve costos. */
export const Money: React.FC<{ value: BovinoMoney | number | undefined; className?: string; showLocal?: boolean }> = ({ value, className = '', showLocal = true }) => {
  const { perms } = useBovino();
  if (!perms.verCostos) return null;
  const m: BovinoMoney = typeof value === 'number' || value === undefined ? { usd: safe(value) } : value;
  return (
    <span className={`tabular-nums ${className}`}>
      {usd(m.usd)}
      {showLocal && m.local !== undefined && m.currency && <span className="block text-xs font-semibold text-slate-700">{`${num(m.local, 2)} ${m.currency}`}</span>}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Chips de estado
// ---------------------------------------------------------------------------
export type ChipTone = 'ok' | 'warn' | 'bad' | 'retiro' | 'info' | 'neutral' | 'solid';
const CHIP_TONE: Record<ChipTone, string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-900',
  bad: 'bg-rose-100 text-rose-800',
  retiro: 'bg-rose-600 text-white',
  info: 'bg-sky-100 text-sky-800',
  neutral: 'bg-slate-200 text-slate-800',
  solid: 'bg-sky-600 text-white',
};

export const StatusChip: React.FC<{ tone: ChipTone; children: React.ReactNode; title?: string }> = ({ tone, children, title }) => (
  <span title={title} className={`inline-flex items-center h-7 px-2.5 rounded-full text-xs font-bold whitespace-nowrap ${CHIP_TONE[tone]}`}>
    {children}
  </span>
);

export const RetiroChip: React.FC<{ w: BovinoWithdrawal; only?: 'carne' | 'leche' }> = ({ w, only }) => (
  <>
    {w.meatActive && only !== 'leche' && (
      <span aria-label={`Retiro de carne hasta el ${fd(w.meatUntil)}`}>
        <StatusChip tone="retiro">Retiro carne {w.meatDaysLeft} d</StatusChip>
      </span>
    )}
    {w.milkActive && only !== 'carne' && (
      <span aria-label={`Retiro de leche hasta el ${fd(w.milkUntil)}`}>
        <StatusChip tone="retiro">Retiro leche {w.milkDaysLeft} d</StatusChip>
      </span>
    )}
  </>
);

const GMD_WORD: Record<GmdColor, string> = { verde: 'Óptima', amarillo: 'Baja', rojo: 'Pérdida', sin_dato: 'Sin dato' };
const GMD_CLS: Record<GmdColor, string> = {
  verde: 'bg-emerald-600 text-white',
  amarillo: 'bg-amber-400 text-slate-900',
  rojo: 'bg-rose-600 text-white',
  sin_dato: 'bg-slate-200 text-slate-800',
};
export const GmdChip: React.FC<{ gmd: number | null | undefined; color: GmdColor }> = ({ gmd, color }) => (
  <span className={`inline-flex items-center h-7 px-2.5 rounded-full text-xs font-bold whitespace-nowrap ${GMD_CLS[color]}`}>
    {gmd === null || gmd === undefined ? 'GMD sin dato' : `${num(gmd, 2)} kg/d · ${GMD_WORD[color]}`}
  </span>
);

const REPRO_TONE: Record<BovinoReproState, string> = {
  vacia: 'bg-slate-200 text-slate-800',
  servida: 'bg-sky-100 text-sky-800',
  preñada: 'bg-emerald-100 text-emerald-800',
  seca: 'bg-amber-100 text-amber-900',
  parida: 'bg-sky-600 text-white',
  lactando: 'bg-sky-600 text-white',
  no_aplica: 'bg-slate-200 text-slate-800',
};
export const ReproChip: React.FC<{ state: BovinoReproState }> = ({ state }) =>
  state === 'no_aplica' ? null : (
    <span className={`inline-flex items-center h-7 px-2.5 rounded-full text-xs font-bold whitespace-nowrap ${REPRO_TONE[state]}`}>{BOVINO_REPRO_LABEL[state]}</span>
  );

/** Chips de estado de un animal (máximo `max` y "+n"). */
export function animalChips(v: BovinoAnimalView): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  if (v.withdrawal.meatActive || v.withdrawal.milkActive) out.push(<RetiroChip key="ret" w={v.withdrawal} />);
  if (!v.active) out.push(<StatusChip key="st" tone="neutral">{v.status === 'vendido' ? 'Vendido' : v.status === 'muerto' ? 'Muerto' : 'Descarte'}</StatusChip>);
  if (v.repro && v.sex === 'hembra' && v.repro.state !== 'no_aplica' && (v.category === 'vaca' || v.category === 'novilla')) out.push(<ReproChip key="rep" state={v.repro.state} />);
  if (/^P-\d+/i.test(v.tag)) out.push(<StatusChip key="tag" tone="warn">Arete pendiente</StatusChip>);
  return out;
}

// ---------------------------------------------------------------------------
// Filas, mosaicos y contadores
// ---------------------------------------------------------------------------
export const AnimalRow: React.FC<{
  v: BovinoAnimalView;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
  right?: React.ReactNode;
  subtitle?: string;
  disabled?: boolean;
  disabledReason?: string;
}> = ({ v, onClick, selectable, selected, right, subtitle, disabled, disabledReason }) => {
  const { index } = useBovino();
  const lot = v.lotId ? index.lotsById.get(v.lotId)?.name : undefined;
  const pad = v.paddockId ? index.paddocksById.get(v.paddockId)?.name : undefined;
  const chips = animalChips(v);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selectable ? !!selected : undefined}
      className={`w-full min-h-16 px-3 py-2 flex items-center gap-3 text-left bg-white rounded-2xl border-2 ${
        selected ? 'border-sky-600 bg-sky-50' : 'border-slate-200'
      } ${disabled ? 'opacity-60' : 'active:border-sky-500'} ${FOCUS_B}`}
    >
      {selectable && (
        <span className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-400 bg-white'}`}>
          {selected && <span className="text-sm font-black">✓</span>}
        </span>
      )}
      <span className="text-lg font-black tabular-nums text-slate-900 min-w-[3.5rem]">#{v.tag}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-900 truncate">
          {v.animal.name ? `${v.animal.name} · ` : ''}
          {v.categoryLabel}
          {v.sex === 'hembra' ? ' ♀' : ' ♂'}
        </span>
        <span className="block text-xs text-slate-700 truncate">
          {disabledReason || subtitle || [lot, pad ? `Potrero ${pad}` : ''].filter(Boolean).join(' · ') || 'Sin lote ni potrero'}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1 shrink-0 max-w-[45%]">
        {right}
        {chips.slice(0, 2)}
        {chips.length > 2 && <span className="text-xs font-bold text-slate-700">+{chips.length - 2}</span>}
      </span>
      {!selectable && <ChevronRight className="w-5 h-5 text-slate-700 shrink-0" />}
    </button>
  );
};

/** Mosaico de hub (Campo, accesos rápidos). */
export const Tile: React.FC<{ icon: React.ReactNode; title: string; detail?: string; onClick: () => void; compact?: boolean; badge?: number; soon?: boolean }> = ({
  icon,
  title,
  detail,
  onClick,
  compact,
  badge,
  soon,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative ${compact ? 'min-h-20 p-3' : 'min-h-28 p-4'} rounded-2xl bg-white border-2 border-slate-200 text-left flex flex-col gap-2 active:scale-[0.98] active:border-sky-500 ${FOCUS_B}`}
  >
    <span className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center`}>{icon}</span>
    <span className={`${compact ? 'text-sm' : 'text-base'} font-black text-slate-900 leading-tight`}>{title}</span>
    {(detail || soon) && <span className="text-sm text-slate-800 leading-snug">{soon ? 'Próximamente' : detail}</span>}
    {!!badge && (
      <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-slate-900 text-xs font-black flex items-center justify-center">{badge}</span>
    )}
  </button>
);

export const CounterTile: React.FC<{ label: string; value: number; onClick?: () => void }> = ({ label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${label}: ${value}`}
    className={`rounded-2xl bg-white border-2 border-slate-200 h-20 flex flex-col items-center justify-center active:border-sky-500 ${FOCUS_B}`}
  >
    <span className="text-2xl font-black tabular-nums text-slate-900">{num(value)}</span>
    <span className="text-xs font-bold text-slate-800">{label}</span>
  </button>
);

export const StatStrip: React.FC<{ items: { label: string; value: React.ReactNode; tone?: string }[] }> = ({ items }) => (
  <div className={`${B.card} px-2 py-3 grid divide-x divide-slate-200`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map((it) => (
      <div key={it.label} className="px-1 text-center min-w-0">
        <p className={`text-lg font-black tabular-nums truncate ${it.tone || 'text-slate-900'}`}>{it.value}</p>
        <p className="text-xs text-slate-700 truncate">{it.label}</p>
      </div>
    ))}
  </div>
);

/** Botón flotante (solo en listas; el contenido deja pb-24). */
export const Fab: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`absolute bottom-4 right-4 z-20 h-14 pl-2 pr-5 rounded-full bg-sky-600 text-white font-bold text-sm shadow-lg flex items-center gap-2 active:scale-95 ${FOCUS_B}`}
  >
    <span className="w-10 h-10 rounded-full bg-white text-sky-700 flex items-center justify-center">
      <Plus className="w-5 h-5" />
    </span>
    {label}
  </button>
);

export const EmptyBlock: React.FC<{ icon: React.ReactNode; title: string; text?: string; cta?: string; onCta?: () => void; children?: React.ReactNode }> = ({
  icon,
  title,
  text,
  cta,
  onCta,
  children,
}) => (
  <div className="text-center py-8 px-4 space-y-3">
    <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center mx-auto">{icon}</div>
    <p className="text-base font-black text-slate-900">{title}</p>
    {text && <p className="text-sm text-slate-700 max-w-xs mx-auto">{text}</p>}
    {cta && onCta && (
      <button type="button" onClick={onCta} className={`h-12 px-6 rounded-2xl bg-sky-600 text-white font-bold ${FOCUS_B}`}>
        {cta}
      </button>
    )}
    {children}
  </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex items-center justify-between gap-2 min-h-8">
    <h3 className="text-base font-black text-slate-900">{children}</h3>
    {right}
  </div>
);

export const PrimaryBtn: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean; className?: string; tone?: 'sky' | 'dark' | 'rose' | 'emerald' }> = ({
  onClick,
  children,
  disabled,
  className = '',
  tone = 'sky',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 ${
      tone === 'dark' ? 'bg-slate-900 text-white' : tone === 'rose' ? 'bg-rose-600 text-white' : tone === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white hover:bg-sky-700'
    } ${FOCUS_B} ${className}`}
  >
    {children}
  </button>
);

export const SecondaryBtn: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean; className?: string }> = ({ onClick, children, disabled, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`h-12 rounded-2xl font-bold text-sm bg-white border-2 border-slate-300 text-slate-900 flex items-center justify-center gap-2 disabled:opacity-50 ${FOCUS_B} ${className}`}
  >
    {children}
  </button>
);

/** Par etiqueta / valor de las fichas. */
export const KV: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="min-w-0">
    <p className="text-xs text-slate-700">{k}</p>
    <p className="text-sm font-bold text-slate-900 truncate">{v}</p>
  </div>
);

/** Fila de menú (Más, listas de opciones). */
export const MenuRow: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; onClick: () => void; badge?: number; accent?: boolean }> = ({
  icon,
  title,
  subtitle,
  onClick,
  badge,
  accent,
}) => (
  <button type="button" onClick={onClick} className={`w-full min-h-16 px-4 py-2 flex items-center gap-3 text-left bg-white ${FOCUS_B}`}>
    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-700'}`}>{icon}</span>
    <span className="flex-1 min-w-0">
      <span className={`block text-base font-bold truncate ${accent ? 'text-sky-700' : 'text-slate-900'}`}>{title}</span>
      {subtitle && <span className="block text-xs text-slate-700 truncate">{subtitle}</span>}
    </span>
    {!!badge && <span className="min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-slate-900 text-xs font-black flex items-center justify-center">{badge}</span>}
    <ChevronRight className="w-5 h-5 text-slate-700 shrink-0" />
  </button>
);

/**
 * Barra inferior contextual (selección múltiple): se monta en #phone-overlay-root y
 * cubre la BovinoNav, así nunca hay dos barras apiladas.
 */
export const BottomBarPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const root = typeof document !== 'undefined' ? document.getElementById('phone-overlay-root') : null;
  const node = (
    <div className={`${root ? 'absolute' : 'fixed'} bottom-0 inset-x-0 z-40 pointer-events-auto bg-slate-900 text-white px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-4 gap-1 items-center`}>
      {children}
    </div>
  );
  return createPortal(node, root || document.body);
};

/** Contenedor de pantalla con scroll propio. */
export const Screen: React.FC<{ children: React.ReactNode; className?: string; padBottom?: boolean }> = ({ children, className = '', padBottom }) => (
  <div className={`p-4 space-y-4 ${padBottom ? 'pb-24' : 'pb-6'} ${className}`}>{children}</div>
);

/** Carga incremental de 50 en 50 ("Ver 50 más"). */
export function usePaged<T>(list: T[], size = 50) {
  const [n, setN] = useState(size);
  const shown = list.slice(0, n);
  const more = list.length > n ? <SecondaryBtn className="w-full" onClick={() => setN((x) => x + size)}>{`Ver ${Math.min(size, list.length - n)} más`}</SecondaryBtn> : null;
  return { shown, more, reset: () => setN(size) };
}
