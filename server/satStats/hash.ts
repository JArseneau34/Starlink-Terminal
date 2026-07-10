import { createHash } from 'node:crypto';

export function stableHash(value: unknown): string {
  const json = JSON.stringify(value, Object.keys(value as object).sort());
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}
