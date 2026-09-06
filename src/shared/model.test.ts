import { describe, expect, it } from 'vitest';
import { sha256, verifyArtifact } from './model';

describe('model integrity', () => {
  it('verifies SHA-256 artifacts', async () => {
    const bytes = new TextEncoder().encode('local-only').buffer;
    const hash = await sha256(bytes);
    expect(await verifyArtifact(bytes, hash)).toBe(true);
    expect(await verifyArtifact(bytes, '0'.repeat(64))).toBe(false);
  });
});
