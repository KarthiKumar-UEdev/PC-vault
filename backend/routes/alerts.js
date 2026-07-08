import { Router } from 'express';
import { Part, PC } from '../config/models.js';

const router = Router();

router.get('/warranty', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const today = new Date();
    const cutoff = new Date(today.getTime() + days * 86400000);
    let parts = await Part.find({}).lean();
    parts = parts.filter(p => p.warranty_expiry && new Date(p.warranty_expiry) >= today && new Date(p.warranty_expiry) <= cutoff);
    parts.sort((a, b) => new Date(a.warranty_expiry) - new Date(b.warranty_expiry));
    const result = await Promise.all(parts.map(async p => {
      let pc_name = null;
      if (p.pc_id) { const pc = await PC.findById(p.pc_id).lean(); if (pc) pc_name = pc.name; }
      return { ...p, id: p._id, pc_name };
    }));
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
