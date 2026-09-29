import { Router } from 'express';
import { bovinoController } from '../controllers/bovinoController';

const router = Router();

router.get('/herd', bovinoController.getHerd);
router.get('/counts', bovinoController.getCounts);
router.post('/animal', bovinoController.addAnimal);
router.post('/milking', bovinoController.recordMilking);

export default router;
