import dns from 'dns';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '1.1.1.1']);

let cached = null;

export async function connectDB() {
  if (cached) return cached;
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  const conn = await mongoose.connect(uri);
  cached = conn;
  return conn;
}

export default mongoose;
