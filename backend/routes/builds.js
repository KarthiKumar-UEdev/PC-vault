import { Router } from 'express';
import { PlannedBuild, PlannedBuildItem, BuildComment, PC, Part, TransferLog } from '../config/models.js';
import { requireAdmin, requireManager, requireAuth, managerRoleEnabled } from '../middleware/auth.js';

const router = Router();

async function enrichBuild(build) {
  const items = await PlannedBuildItem.find({ build_id: build._id.toString() }).lean();
  let total = 0;
  const enrichedItems = await Promise.all(items.map(async item => {
    let part = null;
    if (item.part_id) {
      part = await Part.findById(item.part_id).lean();
      if (part) {
        part = { ...part, id: part._id, pc_name: null };
        if (part.pc_id) { const pc = await PC.findById(part.pc_id).lean(); if (pc) part.pc_name = pc.name; }
        total += part.purchase_price || 0;
      }
    } else { total += item.external_price || 0; }
    return { ...item, id: item._id, part };
  }));
  return { ...build, id: build._id, items: enrichedItems, item_count: items.length, total_cost: total };
}

router.get('/', async (req, res, next) => {
  try {
    let builds = await PlannedBuild.find({}).lean();
    builds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const result = await Promise.all(builds.map(async b => {
      const cnt = await PlannedBuildItem.countDocuments({ build_id: b._id.toString() });
      return { ...b, id: b._id, item_count: cnt };
    }));
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const build = await PlannedBuild.create({ ...req.body, status: 'draft', created_at: new Date() });
    res.status(201).json(await enrichBuild(build.toObject()));
  } catch (err) { next(err); }
});

router.get('/:buildId', async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    res.json(await enrichBuild(build));
  } catch (err) { next(err); }
});

router.patch('/:buildId', requireAdmin, async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    await PlannedBuild.findByIdAndUpdate(req.params.buildId, { $set: req.body });
    const updated = await PlannedBuild.findById(req.params.buildId).lean();
    res.json(await enrichBuild(updated));
  } catch (err) { next(err); }
});

router.delete('/:buildId', requireAdmin, async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    await Promise.all([
      PlannedBuildItem.deleteMany({ build_id: build._id.toString() }),
      BuildComment.deleteMany({ build_id: build._id.toString() }),
      PlannedBuild.findByIdAndDelete(req.params.buildId),
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:buildId/items', requireAdmin, async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    const { part_id, external_name } = req.body;
    if (!part_id && !external_name) return res.status(422).json({ detail: 'Provide either part_id (inventory part) or external_name' });
    if (part_id) {
      const part = await Part.findById(part_id).lean();
      if (!part) return res.status(404).json({ detail: 'Part not found' });
      const existing = await PlannedBuildItem.findOne({ build_id: build._id.toString(), part_id }).lean();
      if (existing) return res.status(409).json({ detail: 'Part already in this build' });
    }
    const item = await PlannedBuildItem.create({ build_id: build._id.toString(), ...req.body });
    await PlannedBuild.findByIdAndUpdate(req.params.buildId, { $set: { status: 'draft' } });
    const doc = item.toObject();
    let part = null;
    if (doc.part_id) {
      part = await Part.findById(doc.part_id).lean();
      if (part) { part = { ...part, id: part._id, pc_name: null }; if (part.pc_id) { const pc = await PC.findById(part.pc_id).lean(); if (pc) part.pc_name = pc.name; } }
    }
    res.status(201).json({ ...doc, id: doc._id, part });
  } catch (err) { next(err); }
});

router.delete('/:buildId/items/:itemId', requireAdmin, async (req, res, next) => {
  try {
    const item = await PlannedBuildItem.findOne({ _id: req.params.itemId, build_id: req.params.buildId }).lean();
    if (!item) return res.status(404).json({ detail: 'Build item not found' });
    await PlannedBuild.findByIdAndUpdate(req.params.buildId, { $set: { status: 'draft' } });
    await PlannedBuildItem.findByIdAndDelete(req.params.itemId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:buildId/convert', requireAdmin, async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    if (await managerRoleEnabled() && build.status !== 'approved')
      return res.status(409).json({ detail: `Build needs manager approval before it can become a real PC (current status: ${build.status}).` });
    const { name, description } = req.body;
    const pc = await PC.create({ name: name || build.name, description: description || build.notes, status: 'active', qr_code: crypto.randomUUID(), build_date: new Date(), created_at: new Date() });
    const pcId = pc._id.toString();
    const items = await PlannedBuildItem.find({ build_id: build._id.toString() }).lean();
    for (const item of items) {
      if (item.part_id) {
        await TransferLog.create({ part_id: item.part_id, from_pc_id: null, to_pc_id: pcId, moved_at: new Date() });
        await Part.findByIdAndUpdate(item.part_id, { $set: { pc_id: pcId } });
      }
    }
    await Promise.all([
      PlannedBuildItem.deleteMany({ build_id: build._id.toString() }),
      BuildComment.deleteMany({ build_id: build._id.toString() }),
      PlannedBuild.findByIdAndDelete(req.params.buildId),
    ]);
    const parts = await Part.find({ pc_id: pcId }).lean();
    res.status(201).json({ ...pc.toObject(), id: pcId, parts: parts.map(p => ({ ...p, id: p._id, pc_name: pc.name })), part_count: parts.length, total_value: parts.reduce((s, p) => s + (p.purchase_price || 0), 0), has_network_info: false });
  } catch (err) { next(err); }
});

// ── approval workflow ────────────────────────────────────────────────────

router.post('/:buildId/submit', requireAdmin, async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    if (!(await managerRoleEnabled())) return res.status(400).json({ detail: 'No manager account is configured' });
    if (build.status === 'pending') return res.status(409).json({ detail: 'Already waiting for review' });
    if (build.status === 'approved') return res.status(409).json({ detail: 'Already approved' });
    const cnt = await PlannedBuildItem.countDocuments({ build_id: build._id.toString() });
    if (cnt === 0) return res.status(422).json({ detail: 'Add parts before submitting' });
    await PlannedBuild.findByIdAndUpdate(req.params.buildId, { $set: { status: 'pending' } });
    const updated = await PlannedBuild.findById(req.params.buildId).lean();
    res.json(await enrichBuild(updated));
  } catch (err) { next(err); }
});

router.post('/:buildId/approve', requireManager, async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    if (build.status !== 'pending') return res.status(409).json({ detail: `Only pending builds can be approved (status: ${build.status})` });
    await PlannedBuild.findByIdAndUpdate(req.params.buildId, { $set: { status: 'approved' } });
    const updated = await PlannedBuild.findById(req.params.buildId).lean();
    res.json(await enrichBuild(updated));
  } catch (err) { next(err); }
});

router.post('/:buildId/reject', requireManager, async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    if (build.status !== 'pending') return res.status(409).json({ detail: `Only pending builds can be rejected (status: ${build.status})` });
    await PlannedBuild.findByIdAndUpdate(req.params.buildId, { $set: { status: 'rejected' } });
    const comment = req.body?.comment;
    if (comment && comment.trim()) await BuildComment.create({ build_id: build._id.toString(), author_role: 'manager', body: comment.trim(), created_at: new Date() });
    const updated = await PlannedBuild.findById(req.params.buildId).lean();
    res.json(await enrichBuild(updated));
  } catch (err) { next(err); }
});

// ── discussion thread ─────────────────────────────────────────────────────

router.get('/:buildId/comments', async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    let comments = await BuildComment.find({ build_id: req.params.buildId }).lean();
    comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    res.json(comments.map(c => ({ ...c, id: c._id })));
  } catch (err) { next(err); }
});

router.post('/:buildId/comments', requireAuth, async (req, res, next) => {
  try {
    const build = await PlannedBuild.findById(req.params.buildId).lean();
    if (!build) return res.status(404).json({ detail: 'Build not found' });
    const { body } = req.body;
    if (!body?.trim()) return res.status(422).json({ detail: 'Comment body is required' });
    const comment = await BuildComment.create({ build_id: req.params.buildId, author_role: req.userRole, body: body.trim(), created_at: new Date() });
    const doc = comment.toObject();
    res.status(201).json({ ...doc, id: doc._id });
  } catch (err) { next(err); }
});

export default router;
