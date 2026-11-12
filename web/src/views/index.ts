/**
 * ============================================================================
 * CAPA VISTA (VIEW) - ÍNDICE PRINCIPAL DE EXPORTACIÓN
 * ============================================================================
 * Las vistas pesadas o secundarias (BovinoModalView, AvicolaModuleView,
 * DocumentationView y MvcArchitectureView) NO se re-exportan aquí: App.tsx las
 * carga de forma diferida (React.lazy) desde su archivo para que queden en
 * chunks propios. Un import estático desde este índice impediría la división.
 */

export * from './home/HomeDashboardView';
export * from './porcino/MenuPorcinoView';
export * from './warehouse/WarehouseModalView';
export * from './alerts/AlertsCenterModalView';
export * from './common';
