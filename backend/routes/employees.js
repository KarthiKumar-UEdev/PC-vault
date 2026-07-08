import { Router } from 'express';
import { Employee, PC, Part } from '../config/models.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    let employees = await Employee.find({}).lean();
    if (search) { const r = new RegExp(search, 'i'); employees = employees.filter(e => r.test(e.name)); }
    employees.sort((a, b) => a.name.localeCompare(b.name));
    const result = await Promise.all(employees.map(async e => {
      const [pcCount, devCount] = await Promise.all([PC.countDocuments({ employee_id: e._id.toString() }), Part.countDocuments({ employee_id: e._id.toString() })]);
      return { ...e, id: e._id, pc_count: pcCount, device_count: devCount };
    }));
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const emp = await Employee.create({ ...req.body, created_at: new Date() });
    const doc = emp.toObject();
    const enriched = { ...doc, id: doc._id, pc_count: 0, device_count: 0, pcs: [], parts: [] };
    res.status(201).json(enriched);
  } catch (err) { next(err); }
});

router.get('/:employeeId', async (req, res, next) => {
  try {
    const emp = await Employee.findById(req.params.employeeId).lean();
    if (!emp) return res.status(404).json({ detail: 'Employee not found' });
    const [pcs, parts] = await Promise.all([
      PC.find({ employee_id: emp._id.toString() }).lean(),
      Part.find({ employee_id: emp._id.toString() }).lean(),
    ]);
    res.json({
      ...emp, id: emp._id,
      pcs: pcs.map(p => ({ ...p, id: p._id, employee_name: emp.name, part_count: 0 })),
      parts: parts.map(p => ({ ...p, id: p._id, employee_name: emp.name })),
      pc_count: pcs.length, device_count: parts.length,
    });
  } catch (err) { next(err); }
});

router.patch('/:employeeId', requireAdmin, async (req, res, next) => {
  try {
    const emp = await Employee.findById(req.params.employeeId).lean();
    if (!emp) return res.status(404).json({ detail: 'Employee not found' });
    await Employee.findByIdAndUpdate(req.params.employeeId, { $set: req.body });
    const updated = await Employee.findById(req.params.employeeId).lean();
    const [pcs, parts] = await Promise.all([
      PC.find({ employee_id: updated._id.toString() }).lean(),
      Part.find({ employee_id: updated._id.toString() }).lean(),
    ]);
    res.json({ ...updated, id: updated._id, pcs: pcs.map(p => ({ ...p, id: p._id })), parts: parts.map(p => ({ ...p, id: p._id })), pc_count: pcs.length, device_count: parts.length });
  } catch (err) { next(err); }
});

router.delete('/:employeeId', requireAdmin, async (req, res, next) => {
  try {
    const emp = await Employee.findById(req.params.employeeId).lean();
    if (!emp) return res.status(404).json({ detail: 'Employee not found' });
    await Promise.all([
      PC.updateMany({ employee_id: emp._id.toString() }, { $set: { employee_id: null } }),
      Part.updateMany({ employee_id: emp._id.toString() }, { $set: { employee_id: null } }),
      Employee.findByIdAndDelete(req.params.employeeId),
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
