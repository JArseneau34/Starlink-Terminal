import { createHash } from 'node:crypto';

export function stableHash(payload: Record<string, unknown>): string {
  const encoded = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(encoded).digest('hex');
}
