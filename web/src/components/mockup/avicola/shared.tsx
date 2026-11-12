/**
 * ============================================================================
 * MÓDULO AVÍCOLA · Primitivas de UI compartidas
 * ============================================================================
 * Estructura de las pantallas de referencia con la paleta de la app:
 * tarjetas blancas rounded-2xl, neutros slate y acento avícola amber.
 * No contiene lógica de dominio: los cálculos vienen de models/avicolaDomain.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronLeft, Minus, Plus, X, CalendarDays, TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { AvicolaStage } from '../../../models/FarmModel';
import type { StageRange } from '../../../models/avicolaReference';
import type { AvicolaDomainResult } from '../../../models/avicolaDomain';
import { parseISODate } from '../../../utils/dates';
import { isTopBackHandler, pushBackHandler } from '../../../utils/backButton';

// ---------------------------------------------------------------------------
// Tipos de navegación del módulo
// ---------------------------------------------------------------------------
export type LotTab = 'ventas' | 'gastos' | 'ingresos' | 'control' | 'gestion';
export type ControlSub = 'pesos' | 'alimentacion' | 'mortalidad' | 'sanidad';
export type GestionSub = 'resumen' | 'reportes' | 'bodega';

/** Petición externa de navegación (Home de la granja, alertas globales). */
export interface AvicolaFocusRequest {
  nonce: number;
  newLot?: boolean;
  /** Abre el calendario sanitario de todos los lotes en el Home avícola. */
  openCalendar?: boolean;
  tab?: LotTab;
  sub?: ControlSub;
  gestionSub?: GestionSub;
}

// ---------------------------------------------------------------------------
// Formateadores
// ---------------------------------------------------------------------------
const safe = (n: unknown) => {
  const v = Number(n);
  return isFinite(v) ? v : 0;
};

/**
 * Montos con el mismo locale que el resto de la app (Home de la granja y módulo porcino
 * usan toLocaleString() sin locale), para que una cifra se vea igual en todas las pantallas.
 * Sin NaN; negativos con signo "−".
 */
export function usd(n: unknown): string {
  const v = Math.round(safe(n) * 100) / 100;
  return `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function num(n: unknown, decimals = 0): string {
  return safe(n).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

/** Peso en gramos legible: "2,45 kg" desde 1000 g, si no "850 g". */
export const fmtW = (g: number) => (g >= 1000 ? `${num(g / 1000, 2)} kg` : `${num(g)} g`);

/** "—" cuando no hay dato. */
export function orDash(n: unknown, fmt: (v: number) => string = (v) => num(v, 1)): string {
  const v = safe(n);
  return v === 0 ? '—' : fmt(v);
}

/** "jue. 29 de oct." */
export function shortDate(iso?: string): string {
  const d = parseISODate(iso);
  if (!d) return iso || '—';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "jue, 29 oct 2026" */
export function longDate(iso?: string): string {
  const d = parseISODate(iso);
  if (!d) return iso || '—';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`;

/** Parsea un número escrito por el usuario (acepta coma decimal). NaN si está vacío. */
export function parseNum(s: string): number {
  if (s === undefined || s === null) return NaN;
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return NaN;
  return Number(t);
}

export function isOk(r: AvicolaDomainResult): r is Extract<AvicolaDomainResult, { ok: true }> {
  return r.ok;
}

// ---------------------------------------------------------------------------
// Tokens de color
// ---------------------------------------------------------------------------
export const STAGE_STYLES: Record<AvicolaStage, { seg: string; chip: string; text: string; border: string }> = {
  Preinicio: { seg: 'bg-sky-500', chip: 'bg-sky-100 text-sky-800', text: 'text-sky-700', border: 'border-sky-200' },
  Inicio: { seg: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-700', border: 'border-emerald-200' },
  Engorde: { seg: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800', text: 'text-amber-700', border: 'border-amber-200' },
  Finalización: { seg: 'bg-rose-500', chip: 'bg-rose-100 text-rose-800', text: 'text-rose-700', border: 'border-rose-200' },
};

export type Tone = 'amber' | 'violet' | 'rose' | 'emerald' | 'indigo' | 'sky' | 'slate';

export const TONE: Record<Tone, { header: string; solid: string; soft: string; text: string; outline: string; sub: string }> = {
  amber: { header: 'bg-amber-400 text-slate-900', solid: 'bg-amber-400 text-slate-900 hover:bg-amber-300', soft: 'bg-amber-50 text-amber-800', text: 'text-amber-700', outline: 'border-amber-300 text-amber-800', sub: 'text-slate-800' },
  violet: { header: 'bg-violet-600 text-white', solid: 'bg-violet-600 text-white hover:bg-violet-700', soft: 'bg-violet-50 text-violet-700', text: 'text-violet-700', outline: 'border-violet-200 text-violet-700', sub: 'text-violet-100' },
  rose: { header: 'bg-rose-600 text-white', solid: 'bg-rose-600 text-white hover:bg-rose-700', soft: 'bg-rose-50 text-rose-700', text: 'text-rose-700', outline: 'border-rose-200 text-rose-700', sub: 'text-rose-100' },
  emerald: { header: 'bg-emerald-600 text-white', solid: 'bg-emerald-600 text-white hover:bg-emerald-700', soft: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', outline: 'border-emerald-200 text-emerald-700', sub: 'text-emerald-100' },
  indigo: { header: 'bg-indigo-600 text-white', solid: 'bg-indigo-600 text-white hover:bg-indigo-700', soft: 'bg-indigo-50 text-indigo-700', text: 'text-indigo-700', outline: 'border-indigo-200 text-indigo-700', sub: 'text-indigo-100' },
  sky: { header: 'bg-sky-600 text-white', solid: 'bg-sky-600 text-white hover:bg-sky-700', soft: 'bg-sky-50 text-sky-700', text: 'text-sky-700', outline: 'border-sky-200 text-sky-700', sub: 'text-sky-100' },
  slate: { header: 'bg-slate-900 text-white', solid: 'bg-slate-900 text-white hover:bg-slate-800', soft: 'bg-slate-100 text-slate-700', text: 'text-slate-700', outline: 'border-slate-200 text-slate-700', sub: 'text-slate-300' },
};

export const CARD = 'bg-white rounded-2xl border border-slate-200/90 shadow-xs';
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';

// ---------------------------------------------------------------------------
// Capa de superposición del teléfono (portal)
// ---------------------------------------------------------------------------
/**
 * Las hojas del módulo se montan en #phone-overlay-root (dentro del teléfono:
 * marco web o pantalla nativa). Si no existe, se usa document.body con fixed.
 */
export const Overlay: React.FC<{ children: React.ReactNode; className?: string; onBackdrop?: () => void }> = ({
  children,
  className = '',
  onBackdrop,
}) => {
  const root = typeof document !== 'undefined' ? document.getElementById('phone-overlay-root') : null;
  const pos = root ? 'absolute' : 'fixed';
  const node = (
    <div
      // text-slate-900: los campos heredan un color oscuro (el contenedor del teléfono es claro sobre oscuro)
      className={`${pos} inset-0 z-50 pointer-events-auto text-slate-900 animate-in fade-in duration-150 ${className}`}
      onMouseDown={(e) => {
        if (onBackdrop && e.target === e.currentTarget) onBackdrop();
      }}
    >
      {children}
    </div>
  );
  return createPortal(node, root || document.body);
};

/**
 * Cierre de hoja con Escape y con el botón Atrás de Android (pila global):
 * se registra una sola vez al montar, así las hojas anidadas conservan su orden.
 */
export function useEscape(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const close = () => ref.current();
    const h = (e: KeyboardEvent) => {
      // Escape solo cierra la hoja de arriba, no todas a la vez
      if (e.key === 'Escape' && isTopBackHandler(close)) close();
    };
    const unregister = pushBackHandler(close);
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('keydown', h);
      unregister();
    };
  }, []);
}

/** Pantalla completa de formulario: cabecera de color + hoja blanca + pie fijo. */
export const FormSheet: React.FC<{
  tone: Tone;
  title: string;
  subtitle?: string;
  question?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Si hay datos escritos, X / Escape / Atrás piden confirmación antes de descartarlos. */
  dirty?: boolean;
}> = ({ tone, title, subtitle, question, header, footer, onClose, children, dirty }) => {
  const [askDiscard, setAskDiscard] = useState(false);
  const requestClose = () => (dirty ? setAskDiscard(true) : onClose());
  useEscape(requestClose);
  const t = TONE[tone];
  return (
    <Overlay className="bg-slate-100 flex flex-col">
      {askDiscard && (
        <ConfirmDialog
          title="¿Descartar cambios?"
          message="Los datos que escribiste en este formulario se perderán."
          confirmLabel="Descartar"
          danger
          onConfirm={() => {
            setAskDiscard(false);
            onClose();
          }}
          onCancel={() => setAskDiscard(false)}
        />
      )}
      <div role="dialog" aria-modal="true" aria-label={title} className="flex flex-col h-full min-h-0">
        <div className={`${t.header} px-4 pt-3 pb-9 shrink-0`}>
          <div className="flex items-center gap-2">
            <button onClick={requestClose} aria-label="Cerrar" className={`w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-black/10 ${FOCUS}`}>
              <X className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-black leading-tight truncate">{title}</h2>
              {subtitle && <p className={`text-xs ${t.sub} truncate`}>{subtitle}</p>}
            </div>
          </div>
          {question && <p className="text-xl font-black mt-3">{question}</p>}
          {header && <div className="mt-3">{header}</div>}
        </div>
        <div className="-mt-6 bg-white rounded-t-3xl px-4 pt-5 pb-6 flex-1 overflow-y-auto space-y-5 min-h-0">{children}</div>
        {footer && (
          <div className="bg-white border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">{footer}</div>
        )}
      </div>
    </Overlay>
  );
};

/** Hoja inferior pequeña. */
export const BottomSheet: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconClass?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dark?: boolean;
}> = ({ title, subtitle, icon, iconClass = 'bg-amber-50 text-amber-700', onClose, children, footer, dark }) => {
  useEscape(onClose);
  return (
    <Overlay className="bg-black/60 backdrop-blur-xs flex items-end" onBackdrop={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white w-full max-h-[88%] rounded-t-3xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-200">
        <div className={`${dark ? 'bg-slate-900 text-white' : 'bg-white'} px-4 pt-2 pb-3 shrink-0 border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className={`w-10 h-1 rounded-full mx-auto mb-2 ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
          <div className="flex items-center gap-2.5">
            {icon && <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>{icon}</div>}
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold text-base leading-tight truncate ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              {subtitle && <p className={`text-[11px] truncate ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Cerrar" className={`w-10 h-10 rounded-full flex items-center justify-center ${dark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${FOCUS}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">{children}</div>
        {footer && <div className="border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0 bg-white">{footer}</div>}
      </div>
    </Overlay>
  );
};

/** Diálogo centrado de confirmación. */
export const ConfirmDialog: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  icon?: React.ReactNode;
  requireText?: string;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, confirmLabel, danger, icon, requireText, error, onConfirm, onCancel }) => {
  useEscape(onCancel);
  const [typed, setTyped] = useState('');
  const blocked = !!requireText && typed.trim().toLowerCase() !== requireText.trim().toLowerCase();
  return (
    <Overlay className="bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onBackdrop={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>
          {icon || <AlertTriangle className="w-6 h-6" />}
        </div>
        <h3 className="font-bold text-slate-900 text-base">{title}</h3>
        <div className="text-xs text-slate-600 space-y-2">{message}</div>
        {requireText && (
          <div>
            <label className="text-[11px] text-slate-500" htmlFor="confirm-text">
              Escribe <strong className="text-slate-800">{requireText}</strong> para confirmar
            </label>
            <input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} className={`mt-1 w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm ${FOCUS}`} />
          </div>
        )}
        <ErrorBox error={error} />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={onCancel} className={`h-11 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm ${FOCUS}`}>
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={blocked}
            className={`h-11 rounded-xl font-bold text-sm disabled:opacity-50 ${danger ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'} ${FOCUS}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
};

export const ErrorBox: React.FC<{ error?: string | null }> = ({ error }) =>
  error ? (
    <div role="alert" className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
      <span>{error}</span>
    </div>
  ) : null;

export const SectionLabel: React.FC<{ index?: number; label: string; right?: React.ReactNode }> = ({ index, label, right }) => (
  <div className="flex items-center justify-between min-h-6">
    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
      {index !== undefined ? `${index} · ` : ''}
      {label}
    </span>
    {right}
  </div>
);

export const FieldRow: React.FC<{ label: string; hint?: React.ReactNode; error?: string | null; htmlFor?: string; children: React.ReactNode }> = ({
  label,
  hint,
  error,
  htmlFor,
  children,
}) => (
  <div className="py-2 border-b border-slate-100 last:border-b-0">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-800">
          {label}
        </label>
        {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
    {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
  </div>
);

export const NumberInput: React.FC<{
  id?: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  ariaLabel?: string;
}> = ({ id, value, onChange, decimal, placeholder = '0', className = 'w-32 bg-slate-50 text-slate-900', invalid, ariaLabel }) => (
  <input
    id={id}
    aria-label={ariaLabel}
    value={value}
    inputMode={decimal ? 'decimal' : 'numeric'}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, ''))}
    className={`h-11 rounded-xl text-right px-3 tabular-nums font-bold text-sm border ${invalid ? 'border-rose-300' : 'border-slate-200'} ${className} ${FOCUS}`}
  />
);

export const TextInput: React.FC<{ id?: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; ariaLabel?: string }> = ({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  ariaLabel,
}) => (
  <input
    id={id}
    aria-label={ariaLabel}
    value={value}
    maxLength={maxLength}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm text-slate-900 ${FOCUS}`}
  />
);

export const Stepper: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  tone?: Tone;
  ariaLabel?: string;
}> = ({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, tone = 'slate', ariaLabel = 'Cantidad' }) => {
  const t = TONE[tone];
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v || 0))));
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Restar" onClick={() => set(value - 1)} disabled={value <= min} className={`w-11 h-11 rounded-full ${t.soft} flex items-center justify-center disabled:opacity-40 ${FOCUS}`}>
        <Minus className="w-4 h-4" />
      </button>
      <input
        aria-label={ariaLabel}
        value={String(value)}
        inputMode="numeric"
        onChange={(e) => set(Number(e.target.value.replace(/[^0-9]/g, '')))}
        className={`w-16 h-12 rounded-2xl border border-slate-200 text-slate-900 text-center text-lg font-bold tabular-nums ${FOCUS}`}
      />
      <button type="button" aria-label="Sumar" onClick={() => set(value + 1)} disabled={value >= max} className={`w-11 h-11 rounded-full ${t.soft} flex items-center justify-center disabled:opacity-40 ${FOCUS}`}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};

export interface ChipOption<T extends string> {
  key: T;
  label: string;
  icon?: React.ReactNode;
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  tone = 'slate',
  onColor,
  size = 'md',
}: {
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  tone?: Tone;
  onColor?: boolean;
  size?: 'md' | 'lg';
}) {
  const t = TONE[tone];
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const active = o.key === value;
        const cls = onColor
          ? active
            ? `bg-white ${t.text} border-white`
            : 'bg-white/20 text-current border-white/30 hover:bg-white/30'
          : active
            ? `${t.solid} border-transparent`
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={`${size === 'lg' ? 'h-12' : 'h-10'} ${o.icon ? 'pl-1.5' : 'pl-4'} pr-4 rounded-full border text-sm font-semibold flex items-center gap-2 transition-colors ${cls} ${FOCUS}`}
          >
            {o.icon && (
              <span className={`w-8 h-8 rounded-full flex items-center justify-center ${onColor ? `bg-white ${t.text}` : active ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>
                {o.icon}
              </span>
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Fecha legible que envuelve un <input type="date"> nativo. */
export const DatePill: React.FC<{ value: string; onChange: (v: string) => void; min?: string; max?: string; ariaLabel?: string }> = ({
  value,
  onChange,
  min,
  max,
  ariaLabel = 'Fecha',
}) => (
  <label className={`relative h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 flex items-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-amber-500`}>
    <CalendarDays className="w-4 h-4 text-amber-600" />
    <span className="whitespace-nowrap">{shortDate(value)}</span>
    <input
      type="date"
      aria-label={ariaLabel}
      value={value}
      min={min}
      max={max}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="absolute inset-0 opacity-0 cursor-pointer"
    />
  </label>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; tone?: Tone }> = ({
  checked,
  onChange,
  label,
  hint,
  tone = 'amber',
}) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`w-full flex items-center justify-between gap-3 min-h-11 text-left ${FOCUS} rounded-xl`}>
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-slate-800">{label}</span>
      {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
    </span>
    <span className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${checked ? (tone === 'amber' ? 'bg-amber-500' : TONE[tone].solid.split(' ')[0]) : 'bg-slate-300'}`}>
      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

/** Barra de 4 etapas proporcional con marcador del día actual. */
export const StageProgressBar: React.FC<{ day: number; totalDays: number; ranges: StageRange[]; showLabels?: boolean; size?: 'sm' | 'md'; currentStage?: AvicolaStage }> = ({
  day,
  totalDays,
  ranges,
  showLabels,
  size = 'sm',
  currentStage,
}) => {
  const total = Math.max(1, totalDays);
  const pct = Math.min(100, Math.max(0, ((Math.min(Math.max(day, 0), total) - 0.5) / total) * 100));
  return (
    <div>
      <div className="relative" role="img" aria-label={`Día ${day} de ${total}`}>
        <div className={`flex gap-1 ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}>
          {ranges.map((r) => {
            const w = ((r.toDay - r.fromDay + 1) / total) * 100;
            const done = day >= r.fromDay;
            return <div key={r.stage} style={{ width: `${w}%` }} className={`rounded-full ${STAGE_STYLES[r.stage].seg} ${done ? '' : 'opacity-30'}`} />;
          })}
        </div>
        {day >= 1 && (
          <span
            style={{ left: `${pct}%` }}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white border-2 border-slate-900 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex gap-1 mt-1.5">
          {ranges.map((r) => (
            <span
              key={r.stage}
              style={{ width: `${((r.toDay - r.fromDay + 1) / total) * 100}%` }}
              className={`text-[10px] truncate text-center ${r.stage === currentStage ? `${STAGE_STYLES[r.stage].text} font-bold` : 'text-slate-500'}`}
            >
              {r.stage}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const StatStrip: React.FC<{ items: { label: string; value: React.ReactNode; tone?: string }[] }> = ({ items }) => (
  <div className={`${CARD} px-3 py-3 grid divide-x divide-slate-200`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map((it) => (
      <div key={it.label} className="px-1.5 text-center min-w-0">
        <p className={`text-lg font-black tabular-nums truncate ${it.tone || 'text-slate-900'}`}>{it.value}</p>
        <p className="text-[10px] text-slate-500 truncate">{it.label}</p>
      </div>
    ))}
  </div>
);

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }> = ({ icon, title, hint, action }) => (
  <div className="text-center py-8 px-4 space-y-2">
    <div className="w-16 h-16 rounded-full bg-white shadow-xs border border-slate-100 text-slate-400 flex items-center justify-center mx-auto">{icon}</div>
    <p className="font-bold text-slate-600 text-sm">{title}</p>
    {hint && <p className="text-xs text-slate-500 max-w-xs mx-auto">{hint}</p>}
    {action && <div className="pt-1">{action}</div>}
  </div>
);

export const FabButton: React.FC<{ label: string; onClick: () => void; variant?: 'amber' | 'dark'; className?: string }> = ({
  label,
  onClick,
  variant = 'dark',
  className = 'bottom-24 right-4',
}) => (
  <button
    onClick={onClick}
    className={`absolute ${className} z-30 h-14 pl-2 pr-5 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 active:scale-95 transition ${
      variant === 'amber' ? 'bg-amber-400 text-slate-900 shadow-amber-500/30' : 'bg-slate-900 text-white'
    } ${FOCUS}`}
  >
    <span className={`w-10 h-10 rounded-full flex items-center justify-center ${variant === 'amber' ? 'bg-slate-900 text-amber-300' : 'bg-amber-400 text-slate-900'}`}>
      <Plus className="w-5 h-5" />
    </span>
    {label}
  </button>
);

/** Balance general (variant plain = Home avícola; highlight = Gestión › Resumen). */
export const BalanceCard: React.FC<{ income: number; expenses: number; variant?: 'plain' | 'highlight'; scopeLabel?: string }> = ({
  income,
  expenses,
  variant = 'plain',
  scopeLabel,
}) => {
  const balance = Math.round((income - expenses) * 100) / 100;
  const empty = income === 0 && expenses === 0;
  const chip = empty ? (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">Sin movimientos</span>
  ) : balance >= 0 ? (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Ganancia</span>
  ) : (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1"><TrendingDown className="w-4 h-4" /> Pérdida</span>
  );
  const highlight = variant === 'highlight';
  return (
    <div className={highlight ? 'bg-gradient-to-br from-amber-400 to-amber-300 rounded-2xl p-4 text-slate-900 shadow-sm' : 'bg-white rounded-2xl p-4 shadow-sm border border-amber-100'}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${highlight ? 'text-slate-800' : 'text-slate-500'}`}>Balance general</span>
        {chip}
      </div>
      <p className={`text-3xl font-black tabular-nums mt-1 ${balance < 0 ? (highlight ? 'text-rose-800' : 'text-rose-600') : 'text-slate-900'}`}>{usd(balance)}</p>
      {scopeLabel && <p className={`text-[10px] ${highlight ? 'text-slate-700' : 'text-slate-500'}`}>{scopeLabel}</p>}
      <div className={highlight ? 'grid grid-cols-2 gap-2 mt-3' : 'grid grid-cols-2 mt-3 pt-3 border-t border-slate-100 divide-x divide-slate-100'}>
        {[
          { label: 'Gastos', value: expenses, cls: 'bg-rose-50 text-rose-600', arrow: <ArrowDownLeft className="w-5 h-5" /> },
          { label: 'Ingresos', value: income, cls: 'bg-emerald-50 text-emerald-600', arrow: <ArrowUpRight className="w-5 h-5" /> },
        ].map((x, i) => (
          <div key={x.label} className={`flex items-center gap-2.5 ${highlight ? 'bg-white rounded-xl p-3' : i === 1 ? 'pl-3' : ''}`}>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${x.cls}`}>{x.arrow}</span>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500">{x.label}</p>
              <p className="text-base font-bold text-slate-900 tabular-nums truncate">{usd(x.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Anillo SVG sin librerías. */
export const Donut: React.FC<{ segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number }> = ({
  segments,
  size = 128,
  thickness = 18,
}) => {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            acc += len;
            return el;
          })}
    </svg>
  );
};

export const KpiTile: React.FC<{ label: string; value: string; hint?: string; status?: 'good' | 'warn' | 'bad' }> = ({ label, value, hint, status }) => (
  <div className={`${CARD} p-3 min-w-0`}>
    <p className="text-[11px] text-slate-500 truncate">{label}</p>
    <p
      className={`text-xl font-black tabular-nums truncate ${
        status === 'good' ? 'text-emerald-600' : status === 'warn' ? 'text-amber-600' : status === 'bad' ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      {value}
    </p>
    {hint && <p className="text-[10px] text-slate-500 leading-snug">{hint}</p>}
  </div>
);

export function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon: React.ReactNode; activeClass: string; badge?: number }[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`relative h-11 px-4 rounded-full border text-sm font-semibold flex items-center gap-2 shrink-0 ${
              on ? `${t.activeClass} text-white border-transparent` : 'border-slate-300 bg-white text-slate-700'
            } ${FOCUS}`}
          >
            {t.icon}
            {t.label}
            {!!t.badge && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedTabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string; icon?: React.ReactNode }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 ${
              on ? 'bg-white border-amber-300 text-slate-900 shadow-xs ring-1 ring-amber-200' : 'bg-slate-100 border-slate-200 text-slate-500'
            } ${FOCUS}`}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export const BackLink: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} className={`h-10 px-2 -ml-2 rounded-xl text-sm font-semibold text-slate-600 flex items-center gap-1 ${FOCUS}`}>
    <ChevronLeft className="w-4 h-4" /> {label}
  </button>
);

/** Botón primario del pie de formularios. */
export const PrimaryButton: React.FC<{ tone: Tone; onClick: () => void; children: React.ReactNode; disabled?: boolean; outline?: boolean; className?: string }> = ({
  tone,
  onClick,
  children,
  disabled,
  outline,
  className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`h-12 rounded-2xl font-bold text-sm disabled:opacity-50 ${outline ? `bg-white border-2 ${TONE[tone].outline}` : TONE[tone].solid} ${FOCUS} ${className}`}
  >
    {children}
  </button>
);

export const TotalFooter: React.FC<{ label: string; total: number; children: React.ReactNode; note?: string }> = ({ label, total, children, note }) => (
  <div>
    <div className="flex items-end justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-2xl font-black tabular-nums text-slate-900">{usd(total)}</span>
    </div>
    {note && <p className="text-[10px] text-slate-500 mt-0.5">{note}</p>}
    <div className="mt-3">{children}</div>
  </div>
);
