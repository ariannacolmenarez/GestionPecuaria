/** A10 · Hub "Operación de campo": mosaicos con su dato vivo. */
import React, { useMemo } from 'react';
import { ArrowLeftRight, Map as MapIcon, Milk, Scale, Syringe, Users } from 'lucide-react';
import { useBovino } from '../context';
import { dailyMilkProduction } from '../../../../models/bovinoCalc';
import { Screen, Tile, num } from '../ui';

export const CampoHub: React.FC = () => {
  const { home, navigate, index, data, today } = useBovino();
  const occupied = home.paddocks.filter((p) => p.status === 'ocupado').length;
  const available = home.paddocks.filter((p) => p.status === 'disponible').length;
  const retiros = useMemo(() => index.active.filter((v) => v.withdrawal.meatActive || v.withdrawal.milkActive).length, [index]);
  const month = today.slice(0, 7);
  const movesMonth = useMemo(
    () => data.animals.filter((a) => (a.entryDate || '').startsWith(month)).length + data.events.filter((e) => e.kind === 'baja' && e.date.startsWith(month)).length,
    [data, month]
  );
  const milk = useMemo(() => dailyMilkProduction(data.events, today), [data.events, today]);
  return (
    <Screen>
      <div className="grid grid-cols-2 gap-3">
        <Tile icon={<Users className="w-6 h-6" />} title="Lotes" detail={`${num(home.lots.length)} activos`} onClick={() => navigate({ s: 'lotes' })} />
        <Tile icon={<MapIcon className="w-6 h-6" />} title="Potreros" detail={home.paddocks.length ? `${occupied} ocupados · ${available} disponibles` : 'Sin potreros'} onClick={() => navigate({ s: 'potreros' })} />
        <Tile icon={<Scale className="w-6 h-6" />} title="Ceba" detail={home.ceba.avgGmdKg !== null ? `GMD ${num(home.ceba.avgGmdKg, 2)} kg/d` : 'Pesajes y GMD'} onClick={() => navigate({ s: 'ceba' })} />
        <Tile icon={<Milk className="w-6 h-6" />} title="Leche" detail={milk.liters > 0 ? `${num(milk.liters, 1)} L hoy` : 'Ordeño y curva'} onClick={() => navigate({ s: 'leche' })} />
        <Tile icon={<Syringe className="w-6 h-6" />} title="Sanidad" detail={retiros ? `${retiros} con retiro` : 'Tratamientos y retiros'} onClick={() => navigate({ s: 'sanidad' })} badge={retiros} />
        <Tile icon={<ArrowLeftRight className="w-6 h-6" />} title="Entradas y salidas" detail={`${num(movesMonth)} este mes`} onClick={() => navigate({ s: 'movimientosHato' })} />
      </div>
    </Screen>
  );
};
