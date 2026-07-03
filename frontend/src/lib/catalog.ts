import type { PartType } from './types';

/** Structured specs a catalog entry can carry — the compatibility engine
 *  reads the same keys from owned parts' `specs` JSON. */
export interface CatalogSpecs {
  socket?: string;        // cpu + mobo
  mem_type?: 'DDR4' | 'DDR5'; // ram + mobo
  tdp_w?: number;         // cpu + gpu power draw estimate
  watts?: number;         // psu capacity
  capacity_gb?: number;   // ram / storage
  form_factor?: string;   // mobo + case
}

/** Curated wishlist options with typical Indian street prices (₹).
 *  Selecting one pre-fills price + specs — still editable before adding. */
export interface CatalogEntry {
  label: string;
  price: number;
  specs?: CatalogSpecs;
}

export const CPU_CATALOG: CatalogEntry[] = [
  { label: 'AMD Ryzen 9 9950X3D', price: 69999, specs: { socket: 'AM5', tdp_w: 170 } },
  { label: 'AMD Ryzen 9 9900X3D', price: 54999, specs: { socket: 'AM5', tdp_w: 120 } },
  { label: 'AMD Ryzen 7 9800X3D', price: 42999, specs: { socket: 'AM5', tdp_w: 120 } },
  { label: 'AMD Ryzen 7 9700X', price: 29999, specs: { socket: 'AM5', tdp_w: 65 } },
  { label: 'AMD Ryzen 7 7800X3D', price: 33999, specs: { socket: 'AM5', tdp_w: 120 } },
  { label: 'AMD Ryzen 5 9600X', price: 21999, specs: { socket: 'AM5', tdp_w: 65 } },
  { label: 'AMD Ryzen 5 7600', price: 16999, specs: { socket: 'AM5', tdp_w: 65 } },
  { label: 'Intel Core Ultra 9 285K', price: 55999, specs: { socket: 'LGA1851', tdp_w: 125 } },
  { label: 'Intel Core Ultra 7 265K', price: 36999, specs: { socket: 'LGA1851', tdp_w: 125 } },
  { label: 'Intel Core Ultra 5 245K', price: 27999, specs: { socket: 'LGA1851', tdp_w: 125 } },
  { label: 'Intel Core i5-14400F', price: 15999, specs: { socket: 'LGA1700', tdp_w: 65 } },
];

export const GPU_CATALOG: CatalogEntry[] = [
  { label: 'NVIDIA RTX 5090', price: 239999, specs: { tdp_w: 575 } },
  { label: 'NVIDIA RTX 5080', price: 114999, specs: { tdp_w: 360 } },
  { label: 'NVIDIA RTX 5070 Ti', price: 84999, specs: { tdp_w: 300 } },
  { label: 'NVIDIA RTX 5070', price: 61999, specs: { tdp_w: 250 } },
  { label: 'NVIDIA RTX 5060 Ti 16GB', price: 44999, specs: { tdp_w: 180 } },
  { label: 'NVIDIA RTX 5060', price: 32999, specs: { tdp_w: 145 } },
  { label: 'AMD RX 9070 XT', price: 71999, specs: { tdp_w: 304 } },
  { label: 'AMD RX 9070', price: 59999, specs: { tdp_w: 220 } },
  { label: 'AMD RX 9060 XT', price: 37999, specs: { tdp_w: 160 } },
  { label: 'Intel Arc B580', price: 27999, specs: { tdp_w: 190 } },
];

export const MOBO_CATALOG: CatalogEntry[] = [
  { label: 'ASUS ROG Strix X870E-E', price: 44999, specs: { socket: 'AM5', mem_type: 'DDR5', form_factor: 'ATX' } },
  { label: 'MSI MAG X870 Tomahawk', price: 28999, specs: { socket: 'AM5', mem_type: 'DDR5', form_factor: 'ATX' } },
  { label: 'Gigabyte B850 Aorus Elite', price: 19999, specs: { socket: 'AM5', mem_type: 'DDR5', form_factor: 'ATX' } },
  { label: 'MSI B650 Gaming Plus WiFi', price: 14999, specs: { socket: 'AM5', mem_type: 'DDR5', form_factor: 'ATX' } },
  { label: 'ASRock B650M-HDV/M.2', price: 10999, specs: { socket: 'AM5', mem_type: 'DDR5', form_factor: 'mATX' } },
  { label: 'ASUS ROG Maximus Z890 Hero', price: 59999, specs: { socket: 'LGA1851', mem_type: 'DDR5', form_factor: 'ATX' } },
  { label: 'MSI PRO Z890-A WiFi', price: 24999, specs: { socket: 'LGA1851', mem_type: 'DDR5', form_factor: 'ATX' } },
  { label: 'Gigabyte B760M DS3H DDR4', price: 9999, specs: { socket: 'LGA1700', mem_type: 'DDR4', form_factor: 'mATX' } },
];

export const RAM_CATALOG: CatalogEntry[] = [
  { label: 'G.Skill Trident Z5 Neo 32GB (2×16) DDR5-6000', price: 10999, specs: { mem_type: 'DDR5', capacity_gb: 32 } },
  { label: 'Corsair Vengeance 32GB (2×16) DDR5-6000', price: 9999, specs: { mem_type: 'DDR5', capacity_gb: 32 } },
  { label: 'Kingston Fury Beast 64GB (2×32) DDR5-5600', price: 18999, specs: { mem_type: 'DDR5', capacity_gb: 64 } },
  { label: 'Crucial Pro 32GB (2×16) DDR5-5600', price: 8499, specs: { mem_type: 'DDR5', capacity_gb: 32 } },
  { label: 'Corsair Vengeance LPX 32GB (2×16) DDR4-3200', price: 5999, specs: { mem_type: 'DDR4', capacity_gb: 32 } },
  { label: 'G.Skill Ripjaws V 16GB (2×8) DDR4-3200', price: 3299, specs: { mem_type: 'DDR4', capacity_gb: 16 } },
];

export const SSD_CATALOG: CatalogEntry[] = [
  { label: 'Samsung 990 Pro 2TB NVMe', price: 15499, specs: { capacity_gb: 2000 } },
  { label: 'WD Black SN850X 2TB NVMe', price: 13999, specs: { capacity_gb: 2000 } },
  { label: 'WD Black SN850X 1TB NVMe', price: 7999, specs: { capacity_gb: 1000 } },
  { label: 'Crucial P3 Plus 1TB NVMe', price: 5499, specs: { capacity_gb: 1000 } },
  { label: 'Samsung 870 EVO 1TB SATA', price: 7499, specs: { capacity_gb: 1000 } },
];

export const HDD_CATALOG: CatalogEntry[] = [
  { label: 'Seagate Barracuda 4TB', price: 7499, specs: { capacity_gb: 4000 } },
  { label: 'WD Blue 2TB', price: 4799, specs: { capacity_gb: 2000 } },
  { label: 'Seagate IronWolf 8TB NAS', price: 17999, specs: { capacity_gb: 8000 } },
];

export const PSU_CATALOG: CatalogEntry[] = [
  { label: 'Corsair RM1000e 1000W Gold', price: 13999, specs: { watts: 1000 } },
  { label: 'Corsair RM850e 850W Gold', price: 9999, specs: { watts: 850 } },
  { label: 'MSI MAG A750GL 750W Gold', price: 7499, specs: { watts: 750 } },
  { label: 'Deepcool PK650D 650W Bronze', price: 4599, specs: { watts: 650 } },
  { label: 'Antec CSK550 550W Bronze', price: 3599, specs: { watts: 550 } },
];

export const CASE_CATALOG: CatalogEntry[] = [
  { label: 'Lian Li O11 Dynamic EVO', price: 13999, specs: { form_factor: 'ATX' } },
  { label: 'NZXT H7 Flow', price: 10499, specs: { form_factor: 'ATX' } },
  { label: 'Corsair 4000D Airflow', price: 7999, specs: { form_factor: 'ATX' } },
  { label: 'Deepcool CH510 Mesh', price: 4999, specs: { form_factor: 'ATX' } },
  { label: 'Cooler Master NR200P (ITX)', price: 8499, specs: { form_factor: 'ITX' } },
];

export const COOLER_CATALOG: CatalogEntry[] = [
  { label: 'Arctic Liquid Freezer III 360', price: 11999 },
  { label: 'NZXT Kraken 240', price: 9999 },
  { label: 'Deepcool AK620 (air)', price: 5499 },
  { label: 'Thermalright Peerless Assassin 120 SE', price: 3999 },
  { label: 'AMD/Intel stock cooler', price: 0 },
];

export const PART_CATALOGS: Partial<Record<PartType, CatalogEntry[]>> = {
  cpu: CPU_CATALOG,
  gpu: GPU_CATALOG,
  mobo: MOBO_CATALOG,
  ram: RAM_CATALOG,
  ssd: SSD_CATALOG,
  hdd: HDD_CATALOG,
  psu: PSU_CATALOG,
  case: CASE_CATALOG,
  cooler: COOLER_CATALOG,
};

/** Recover the specs of an external (wishlist) build item by matching its
 *  stored name back to the catalog it was picked from. */
export function findCatalogEntry(type: PartType, name: string | null): CatalogEntry | undefined {
  if (!name) return undefined;
  return PART_CATALOGS[type]?.find((entry) => entry.label === name);
}
