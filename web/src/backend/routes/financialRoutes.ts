import { Router } from 'express';
import { financialController } from '../controllers/financialController';

const router = Router();

router.get('/movements', financialController.getMovements);
router.post('/movements', financialController.createMovement);
router.get('/balance', financialController.getBalance);

export default router;
