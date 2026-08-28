import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coopCoepHeaders,
  documentIsolationHeaders,
  isFramedDocumentRequest,
  urlHasEmbedFlag,
} from './orionFrame.ts';

describe('orionFrame isolation', () => {
  it('flags embed query and /embed/ops', () => {
    assert.equal(urlHasEmbedFlag('/mesh/?embed=1&tab=ops'), true);
    assert.equal(urlHasEmbedFlag('/?embed=true'), true);
    assert.equal(urlHasEmbedFlag('/embed/ops'), true);
    assert.equal(urlHasEmbedFlag('/mesh/?tab=ops'), false);
    assert.equal(urlHasEmbedFlag('/embed/youtube?v=x'), false);
  });

  it('treats Sec-Fetch-Dest: iframe as framed even without embed=', () => {
    assert.equal(
      isFramedDocumentRequest({
        url: '/mesh/?tab=ops',
        headers: { 'sec-fetch-dest': 'iframe' },
      }),
      true
    );
    assert.equal(
      isFramedDocumentRequest({ url: '/mesh/?tab=ops', headers: {} }),
      false
    );
  });

  it('strips COOP/COEP for embed and sets frame-ancestors', () => {
    const embed = documentIsolationHeaders({ url: '/mesh/?embed=1&tab=ops' });
    assert.equal(embed['Cross-Origin-Opener-Policy'], undefined);
    assert.equal(embed['Cross-Origin-Embedder-Policy'], undefined);
    assert.match(embed['Content-Security-Policy'] || '', /frame-ancestors/);
    assert.match(embed['Content-Security-Policy'] || '', /localhost:3047/);

    const standalone = documentIsolationHeaders({ url: '/mesh/' });
    assert.deepEqual(standalone, coopCoepHeaders());
  });
});
