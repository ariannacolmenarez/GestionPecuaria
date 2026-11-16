/**
 * ============================================================================
 * UI COMÚN · primitivas para las pantallas fuera del módulo avícola
 * ============================================================================
 * Porcino, almacén, actividades, alertas, miembros y ajustes usan estas piezas
 * para verse y comportarse igual en todo el teléfono (uso en campo: al sol,
 * con guantes): botones ≥ 44 px, texto mínimo text-xs, foco visible y
 * el mismo color por rubro en todas partes.
 *
 * El botón Atrás de Android y Escape usan la MISMA pila global que las hojas
 * del módulo avícola (utils/backButton vía useBackHandler de avicola/shared).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Beef, Bird, PiggyBank, Tractor, X } from 'lucide-react';
import { ConfirmDialog, FOCUS, FOCUS_ON_DARK, useBackHandler } from '../mockup/avicola/shared';

// Re-exportaciones para tener un solo punto de entrada
export {
  ConfirmDialog,
  ErrorBox,
  Overlay,
  FOCUS,
  FOCUS_ON_DARK,
  useBackHandler,
  useEscape,
  useDiscardGuard,
  useFocusFirstInvalid,
} from '../mockup/avicola/shared';

// ---------------------------------------------------------------------------
// Color por rubro (igual en toda la app)
// ---------------------------------------------------------------------------
export type UiRubro = 'porcino' | 'avicola' | 'bovino' | 'general';

/**
 * - porcino: rose-600 + blanco
 * - avícola: amber-400 + texto slate-900 (blanco sobre ámbar no se lee)
 * - bovino: sky-700 + blanco (sky-600 no llega a 4.5:1)
 * - general: emerald-700 + blanco
 */
export const RUBRO_UI: Record<UiRubro, { solid: string; hover: string; soft: string; text: string; ring: string; label: string; Icon: React.ElementType }> = {
  porcino: { solid: 'bg-rose-600 text-white', hover: 'hover:bg-rose-700 active:bg-rose-800', soft: 'bg-rose-50 text-rose-800', text: 'text-rose-700', ring: 'focus-visible:ring-rose-600', label: 'Porcino', Icon: PiggyBank },
  avicola: { solid: 'bg-amber-400 text-slate-900', hover: 'hover:bg-amber-300 active:bg-amber-500', soft: 'bg-amber-50 text-amber-900', text: 'text-amber-800', ring: 'focus-visible:ring-amber-600', label: 'Avícola', Icon: Bird },
  bovino: { solid: 'bg-sky-700 text-white', hover: 'hover:bg-sky-800 active:bg-sky-800', soft: 'bg-sky-50 text-sky-800', text: 'text-sky-700', ring: 'focus-visible:ring-sky-700', label: 'Bovino', Icon: Beef },
  general: { solid: 'bg-emerald-700 text-white', hover: 'hover:bg-emerald-800 active:bg-emerald-900', soft: 'bg-emerald-50 text-emerald-800', text: 'text-emerald-700', ring: 'focus-visible:ring-emerald-700', label: 'Granja', Icon: Tractor },
};

// ---------------------------------------------------------------------------
// Campos de formulario
// ---------------------------------------------------------------------------
/** Clase base de <input>/<select>/<textarea>: 44 px de alto, texto 16 px (sin zoom en iOS), borde visible y foco. */
export const inputClass =
  'w-full min-h-11 px-3 text-base text-slate-900 bg-white rounded-xl border border-slate-300 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 disabled:bg-slate-100 disabled:text-slate-600';
/** Igual que inputClass pero con borde de error (combinar con aria-invalid). */
export const inputInvalidClass = inputClass.replace('border border-slate-300', 'border-2 border-rose-500');
/** Devuelve la clase del campo según tenga error o no. */
export const fieldClass = (invalid?: boolean, extra = '') => `${invalid ? inputInvalidClass : inputClass} ${extra}`.trim();

/** Mensaje de error bajo un campo. Usa `id` y apúntalo desde el campo con aria-describedby. */
export const FieldError: React.FC<{ id?: string; error?: React.ReactNode; children?: React.ReactNode; className?: string }> = ({ id, error, children, className = '' }) => {
  const content = error ?? children;
  if (!content) return null;
  return (
    <p id={id} role="alert" className={`text-xs font-semibold text-rose-700 mt-1 ${className}`}>
      {content}
    </p>
  );
};

/** Etiqueta de campo visible (no usar solo placeholder). */
export const FieldLabel: React.FC<{ htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }> = ({ htmlFor, children, hint, className = '' }) => (
  <div className={`mb-1 ${className}`}>
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-900">
      {children}
    </label>
    {hint && <p className="text-xs text-slate-600">{hint}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------
export type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type BtnProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: BtnVariant;
  /** Color de rubro para la variante primary (por defecto 'general' = emerald-700). */
  rubro?: UiRubro;
  /** md = 44 px (min-h-11), lg = 48 px (min-h-12) para la acción principal. */
  size?: 'md' | 'lg';
  /** Ancho completo. */
  block?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
};

/** Clases de botón por si hace falta en un <a> o <label>. */
export function btnClass({ variant = 'primary', rubro = 'general', size = 'md', block }: Pick<BtnProps, 'variant' | 'rubro' | 'size' | 'block'> = {}): string {
  const base = `${size === 'lg' ? 'min-h-12 text-base' : 'min-h-11 text-sm'} px-4 rounded-xl font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${block ? 'w-full' : ''}`;
  const r = RUBRO_UI[rubro];
  const v =
    variant === 'primary'
      ? `${r.solid} ${r.hover} ${r.ring}`
      : variant === 'danger'
        ? 'bg-rose-700 text-white hover:bg-rose-800 active:bg-rose-900 focus-visible:ring-rose-700'
        : variant === 'secondary'
          ? 'bg-white text-slate-900 border-2 border-slate-300 hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-slate-900'
          : 'bg-transparent text-slate-800 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-900';
  return `${base} ${v}`;
}

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = 'primary', rubro = 'general', size = 'md', block, icon, children, className = '', type = 'button', ...rest }: BtnProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <button ref={ref} type={type} className={`${btnClass({ variant, rubro, size, block })} ${className}`} {...rest}>
      {icon && (
        <span aria-hidden="true" className="shrink-0 flex items-center [&>svg]:w-5 [&>svg]:h-5">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
});

/** Botón solo icono, 44 px (aria-label obligatorio). */
export const IconBtn: React.FC<Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { 'aria-label': string; tone?: 'light' | 'dark' | 'danger' }> = ({
  tone = 'light',
  className = '',
  type = 'button',
  children,
  ...rest
}) => (
  <button
    type={type}
    className={`w-11 h-11 shrink-0 rounded-full inline-flex items-center justify-center transition-colors disabled:opacity-50 ${
      tone === 'dark' ? `text-white hover:bg-white/10 ${FOCUS_ON_DARK}` : tone === 'danger' ? `text-rose-700 hover:bg-rose-50 ${FOCUS}` : `text-slate-800 hover:bg-slate-100 ${FOCUS}`
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Encabezado único de modal
// ---------------------------------------------------------------------------
/**
 * Cabecera oscura de modal: icono del rubro (opcional), título 16 px, subtítulo
 * text-xs slate-300 y botón Cerrar de 44 px con aria-label. Úsalo con
 * `titleId` en el <h2> y aria-labelledby={titleId} en el contenedor role="dialog".
 */
export const ModalHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  /** Muestra el icono del rubro con su color. */
  rubro?: UiRubro;
  /** Icono propio (reemplaza al del rubro; se pinta con el color del rubro si se indica). */
  icon?: React.ReactNode;
  titleId?: string;
  /** Contenido extra a la derecha, antes del botón Cerrar. */
  right?: React.ReactNode;
  closeLabel?: string;
  className?: string;
}> = ({ title, subtitle, onClose, rubro, icon, titleId, right, closeLabel = 'Cerrar', className = '' }) => {
  const r = rubro ? RUBRO_UI[rubro] : null;
  const RIcon = r?.Icon;
  const showIcon = !!icon || !!RIcon;
  return (
    <div className={`bg-slate-900 text-white px-3 py-2 flex items-center gap-2.5 shrink-0 ${className}`}>
      {showIcon && (
        <span aria-hidden="true" className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5 ${r ? r.solid : 'bg-slate-700 text-white'}`}>
          {icon || (RIcon && <RIcon />)}
        </span>
      )}
      <div className={`min-w-0 flex-1 ${showIcon ? '' : 'pl-1'}`}>
        <h2 id={titleId} className="text-base font-bold leading-tight truncate">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-300 truncate">{subtitle}</p>}
      </div>
      {right}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 ${FOCUS_ON_DARK}`}
        >
          <X className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Botón Atrás / Escape para modales que se abren con un booleano
// ---------------------------------------------------------------------------
/**
 * Registra el cierre del modal en la pila global del botón Atrás de Android
 * (la misma de las hojas avícolas: utils/backButton) mientras `open` sea true.
 * Escape también cierra si este modal es la capa superior.
 *
 * Si `dirty` es true, en vez de cerrar pregunta "¿Descartar cambios?".
 * Usa `requestClose` también en la X y en el fondo, y pinta `confirmDialog`
 * dentro del modal:
 *
 *   const { requestClose, confirmDialog } = useBackClose(open, onClose, hayDatos);
 *   ...<ModalHeader title="Parto" onClose={requestClose} /> ... {confirmDialog}
 */
export function useBackClose(open: boolean, onClose: () => void, dirty = false) {
  const [asking, setAsking] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const requestClose = useCallback(() => {
    if (dirtyRef.current) setAsking(true);
    else closeRef.current();
  }, []);
  useBackHandler(open, requestClose);
  useEffect(() => {
    if (!open) setAsking(false);
  }, [open]);
  const confirmDialog =
    open && asking ? (
      <ConfirmDialog
        title="¿Descartar cambios?"
        message="Los datos que escribiste se perderán."
        confirmLabel="Descartar"
        danger
        onConfirm={() => {
          setAsking(false);
          closeRef.current();
        }}
        onCancel={() => setAsking(false)}
      />
    ) : null;
  return { requestClose, confirmDialog, isConfirming: open && asking };
}
