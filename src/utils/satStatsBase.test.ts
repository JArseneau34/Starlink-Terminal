import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { satStatsBase, withBase } from './satStatsBase.ts';

describe('satStatsBase', () => {
  it('is empty under tsx (no Vite BASE_URL) so /api stays /api', () => {
    assert.equal(satStatsBase(), '');
    assert.equal(withBase('/api/auth/me'), '/api/auth/me');
    assert.equal(withBase('/textures/earth-day.jpg'), '/textures/earth-day.jpg');
    assert.equal(withBase('https://example.com/x'), 'https://example.com/x');
  });
});
