/**
 * B9 · Bitácora (solo Administrador): quién creó, editó, eliminó o autorizó cada dato y a qué
 * hora. Filtros por usuario, tipo y periodo. Solo lectura; exportable a CSV.
 */
import React, { useMemo, useState } from 'react';
import { Ban, DollarSign, FileSpreadsheet, Package, PawPrint, ScrollText, Settings, Skull } from 'lucide-react';
import type { BovinoAuditEntity, BovinoAuditEntry } from '../../../../models/bovinoModel';
import { inRange } from '../../../../models/bovinoCalc';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { BlockedNotice, ChipFilter, EmptyBlock, Screen, SecondaryBtn, fd, hm, usePaged } from '../ui';
import { PeriodFilter, periodRange, type Period } from '../kit';
import { auditReport } from '../exportar/reports';
import { csvBlob } from '../exportar/exportCsv';
import { deliverFile, safeFileName } from '../exportar/share';

type Tipo = 'todos' | 'almacen' | 'animales' | 'bajas' | 'finanzas' | 'config';
const TIPO: Record<Exclude<Tipo, 'todos'>, BovinoAuditEntity[]> = {
  almacen: ['salida_almacen', 'entrada_almacen', 'insumo'],
  animales: ['animal', 'lote', 'potrero', 'evento'],
  bajas: ['muerte', 'descarte', 'venta'],
  finanzas: ['movimiento_financiero', 'liquidacion'],
  config: ['configuracion', 'tarea'],
};
const ACT: Record<BovinoAuditEntry['action'], string> = { crear: 'registró', editar: 'editó', eliminar: 'eliminó', autorizar: 'autorizó' };

const iconOf = (e: BovinoAuditEntity) =>
  TIPO.almacen.includes(e) ? <Package className="w-5 h-5" /> : TIPO.bajas.includes(e) ? <Skull className="w-5 h-5" /> : TIPO.finanzas.includes(e) ? <DollarSign className="w-5 h-5" /> : TIPO.config.includes(e) ? <Settings className="w-5 h-5" /> : <PawPrint className="w-5 h-5" />;

export default function Bitacora(_p: StageBProps) {
  const { data, perms, today, farmName, me } = useBovino();
  const [user, setUser] = useState('todos');
  const [tipo, setTipo] = useState<Tipo>('todos');
  const [period, setPeriod] = useState<Period>(() => periodRange('mes', today));
  const [msg, setMsg] = useState<string | null>(null);

  const users = useMemo(() => [...new Map(data.audit.map((a) => [a.uid, a.name])).entries()], [data.audit]);
  const list = useMemo(
    () =>
      data.audit
        .filter((a) => inRange((a.at || '').slice(0, 10), period.from, period.to))
        .filter((a) => user === 'todos' || a.uid === user)
        .filter((a) => tipo === 'todos' || TIPO[tipo].includes(a.entity))
        .sort((a, b) => (a.at < b.at ? 1 : -1)),
    [data.audit, period, user, tipo]
  );
  const { shown, more } = usePaged<BovinoAuditEntry>(list, 50);

  if (!perms.bitacora) return <Screen><BlockedNotice title="La bitácora la ve solo el administrador" /></Screen>;

  const exportCsv = async () => {
    const r = auditReport(list, period.from, period.to);
    const res = await deliverFile(csvBlob(r, { farmName, generatedBy: me.name, generatedAt: today }), safeFileName(r.fileBase, 'csv', today), r.title);
    setMsg(res === 'error' ? 'No se pudo entregar el archivo.' : 'Bitácora exportada.');
  };

  return (
    <Screen>
      <PeriodFilter value={period} onChange={setPeriod} today={today} options={['hoy', 'semana', 'mes', 'mesAnterior', 'tresMeses', 'rango']} />
      <ChipFilter<Tipo>
        ariaLabel="Tipo"
        value={tipo}
        onChange={setTipo}
        options={[
          { key: 'todos', label: 'Todo' },
          { key: 'almacen', label: 'Almacén' },
          { key: 'animales', label: 'Animales' },
          { key: 'bajas', label: 'Muertes y ventas' },
          { key: 'finanzas', label: 'Finanzas' },
          { key: 'config', label: 'Configuración' },
        ]}
      />
      {users.length > 1 && <ChipFilter ariaLabel="Usuario" value={user} onChange={setUser} options={[{ key: 'todos', label: 'Todos' }, ...users.map(([uid, name]) => ({ key: uid, label: name }))]} />}
      {list.length === 0 ? (
        <EmptyBlock icon={<ScrollText className="w-8 h-8" />} title="Sin registros en este periodo" />
      ) : (
        <ul className="space-y-2">
          {shown.map((a) => {
            const del = a.action === 'eliminar';
            const auth = a.action === 'autorizar';
            return (
              <li key={a.id} className={`rounded-2xl border-2 p-3 flex gap-3 ${del ? 'bg-rose-50 border-rose-200' : auth ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${del ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>{del ? <Ban className="w-5 h-5" /> : iconOf(a.entity)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-900">
                    <strong>{a.name}</strong> {ACT[a.action]}: {a.summary}
                  </span>
                  <span className="block text-xs text-slate-700">
                    {fd(a.at.slice(0, 10))} · {hm(a.at)} · {a.role}
                  </span>
                  {a.action === 'editar' && a.data?.patch && (
                    <span className="block text-xs text-slate-800 mt-1 break-words">
                      {Object.entries(a.data.patch as Record<string, unknown>)
                        .filter(([, v]) => typeof v !== 'object')
                        .slice(0, 6)
                        .map(([k, v]) => `${k} → ${String(v)}`)
                        .join(' · ')}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {more}
      <SecondaryBtn className="w-full" onClick={exportCsv} disabled={!list.length}>
        <FileSpreadsheet className="w-4 h-4" /> Exportar a Excel (CSV)
      </SecondaryBtn>
      {msg && <p className="text-sm font-bold text-emerald-800">{msg}</p>}
    </Screen>
  );
}
