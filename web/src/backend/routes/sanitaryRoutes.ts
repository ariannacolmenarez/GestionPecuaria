import { Router } from 'express';
import { sanitaryController } from '../controllers/sanitaryController';

const router = Router();

router.get('/', sanitaryController.getTasks);
router.get('/today', sanitaryController.getTodayPending);
router.post('/', sanitaryController.createTask);
router.patch('/:id/status', sanitaryController.updateStatus);
router.post('/generate-batch-protocol', sanitaryController.generateBatchProtocol);

export default router;
