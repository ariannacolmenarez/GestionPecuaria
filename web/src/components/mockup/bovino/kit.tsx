/**
 * ============================================================================
 * MÓDULO BOVINO · Kit de la Etapa B (gráficos SVG, periodos, KPIs)
 * ============================================================================
 * Gráficos sin librerías (línea 2 px sky, ejes slate-300, caídas en rose) con su
 * tabla equivalente desplegable ("Ver datos"), selector de periodo y tarjetas KPI
 * en versión bovina (alto contraste). Funciones de periodo puras (probadas).
 */
import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { BovinoDomainResult, BovinoDomainSuccess } from '../../../models/bovinoDomain';
import { addDays, daysInMonth, MONTH_NAMES_ES, parseISODate } from '../../../utils/dates';
import { B, ChipFilter, DateField, FOCUS_B, LimitConfirm, fd, num } from './ui';

// ---------------------------------------------------------------------------
// Varias acciones del dominio en secuencia (con confirmación de topes por paso)
// ---------------------------------------------------------------------------
export interface DomainStep {
  call: (confirm: boolean) => BovinoDomainResult;
  onOk?: (res: BovinoDomainSuccess) => void;
}

export interface StepsOutcome {
  saved: number;
  total: number;
  results: BovinoDomainSuccess[];
  /** true si se detuvo por un error o porque el usuario eligió "Corregir". */
  stopped: boolean;
}

/**
 * Ejecuta pasos en orden (cada uno es un documento independiente). Si un paso pide
 * confirmación (FUERA_DE_RANGO), pausa con LimitConfirm: "Sí, es correcto" reintenta
 * ese paso con confirm:true y sigue; "Corregir" detiene (lo ya guardado se conserva).
 * Los pasos se evalúan de forma diferida: un paso puede usar el resultado de otro.
 */
export function useStepRunner() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ warnings: string[]; resume: () => void; stop: () => void } | null>(null);

  const runSteps = useCallback((steps: DomainStep[], onDone?: (o: StepsOutcome) => void) => {
    setError(null);
    const results: BovinoDomainSuccess[] = [];
    const finish = (stopped: boolean) => onDone?.({ saved: results.length, total: steps.length, results, stopped });
    const go = (start: number, confirmFirst: boolean) => {
      for (let k = start; k < steps.length; k++) {
        const confirm = k === start && confirmFirst;
        const res = steps[k].call(confirm);
        if ('error' in res) {
          if (res.needsConfirmation && res.code !== 'RETIRO_ACTIVO' && !confirm) {
            setPending({
              warnings: res.warnings && res.warnings.length ? res.warnings : [res.error],
              resume: () => {
                setPending(null);
                go(k, true);
              },
              stop: () => {
                setPending(null);
                if (results.length) setError(`Se guardaron ${results.length} de ${steps.length}. Corrige el dato y guarda el resto.`);
                finish(true);
              },
            });
            return;
          }
          setError(results.length ? `${res.error} (se guardaron ${results.length} de ${steps.length})` : res.error);
          finish(true);
          return;
        }
        results.push(res);
        steps[k].onOk?.(res);
      }
      finish(false);
    };
    go(0, false);
  }, []);

  const confirmEl = pending ? <LimitConfirm warnings={pending.warnings} onConfirm={pending.resume} onCancel={pending.stop} /> : null;
  return { error, setError, runSteps, confirmEl };
}

// ---------------------------------------------------------------------------
// Periodos (puros)
// ---------------------------------------------------------------------------
export type PeriodKey = 'hoy' | 'semana' | 'mes' | 'mesAnterior' | 'tresMeses' | 'anio' | 'rango';

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  hoy: 'Hoy',
  semana: 'Semana',
  mes: 'Mes actual',
  mesAnterior: 'Mes anterior',
  tresMeses: '3 meses',
  anio: 'Año',
  rango: 'Rango',
};

export interface Period {
  key: PeriodKey;
  from: string;
  to: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Primer y último día del mes de `iso` desplazado `offset` meses. */
export function monthBounds(iso: string, offset = 0): { from: string; to: string; label: string } {
  const d = parseISODate(iso) || new Date();
  const base = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const y = base.getFullYear();
  const m = base.getMonth() + 1;
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(daysInMonth(y, m))}`, label: `${MONTH_NAMES_ES[m - 1]} ${y}` };
}

/** Rango [from, to] de un periodo a la fecha `today` (nunca termina después de hoy). */
export function periodRange(key: PeriodKey, today: string, custom?: { from: string; to: string }): Period {
  switch (key) {
    case 'hoy':
      return { key, from: today, to: today };
    case 'semana':
      return { key, from: addDays(today, -6), to: today };
    case 'mes':
      return { key, from: monthBounds(today).from, to: today };
    case 'mesAnterior': {
      const b = monthBounds(today, -1);
      return { key, from: b.from, to: b.to };
    }
    case 'tresMeses':
      return { key, from: monthBounds(today, -2).from, to: today };
    case 'anio':
      return { key, from: `${today.slice(0, 4)}-01-01`, to: today };
    default: {
      const from = custom?.from || monthBounds(today).from;
      const to = custom?.to && custom.to <= today ? custom.to : today;
      return from <= to ? { key, from, to } : { key, from: to, to: from };
    }
  }
}

/** Selector de periodo: chips + rango con dos fechas. */
export const PeriodFilter: React.FC<{ value: Period; onChange: (p: Period) => void; today: string; options?: PeriodKey[] }> = ({
  value,
  onChange,
  today,
  options = ['mes', 'mesAnterior', 'tresMeses', 'anio', 'rango'],
}) => (
  <div className="space-y-2">
    <ChipFilter ariaLabel="Periodo" options={options.map((k) => ({ key: k, label: PERIOD_LABEL[k] }))} value={value.key} onChange={(k) => onChange(periodRange(k, today, value))} />
    {value.key === 'rango' && (
      <div className="grid grid-cols-2 gap-2">
        <DateField compact ariaLabel="Desde" value={value.from} onChange={(from) => onChange(periodRange('rango', today, { from, to: value.to }))} />
        <DateField compact ariaLabel="Hasta" value={value.to} onChange={(to) => onChange(periodRange('rango', today, { from: value.from, to }))} />
      </div>
    )}
    {value.key !== 'rango' && value.key !== 'hoy' && (
      <p className="text-xs text-slate-700">
        Del {fd(value.from)} al {fd(value.to)}
      </p>
    )}
  </div>
);

/** Navegador de mes con flechas (no deja pasar del mes actual). */
export const MonthNav: React.FC<{ offset: number; onChange: (o: number) => void; today: string; allowFuture?: boolean }> = ({ offset, onChange, today, allowFuture }) => {
  const b = monthBounds(today, offset);
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Mes anterior" onClick={() => onChange(offset - 1)} className={`w-12 h-12 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center ${FOCUS_B}`}>
        <ChevronLeft className="w-5 h-5" />
      </button>
      <p className="flex-1 text-center text-base font-black text-slate-900">{b.label}</p>
      <button type="button" aria-label="Mes siguiente" disabled={!allowFuture && offset >= 0} onClick={() => onChange(allowFuture ? offset + 1 : Math.min(0, offset + 1))} className={`w-12 h-12 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center disabled:opacity-40 ${FOCUS_B}`}>
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------
export type KpiTone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';
const KPI_TONE: Record<KpiTone, string> = {
  ok: 'border-emerald-300 bg-emerald-50',
  warn: 'border-amber-300 bg-amber-50',
  bad: 'border-rose-300 bg-rose-50',
  info: 'border-sky-200 bg-sky-50',
  neutral: 'border-slate-200 bg-white',
};

export const KpiCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: KpiTone; onClick?: () => void }> = ({ label, value, hint, tone = 'neutral', onClick }) => {
  const body = (
    <>
      <p className="text-xs font-bold text-slate-700">{label}</p>
      <p className="text-2xl font-black tabular-nums text-slate-900 leading-tight break-words">{value}</p>
      {hint && <p className="text-xs text-slate-700 leading-snug">{hint}</p>}
    </>
  );
  const cls = `rounded-2xl border-2 p-3 text-left space-y-0.5 ${KPI_TONE[tone]}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:border-sky-500 ${FOCUS_B}`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

/** Barra de progreso (ej. hacia el peso objetivo). */
export const ProgressBar: React.FC<{ pct: number; tone?: 'sky' | 'emerald' | 'amber' | 'rose'; label?: string }> = ({ pct, tone = 'sky', label }) => {
  const p = Math.max(0, Math.min(100, isFinite(pct) ? pct : 0));
  const color = tone === 'emerald' ? 'bg-emerald-600' : tone === 'amber' ? 'bg-amber-500' : tone === 'rose' ? 'bg-rose-600' : 'bg-sky-600';
  return (
    <div className="h-4 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Gráficos SVG
// ---------------------------------------------------------------------------
export interface ChartPoint {
  label: string;
  value: number;
  /** Punto marcado (caída, día anómalo). */
  mark?: string;
}

/** Barras verticales simples (producción diaria). */
export const BarChart: React.FC<{ points: ChartPoint[]; unit?: string; height?: number; ariaLabel: string }> = ({ points, unit = '', height = 150, ariaLabel }) => {
  const w = 320;
  const pad = { l: 40, r: 6, t: 12, b: 24 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const bw = points.length ? innerW / points.length : innerW;
  const step = Math.max(1, Math.ceil(points.length / 6));
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + innerH * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} className="stroke-slate-300" strokeWidth={1} />
            <text x={pad.l - 4} y={y + 4} textAnchor="end" className="fill-slate-700" fontSize={12} fontWeight={600}>
              {num(max * f, max * f < 10 ? 1 : 0)}
            </text>
          </g>
        );
      })}
      {points.map((p, i) => {
        const h = (Math.max(0, p.value) / max) * innerH;
        const x = pad.l + i * bw + bw * 0.15;
        return (
          <g key={i}>
            <rect x={x} y={pad.t + innerH - h} width={Math.max(2, bw * 0.7)} height={h} rx={2} className={p.mark ? 'fill-rose-600' : 'fill-sky-600'}>
              <title>{`${p.label}: ${num(p.value, 1)} ${unit}${p.mark ? ` · ${p.mark}` : ''}`}</title>
            </rect>
            {i % step === 0 && (
              <text x={x + bw * 0.35} y={height - 5} textAnchor="middle" className="fill-slate-700" fontSize={12} fontWeight={600}>
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/** Línea con puntos de 6 px, referencia opcional y puntos marcados en rose (con anotación). */
export const LineChart: React.FC<{ points: ChartPoint[]; refValue?: number | null; refLabel?: string; height?: number; ariaLabel: string; peakIndex?: number | null }> = ({
  points,
  refValue,
  refLabel,
  height = 170,
  ariaLabel,
  peakIndex,
}) => {
  const w = 320;
  const pad = { l: 40, r: 10, t: 20, b: 24 };
  const max = Math.max(1, ...points.map((p) => p.value), refValue || 0) * 1.1;
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH * (1 - Math.max(0, v) / max);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const step = Math.max(1, Math.ceil(points.length / 5));
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
      {[0, 0.5, 1].map((f) => {
        const yy = pad.t + innerH * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={yy} y2={yy} className="stroke-slate-300" strokeWidth={1} />
            <text x={pad.l - 4} y={yy + 4} textAnchor="end" className="fill-slate-700" fontSize={12} fontWeight={600}>
              {num(max * f, 0)}
            </text>
          </g>
        );
      })}
      {refValue !== null && refValue !== undefined && refValue > 0 && (
        <g>
          <line x1={pad.l} x2={w - pad.r} y1={y(refValue)} y2={y(refValue)} className="stroke-amber-500" strokeWidth={1.5} strokeDasharray="5 4" />
          {refLabel && (
            <text x={w - pad.r} y={y(refValue) - 4} textAnchor="end" className="fill-amber-800" fontSize={12} fontWeight={800}>
              {refLabel}
            </text>
          )}
        </g>
      )}
      {points.length > 1 && <path d={path} fill="none" className="stroke-sky-600" strokeWidth={2} strokeLinejoin="round" />}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={p.mark ? 4.5 : 3} className={p.mark ? 'fill-rose-600' : i === peakIndex ? 'fill-emerald-600' : 'fill-sky-600'}>
            <title>{`${p.label}: ${num(p.value, 1)}${p.mark ? ` · ${p.mark}` : ''}`}</title>
          </circle>
          {p.mark && (
            <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" className="fill-rose-700" fontSize={12} fontWeight={800}>
              {p.mark}
            </text>
          )}
          {i === peakIndex && !p.mark && (
            <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" className="fill-emerald-800" fontSize={12} fontWeight={800}>
              Pico
            </text>
          )}
          {i % step === 0 && (
            <text x={x(i)} y={height - 5} textAnchor="middle" className="fill-slate-700" fontSize={12} fontWeight={600}>
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

/** Tabla equivalente de un gráfico (accesibilidad y lectura al sol). */
export const DataToggle: React.FC<{ headers: string[]; rows: (string | number)[][]; label?: string }> = ({ headers, rows, label = 'Ver datos' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`h-11 px-3 rounded-xl text-sm font-bold text-sky-800 flex items-center gap-1 ${FOCUS_B}`}>
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                {headers.map((h, i) => (
                  <th key={h} className={`px-3 py-2 text-xs font-bold text-slate-800 ${i ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {r.map((c, j) => (
                    <td key={j} className={`px-3 py-1.5 text-slate-900 ${j ? 'text-right tabular-nums font-bold' : ''}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** Tarjeta de sección con título. */
export const Card: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, right, children, className = '' }) => (
  <section className={`${B.card} p-4 space-y-3 ${className}`}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-2">
        {title && <h3 className="text-base font-black text-slate-900">{title}</h3>}
        {right}
      </div>
    )}
    {children}
  </section>
);

/** Fila "etiqueta ........ valor" de desgloses. */
export const LineRow: React.FC<{ label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: string }> = ({ label, value, strong, tone }) => (
  <div className={`flex items-center justify-between gap-3 py-1.5 ${strong ? 'border-t-2 border-slate-200 pt-2' : ''}`}>
    <span className={`text-sm ${strong ? 'font-black' : 'font-semibold'} text-slate-900 min-w-0`}>{label}</span>
    <span className={`text-sm tabular-nums ${strong ? 'font-black text-base' : 'font-bold'} ${tone || 'text-slate-900'} text-right`}>{value}</span>
  </div>
);
