/**
 * ============================================================================
 * MÓDULO AVÍCOLA · Primitivas de UI compartidas
 * ============================================================================
 * Estructura de las pantallas de referencia con la paleta de la app:
 * tarjetas blancas rounded-2xl, neutros slate y acento avícola amber.
 * No contiene lógica de dominio: los cálculos vienen de models/avicolaDomain.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
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

/**
 * Colores por tono. Texto blanco solo sobre fondos que dan ≥ 4.5:1
 * (sky y emerald pasan a 700: blanco sobre 600 no alcanza al sol).
 */
export const TONE: Record<Tone, { header: string; solid: string; soft: string; text: string; outline: string; sub: string }> = {
  amber: { header: 'bg-amber-400 text-slate-900', solid: 'bg-amber-400 text-slate-900 hover:bg-amber-300', soft: 'bg-amber-50 text-amber-800', text: 'text-amber-800', outline: 'border-amber-400 text-amber-900', sub: 'text-slate-900 font-semibold' },
  violet: { header: 'bg-violet-600 text-white', solid: 'bg-violet-600 text-white hover:bg-violet-700', soft: 'bg-violet-50 text-violet-700', text: 'text-violet-700', outline: 'border-violet-300 text-violet-700', sub: 'text-white font-semibold' },
  rose: { header: 'bg-rose-600 text-white', solid: 'bg-rose-600 text-white hover:bg-rose-700', soft: 'bg-rose-50 text-rose-700', text: 'text-rose-700', outline: 'border-rose-300 text-rose-700', sub: 'text-white font-semibold' },
  emerald: { header: 'bg-emerald-700 text-white', solid: 'bg-emerald-700 text-white hover:bg-emerald-800', soft: 'bg-emerald-50 text-emerald-800', text: 'text-emerald-700', outline: 'border-emerald-300 text-emerald-800', sub: 'text-white font-semibold' },
  indigo: { header: 'bg-indigo-600 text-white', solid: 'bg-indigo-600 text-white hover:bg-indigo-700', soft: 'bg-indigo-50 text-indigo-700', text: 'text-indigo-700', outline: 'border-indigo-300 text-indigo-700', sub: 'text-white font-semibold' },
  sky: { header: 'bg-sky-700 text-white', solid: 'bg-sky-700 text-white hover:bg-sky-800', soft: 'bg-sky-50 text-sky-800', text: 'text-sky-700', outline: 'border-sky-300 text-sky-800', sub: 'text-white font-semibold' },
  slate: { header: 'bg-slate-900 text-white', solid: 'bg-slate-900 text-white hover:bg-slate-800', soft: 'bg-slate-100 text-slate-800', text: 'text-slate-800', outline: 'border-slate-300 text-slate-800', sub: 'text-slate-300' },
};

export const CARD = 'bg-white rounded-2xl border border-slate-200/90 shadow-xs';
/** Foco visible por defecto: anillo oscuro con separación (se ve sobre blanco y sobre ámbar). */
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2';
/** Foco del modo sol (bovino): anillo sky. */
export const FOCUS_SOL = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-1';
/** Foco sobre fondos oscuros o de color con texto blanco. */
export const FOCUS_ON_DARK = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

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
 * Registra `handler` en la pila global del botón Atrás (utils/backButton) mientras
 * `enabled` sea true, y lo ejecuta también con Escape si es la capa superior.
 * El manejador se lee por ref: puede cambiar en cada render sin reordenar la pila.
 */
export function useBackHandler(enabled: boolean, handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const close = () => ref.current();
    const h = (e: KeyboardEvent) => {
      // Escape solo cierra la capa de arriba, no todas a la vez
      if (e.key === 'Escape' && isTopBackHandler(close)) close();
    };
    const unregister = pushBackHandler(close);
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('keydown', h);
      unregister();
    };
  }, [enabled]);
}

/**
 * Cierre de hoja con Escape y con el botón Atrás de Android (pila global):
 * se registra una sola vez al montar, así las hojas anidadas conservan su orden.
 */
export function useEscape(onClose: () => void) {
  useBackHandler(true, onClose);
}

/**
 * Protección contra perder datos escritos: `requestClose` cierra directo si no hay cambios
 * o muestra "¿Descartar cambios?" si `dirty`. Renderiza `discardDialog` dentro de la hoja.
 */
export function useDiscardGuard(onClose: () => void, dirty?: boolean, contrast?: 'sol') {
  const [askDiscard, setAskDiscard] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dirtyRef = useRef(!!dirty);
  dirtyRef.current = !!dirty;
  const requestClose = useCallback(() => {
    if (dirtyRef.current) setAskDiscard(true);
    else closeRef.current();
  }, []);
  const discardDialog = askDiscard ? (
    <ConfirmDialog
      title="¿Descartar cambios?"
      message="Los datos que escribiste se perderán."
      confirmLabel="Descartar"
      danger
      contrast={contrast}
      onConfirm={() => {
        setAskDiscard(false);
        closeRef.current();
      }}
      onCancel={() => setAskDiscard(false)}
    />
  ) : null;
  return { requestClose, discardDialog, cancelDiscard: () => setAskDiscard(false) };
}

/**
 * Cuando aparece un error (o cambia `key`), lleva la vista al primer campo inválido
 * (`aria-invalid="true"` o `data-invalid="true"`) dentro de `ref` y le da el foco.
 */
export function useFocusFirstInvalid(ref: React.RefObject<HTMLElement | null>, error?: string | null, key?: unknown) {
  useEffect(() => {
    if (!error) return;
    const id = requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (typeof el.focus === 'function') el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [error, key, ref]);
}

/** Error del pie (encima del botón Guardar). */
const FooterError: React.FC<{ error?: string | null }> = ({ error }) => (error ? <div className="mb-3"><ErrorBox error={error} /></div> : null);

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
  /** Error del formulario: se muestra en el pie, encima del botón, y lleva al primer campo inválido. */
  error?: string | null;
  /** Cambiarlo (p. ej. un contador de intentos) repite el salto al campo inválido aunque el error sea el mismo. */
  errorKey?: unknown;
  /** 'sol': foco sky (módulo bovino). El alto contraste ya es el estilo por defecto. */
  contrast?: 'sol';
}> = ({ tone, title, subtitle, question, header, footer, onClose, children, dirty, error, errorKey, contrast }) => {
  const { requestClose, discardDialog } = useDiscardGuard(onClose, dirty, contrast);
  useEscape(requestClose);
  const bodyRef = useRef<HTMLDivElement>(null);
  useFocusFirstInvalid(bodyRef, error, errorKey);
  const t = TONE[tone];
  const headerFocus = tone === 'amber' ? FOCUS : FOCUS_ON_DARK;
  return (
    <Overlay className="bg-slate-100 flex flex-col">
      {discardDialog}
      <div role="dialog" aria-modal="true" aria-label={title} className="flex flex-col h-full min-h-0">
        <div className={`${t.header} px-4 pt-3 pb-9 shrink-0`}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={requestClose} aria-label="Cerrar" className={`w-12 h-12 -ml-2 shrink-0 rounded-full flex items-center justify-center hover:bg-black/10 ${headerFocus}`}>
              <X className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-black leading-tight truncate">{title}</h2>
              {subtitle && <p className={`text-sm ${t.sub} truncate`}>{subtitle}</p>}
            </div>
          </div>
          {question && <p className="text-xl font-black mt-3">{question}</p>}
          {header && <div className="mt-3">{header}</div>}
        </div>
        <div ref={bodyRef} className="-mt-6 bg-white rounded-t-3xl px-4 pt-5 pb-6 flex-1 overflow-y-auto space-y-5 min-h-0">
          {children}
        </div>
        {(footer || error) && (
          <div className="bg-white border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
            <FooterError error={error} />
            {footer}
          </div>
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
  /** Si hay datos escritos, fondo / X / Escape / Atrás piden confirmación antes de descartarlos. */
  dirty?: boolean;
  /** Error del formulario: en el pie, encima del botón; lleva al primer campo inválido. */
  error?: string | null;
  /** Cambiarlo repite el salto al campo inválido aunque el error sea el mismo. */
  errorKey?: unknown;
  /** 'sol': foco sky (módulo bovino). El alto contraste ya es el estilo por defecto. */
  contrast?: 'sol';
}> = ({ title, subtitle, icon, iconClass = 'bg-amber-50 text-amber-800', onClose, children, footer, dark, dirty, error, errorKey, contrast }) => {
  const { requestClose, discardDialog } = useDiscardGuard(onClose, dirty, contrast);
  useEscape(requestClose);
  const bodyRef = useRef<HTMLDivElement>(null);
  useFocusFirstInvalid(bodyRef, error, errorKey);
  const focus = dark ? FOCUS_ON_DARK : contrast === 'sol' ? FOCUS_SOL : FOCUS;
  return (
    <Overlay className="bg-black/60 backdrop-blur-xs flex items-end" onBackdrop={requestClose}>
      {discardDialog}
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white w-full max-h-[88%] rounded-t-3xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-200">
        <div className={`${dark ? 'bg-slate-900 text-white' : 'bg-white'} px-4 pt-2 pb-3 shrink-0 border-b ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className={`w-10 h-1 rounded-full mx-auto mb-2 ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
          <div className="flex items-center gap-2.5">
            {icon && <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>{icon}</div>}
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold text-base leading-tight truncate ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              {subtitle && <p className={`text-xs font-semibold truncate ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Cerrar"
              className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${dark ? 'text-white hover:bg-white/10' : 'text-slate-800 hover:bg-slate-100'} ${focus}`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {children}
        </div>
        {(footer || error) && (
          <div className="border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0 bg-white">
            <FooterError error={error} />
            {footer}
          </div>
        )}
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
  /** 'sol': foco y botón de confirmar sky (módulo bovino). El alto contraste ya es el estilo por defecto. */
  contrast?: 'sol';
  /** Texto del botón de cancelar (por defecto "Cancelar"). */
  cancelLabel?: string;
}> = ({ title, message, confirmLabel, danger, icon, requireText, error, onConfirm, onCancel, contrast, cancelLabel = 'Cancelar' }) => {
  useEscape(onCancel);
  const sol = contrast === 'sol';
  const focus = sol ? FOCUS_SOL : FOCUS;
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const blocked = !!requireText && typed.trim().toLowerCase() !== requireText.trim().toLowerCase();
  return (
    <Overlay className="bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onBackdrop={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
          {icon || <AlertTriangle className="w-6 h-6" />}
        </div>
        <h3 className="text-slate-900 font-black text-lg leading-tight">{title}</h3>
        <div className="space-y-2 text-sm text-slate-800">{message}</div>
        {requireText && (
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor={inputId}>
              Escribe <strong className="text-slate-900">{requireText}</strong> para confirmar
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
              className={`mt-1 w-full h-12 text-base px-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 ${focus}`}
            />
          </div>
        )}
        <ErrorBox error={error} />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button type="button" onClick={onCancel} className={`h-12 text-base rounded-xl font-bold bg-slate-200 text-slate-900 hover:bg-slate-300 ${focus}`}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={blocked}
            className={`h-12 text-base rounded-xl font-bold disabled:opacity-50 ${danger ? 'bg-rose-700 text-white hover:bg-rose-800' : sol ? 'bg-sky-700 text-white hover:bg-sky-800' : 'bg-slate-900 text-white hover:bg-slate-800'} ${focus}`}
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
    <div role="alert" className="p-3 bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-xl text-sm font-semibold flex items-start gap-2">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-px" aria-hidden="true" />
      <span>{error}</span>
    </div>
  ) : null;

export const SectionLabel: React.FC<{ index?: number; label: string; right?: React.ReactNode }> = ({ index, label, right }) => (
  <div className="flex items-center justify-between min-h-6">
    <span className="text-xs font-bold tracking-wider uppercase text-slate-600">
      {index !== undefined ? `${index} · ` : ''}
      {label}
    </span>
    {right}
  </div>
);

/**
 * Fila etiqueta + campo. Si no se pasa `htmlFor`, genera un id con useId y se lo
 * inyecta al campo hijo (NumberInput, TextInput, DatePill, Stepper o un input nativo),
 * junto con aria-describedby (pista y error) y aria-invalid cuando hay error.
 */
export const FieldRow: React.FC<{ label: string; hint?: React.ReactNode; error?: string | null; htmlFor?: string; children: React.ReactNode }> = ({
  label,
  hint,
  error,
  htmlFor,
  children,
}) => {
  const autoId = useId();
  const el = React.Children.count(children) === 1 && React.isValidElement(children) ? (children as React.ReactElement<Record<string, unknown>>) : null;
  // Solo campos: inputs nativos o componentes (NumberInput, TextInput, DatePill, Stepper…); nunca fragmentos ni <div>
  const native = !!el && typeof el.type === 'string';
  const child = el && el.type !== React.Fragment && (!native || ['input', 'select', 'textarea'].includes(el.type as string)) ? el : null;
  const childId = child && typeof child.props.id === 'string' ? (child.props.id as string) : undefined;
  const id = htmlFor || childId || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  let content: React.ReactNode = children;
  if (child) {
    const extra: Record<string, unknown> = {};
    if (!childId) extra.id = id;
    if (native) {
      if (describedBy && child.props['aria-describedby'] === undefined) extra['aria-describedby'] = describedBy;
      if (error && child.props['aria-invalid'] === undefined) extra['aria-invalid'] = true;
    } else {
      if (describedBy && child.props.ariaDescribedBy === undefined) extra.ariaDescribedBy = describedBy;
      if (error && child.props.invalid === undefined) extra.invalid = true;
    }
    content = React.cloneElement(child, extra);
  }
  return (
    <div className="py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={child || htmlFor ? id : undefined} className="text-sm font-semibold text-slate-900">
            {label}
          </label>
          {hint && (
            <div id={hintId} className="text-xs text-slate-600">
              {hint}
            </div>
          )}
        </div>
        <div className="shrink-0">{content}</div>
      </div>
      {error && (
        <p id={errId} className="text-xs font-semibold text-rose-700 mt-1">
          {error}
        </p>
      )}
    </div>
  );
};

export const NumberInput: React.FC<{
  id?: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
}> = ({ id, value, onChange, decimal, placeholder = '0', className = 'w-32 bg-slate-50 text-slate-900', invalid, ariaLabel, ariaDescribedBy, autoFocus }) => {
  // El consumidor puede fijar su propia altura o tamaño de texto en className
  const h = /(^|\s)h-\d/.test(className) ? '' : 'h-11';
  const size = /(^|\s)text-(xs|sm|base|lg|\dxl)/.test(className) ? '' : 'text-base';
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      value={value}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, ''))}
      className={`${h} ${size} rounded-xl text-right px-3 tabular-nums font-bold placeholder:text-slate-500 ${invalid ? 'border-2 border-rose-500' : 'border border-slate-300'} ${className} ${FOCUS}`}
    />
  );
};

export const TextInput: React.FC<{
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
}> = ({ id, value, onChange, placeholder, maxLength, ariaLabel, ariaDescribedBy, invalid }) => (
  <input
    id={id}
    aria-label={ariaLabel}
    aria-invalid={invalid || undefined}
    aria-describedby={ariaDescribedBy}
    value={value}
    maxLength={maxLength}
    placeholder={placeholder}
    enterKeyHint="done"
    onChange={(e) => onChange(e.target.value)}
    className={`w-full h-11 rounded-xl bg-slate-50 px-3 text-base text-slate-900 placeholder:text-slate-500 ${invalid ? 'border-2 border-rose-500' : 'border border-slate-300'} ${FOCUS}`}
  />
);

export const Stepper: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  tone?: Tone;
  ariaLabel?: string;
  id?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
}> = ({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, tone = 'slate', ariaLabel = 'Cantidad', id, ariaDescribedBy, invalid }) => {
  const t = TONE[tone];
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v || 0))));
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Restar" onClick={() => set(value - 1)} disabled={value <= min} className={`w-11 h-11 rounded-full ${t.soft} flex items-center justify-center disabled:opacity-40 ${FOCUS}`}>
        <Minus className="w-5 h-5" />
      </button>
      <input
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        value={String(value)}
        inputMode="numeric"
        enterKeyHint="done"
        onChange={(e) => set(Number(e.target.value.replace(/[^0-9]/g, '')))}
        className={`w-20 h-12 rounded-2xl text-slate-900 text-center text-lg font-bold tabular-nums ${invalid ? 'border-2 border-rose-500' : 'border border-slate-300'} ${FOCUS}`}
      />
      <button type="button" aria-label="Sumar" onClick={() => set(value + 1)} disabled={value >= max} className={`w-11 h-11 rounded-full ${t.soft} flex items-center justify-center disabled:opacity-40 ${FOCUS}`}>
        <Plus className="w-5 h-5" />
      </button>
      <span className="sr-only" aria-live="polite">
        {ariaLabel}: {value}
      </span>
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
  ariaLabel,
  id,
}: {
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  tone?: Tone;
  onColor?: boolean;
  size?: 'md' | 'lg';
  /** Nombre del grupo para lectores de pantalla (p. ej. "Unidad"). */
  ariaLabel?: string;
  id?: string;
}) {
  const t = TONE[tone];
  return (
    <div id={id} className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = o.key === value;
        const cls = onColor
          ? active
            ? `bg-white ${t.text} border-white`
            : 'bg-white/20 text-current border-white/40 hover:bg-white/30'
          : active
            ? `${t.solid} border-transparent`
            : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50';
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={`${size === 'lg' ? 'h-12' : 'h-11'} ${o.icon ? 'pl-1.5' : 'pl-4'} pr-4 rounded-full border text-sm font-semibold flex items-center gap-2 transition-colors ${cls} ${onColor ? FOCUS_ON_DARK : FOCUS}`}
          >
            {o.icon && (
              <span className={`w-8 h-8 rounded-full flex items-center justify-center ${onColor ? `bg-white ${t.text}` : active ? 'bg-white/25' : 'bg-slate-100 text-slate-700'}`}>
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
export const DatePill: React.FC<{ value: string; onChange: (v: string) => void; min?: string; max?: string; ariaLabel?: string; id?: string; ariaDescribedBy?: string; invalid?: boolean }> = ({
  value,
  onChange,
  min,
  max,
  ariaLabel = 'Fecha',
  id,
  ariaDescribedBy,
  invalid,
}) => (
  <label
    className={`relative h-11 px-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-900 flex items-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2 ${
      invalid ? 'border-2 border-rose-500' : 'border border-slate-300'
    }`}
  >
    <CalendarDays className="w-5 h-5 text-amber-700" aria-hidden="true" />
    <span className="whitespace-nowrap">{shortDate(value)}</span>
    <input
      id={id}
      type="date"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid || undefined}
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
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`w-full flex items-center justify-between gap-3 min-h-12 text-left ${FOCUS} rounded-xl`}>
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-slate-900">{label}</span>
      {hint && <span className="block text-xs text-slate-600">{hint}</span>}
    </span>
    <span className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${checked ? (tone === 'amber' ? 'bg-amber-500' : TONE[tone].solid.split(' ')[0]) : 'bg-slate-500'}`}>
      <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
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
            return <div key={r.stage} style={{ width: `${w}%` }} className={`rounded-full ${STAGE_STYLES[r.stage].seg} ${done ? '' : 'opacity-40'}`} />;
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
              className={`text-xs truncate text-center ${r.stage === currentStage ? `${STAGE_STYLES[r.stage].text} font-bold` : 'text-slate-600'}`}
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
        <p className="text-xs text-slate-600 truncate">{it.label}</p>
      </div>
    ))}
  </div>
);

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }> = ({ icon, title, hint, action }) => (
  <div className="text-center py-8 px-4 space-y-2">
    <div className="w-16 h-16 rounded-full bg-white shadow-xs border border-slate-200 text-slate-500 flex items-center justify-center mx-auto" aria-hidden="true">
      {icon}
    </div>
    <p className="font-bold text-slate-800 text-sm">{title}</p>
    {hint && <p className="text-sm text-slate-600 max-w-xs mx-auto">{hint}</p>}
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
    type="button"
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
    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Sin movimientos</span>
  ) : balance >= 0 ? (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Ganancia</span>
  ) : (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-300 inline-flex items-center gap-1"><TrendingDown className="w-4 h-4" /> Pérdida</span>
  );
  const highlight = variant === 'highlight';
  return (
    <div className={highlight ? 'bg-gradient-to-br from-amber-400 to-amber-300 rounded-2xl p-4 text-slate-900 shadow-sm' : 'bg-white rounded-2xl p-4 shadow-sm border border-amber-200'}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${highlight ? 'text-slate-900' : 'text-slate-600'}`}>Balance general</span>
        {chip}
      </div>
      <p className={`text-3xl font-black tabular-nums mt-1 ${balance < 0 ? (highlight ? 'text-rose-800' : 'text-rose-700') : 'text-slate-900'}`}>{usd(balance)}</p>
      {scopeLabel && <p className={`text-xs ${highlight ? 'text-slate-800' : 'text-slate-600'}`}>{scopeLabel}</p>}
      <div className={highlight ? 'grid grid-cols-2 gap-2 mt-3' : 'grid grid-cols-2 mt-3 pt-3 border-t border-slate-200 divide-x divide-slate-200'}>
        {[
          { label: 'Gastos', value: expenses, cls: 'bg-rose-50 text-rose-700', arrow: <ArrowDownLeft className="w-5 h-5" /> },
          { label: 'Ingresos', value: income, cls: 'bg-emerald-50 text-emerald-700', arrow: <ArrowUpRight className="w-5 h-5" /> },
        ].map((x, i) => (
          <div key={x.label} className={`flex items-center gap-2.5 ${highlight ? 'bg-white rounded-xl p-3' : i === 1 ? 'pl-3' : ''}`}>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${x.cls}`} aria-hidden="true">{x.arrow}</span>
            <div className="min-w-0">
              <p className="text-xs text-slate-600">{x.label}</p>
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
    <p className="text-xs text-slate-600 truncate">{label}</p>
    <p
      className={`text-xl font-black tabular-nums truncate ${
        status === 'good' ? 'text-emerald-700' : status === 'warn' ? 'text-amber-700' : status === 'bad' ? 'text-rose-700' : 'text-slate-900'
      }`}
    >
      {value}
    </p>
    {hint && <p className="text-xs text-slate-600 leading-snug">{hint}</p>}
  </div>
);

/** Oscurece un fondo -500/-600 a -700 para que el texto blanco tenga contraste al sol. */
const darkenActive = (cls: string) => cls.replace(/\b(bg-[a-z]+)-(500|600)\b/g, '$1-700');

/**
 * Sub-pestañas en rejilla: todas visibles a 360 px (sin scroll horizontal),
 * icono encima del texto, 56 px de alto.
 */
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
    <div role="tablist" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`relative h-14 min-w-0 px-0.5 rounded-xl border text-xs font-semibold tracking-tight flex flex-col items-center justify-center gap-0.5 ${
              on ? `${darkenActive(t.activeClass)} text-white border-transparent shadow-sm` : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            } ${FOCUS}`}
          >
            <span aria-hidden="true" className="flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">
              {t.icon}
            </span>
            <span className="max-w-full truncate leading-tight">{t.label}</span>
            {!!t.badge && (
              <span className="absolute top-1 right-1 min-w-5 h-5 px-1 rounded-full bg-rose-700 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white">
                {t.badge}
                <span className="sr-only"> pendientes</span>
              </span>
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
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`h-11 min-w-0 px-1 rounded-xl border-2 text-sm flex items-center justify-center gap-1.5 ${
              on ? 'bg-white border-slate-900 text-slate-900 font-bold shadow-xs' : 'bg-slate-100 border-slate-200 text-slate-700 font-semibold hover:bg-slate-200'
            } ${FOCUS}`}
          >
            {t.icon}
            <span className="truncate">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const BackLink: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button type="button" onClick={onClick} className={`h-11 pl-1 pr-3 -ml-1 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-200/60 flex items-center gap-1 ${FOCUS}`}>
    <ChevronLeft className="w-5 h-5" /> {label}
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
      <span className="text-sm text-slate-700">{label}</span>
      <span className="text-2xl font-black tabular-nums text-slate-900">{usd(total)}</span>
    </div>
    {note && <p className="text-xs text-slate-600 mt-0.5">{note}</p>}
    <div className="mt-3">{children}</div>
  </div>
);
