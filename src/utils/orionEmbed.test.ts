import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOrionEmbed,
  isOrionEmbedPath,
  isOrionEmbedSearch,
} from './orionEmbed.ts';

describe('orionEmbed', () => {
  it('reads embed=1 / embed=true', () => {
    assert.equal(isOrionEmbedSearch(''), false);
    assert.equal(isOrionEmbedSearch('?tab=ops'), false);
    assert.equal(isOrionEmbedSearch('?embed=1'), true);
    assert.equal(isOrionEmbedSearch('?embed=true&tab=ops'), true);
    assert.equal(isOrionEmbedSearch('?embed=0'), false);
    assert.equal(isOrionEmbedSearch(new URLSearchParams('embed=1')), true);
  });

  it('treats /embed/ops as embed even without the query', () => {
    assert.equal(isOrionEmbedPath('/embed/ops'), true);
    assert.equal(isOrionEmbedPath('/embed/ops/'), true);
    assert.equal(isOrionEmbedPath('/embed/youtube'), false);
    assert.equal(isOrionEmbedPath('/mesh/'), false);
  });

  it('combines search + path', () => {
    assert.equal(isOrionEmbed('?tab=ops', '/mesh/'), false);
    assert.equal(isOrionEmbed('?embed=1&tab=ops', '/mesh/'), true);
    assert.equal(isOrionEmbed('', '/embed/ops'), true);
  });
});
