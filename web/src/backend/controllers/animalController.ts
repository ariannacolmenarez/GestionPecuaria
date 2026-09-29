import { Request, Response } from 'express';
import { animalService } from '../services/animalService';
import { RubroType } from '../types';

export const animalController = {
  async getAll(req: Request, res: Response) {
    try {
      const rubro = req.query.rubro as RubroType | undefined;
      const category = req.query.category as string | undefined;
      const animals = await animalService.getAllAnimals(rubro, category);
      res.json({ success: true, data: animals });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const animal = await animalService.getAnimalById(req.params.id);
      if (!animal) {
        return res.status(404).json({ success: false, message: 'Animal not found' });
      }
      res.json({ success: true, data: animal });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const created = await animalService.createAnimal(req.body);
      res.status(201).json({ success: true, data: created });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const updated = await animalService.updateAnimal(req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const ok = await animalService.deleteAnimal(req.params.id);
      res.json({ success: ok });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getCounts(req: Request, res: Response) {
    try {
      const rubro = (req.query.rubro as RubroType) || 'porcino';
      const counts = await animalService.getCategoryCounts(rubro);
      res.json({ success: true, data: counts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
