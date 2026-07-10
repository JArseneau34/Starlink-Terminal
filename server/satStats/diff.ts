import { stableHash } from './hash.js';

export type ChangeType = 'inserted' | 'updated' | 'unchanged';

export function detectChangeType(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
): ChangeType {
  if (!existing) return 'inserted';
  const existingPayload = { ...existing };
  delete existingPayload.source_hash;
  const incomingHash = stableHash(incoming);
  const existingHash = stableHash(existingPayload);
  return incomingHash === existingHash ? 'unchanged' : 'updated';
}

export function buildDiffPayload(changeType: ChangeType, fields?: string[]): Record<string, unknown> {
  return { change_type: changeType, fields: fields ?? [] };
}
