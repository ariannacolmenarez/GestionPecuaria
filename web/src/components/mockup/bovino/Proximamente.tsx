/** Pantalla "Próximamente" de las secciones de la Etapa B (se reemplaza archivo por archivo). */
import React from 'react';
import { Hourglass } from 'lucide-react';
import { useBovino } from './context';
import { FOCUS_B, Screen } from './ui';

export const Proximamente: React.FC<{ title: string; text: string }> = ({ title, text }) => {
  const { back, route } = useBovino();
  return (
    <Screen>
      <div className="bg-white rounded-2xl border-2 border-dashed border-sky-300 p-6 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center mx-auto">
          <Hourglass className="w-8 h-8" />
        </div>
        <span className="inline-flex h-7 px-3 rounded-full bg-sky-100 text-sky-800 text-xs font-bold items-center">Próximamente</span>
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        <p className="text-sm text-slate-800 max-w-xs mx-auto">{text}</p>
        {route.stack.length > 1 && (
          <button type="button" onClick={back} className={`h-12 px-6 rounded-2xl bg-white border-2 border-slate-300 text-slate-900 font-bold ${FOCUS_B}`}>
            Volver
          </button>
        )}
      </div>
    </Screen>
  );
};
