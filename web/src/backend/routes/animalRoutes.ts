import { Router } from 'express';
import { animalController } from '../controllers/animalController';

const router = Router();

router.get('/', animalController.getAll);
router.get('/counts', animalController.getCounts);
router.get('/:id', animalController.getById);
router.post('/', animalController.create);
router.put('/:id', animalController.update);
router.delete('/:id', animalController.remove);

export default router;
