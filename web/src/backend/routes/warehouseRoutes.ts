import { Router } from 'express';
import { warehouseController } from '../controllers/warehouseController';

const router = Router();

router.get('/', warehouseController.getItems);
router.get('/critical', warehouseController.getCritical);
router.post('/movement', warehouseController.recordMovement);
router.post('/', warehouseController.createItem);

export default router;
