import { Router } from 'express';
import { PC, NetworkInfo } from '../config/models.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/:pcId/network', async (req, res, next) => {
  try {
    const pc = await PC.findById(req.params.pcId).lean();
    if (!pc) return res.status(404).json({ detail: 'PC not found' });
    const info = await NetworkInfo.findOne({ pc_id: req.params.pcId }).lean();
    if (!info) return res.json({ pc_id: req.params.pcId, ip_address: null, mac_address: null, notes: null });
    res.json({ pc_id: req.params.pcId, ip_address: decrypt(info.ip_address), mac_address: decrypt(info.mac_address), notes: info.notes });
  } catch (err) { next(err); }
});

router.put('/:pcId/network', requireAdmin, async (req, res, next) => {
  try {
    const pc = await PC.findById(req.params.pcId).lean();
    if (!pc) return res.status(404).json({ detail: 'PC not found' });
    const { ip_address, mac_address, notes } = req.body;
    let info = await NetworkInfo.findOne({ pc_id: req.params.pcId }).lean();
    const data = { pc_id: req.params.pcId, ip_address: encrypt(ip_address), mac_address: encrypt(mac_address), notes: notes || null };
    if (info) {
      await NetworkInfo.updateOne({ pc_id: req.params.pcId }, { $set: data });
    } else {
      await NetworkInfo.create(data);
    }
    res.json({ pc_id: req.params.pcId, ip_address, mac_address, notes: notes || null });
  } catch (err) { next(err); }
});

export default router;
