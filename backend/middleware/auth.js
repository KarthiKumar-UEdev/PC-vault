import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { User } from '../config/models.js';

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_USERNAME = 5;
const MAX_FAILS_PER_IP = 20;
const failures = new Map();

function getSecret() {
  return process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production';
}

function tokenTTL() {
  return (parseInt(process.env.SESSION_TTL_DAYS || '30', 10)) * 86400;
}

export function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, u: user.username, pv: user.password_hash.substring(0, 16) },
    getSecret(),
    { expiresIn: tokenTTL() },
  );
}

function decodeToken(token) {
  try { return jwt.verify(token, getSecret()); } catch { return null; }
}

export async function usersExist() {
  return (await User.countDocuments()) > 0;
}

export async function bootstrapUsers() {
  if (await usersExist()) return;
  const promises = [];
  if (process.env.ADMIN_PASSWORD) {
    const doc = new User({
      username: process.env.ADMIN_USERNAME || 'admin',
      password_hash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
      role: 'admin',
      created_at: new Date(),
    });
    promises.push(doc.save());
  }
  if (process.env.MANAGER_PASSWORD) {
    const doc = new User({
      username: process.env.MANAGER_USERNAME || 'manager',
      password_hash: await bcrypt.hash(process.env.MANAGER_PASSWORD, 12),
      role: 'manager',
      created_at: new Date(),
    });
    promises.push(doc.save());
  }
  await Promise.all(promises);
}

export async function managerRoleEnabled() {
  const count = await User.countDocuments({ role: 'manager' });
  return count > 0 || !!process.env.MANAGER_PASSWORD;
}

export async function authEnabled() {
  return (await usersExist()) || !!process.env.ADMIN_PASSWORD || !!process.env.MANAGER_PASSWORD;
}

function clientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function recentFailures(key) {
  const now = Date.now();
  const hits = (failures.get(key) || []).filter(t => now - t < LOCKOUT_WINDOW_MS);
  if (hits.length) failures.set(key, hits);
  else failures.delete(key);
  return hits;
}

function checkLockout(username, ip) {
  const now = Date.now();
  const userFails = recentFailures(`u:${username.toLowerCase().trim()}`);
  const ipFails = recentFailures(`ip:${ip}`);
  if (userFails.length >= MAX_FAILS_PER_USERNAME || ipFails.length >= MAX_FAILS_PER_IP) {
    throw Object.assign(new Error('Too many failed attempts — try again later.'), { status: 429 });
  }
}

function recordFailure(username, ip) {
  const now = Date.now();
  ['u:' + username.toLowerCase().trim(), 'ip:' + ip].forEach(k => {
    if (!failures.has(k)) failures.set(k, []);
    failures.get(k).push(now);
  });
}

function clearFailures(username) {
  failures.delete('u:' + username.toLowerCase().trim());
}

function extractUser(req) {
  const header = req.headers['authorization'] || '';
  let token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token && req.method === 'GET') token = req.query.token || '';
  if (!token) return null;
  return decodeToken(token);
}

function toObject(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (obj._id && typeof obj._id === 'object') obj._id = obj._id.toString();
  return obj;
}

export function requireAuth(req, res, next) {
  (async () => {
    if (!(await authEnabled())) {
      req.userRole = 'admin';
      req.user = { role: 'admin', username: 'admin' };
      return next();
    }
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ detail: 'Not authenticated' });
    const user = await User.findById(payload.sub).lean();
    if (!user || user.role !== payload.role || user.password_hash.substring(0, 16) !== payload.pv)
      return res.status(401).json({ detail: 'Not authenticated' });
    req.userRole = payload.role;
    req.user = { role: payload.role, username: payload.u };
    next();
  })();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.userRole !== 'admin') return res.status(403).json({ detail: 'Admin access required' });
    next();
  });
}

export function requireManager(req, res, next) {
  requireAuth(req, res, () => {
    if (req.userRole !== 'manager') return res.status(403).json({ detail: 'Only the manager can do this' });
    next();
  });
}

export async function loginHandler(username, password, ip) {
  checkLockout(username, ip);
  const lower = username.toLowerCase().trim();
  const users = await User.find({}).lean();
  const user = users.find(u => u.username.toLowerCase().trim() === lower);
  if (!user) {
    await bcrypt.hash(password, 12);
    recordFailure(username, ip);
    throw Object.assign(new Error('Wrong username or password'), { status: 401 });
  }
  if (!(await bcrypt.compare(password, user.password_hash))) {
    recordFailure(username, ip);
    throw Object.assign(new Error('Wrong username or password'), { status: 401 });
  }
  clearFailures(username);
  return { token: createToken(user), role: user.role, username: user.username, expires_in: tokenTTL() };
}
