import { Router } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../config/models.js';
import { loginHandler, requireAuth, authEnabled, managerRoleEnabled, createToken } from '../middleware/auth.js';

const router = Router();

router.get('/status', async (req, res, next) => {
  try { res.json({ auth_required: await authEnabled(), manager_enabled: await managerRoleEnabled() }); }
  catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(422).json({ detail: 'Username and password required' });
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const result = await loginHandler(username, password, ip);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ detail: err.message });
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ role: req.userRole, username: req.user.username });
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    if (!(await authEnabled())) return res.status(400).json({ detail: 'Authentication is disabled' });
    const { current_password, username: newUsername, new_password } = req.body;
    const users = await User.find({}).lean();
    const user = users.find(u => u.username.toLowerCase().trim() === req.user.username.toLowerCase().trim());
    if (!user) return res.status(401).json({ detail: 'Not authenticated' });
    if (!(await bcrypt.compare(current_password, user.password_hash))) return res.status(403).json({ detail: 'Current password is wrong' });
    if (!newUsername && !new_password) return res.status(422).json({ detail: 'Nothing to change' });
    if (newUsername) {
      const trimmed = newUsername.trim();
      if (trimmed.length < 3) return res.status(422).json({ detail: 'Username must be at least 3 characters' });
      const existing = users.find(u => u.username.toLowerCase().trim() === trimmed.toLowerCase() && u._id.toString() !== user._id.toString());
      if (existing) return res.status(409).json({ detail: 'That username is taken' });
      user.username = trimmed;
    }
    if (new_password) user.password_hash = await bcrypt.hash(new_password, 12);
    await User.findByIdAndUpdate(user._id, { username: user.username, password_hash: user.password_hash });
    const updated = await User.findById(user._id).lean();
    const token = createToken(updated);
    res.json({ token, role: updated.role, username: updated.username, expires_in: parseInt(process.env.SESSION_TTL_DAYS || '30', 10) * 86400 });
  } catch (err) { next(err); }
});

export default router;
