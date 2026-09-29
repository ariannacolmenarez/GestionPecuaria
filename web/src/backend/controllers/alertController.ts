import { Request, Response } from 'express';
import { alertService } from '../services/alertService';

export const alertController = {
  async getAlerts(req: Request, res: Response) {
    try {
      const alerts = await alertService.getConsolidatedAlerts();
      res.json({ success: true, data: alerts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
