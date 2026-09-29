import { Router } from 'express';
import { porcinoController } from '../controllers/porcinoController';

const router = Router();

// 1. Contadores y Censo en Vivo
router.get('/counters', porcinoController.getCounters);
router.get('/census', porcinoController.getCensusAudit);
router.post('/animals', porcinoController.registerAnimal);

// 2. Métricas Especializadas por Módulo
router.get('/engorde/metrics', porcinoController.getEngordeMetrics);
router.get('/maternidad/metrics', porcinoController.getMaternidadMetrics);
router.get('/verracos/metrics', porcinoController.getVerracosMetrics);
router.get('/lechones/metrics', porcinoController.getLechonesMetrics);

// 3. Conciliación Matemática de Movimientos
router.get('/movements-ledger', porcinoController.getMovementsLedger);

// 4. Planes de Alimentación y Nutrición
router.get('/feeding-plans', porcinoController.getFeedingPlans);
router.post('/feeding-plans', porcinoController.updateFeedingPlans);
router.post('/feeding-calculator', porcinoController.calculateFeedingBatch);

export default router;
