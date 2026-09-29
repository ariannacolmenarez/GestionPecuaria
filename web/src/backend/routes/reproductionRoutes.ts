import { Router } from 'express';
import { reproductionController } from '../controllers/reproductionController';

const router = Router();

router.get('/matings', reproductionController.getMatings);
router.post('/matings', reproductionController.registerMating);
router.get('/farrowings', reproductionController.getFarrowings);
router.post('/farrowings', reproductionController.registerFarrowing);
router.post('/weaning/calculate', reproductionController.calculateWeaning);

export default router;
