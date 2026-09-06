import { describe, expect, it } from 'vitest';
import { VoiceActivityDetector } from './voice-activity';

const silence = (length = 1_600) => new Float32Array(length);
const speech = (length = 1_600) => new Float32Array(length).fill(0.1);

describe('VoiceActivityDetector', () => {
  it('does not emit sustained silence', () => {
    const detector = new VoiceActivityDetector(0.012, 800, 1_600);
    expect(detector.push(silence())).toEqual([]);
    expect(detector.push(silence())).toEqual([]);
  });
  it('keeps pre-speech audio and emits after trailing silence', () => {
    const detector = new VoiceActivityDetector(0.012, 800, 1_600);
    detector.push(silence(800)); detector.push(speech(1_600));
    const [segment] = detector.push(silence(1_600));
    expect(segment.startSample).toBe(0);
    expect(segment.samples.length).toBe(4_000);
  });
});
