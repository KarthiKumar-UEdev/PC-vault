import 'dotenv/config';
import { connectDB } from '../config/db.js';
import { User, Employee, PC, Part, TransferLog, NetworkInfo, PlannedBuild, PlannedBuildItem, BuildComment } from '../config/models.js';

async function seed() {
  await connectDB();

  // Clear existing data
  await Promise.all([
    Employee.deleteMany({}),
    PC.deleteMany({}),
    Part.deleteMany({}),
    TransferLog.deleteMany({}),
    NetworkInfo.deleteMany({}),
    PlannedBuild.deleteMany({}),
    PlannedBuildItem.deleteMany({}),
    BuildComment.deleteMany({}),
    User.deleteMany({}),
  ]);

  const emp1 = await Employee.create({ name: 'Karthi Kumar', title: 'Developer', department: 'Engineering', email: 'karthi@company.com', created_at: new Date() });
  const emp2 = await Employee.create({ name: 'Priya Sharma', title: 'Designer', department: 'Design', email: 'priya@company.com', created_at: new Date() });
  console.log('Employees created');

  const pc1 = await PC.create({ name: 'Skyven', description: 'Senior dev workstation', status: 'active', qr_code: crypto.randomUUID(), build_date: new Date('2025-01-15'), employee_id: emp1._id.toString(), created_at: new Date() });
  const pc2 = await PC.create({ name: 'Elite18', description: 'Gaming / render rig', status: 'active', qr_code: crypto.randomUUID(), build_date: new Date('2025-03-01'), created_at: new Date() });
  const pc3 = await PC.create({ name: 'Workstation-173', description: 'Spare build station', status: 'planned', qr_code: crypto.randomUUID(), created_at: new Date() });
  console.log('PCs created');
  const pc1Id = pc1._id.toString();
  const pc2Id = pc2._id.toString();
  const emp1Id = emp1._id.toString();
  const emp2Id = emp2._id.toString();

  const parts = await Promise.all([
    Part.create({ pc_id: pc1Id, type: 'cpu', brand: 'AMD', model: 'Ryzen 9 7950X', serial_number: 'CP1001', condition: 'good', purchase_date: new Date('2025-01-10'), purchase_price: 57999, warranty_expiry: new Date('2028-01-10'), specs: { cores: 16, threads: 32, socket: 'AM5', tdp_w: 170 }, created_at: new Date() }),
    Part.create({ pc_id: pc1Id, type: 'gpu', brand: 'NVIDIA', model: 'RTX 4090', serial_number: 'GPU2001', condition: 'good', purchase_date: new Date('2025-01-10'), purchase_price: 159999, warranty_expiry: new Date('2028-01-10'), created_at: new Date() }),
    Part.create({ pc_id: pc1Id, type: 'ram', brand: 'G.Skill', model: 'Trident Z5 Neo 32GB DDR5-6000', serial_number: 'RM3001', condition: 'new', purchase_date: new Date('2025-01-10'), purchase_price: 10999, warranty_expiry: new Date('2028-01-10'), specs: { mem_type: 'DDR5', capacity_gb: 32 }, created_at: new Date() }),
    Part.create({ pc_id: pc1Id, type: 'ssd', brand: 'Samsung', model: '990 Pro 2TB NVMe', serial_number: 'SS4001', condition: 'good', purchase_date: new Date('2025-01-10'), purchase_price: 15499, warranty_expiry: new Date('2028-01-10'), created_at: new Date() }),
    Part.create({ pc_id: pc1Id, type: 'psu', brand: 'Corsair', model: 'RM1000e 1000W Gold', serial_number: 'PS5001', condition: 'good', purchase_date: new Date('2025-01-10'), purchase_price: 13999, warranty_expiry: new Date('2030-01-10'), created_at: new Date() }),
    Part.create({ pc_id: pc1Id, type: 'mobo', brand: 'ASUS', model: 'ROG Strix X670E-E', serial_number: 'MB6001', condition: 'good', purchase_date: new Date('2025-01-10'), purchase_price: 39999, warranty_expiry: new Date('2028-01-10'), specs: { socket: 'AM5', mem_type: 'DDR5', form_factor: 'ATX' }, created_at: new Date() }),
    Part.create({ pc_id: pc1Id, type: 'cooler', brand: 'Arctic', model: 'Liquid Freezer III 360', serial_number: 'CL7001', condition: 'good', purchase_date: new Date('2025-01-10'), purchase_price: 11999, created_at: new Date() }),
    Part.create({ pc_id: pc1Id, type: 'case', brand: 'Lian Li', model: 'O11 Dynamic EVO', serial_number: 'CS8001', condition: 'good', purchase_date: new Date('2025-01-10'), purchase_price: 13999, specs: { form_factor: 'ATX' }, created_at: new Date() }),
    Part.create({ pc_id: pc2Id, type: 'gpu', brand: 'NVIDIA', model: 'RTX 5080', serial_number: 'GPU2002', condition: 'new', purchase_date: new Date('2025-03-01'), purchase_price: 114999, warranty_expiry: new Date('2028-03-01'), created_at: new Date() }),
    Part.create({ pc_id: pc2Id, type: 'cpu', brand: 'Intel', model: 'Core Ultra 9 285K', serial_number: 'CP1002', condition: 'new', purchase_date: new Date('2025-03-01'), purchase_price: 55999, warranty_expiry: new Date('2028-03-01'), specs: { socket: 'LGA1851', tdp_w: 125 }, created_at: new Date() }),
    Part.create({ pc_id: pc2Id, type: 'mobo', brand: 'ASUS', model: 'ROG Maximus Z890 Hero', serial_number: 'MB6002', condition: 'new', purchase_date: new Date('2025-03-01'), purchase_price: 59999, warranty_expiry: new Date('2028-03-01'), specs: { socket: 'LGA1851', mem_type: 'DDR5', form_factor: 'ATX' }, created_at: new Date() }),
    Part.create({ pc_id: pc2Id, type: 'ram', brand: 'Corsair', model: 'Vengeance 32GB DDR5-6000', serial_number: 'RM3002', condition: 'new', purchase_date: new Date('2025-03-01'), purchase_price: 9999, warranty_expiry: new Date('2028-03-01'), specs: { mem_type: 'DDR5', capacity_gb: 32 }, created_at: new Date() }),
    Part.create({ pc_id: pc2Id, type: 'ssd', brand: 'WD', model: 'Black SN850X 2TB NVMe', serial_number: 'SS4002', condition: 'new', purchase_date: new Date('2025-03-01'), purchase_price: 13999, warranty_expiry: new Date('2028-03-01'), created_at: new Date() }),
    Part.create({ type: 'monitor', brand: 'Dell', model: 'U2723QE 4K', serial_number: 'MN9001', condition: 'good', purchase_date: new Date('2025-02-01'), purchase_price: 44999, warranty_expiry: new Date('2028-02-01'), employee_id: emp1Id, created_at: new Date() }),
    Part.create({ type: 'laptop', brand: 'Apple', model: 'MacBook Pro 16" M3 Max', serial_number: 'LB1001', condition: 'good', purchase_date: new Date('2025-01-20'), purchase_price: 259999, warranty_expiry: new Date('2028-01-20'), employee_id: emp2Id, created_at: new Date() }),
    Part.create({ type: 'ups', brand: 'APC', model: 'Back-UPS Pro 1500', serial_number: 'UP1101', condition: 'fair', purchase_date: new Date('2024-06-15'), purchase_price: 12999, warranty_expiry: new Date('2027-06-15'), created_at: new Date() }),
    Part.create({ type: 'printer', brand: 'HP', model: 'LaserJet Pro M404dn', serial_number: 'PR1201', condition: 'good', purchase_date: new Date('2024-09-01'), purchase_price: 24999, created_at: new Date() }),
  ]);
  console.log(`${parts.length} parts created`);
  console.log('Seed complete!');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
