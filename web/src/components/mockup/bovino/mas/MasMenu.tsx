/** A10 · Menú "Más": almacén, balance, reportes, exportar, configuración, bitácora y volver a la granja (filtrado por rol). */
import React, { useMemo } from 'react';
import { Calculator, ChartBar, FileDown, House as HomeIcon, Package, ScrollText, Settings } from 'lucide-react';
import { isItemExpired } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { MenuRow, Screen } from '../ui';

export const MasMenu: React.FC = () => {
  const { perms, navigate, exitModule, home, bovinoItems, today } = useBovino();
  const expired = useMemo(() => bovinoItems.filter((i) => isItemExpired(i, today) && i.quantity > 0).length, [bovinoItems, today]);
  return (
    <Screen>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        <MenuRow icon={<Package className="w-5 h-5" />} title="Almacén bovino" subtitle="Alimentos, minerales, farmacia y otros" badge={home.criticalItems + expired} onClick={() => navigate({ s: 'almacen' })} />
        {perms.verBalance && <MenuRow icon={<Calculator className="w-5 h-5" />} title="Balance" subtitle="Ceba vs leche y cría · liquidaciones" onClick={() => navigate({ s: 'balance' })} />}
        {perms.manejo && <MenuRow icon={<ChartBar className="w-5 h-5" />} title="Reportes y KPIs" subtitle="GMD, conversión, preñez, IEP" onClick={() => navigate({ s: 'reportes' })} />}
        <MenuRow icon={<FileDown className="w-5 h-5" />} title="Exportar y respaldo" subtitle={perms.exportarMontos ? 'PDF, Excel y copia completa' : 'Lista de ganado y ordeño'} onClick={() => navigate({ s: 'exportar' })} />
        {perms.manejo && <MenuRow icon={<Settings className="w-5 h-5" />} title="Configuración bovina" subtitle={perms.config ? 'Moneda, tasa, topes, prorrateo' : 'Parámetros reproductivos y plan sanitario'} onClick={() => navigate({ s: 'config' })} />}
        {perms.bitacora && <MenuRow icon={<ScrollText className="w-5 h-5" />} title="Bitácora" subtitle="Quién registró o eliminó cada dato" onClick={() => navigate({ s: 'bitacora' })} />}
        <MenuRow icon={<HomeIcon className="w-5 h-5" />} title="Volver a la granja" accent onClick={exitModule} />
      </div>
      <p className="text-xs text-slate-700 text-center">Tu rol en el módulo: {perms.roleLabel}</p>
    </Screen>
  );
};
