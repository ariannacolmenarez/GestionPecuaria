import { Router } from 'express';
import { avicolaController } from '../controllers/avicolaController';

const router = Router();

router.get('/lots', avicolaController.getLots);
router.get('/total-count', avicolaController.getTotalCount);
router.post('/lot', avicolaController.createLot);
router.post('/daily-record', avicolaController.recordDaily);
router.post('/liquidate', avicolaController.liquidateSale);

export default router;
