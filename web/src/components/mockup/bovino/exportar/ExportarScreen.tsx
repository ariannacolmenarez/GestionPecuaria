/**
 * B7 · Exportar y respaldo (Más › Exportar).
 * Reportes en PDF imprimible (generado en el teléfono, sin librerías externas) y Excel (CSV
 * con ";" y BOM), y compartir por WhatsApp. Según el rol se ocultan reportes y columnas con
 * montos. Respaldo: la nube (Firestore) guarda todo automáticamente; el administrador puede
 * descargar una copia completa en JSON.
 */
import React, { useMemo, useState } from 'react';
import { BookOpen, CalendarCheck, Cloud, CloudOff, Database, FileDown, FileSpreadsheet, History, Milk, Package, Scale, ScrollText, Share2, Users, Wallet } from 'lucide-react';
import type { BovinoLiquidation } from '../../../../models/bovinoModel';
import { nowISO } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { AnimalSearch } from '../pickers';
import { BottomSheet, Chips, ErrorBox, Field, MenuRow, PrimaryBtn, Screen, SecondaryBtn, Toggle, hm, fdy } from '../ui';
import { Card, PeriodFilter, periodRange, type Period } from '../kit';
import { describeEvent } from '../animales/eventText';
import { agendaReport, auditReport, balanceReport, herdReport, historyReport, inventoryReport, liquidationReport, milkReport, reportText, weighingReport, type Report } from './reports';
import { csvBlob } from './exportCsv';
import { deliverFile, safeFileName, shareText } from './share';

type Key = 'ganado' | 'inventario' | 'balance' | 'liquidacion' | 'ordeno' | 'pesajes' | 'agenda' | 'historial' | 'bitacora';

const ITEMS: { key: Key; title: string; subtitle: string; icon: React.ReactNode }[] = [
  { key: 'ganado', title: 'Lista de ganado', subtitle: 'Arete, categoría, lote, peso, GMD y estado', icon: <Users className="w-5 h-5" /> },
  { key: 'ordeno', title: 'Ordeño del periodo', subtitle: 'Litros por vaca y tanque, descarte', icon: <Milk className="w-5 h-5" /> },
  { key: 'pesajes', title: 'Pesajes', subtitle: 'Por lote o todo el hato, con GMD', icon: <Scale className="w-5 h-5" /> },
  { key: 'agenda', title: 'Agenda de hoy', subtitle: 'Lista de trabajo para imprimir', icon: <CalendarCheck className="w-5 h-5" /> },
  { key: 'inventario', title: 'Inventario de almacén', subtitle: 'Stock, lotes del fabricante y vencimientos', icon: <Package className="w-5 h-5" /> },
  { key: 'historial', title: 'Historial de un animal', subtitle: 'Línea de tiempo completa', icon: <History className="w-5 h-5" /> },
  { key: 'balance', title: 'Balance del periodo', subtitle: 'Ceba vs leche y cría, movimientos', icon: <Wallet className="w-5 h-5" /> },
  { key: 'liquidacion', title: 'Liquidación de lote', subtitle: 'Costos, venta y utilidad del ciclo', icon: <BookOpen className="w-5 h-5" /> },
  { key: 'bitacora', title: 'Bitácora', subtitle: 'Quién hizo cada cambio', icon: <ScrollText className="w-5 h-5" /> },
];

export default function ExportarScreen(_p: StageBProps) {
  const ctx = useBovino();
  const { perms, today, data, index, bovinoItems, agenda, selectors, members, me, farmName, tasks, movements, config } = ctx;
  const [open, setOpen] = useState<Key | null>(null);
  const [period, setPeriod] = useState<Period>(() => periodRange('mes', today));
  const [lotId, setLotId] = useState<string>('');
  const [animalId, setAnimalId] = useState<string>('');
  const [withInactive, setWithInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;

  const allowed = (k: Key) => {
    switch (k) {
      case 'ganado':
      case 'ordeno':
      case 'pesajes':
      case 'agenda':
        return true;
      case 'inventario':
      case 'historial':
        return perms.manejo;
      case 'balance':
      case 'liquidacion':
        return perms.verBalance;
      case 'bitacora':
        return perms.bitacora;
    }
  };
  const liqLots = useMemo(() => data.lots.filter((l) => l.type === 'ceba'), [data.lots]);

  const build = (k: Key): Report | string => {
    switch (k) {
      case 'ganado':
        return herdReport(index, { includeInactive: withInactive });
      case 'inventario':
        return inventoryReport(bovinoItems, today, perms.exportarMontos);
      case 'balance':
        return balanceReport(selectors.balance(period.from, period.to), data.finance, members);
      case 'liquidacion': {
        if (!lotId) return 'Elige el lote.';
        const lot = index.lotsById.get(lotId);
        const saved = lot?.liquidationId ? (data.finance.find((f) => f.id === lot.liquidationId) as BovinoLiquidation | undefined) : undefined;
        const q = saved?.snapshot || selectors.liquidationPreview(lotId, false);
        return q ? liquidationReport(q) : 'No se pudo calcular la liquidación.';
      }
      case 'ordeno':
        return milkReport(data.events, index, period.from, period.to);
      case 'pesajes':
        return weighingReport(data.events, index, period.from, period.to, lotId || undefined);
      case 'agenda':
        return agendaReport(agenda, today);
      case 'historial': {
        const v = animalId ? index.views.get(animalId) : undefined;
        if (!v) return 'Elige el animal.';
        return historyReport(v, index.eventsByAnimal.get(v.id) || [], (e) => describeEvent(e, index).title, index);
      }
      case 'bitacora':
        return auditReport(data.audit, period.from, period.to);
    }
  };

  const meta = () => ({ farmName, generatedBy: me.name || 'Usuario', generatedAt: `${fdy(today)} ${hm(nowISO())}` });

  const doExport = async (format: 'pdf' | 'csv' | 'wa') => {
    if (!open) return;
    setErr(null);
    setMsg(null);
    const r = build(open);
    if (typeof r === 'string') return setErr(r);
    setBusy(true);
    try {
      if (format === 'wa') {
        const res = await shareText(reportText(r, farmName), r.title);
        setMsg(res === 'copiado' ? 'Texto copiado: pégalo en WhatsApp.' : res === 'cancelado' ? null : online ? 'Listo para enviar.' : 'Se compartirá cuando haya señal.');
      } else {
        const blob = format === 'csv' ? csvBlob(r, meta()) : (await import('./exportPdf')).pdfBlob(r, meta());
        const res = await deliverFile(blob, safeFileName(r.fileBase, format, today), r.title);
        setMsg(res === 'descargado' ? 'Archivo descargado.' : res === 'compartido' ? 'Archivo compartido.' : res === 'abierto' ? 'Archivo abierto: usa Compartir o Imprimir para guardarlo.' : res === 'cancelado' ? null : 'No se pudo entregar el archivo en este dispositivo.');
      }
    } catch (e) {
      console.error(e);
      setErr('No se pudo generar el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const backup = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      let cloud: any = null;
      try {
        const { dbService } = await import('../../../../services/dbService');
        cloud = await dbService.getBovinoData();
      } catch {
        cloud = null;
      }
      const payload = {
        formato: 'gestion-pecuaria/bovino',
        version: 1,
        generado: nowISO(),
        por: { uid: me.uid, nombre: me.name },
        granja: farmName,
        datos: cloud || { ...data, config },
        tareas: tasks.filter((t) => t.targetRubro === 'bovino'),
        movimientos: movements.filter((m) => m.rubro === 'bovino'),
        almacen: bovinoItems,
      };
      const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
      const res = await deliverFile(blob, safeFileName('respaldo-bovino', 'json', today), 'Respaldo bovino');
      setMsg(res === 'error' ? 'No se pudo entregar el archivo en este dispositivo.' : 'Copia completa generada.');
    } catch (e) {
      console.error(e);
      setErr('No se pudo generar la copia.');
    } finally {
      setBusy(false);
    }
  };

  const item = open ? ITEMS.find((i) => i.key === open) : undefined;
  const needsPeriod = open === 'balance' || open === 'ordeno' || open === 'pesajes' || open === 'bitacora';
  const preview = open ? build(open) : null;

  return (
    <Screen>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {ITEMS.filter((i) => allowed(i.key)).map((i) => (
          <MenuRow
            key={i.key}
            icon={i.icon}
            title={i.title}
            subtitle={i.subtitle}
            onClick={() => {
              setOpen(i.key);
              setErr(null);
              setMsg(null);
            }}
          />
        ))}
      </div>
      {!perms.exportarMontos && <p className="text-xs text-slate-700">Los reportes se generan sin columnas de costos ni precios para tu rol.</p>}

      <Card title={<span className="flex items-center gap-2">{online ? <Cloud className="w-5 h-5 text-sky-700" /> : <CloudOff className="w-5 h-5 text-amber-700" />} Respaldo</span>}>
        <p className="text-sm text-slate-900">
          Tus datos se guardan en la nube automáticamente cada vez que hay señal. Cada registro (pesaje, ordeño, tratamiento…) es un documento propio: si dos teléfonos trabajan sin internet, al sincronizar no se pisan.
        </p>
        <p className={`text-sm font-bold ${online ? 'text-emerald-800' : 'text-amber-900'}`}>{online ? 'Con conexión: los cambios se están subiendo.' : 'Sin conexión: todo queda guardado en el teléfono y se subirá al volver la señal.'}</p>
        <p className="text-xs text-slate-700">
          En este teléfono: {index.list.length} animales · {data.events.length} registros · {data.finance.length} movimientos.
        </p>
        {perms.administrar && (
          <SecondaryBtn className="w-full" disabled={busy} onClick={backup}>
            <Database className="w-4 h-4" /> Descargar copia completa (JSON)
          </SecondaryBtn>
        )}
        {!open && <ErrorBox error={err} />}
        {!open && msg && <p className="text-sm font-bold text-emerald-800">{msg}</p>}
      </Card>

      {open && item && (
        <BottomSheet title={item.title} subtitle={typeof preview === 'object' && preview ? `${preview.rows.length} filas` : undefined} icon={<FileDown className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={() => setOpen(null)}>
          <div className="space-y-3">
            {open === 'ganado' && <Toggle checked={withInactive} onChange={setWithInactive} label="Incluir vendidos y muertos" />}
            {needsPeriod && <PeriodFilter value={period} onChange={setPeriod} today={today} options={['hoy', 'semana', 'mes', 'mesAnterior', 'tresMeses', 'anio', 'rango']} />}
            {open === 'pesajes' && (
              <Field label="Lote">
                <Chips options={[{ key: '', label: 'Todo el hato' }, ...data.lots.filter((l) => l.status === 'abierto').map((l) => ({ key: l.id, label: l.name }))]} value={lotId} onChange={setLotId} />
              </Field>
            )}
            {open === 'liquidacion' && (
              <Field label="Lote de ceba">
                {liqLots.length ? <Chips options={liqLots.map((l) => ({ key: l.id, label: `${l.name}${l.status === 'cerrado' ? ' (liquidado)' : ''}` }))} value={lotId} onChange={setLotId} /> : <p className="text-sm text-slate-800">No hay lotes de ceba.</p>}
              </Field>
            )}
            {open === 'historial' && (
              <Field label="Animal">
                {animalId ? (
                  <SecondaryBtn className="w-full" onClick={() => setAnimalId('')}>
                    #{index.views.get(animalId)?.tag} · cambiar
                  </SecondaryBtn>
                ) : (
                  <AnimalSearch onPick={(v) => setAnimalId(v.id)} />
                )}
              </Field>
            )}
            {typeof preview === 'object' && preview && <p className="text-sm text-slate-900">{preview.subtitle}</p>}
            <div className="grid grid-cols-2 gap-2">
              <PrimaryBtn disabled={busy} onClick={() => doExport('pdf')}>
                <FileDown className="w-5 h-5" /> PDF
              </PrimaryBtn>
              <PrimaryBtn tone="dark" disabled={busy} onClick={() => doExport('csv')}>
                <FileSpreadsheet className="w-5 h-5" /> Excel (CSV)
              </PrimaryBtn>
            </div>
            <PrimaryBtn className="w-full" tone="emerald" disabled={busy} onClick={() => doExport('wa')}>
              <Share2 className="w-5 h-5" /> Compartir por WhatsApp
            </PrimaryBtn>
            <ErrorBox error={err} />
            {msg && <p className="text-sm font-bold text-emerald-800">{msg}</p>}
            <p className="text-xs text-slate-700">PDF en blanco y negro, apto para imprimir. Excel: separador punto y coma y decimales con coma.</p>
          </div>
        </BottomSheet>
      )}
    </Screen>
  );
}
