import { Router } from 'express';
import { PC, Part, TransferLog } from '../config/models.js';

const router = Router();

router.get('/stats', async (req, res, next) => {
  try {
    const today = new Date();
    const cutoff = new Date(today.getTime() + 30 * 86400000);
    const allParts = await Part.find({}).lean();
    const allPcs = await PC.find({}).lean();
    const totalPcs = allPcs.length;
    const activePcs = allPcs.filter(p => p.status === 'active').length;
    const totalParts = allParts.length;
    const inventoryCount = allParts.filter(p => !p.pc_id && !p.employee_id).length;
    const totalValue = allParts.reduce((s, p) => s + (p.purchase_price || 0), 0);
    const expiring = allParts.filter(p => p.warranty_expiry && new Date(p.warranty_expiry) >= today && new Date(p.warranty_expiry) <= cutoff).length;
    const faulty = allParts.filter(p => p.condition === 'faulty' || p.condition === 'rma').length;
    res.json({ total_pcs: totalPcs, active_pcs: activePcs, total_parts: totalParts, inventory_count: inventoryCount, total_value: totalValue, expiring_warranties: expiring, faulty_parts: faulty });
  } catch (err) { next(err); }
});

router.get('/transfers/recent', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    let logs = await TransferLog.find({}).lean();
    logs.sort((a, b) => new Date(b.moved_at) - new Date(a.moved_at));
    logs = logs.slice(0, limit);
    const pcIds = [...new Set(logs.flatMap(l => [l.from_pc_id, l.to_pc_id].filter(Boolean)))];
    const names = {};
    for (const id of pcIds) { const p = await PC.findById(id).lean(); if (p) names[id] = p.name; }
    const result = [];
    for (const log of logs) {
      const item = { ...log, id: log._id, from_pc_name: log.from_pc_id ? names[log.from_pc_id] || null : null, to_pc_name: log.to_pc_id ? names[log.to_pc_id] || null : null };
      if (log.part_id) { const part = await Part.findById(log.part_id).lean(); item.part_label = part ? `${part.brand} ${part.model}` : null; }
      result.push(item);
    }
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
