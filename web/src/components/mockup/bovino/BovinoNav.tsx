/** Barra inferior del módulo (reemplaza a la BottomNav global: nunca se apilan dos barras). */
import React, { useMemo } from 'react';
import { Beef, CalendarCheck, Fence, HeartPulse, LayoutGrid } from 'lucide-react';
import { useBovino } from './context';
import type { BovinoSection } from './routes';
import { FOCUS_B } from './ui';
import { daysBetween } from '../../../utils/dates';
import { isItemExpired } from '../../../models/bovinoCalc';

const ITEMS: { id: BovinoSection; label: string; Icon: React.ElementType }[] = [
  { id: 'hato', label: 'Hato', Icon: Beef },
  { id: 'agenda', label: 'Agenda', Icon: CalendarCheck },
  { id: 'campo', label: 'Campo', Icon: Fence },
  { id: 'repro', label: 'Repro', Icon: HeartPulse },
  { id: 'mas', label: 'Más', Icon: LayoutGrid },
];

export const BovinoNav: React.FC = () => {
  const { route, goSection, agenda, today, home, bovinoItems } = useBovino();
  const badges = useMemo(() => {
    const due = agenda.filter((a) => a.date <= today);
    const overdue = due.some((a) => a.overdue);
    const repro = agenda.filter((a) => (a.kind === 'parto' && daysBetween(today, a.date) <= 7) || (a.kind === 'secar' && a.date <= today)).length;
    const expired = bovinoItems.filter((i) => isItemExpired(i, today) && (i.quantity || 0) > 0).length;
    return { agenda: due.length, overdue, repro, mas: home.criticalItems + expired };
  }, [agenda, today, home.criticalItems, bovinoItems]);

  return (
    <nav
      id="bovino-navigation-bar"
      role="tablist"
      aria-label="Secciones del módulo bovino"
      className="bg-white border-t border-slate-200 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1 shrink-0 select-none"
    >
      {ITEMS.map(({ id, label, Icon }) => {
        const on = route.section === id;
        const badge = id === 'agenda' ? badges.agenda : id === 'repro' ? badges.repro : id === 'mas' ? badges.mas : 0;
        const badgeCls = id === 'agenda' && badges.overdue ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-900';
        return (
          <button
            key={id}
            role="tab"
            aria-selected={on}
            onClick={() => goSection(id)}
            className={`relative h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold ${on ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-slate-100'} ${FOCUS_B}`}
          >
            <Icon className="w-6 h-6" />
            {label}
            {badge > 0 && (
              <span className={`absolute top-1 right-[18%] min-w-5 h-5 px-1 rounded-full text-[12px] font-black flex items-center justify-center ${badgeCls}`}>
                {badge > 99 ? '99+' : badge}
                <span className="sr-only"> pendientes</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
