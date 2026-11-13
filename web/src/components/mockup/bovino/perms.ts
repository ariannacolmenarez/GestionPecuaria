/**
 * Permisos de UI del módulo bovino (puros). Se derivan de los permisos del dominio
 * (bovinoCan en models/bovinoModel.ts) para que la UI nunca ofrezca algo que el
 * dominio luego rechace:
 *  - Operario (Operador / Trabajador): carga diaria, SIN montos ni balances.
 *  - Encargado (Veterinario): + reproducción, sanidad, farmacia, lotes y potreros.
 *  - Propietario (Administrador): todo (precios, ventas, cierre de lotes, balance).
 */
import { bovinoCan, bovinoRoleOf, BOVINO_ROLE_LABEL, type BovinoRole, type FarmRole } from '../../../models/bovinoModel';

export interface BovinoPerms {
  role: BovinoRole;
  farmRole: FarmRole | string;
  roleLabel: string;
  /** Ordeño, pesaje, parto, calostro, ración, salidas de alimento/minerales. */
  cargaDiaria: boolean;
  /** Alta y movimiento de animales, lotes, potreros, reproducción, sanidad, farmacia, compras. */
  manejo: boolean;
  /** Montos, precios, valorización, costo por kg / litro, balance (solo propietario). */
  verCostos: boolean;
  /**
   * Costos de insumos y tratamientos: costo unitario, valor del stock, Kardex con montos y
   * costo del tratamiento (encargado y propietario). No incluye balance, liquidación ni utilidad.
   */
  verCostosInsumos: boolean;
  /** Ventas, ingresos, gastos, cierre de lotes, configuración, borrados. */
  administrar: boolean;
  // ---- Derivados para la UI ----
  verBalance: boolean;
  altaAnimales: boolean;
  moverLotes: boolean;
  reproduccion: boolean;
  sanidad: boolean;
  farmacia: boolean;
  /** Compras y entradas de almacén (el dominio exige el precio de compra). */
  compras: boolean;
  /** Salidas de farmacia y otros insumos (alimento y minerales: cargaDiaria). */
  salidasTodo: boolean;
  bajas: boolean;
  ventas: boolean;
  cerrarLote: boolean;
  config: boolean;
  bitacora: boolean;
  /** Exportar con montos. */
  exportarMontos: boolean;
}

export type BovinoPermKey = { [K in keyof BovinoPerms]: BovinoPerms[K] extends boolean ? K : never }[keyof BovinoPerms];

export function permsForRole(farmRole: FarmRole | string | undefined): BovinoPerms {
  const role = bovinoRoleOf(farmRole);
  const carga = bovinoCan(farmRole, 'carga_diaria');
  const manejo = bovinoCan(farmRole, 'manejo');
  const costos = bovinoCan(farmRole, 'ver_costos');
  const admin = bovinoCan(farmRole, 'administrar');
  return {
    role,
    farmRole: farmRole || 'Operador',
    roleLabel: BOVINO_ROLE_LABEL[role],
    cargaDiaria: carga,
    manejo,
    verCostos: costos,
    verCostosInsumos: costos || manejo,
    administrar: admin,
    verBalance: admin && costos,
    altaAnimales: manejo,
    moverLotes: manejo,
    reproduccion: manejo,
    sanidad: manejo,
    farmacia: manejo,
    compras: manejo,
    salidasTodo: manejo,
    bajas: manejo,
    ventas: admin,
    cerrarLote: admin,
    config: admin,
    bitacora: admin,
    exportarMontos: costos,
  };
}
