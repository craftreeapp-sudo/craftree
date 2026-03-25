import fs from 'fs';
import path from 'path';
import type { SeedDataFile } from '@/lib/types';

export function getSeedDataPath(): string {
  return path.join(process.cwd(), 'src/data/seed-data.json');
}

export function readSeedData(): SeedDataFile {
  const p = getSeedDataPath();
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as SeedDataFile;
}

export function writeSeedData(data: SeedDataFile): void {
  const p = getSeedDataPath();
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}
