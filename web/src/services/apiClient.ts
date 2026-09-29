import { animalService } from '../backend/services/animalService';
import { reproductionService } from '../backend/services/reproductionService';
import { sanitaryService } from '../backend/services/sanitaryService';
import { warehouseService } from '../backend/services/warehouseService';
import { salesSlaughterService } from '../backend/services/salesSlaughterService';
import { financialService } from '../backend/services/financialService';
import { bovinoService } from '../backend/services/bovinoService';
import { avicolaService } from '../backend/services/avicolaService';
import { alertService } from '../backend/services/alertService';
import { porcinoService } from '../backend/services/porcinoService';

/**
 * ApiClient: Fachada unificada que expone los servicios backend modulares
 * a todos los componentes de la interfaz de usuario con tipado estricto y ejecución directa.
 */
export const apiClient = {
  porcino: porcinoService,
  animals: animalService,
  reproduction: reproductionService,
  sanitary: sanitaryService,
  warehouse: warehouseService,
  sales: salesSlaughterService,
  financial: financialService,
  bovino: bovinoService,
  avicola: avicolaService,
  alerts: alertService,
};
