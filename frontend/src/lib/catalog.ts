import type { PartType } from './types';

/** Curated wishlist options with typical Indian street prices (₹).
 *  Selecting one pre-fills the price — still editable before adding. */
export interface CatalogEntry {
  label: string;
  price: number;
}

export const CPU_CATALOG: CatalogEntry[] = [
  { label: 'AMD Ryzen 9 9950X3D', price: 69999 },
  { label: 'AMD Ryzen 9 9900X3D', price: 54999 },
  { label: 'AMD Ryzen 7 9800X3D', price: 42999 },
  { label: 'AMD Ryzen 7 9700X', price: 29999 },
  { label: 'AMD Ryzen 7 7800X3D', price: 33999 },
  { label: 'AMD Ryzen 5 9600X', price: 21999 },
  { label: 'AMD Ryzen 5 7600', price: 16999 },
  { label: 'Intel Core Ultra 9 285K', price: 55999 },
  { label: 'Intel Core Ultra 7 265K', price: 36999 },
  { label: 'Intel Core Ultra 5 245K', price: 27999 },
  { label: 'Intel Core i5-14400F', price: 15999 },
];

export const GPU_CATALOG: CatalogEntry[] = [
  { label: 'NVIDIA RTX 5090', price: 239999 },
  { label: 'NVIDIA RTX 5080', price: 114999 },
  { label: 'NVIDIA RTX 5070 Ti', price: 84999 },
  { label: 'NVIDIA RTX 5070', price: 61999 },
  { label: 'NVIDIA RTX 5060 Ti 16GB', price: 44999 },
  { label: 'NVIDIA RTX 5060', price: 32999 },
  { label: 'AMD RX 9070 XT', price: 71999 },
  { label: 'AMD RX 9070', price: 59999 },
  { label: 'AMD RX 9060 XT', price: 37999 },
  { label: 'Intel Arc B580', price: 27999 },
];

export const PART_CATALOGS: Partial<Record<PartType, CatalogEntry[]>> = {
  cpu: CPU_CATALOG,
  gpu: GPU_CATALOG,
};
