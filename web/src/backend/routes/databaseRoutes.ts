import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/database/config
router.get('/config', (_req: Request, res: Response) => {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({
        success: true,
        data: {
          projectId: config.projectId,
          authDomain: config.authDomain,
          firestoreDatabaseId: config.firestoreDatabaseId || '(default)',
          hasApiKey: !!config.apiKey,
          storageBucket: config.storageBucket,
          status: 'configured',
        },
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'firebase-applet-config.json no encontrado.',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/database/schema
router.get('/schema', (_req: Request, res: Response) => {
  try {
    const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
    if (fs.existsSync(blueprintPath)) {
      const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
      res.json({
        success: true,
        entitiesCount: Object.keys(blueprint.entities || {}).length,
        collectionsCount: Object.keys(blueprint.firestore || {}).length,
        data: blueprint,
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'firebase-blueprint.json no encontrado.',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/database/collections
router.get('/collections', (_req: Request, res: Response) => {
  res.json({
    success: true,
    collections: [
      {
        path: '/farms/{farmId}',
        name: 'Farm Maestro',
        description: 'Datos maestros de la granja y resumen financiero consolidado',
      },
      {
        path: '/farms/{farmId}/animals',
        name: 'Porcino - Animales y Lotes',
        description: 'Censo porcino activo, pesos, ganancias diarias y estado de salud',
      },
      {
        path: '/farms/{farmId}/litters',
        name: 'Maternidad - Camadas Lactantes',
        description: 'Control de partos, mortalidad predestete y prorrateo de costo al destete',
      },
      {
        path: '/farms/{farmId}/bovino',
        name: 'Hato Bovino',
        description: 'Vacas lecheras, padrotes reproductores, becerros y producción de leche',
      },
      {
        path: '/farms/{farmId}/avicola',
        name: 'Módulo Avícola',
        description: 'Lotes de pollos de engorde, conversión FCR y biomasa en galpón',
      },
      {
        path: '/farms/{farmId}/tasks',
        name: 'Plan Sanitario',
        description: 'Cronograma veterinario preventivo, vacunas, dosis y costos asociados',
      },
      {
        path: '/farms/{farmId}/movements',
        name: 'Flujo Contable / Financiero',
        description: 'Libro de entradas y salidas de efectivo por rubro pecuario',
      },
      {
        path: '/farms/{farmId}/warehouse',
        name: 'Almacén Central',
        description: 'Control de existencias de alimento y medicinas con alerta preventiva (< 2 meses)',
      },
      {
        path: '/farms/{farmId}/sales',
        name: 'Ventas y Faena',
        description: 'Liquidaciones comerciales en pie y canal con cálculo de margen neto',
      },
      {
        path: '/farms/{farmId}/feeding_plans',
        name: 'Nutrición Animal',
        description: 'Planes alimenticios por etapas zootécnicas y estimación de bultos',
      },
    ],
  });
});

export default router;
