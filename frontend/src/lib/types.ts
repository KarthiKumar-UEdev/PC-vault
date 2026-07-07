export type PCStatus = 'active' | 'retired' | 'planned';

export type PartType =
  | 'cpu' | 'gpu' | 'ram' | 'psu' | 'case' | 'cooler'
  | 'ssd' | 'hdd' | 'mobo' | 'fan'
  | 'laptop' | 'tablet' | 'monitor' | 'vr' | 'peripheral' | 'audio'
  | 'printer' | 'camera' | 'ups'
  | 'router' | 'switch' | 'ap'
  | 'other';

export type PartCondition = 'new' | 'good' | 'fair' | 'faulty' | 'rma' | 'retired';

export interface Part {
  id: string;
  pc_id: string | null;
  employee_id: string | null;
  type: PartType;
  brand: string;
  model: string;
  serial_number: string | null;
  condition: PartCondition;
  purchase_date: string | null;
  purchase_price: string | null;
  warranty_expiry: string | null;
  specs: Record<string, unknown> | null;
  created_at: string;
  pc_name: string | null;
  employee_name: string | null;
}

export interface PartAging extends Part {
  age_days: number | null;
}

export interface PC {
  id: string;
  name: string;
  description: string | null;
  status: PCStatus;
  qr_code: string;
  build_date: string | null;
  employee_id: string | null;
  created_at: string;
  part_count: number;
  total_value: string;
  employee_name: string | null;
}

export interface Employee {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  department: string | null;
  created_at: string;
  pc_count: number;
  device_count: number;
}

export interface EmployeeDetail extends Employee {
  pcs: PC[];
  parts: Part[];
}

export interface PCDetail extends PC {
  parts: Part[];
  has_network_info: boolean;
}

export interface NetworkInfo {
  pc_id: string;
  ip_address: string | null;
  mac_address: string | null;
  notes: string | null;
}

export interface TransferLog {
  id: string;
  part_id: string;
  from_pc_id: string | null;
  to_pc_id: string | null;
  moved_at: string;
  from_pc_name: string | null;
  to_pc_name: string | null;
  part_label: string | null;
}

export interface BuildItem {
  id: string;
  build_id: string;
  part_id: string | null;
  external_type: PartType | null;
  external_name: string | null;
  external_price: string | null;
  external_url: string | null;
  part: Part | null;
}

export type BuildStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface Build {
  id: string;
  name: string;
  notes: string | null;
  status: BuildStatus;
  created_at: string;
  item_count: number;
}

export interface BuildComment {
  id: string;
  build_id: string;
  author_role: 'admin' | 'manager';
  body: string;
  created_at: string;
}

export interface BuildDetail extends Build {
  items: BuildItem[];
  total_cost: string;
}

export interface Stats {
  total_pcs: number;
  active_pcs: number;
  total_parts: number;
  inventory_count: number;
  total_value: string;
  expiring_warranties: number;
  faulty_parts: number;
}

export interface PCInput {
  name: string;
  description?: string | null;
  status?: PCStatus;
  build_date?: string | null;
  employee_id?: string | null;
}

export interface EmployeeInput {
  name: string;
  title?: string | null;
  email?: string | null;
  department?: string | null;
}

export interface PartInput {
  type: PartType;
  brand: string;
  model: string;
  serial_number?: string | null;
  condition?: PartCondition;
  purchase_date?: string | null;
  purchase_price?: string | null;
  warranty_expiry?: string | null;
  specs?: Record<string, unknown> | null;
  pc_id?: string | null;
}

export const PART_TYPES: PartType[] = [
  'cpu', 'gpu', 'ram', 'psu', 'case', 'cooler', 'ssd', 'hdd', 'mobo', 'fan',
  'laptop', 'tablet', 'monitor', 'vr', 'peripheral', 'audio', 'printer',
  'camera', 'ups', 'router', 'switch', 'ap', 'other',
];

export const PART_CONDITIONS: PartCondition[] = [
  'new', 'good', 'fair', 'faulty', 'rma', 'retired',
];

export const PART_TYPE_LABELS: Record<PartType, string> = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', psu: 'PSU (SMPS)', case: 'Case',
  cooler: 'Cooler', ssd: 'SSD', hdd: 'HDD', mobo: 'Motherboard',
  fan: 'Fan',
  laptop: 'Laptop', tablet: 'Tablet', monitor: 'Monitor', vr: 'VR Headset',
  peripheral: 'Peripheral', audio: 'Audio', printer: 'Printer',
  camera: 'Camera', ups: 'UPS',
  router: 'Router', switch: 'Network Switch', ap: 'Access Point',
  other: 'Other',
};

/** Category grouping for filters and grouped type selects. */
export type PartCategory = 'components' | 'devices' | 'network';

/** Which category a type belongs to; 'other' returns null (uncategorized). */
export function partCategory(type: PartType): PartCategory | null {
  return PART_CATEGORIES.find((c) => c.types.includes(type))?.key ?? null;
}

export const PART_CATEGORIES: { key: PartCategory; label: string; types: PartType[] }[] = [
  {
    key: 'components',
    label: 'PC Components',
    types: ['cpu', 'gpu', 'ram', 'psu', 'case', 'cooler', 'ssd', 'hdd', 'mobo', 'fan'],
  },
  {
    key: 'devices',
    label: 'Devices',
    types: ['laptop', 'tablet', 'monitor', 'vr', 'peripheral', 'audio', 'printer', 'camera', 'ups'],
  },
  {
    key: 'network',
    label: 'Network',
    types: ['router', 'switch', 'ap'],
  },
];
