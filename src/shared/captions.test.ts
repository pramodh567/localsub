import { describe, expect, it } from 'vitest';
import { formatSrtTimestamp, mergeOverlap, toSrt } from './captions';

describe('caption helpers', () => {
  it('removes overlapping words', () => expect(mergeOverlap('hello from the', 'the local model')).toBe('local model'));
  it('formats SRT timestamps', () => expect(formatSrtTimestamp(3_723_004)).toBe('01:02:03,004'));
  it('exports finalized cues only', () => expect(toSrt([
    { id: '1', startMs: 0, endMs: 1_000, text: 'Hello' },
    { id: '2', startMs: 1_000, endMs: 2_000, text: 'Draft', provisional: true }
  ])).toContain('Hello'));
});
