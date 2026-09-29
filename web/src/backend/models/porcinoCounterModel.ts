import { RubroType, PorcinoCategory } from '../types';

export interface PorcinoCounterSummary {
  productoras: number;
  lechones: number;
  verracos: number;
  engorde: number;
  totalPorcino: number;
  maternidadGestantes: number;
  maternidadLactantes: number;
  maternidadReemplazo: number;
  camadasActivasCount: number;
  lotesEngordeCount: number;
  verracosActivosCount: number;
  mortalidadLechonesTotal: number;
  censoPorUbicacion: Record<string, number>;
  lastCalculatedAt: string;
  source: 'firestore' | 'in_memory' | 'local_sync';
}

export interface PorcinoCensusItem {
  code: string;
  category: string;
  stage: string;
  headCount: number;
  penLocation: string;
  healthStatus: string;
  weightKg?: number;
}

export class PorcinoCounterModel {
  /**
   * Agrupa y calcula los contadores de animales a partir de una lista de registros crudos
   */
  public static calculate(
    animals: any[],
    litters: any[]
  ): PorcinoCounterSummary {
    const activeAnimals = animals.filter(
      (a) => !a.isSoldToSlaughter && a.healthStatus !== 'Matadero' && a.healthStatus !== 'Baja'
    );

    // 1. Verracos
    const verracos = activeAnimals.filter((a) => a.category === 'verracos');
    const verracosCount = verracos.reduce((acc, curr) => acc + (curr.batchAnimalCount || 1), 0);

    // 2. Maternidad
    const productoras = activeAnimals.filter((a) => a.category === 'maternidad');
    const productorasCount = productoras.reduce((acc, curr) => acc + (curr.batchAnimalCount || 1), 0);

    let gestantes = 0;
    let lactantes = 0;
    let reemplazo = 0;

    productoras.forEach((s) => {
      const stage = (s.stage || '').toLowerCase();
      const status = (s.healthStatus || '').toLowerCase();
      const count = s.batchAnimalCount || 1;
      if (status.includes('lactante') || stage.includes('lactancia') || stage.includes('lactante')) {
        lactantes += count;
      } else if (status.includes('gestante') || stage.includes('gestación') || stage.includes('gestante')) {
        gestantes += count;
      } else {
        reemplazo += count;
      }
    });

    // 3. Engorde
    const engorde = activeAnimals.filter((a) => a.category === 'engorde');
    const engordeCount = engorde.reduce((acc, curr) => acc + (curr.batchAnimalCount || 1), 0);

    // 4. Lechones
    const activeLitters = litters.filter((l) => l.weaningStatus !== 'destetado');
    const lechonesCount = activeLitters.reduce((acc, curr) => acc + (curr.currentCount || 0), 0);
    const mortalidadTotal = litters.reduce((acc, curr) => acc + (curr.mortalityCount || 0), 0);

    // 5. Censo por ubicación
    const censoPorUbicacion: Record<string, number> = {};
    activeAnimals.forEach((a) => {
      const loc = a.penLocation || 'Corral General';
      const count = a.batchAnimalCount || 1;
      censoPorUbicacion[loc] = (censoPorUbicacion[loc] || 0) + count;
    });
    activeLitters.forEach((l) => {
      const loc = `Parideras Maternidad (Camada ${l.batchCode} - Cerda ${l.sowCode})`;
      censoPorUbicacion[loc] = (censoPorUbicacion[loc] || 0) + (l.currentCount || 0);
    });

    return {
      productoras: productorasCount,
      lechones: lechonesCount,
      verracos: verracosCount,
      engorde: engordeCount,
      totalPorcino: productorasCount + lechonesCount + verracosCount + engordeCount,
      maternidadGestantes: gestantes,
      maternidadLactantes: lactantes,
      maternidadReemplazo: reemplazo,
      camadasActivasCount: activeLitters.length,
      lotesEngordeCount: engorde.length,
      verracosActivosCount: verracos.length,
      mortalidadLechonesTotal: mortalidadTotal,
      censoPorUbicacion,
      lastCalculatedAt: new Date().toISOString(),
      source: 'firestore',
    };
  }
}
