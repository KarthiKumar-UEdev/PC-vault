export type PCStatus = 'active' | 'retired' | 'planned';

export type PartType =
  | 'cpu' | 'gpu' | 'ram' | 'psu' | 'case' | 'cooler'
  | 'ssd' | 'hdd' | 'mobo' | 'fan' | 'other';

export type PartCondition = 'new' | 'good' | 'fair' | 'faulty' | 'rma' | 'retired';

export interface Part {
  id: string;
  pc_id: string | null;
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
  created_at: string;
  part_count: number;
  total_value: string;
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

export interface Build {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  item_count: number;
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
  'cpu', 'gpu', 'ram', 'psu', 'case', 'cooler', 'ssd', 'hdd', 'mobo', 'fan', 'other',
];

export const PART_CONDITIONS: PartCondition[] = [
  'new', 'good', 'fair', 'faulty', 'rma', 'retired',
];

export const PART_TYPE_LABELS: Record<PartType, string> = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', psu: 'PSU (SMPS)', case: 'Case',
  cooler: 'Cooler', ssd: 'SSD', hdd: 'HDD', mobo: 'Motherboard',
  fan: 'Fan', other: 'Other',
};
