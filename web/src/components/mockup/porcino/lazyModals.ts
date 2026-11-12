/**
 * Modales del Menú Porcino cargados bajo demanda (React.lazy) para reducir el
 * bundle inicial: cada modal solo se descarga cuando se abre por primera vez.
 */
import { lazy } from 'react';

export const SanitaryProcedureModal = lazy(() =>
  import('../SanitaryProcedureModal').then((m) => ({ default: m.SanitaryProcedureModal }))
);
export const WarehouseModal = lazy(() => import('../WarehouseModal').then((m) => ({ default: m.WarehouseModal })));
export const WeaningProratingModal = lazy(() =>
  import('../WeaningProratingModal').then((m) => ({ default: m.WeaningProratingModal }))
);
export const UnifiedSaleSlaughterModal = lazy(() =>
  import('../UnifiedSaleSlaughterModal').then((m) => ({ default: m.UnifiedSaleSlaughterModal }))
);
export const AddSanitaryActivityModal = lazy(() =>
  import('../AddSanitaryActivityModal').then((m) => ({ default: m.AddSanitaryActivityModal }))
);
export const BatchProductionConfigModal = lazy(() =>
  import('../BatchProductionConfigModal').then((m) => ({ default: m.BatchProductionConfigModal }))
);
export const HerdCategoryViewModal = lazy(() =>
  import('../HerdCategoryViewModal').then((m) => ({ default: m.HerdCategoryViewModal }))
);
export const AnimalTraceabilityModal = lazy(() =>
  import('../AnimalTraceabilityModal').then((m) => ({ default: m.AnimalTraceabilityModal }))
);
export const FarrowingModal = lazy(() => import('../FarrowingModal').then((m) => ({ default: m.FarrowingModal })));
export const BoarMatingAndNewModal = lazy(() =>
  import('../BoarMatingAndNewModal').then((m) => ({ default: m.BoarMatingAndNewModal }))
);
export const PigletMortalityModal = lazy(() =>
  import('../PigletMortalityModal').then((m) => ({ default: m.PigletMortalityModal }))
);
export const FeedingPlanConfigModal = lazy(() =>
  import('../FeedingPlanConfigModal').then((m) => ({ default: m.FeedingPlanConfigModal }))
);
export const PorcinoCensusModal = lazy(() =>
  import('../PorcinoCensusModal').then((m) => ({ default: m.PorcinoCensusModal }))
);
