/**
 * Íconos del módulo porcino por categoría (reemplazan las fotos de stock):
 * engorde = báscula (ganancia de peso), maternidad = corazón (gestación/lactancia),
 * verracos = ADN (reproducción), lechones = bebé, lote = alcancía-cerdo.
 */
import React from 'react';
import { Baby, Dna, HeartPulse, PiggyBank, Scale } from 'lucide-react';
import type { PorcinoAnimal, PorcinoCategory } from '../../../types';
import { headCount } from '../../../models/porcinoRules';

type IconCategory = PorcinoCategory | 'lote';

const STYLE: Record<IconCategory, { Icon: React.ElementType; box: string }> = {
  engorde: { Icon: Scale, box: 'bg-emerald-100 text-emerald-700' },
  maternidad: { Icon: HeartPulse, box: 'bg-rose-100 text-rose-700' },
  verracos: { Icon: Dna, box: 'bg-blue-100 text-blue-700' },
  lechones: { Icon: Baby, box: 'bg-amber-100 text-amber-700' },
  lote: { Icon: PiggyBank, box: 'bg-indigo-100 text-indigo-700' },
};

/** Categoría visual de un animal: un registro con varias cabezas se muestra como lote. */
export const iconCategoryOf = (a: Pick<PorcinoAnimal, 'category' | 'batchAnimalCount'>): IconCategory =>
  a.category === 'engorde' && headCount(a as PorcinoAnimal) > 1 ? 'lote' : a.category;

export const CategoryIcon: React.FC<{
  category: IconCategory;
  /** Tamaño de la caja: sm 40px, md 56px, lg 64px. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}> = ({ category, size = 'sm', className = '', label }) => {
  const { Icon, box } = STYLE[category] || STYLE.engorde;
  const dims = size === 'lg' ? 'w-16 h-16 rounded-2xl' : size === 'md' ? 'w-14 h-14 rounded-2xl' : 'w-10 h-10 rounded-lg';
  const icon = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  return (
    <div role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`${dims} ${box} flex items-center justify-center shrink-0 ${className}`}>
      <Icon className={icon} />
    </div>
  );
};
