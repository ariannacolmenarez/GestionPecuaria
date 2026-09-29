import { Router } from 'express';
import { salesSlaughterController } from '../controllers/salesSlaughterController';

const router = Router();

router.get('/', salesSlaughterController.getAll);
router.post('/', salesSlaughterController.recordSaleOrSlaughter);

export default router;
