import { Router } from 'express';
import animalRoutes from './animalRoutes';
import reproductionRoutes from './reproductionRoutes';
import sanitaryRoutes from './sanitaryRoutes';
import warehouseRoutes from './warehouseRoutes';
import salesSlaughterRoutes from './salesSlaughterRoutes';
import financialRoutes from './financialRoutes';
import bovinoRoutes from './bovinoRoutes';
import avicolaRoutes from './avicolaRoutes';
import alertRoutes from './alertRoutes';
import porcinoRoutes from './porcinoRoutes';
import databaseRoutes from './databaseRoutes';

const apiRouter = Router();

apiRouter.use('/database', databaseRoutes);
apiRouter.use('/porcino', porcinoRoutes);
apiRouter.use('/animals', animalRoutes);
apiRouter.use('/reproduction', reproductionRoutes);
apiRouter.use('/sanitary', sanitaryRoutes);
apiRouter.use('/warehouse', warehouseRoutes);
apiRouter.use('/sales', salesSlaughterRoutes);
apiRouter.use('/financial', financialRoutes);
apiRouter.use('/bovino', bovinoRoutes);
apiRouter.use('/avicola', avicolaRoutes);
apiRouter.use('/alerts', alertRoutes);

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Gestión Pecuaria API Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    rubros: ['porcino', 'bovino', 'avicola'],
  });
});

export default apiRouter;
