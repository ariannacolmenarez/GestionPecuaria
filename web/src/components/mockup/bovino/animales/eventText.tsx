/** Texto, ícono y color de cada evento bovino para historiales y líneas de tiempo. */
import React from 'react';
import { ArrowRightLeft, Baby, Droplets, Heart, LogIn, LogOut, Milk, NotebookPen, Package, Scale, Stethoscope, Syringe, Wheat } from 'lucide-react';
import type { BovinoEvent } from '../../../../models/bovinoModel';
import type { BovinoIndex } from '../../../../models/bovinoCalc';
import { num } from '../ui';

export type TimelineFilter = 'todo' | 'pesajes' | 'repro' | 'sanidad' | 'movimientos' | 'leche';

export function eventFilterOf(e: BovinoEvent): TimelineFilter {
  switch (e.kind) {
    case 'pesaje':
    case 'destete':
      return 'pesajes';
    case 'servicio':
    case 'diagnostico':
    case 'parto':
    case 'calostro':
    case 'secado':
      return 'repro';
    case 'tratamiento':
      return 'sanidad';
    case 'ordeno':
      return 'leche';
    default:
      return 'movimientos';
  }
}

export interface EventDesc {
  title: string;
  Icon: React.ElementType;
  dot: string;
}

export function describeEvent(e: BovinoEvent, idx: BovinoIndex): EventDesc {
  const pad = (id?: string) => (id ? idx.paddocksById.get(id)?.name || 'potrero' : '');
  const lot = (id?: string) => (id ? idx.lotsById.get(id)?.name || 'lote' : '');
  const x = e as any;
  switch (e.kind) {
    case 'pesaje':
      return { title: x.lotAverage ? `Pesaje promedio de lote ${num(x.weightKg)} kg (${x.heads || '?'} cab.)` : `Pesaje ${num(x.weightKg, 1)} kg`, Icon: Scale, dot: 'bg-sky-600' };
    case 'movimiento': {
      const parts: string[] = [];
      if (x.toLotId !== undefined || x.fromLotId) parts.push(x.toLotId ? `a ${lot(x.toLotId)}` : x.fromLotId ? `sale de ${lot(x.fromLotId)}` : '');
      if (x.toPaddockId) parts.push(`potrero ${pad(x.toPaddockId)}`);
      const who = x.scope === 'lote' ? `${lot(x.lotId)}: ` : '';
      return { title: `${who}Movimiento ${parts.filter(Boolean).join(' · ') || ''}`.trim(), Icon: ArrowRightLeft, dot: 'bg-slate-600' };
    }
    case 'racion':
      return { title: `Ración ${num(x.kg)} kg de ${x.feedName}`, Icon: Wheat, dot: 'bg-amber-500' };
    case 'salida':
      return { title: `Salida ${num(x.quantity, 2)} ${x.unit} de ${x.itemName} → ${x.destination?.label || ''}`, Icon: Package, dot: 'bg-slate-600' };
    case 'entrada':
      return { title: `Entrada ${num(x.quantity, 2)} ${x.unit} de ${x.itemName}`, Icon: Package, dot: 'bg-emerald-600' };
    case 'ordeno':
      return { title: `${x.tank ? 'Tanque' : 'Ordeño'} ${num(x.liters, 1)} L (${x.shift === 'manana' ? 'mañana' : x.shift === 'tarde' ? 'tarde' : 'único'})${x.discarded ? (x.discardDestination === 'terneros' ? ' · retiro: a los terneros' : ' · descarte por retiro') : ''}`, Icon: Milk, dot: 'bg-sky-600' };
    case 'servicio':
      return { title: `${x.method === 'te' ? 'Transferencia de embrión' : x.method === 'monta' ? 'Servicio monta natural' : x.method === 'iatf' ? 'Servicio IATF' : 'Servicio inseminación'}${x.sireLabel ? ` · ${x.sireLabel}` : ''}`, Icon: Heart, dot: 'bg-sky-600' };
    case 'diagnostico':
      return { title: `Diagnóstico ${x.method === 'ecografia' ? 'ecografía' : 'palpación'}: ${x.result === 'preñada' ? 'Preñada' : x.result === 'vacia' ? 'Vacía' : 'Dudosa'}${x.expectedCalvingDate ? ` · FPP ${x.expectedCalvingDate}` : ''}`, Icon: Stethoscope, dot: x.result === 'preñada' ? 'bg-emerald-600' : 'bg-slate-500' };
    case 'parto':
      return { title: `${x.difficulty === 'aborto' ? 'Aborto' : 'Parto'}${x.calves?.length ? ` · ${x.calves.length} cría(s)` : ''}`, Icon: Baby, dot: 'bg-emerald-600' };
    case 'calostro':
      return { title: `Calostro a las ${x.hoursAfterBirth} h${x.liters ? ` · ${num(x.liters, 1)} L` : ''}`, Icon: Milk, dot: 'bg-emerald-600' };
    case 'secado':
      return { title: `Secado${x.treatment ? ` · ${x.treatment}` : ''}`, Icon: Droplets, dot: 'bg-amber-500' };
    case 'destete':
      return { title: `Destete${x.weightKg ? ` · ${num(x.weightKg, 1)} kg` : ''}`, Icon: Baby, dot: 'bg-sky-600' };
    case 'tratamiento':
      return { title: `${x.productName} ${num(x.dose, 2)} ${x.doseUnit} · ${x.purpose === 'curativo' ? 'curativo' : 'preventivo'}`, Icon: Syringe, dot: 'bg-rose-600' };
    case 'baja':
      return { title: `Baja: ${x.exitType === 'venta' ? 'venta' : x.exitType === 'muerte' ? 'muerte' : 'descarte'}${x.cause ? ` · ${x.cause}` : ''}`, Icon: LogOut, dot: 'bg-slate-800' };
    case 'observacion':
      return { title: x.title || 'Observación', Icon: NotebookPen, dot: 'bg-slate-500' };
    default:
      return { title: 'Registro', Icon: LogIn, dot: 'bg-slate-500' };
  }
}
