import { Router } from 'express';
import QRCode from 'qrcode';
import { PC, Part, Employee, NetworkInfo } from '../config/models.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
const publicRouter = Router();

async function enrichPC(pc) {
  pc = { ...pc };
  const parts = await Part.find({ pc_id: pc._id.toString() }).lean();
  const emp = pc.employee_id ? await Employee.findById(pc.employee_id).lean() : null;
  const net = await NetworkInfo.findOne({ pc_id: pc._id.toString() }).lean();
  return {
    ...pc, id: pc._id, parts: parts.map(p => ({ ...p, id: p._id, pc_name: pc.name })),
    part_count: parts.length, total_value: parts.reduce((s, p) => s + (p.purchase_price || 0), 0),
    employee_name: emp?.name || null, has_network_info: !!net,
  };
}

async function enrichPCList(pcs) {
  const result = [];
  for (const pc of pcs) {
    const parts = await Part.find({ pc_id: pc._id.toString() }).lean();
    const emp = pc.employee_id ? await Employee.findById(pc.employee_id).lean() : null;
    result.push({ ...pc, id: pc._id, part_count: parts.length, total_value: parts.reduce((s, p) => s + (p.purchase_price || 0), 0), employee_name: emp?.name || null });
  }
  return result;
}

router.get('/', async (req, res, next) => {
  try {
    const { status, search, sort = 'name', order = 'asc' } = req.query;
    let pcs = await PC.find({}).lean();
    if (status) pcs = pcs.filter(p => p.status === status);
    if (search) { const r = new RegExp(search, 'i'); pcs = pcs.filter(p => r.test(p.name) || r.test(p.description)); }
    pcs.sort((a, b) => {
      const av = sort === 'name' ? a.name : (a.build_date || '');
      const bv = sort === 'name' ? b.name : (b.build_date || '');
      return order === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    res.json(await enrichPCList(pcs));
  } catch (err) { next(err); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    if (req.body.employee_id) {
      const emp = await Employee.findById(req.body.employee_id).lean();
      if (!emp) return res.status(404).json({ detail: 'Employee not found' });
    }
    const pc = await PC.create({ ...req.body, qr_code: crypto.randomUUID(), status: req.body.status || 'active', created_at: new Date() });
    res.status(201).json(await enrichPC(pc.toObject()));
  } catch (err) { next(err); }
});

publicRouter.get('/qr/:qrCode', async (req, res, next) => {
  try {
    const pc = await PC.findOne({ qr_code: req.params.qrCode }).lean();
    if (!pc) return res.status(404).json({ detail: 'Unknown QR code' });
    res.json(await enrichPC(pc));
  } catch (err) { next(err); }
});

router.get('/:pcId', async (req, res, next) => {
  try {
    const pc = await PC.findById(req.params.pcId).lean();
    if (!pc) return res.status(404).json({ detail: 'PC not found' });
    res.json(await enrichPC(pc));
  } catch (err) { next(err); }
});

router.patch('/:pcId', requireAdmin, async (req, res, next) => {
  try {
    const pc = await PC.findById(req.params.pcId).lean();
    if (!pc) return res.status(404).json({ detail: 'PC not found' });
    if (req.body.employee_id !== undefined && req.body.employee_id !== null) {
      const emp = await Employee.findById(req.body.employee_id).lean();
      if (!emp) return res.status(404).json({ detail: 'Employee not found' });
    }
    await PC.findByIdAndUpdate(req.params.pcId, { $set: req.body });
    const updated = await PC.findById(req.params.pcId).lean();
    res.json(await enrichPC(updated));
  } catch (err) { next(err); }
});

router.delete('/:pcId', requireAdmin, async (req, res, next) => {
  try {
    const pc = await PC.findById(req.params.pcId).lean();
    if (!pc) return res.status(404).json({ detail: 'PC not found' });
    await Part.updateMany({ pc_id: pc._id.toString() }, { $set: { pc_id: null } });
    await NetworkInfo.deleteMany({ pc_id: pc._id.toString() });
    await PC.findByIdAndDelete(req.params.pcId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/:pcId/qr-image', async (req, res, next) => {
  try {
    const pc = await PC.findById(req.params.pcId).lean();
    if (!pc) return res.status(404).json({ detail: 'PC not found' });
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const qrBuffer = await QRCode.toBuffer(`${frontendUrl}/pc/qr?t=${pc.qr_code}`, { width: 400, margin: 2 });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="pc-vault-${pc.name}.png"`);
    res.send(qrBuffer);
  } catch (err) { next(err); }
});

export { publicRouter };
export default router;
