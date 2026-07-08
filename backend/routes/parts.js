import { Router } from 'express';
import { PC, Part, Employee, TransferLog } from '../config/models.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

async function enrichPart(part) {
  if (!part) return null;
  const { _id, pc_id, employee_id, ...rest } = part;
  const pc = pc_id ? await PC.findById(pc_id).lean() : null;
  const emp = employee_id ? await Employee.findById(employee_id).lean() : null;
  return { ...rest, _id, id: _id, pc_name: pc?.name || null, employee_name: emp?.name || null };
}

router.get('/', async (req, res, next) => {
  try {
    const { type, condition, pc_id, employee_id, in_inventory, search, sort = 'age', order = 'asc' } = req.query;
    let parts = await Part.find({}).lean();
    if (type) parts = parts.filter(p => p.type === type);
    if (condition) parts = parts.filter(p => p.condition === condition);
    if (pc_id) parts = parts.filter(p => p.pc_id === pc_id);
    if (employee_id) parts = parts.filter(p => p.employee_id === employee_id);
    const inv = in_inventory === 'true' || in_inventory === true;
    if (in_inventory !== undefined) parts = parts.filter(p => inv ? (!p.pc_id && !p.employee_id) : (p.pc_id || p.employee_id));
    if (search) { const r = new RegExp(search, 'i'); parts = parts.filter(p => r.test(p.brand) || r.test(p.model) || (p.serial_number && r.test(p.serial_number))); }
    const sortMap = { age: 'purchase_date', price: 'purchase_price', warranty_expiry: 'warranty_expiry' };
    const sf = sortMap[sort] || 'purchase_date';
    parts.sort((a, b) => order === 'desc' ? String(b[sf] || '').localeCompare(String(a[sf] || '')) : String(a[sf] || '').localeCompare(String(b[sf] || '')));
    res.json(await Promise.all(parts.map(enrichPart)));
  } catch (err) { next(err); }
});

router.get('/aging', async (req, res, next) => {
  try {
    const parts = await Part.find({}).lean();
    parts.sort((a, b) => (a.purchase_date || '').toString().localeCompare((b.purchase_date || '').toString()));
    const today = new Date();
    const enriched = await Promise.all(parts.map(async p => ({ ...await enrichPart(p), age_days: p.purchase_date ? Math.floor((today - new Date(p.purchase_date)) / 86400000) : null })));
    res.json(enriched);
  } catch (err) { next(err); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    if (req.body.pc_id) { const pc = await PC.findById(req.body.pc_id).lean(); if (!pc) return res.status(404).json({ detail: 'Target PC not found' }); }
    if (req.body.employee_id) { const emp = await Employee.findById(req.body.employee_id).lean(); if (!emp) return res.status(404).json({ detail: 'Employee not found' }); }
    const part = await Part.create({ ...req.body, condition: req.body.condition || 'good', created_at: new Date() });
    const doc = part.toObject();
    if (doc.pc_id) await TransferLog.create({ part_id: doc._id.toString(), from_pc_id: null, to_pc_id: doc.pc_id, moved_at: new Date() });
    res.status(201).json(await enrichPart(doc));
  } catch (err) { next(err); }
});

router.get('/:partId', async (req, res, next) => {
  try {
    const part = await Part.findById(req.params.partId).lean();
    if (!part) return res.status(404).json({ detail: 'Part not found' });
    res.json(await enrichPart(part));
  } catch (err) { next(err); }
});

router.patch('/:partId', requireAdmin, async (req, res, next) => {
  try {
    const part = await Part.findById(req.params.partId).lean();
    if (!part) return res.status(404).json({ detail: 'Part not found' });
    await Part.findByIdAndUpdate(req.params.partId, { $set: req.body });
    const updated = await Part.findById(req.params.partId).lean();
    res.json(await enrichPart(updated));
  } catch (err) { next(err); }
});

router.delete('/:partId', requireAdmin, async (req, res, next) => {
  try {
    const part = await Part.findById(req.params.partId).lean();
    if (!part) return res.status(404).json({ detail: 'Part not found' });
    await Part.findByIdAndDelete(req.params.partId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:partId/transfer', requireAdmin, async (req, res, next) => {
  try {
    const part = await Part.findById(req.params.partId).lean();
    if (!part) return res.status(404).json({ detail: 'Part not found' });
    const { to_pc_id } = req.body;
    if (to_pc_id) { const t = await PC.findById(to_pc_id).lean(); if (!t) return res.status(404).json({ detail: 'Target PC not found' }); }
    if (to_pc_id !== part.pc_id) {
      await TransferLog.create({ part_id: part._id.toString(), from_pc_id: part.pc_id, to_pc_id: to_pc_id || null, moved_at: new Date() });
      const upd = { pc_id: to_pc_id || null };
      if (to_pc_id) upd.employee_id = null;
      await Part.findByIdAndUpdate(req.params.partId, { $set: upd });
    }
    const updated = await Part.findById(req.params.partId).lean();
    res.json(await enrichPart(updated));
  } catch (err) { next(err); }
});

router.post('/:partId/assign', requireAdmin, async (req, res, next) => {
  try {
    const part = await Part.findById(req.params.partId).lean();
    if (!part) return res.status(404).json({ detail: 'Part not found' });
    const { employee_id } = req.body;
    if (employee_id) { const e = await Employee.findById(employee_id).lean(); if (!e) return res.status(404).json({ detail: 'Employee not found' }); }
    const upd = { employee_id: employee_id || null };
    if (part.pc_id && employee_id) {
      await TransferLog.create({ part_id: part._id.toString(), from_pc_id: part.pc_id, to_pc_id: null, moved_at: new Date() });
      upd.pc_id = null;
    }
    await Part.findByIdAndUpdate(req.params.partId, { $set: upd });
    const updated = await Part.findById(req.params.partId).lean();
    res.json(await enrichPart(updated));
  } catch (err) { next(err); }
});

router.get('/:partId/history', async (req, res, next) => {
  try {
    const part = await Part.findById(req.params.partId).lean();
    if (!part) return res.status(404).json({ detail: 'Part not found' });
    let logs = await TransferLog.find({ part_id: part._id.toString() }).lean();
    logs.sort((a, b) => new Date(b.moved_at) - new Date(a.moved_at) || String(a._id).localeCompare(String(b._id)));
    const pcIds = [...new Set(logs.flatMap(l => [l.from_pc_id, l.to_pc_id].filter(Boolean)))];
    const names = {};
    for (const id of pcIds) { const p = await PC.findById(id).lean(); if (p) names[id] = p.name; }
    res.json(logs.map(l => ({ ...l, id: l._id, from_pc_name: l.from_pc_id ? names[l.from_pc_id] || null : null, to_pc_name: l.to_pc_id ? names[l.to_pc_id] || null : null, part_label: `${part.brand} ${part.model}` })));
  } catch (err) { next(err); }
});

export default router;
