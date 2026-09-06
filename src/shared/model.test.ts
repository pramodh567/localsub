import { describe, expect, it } from 'vitest';
import { sha256, transcriptionProfile, verifyArtifact } from './model';

describe('model integrity', () => {
  it('verifies SHA-256 artifacts', async () => {
    const bytes = new TextEncoder().encode('local-only').buffer;
    const hash = await sha256(bytes);
    expect(await verifyArtifact(bytes, hash)).toBe(true);
    expect(await verifyArtifact(bytes, '0'.repeat(64))).toBe(false);
  });
});

describe('transcription profiles', () => {
  it('uses the English-only fast model for English', () => {
    expect(transcriptionProfile('en').task).toBe('transcribe');
    expect(transcriptionProfile('en').modelId).toContain('tiny.en');
  });
  it('keeps auto-detect unconstrained and other choices multilingual', () => {
    expect(transcriptionProfile('auto').language).toBeUndefined();
    expect(transcriptionProfile('hi').task).toBe('translate');
    expect(transcriptionProfile('ja').task).toBe('translate');
  });
});
