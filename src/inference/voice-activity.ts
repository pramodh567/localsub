export interface VoiceSegment {
  samples: Float32Array;
  startSample: number;
}

export class VoiceActivityDetector {
  private readonly preRollBlocks: Float32Array[] = [];
  private readonly activeBlocks: Float32Array[] = [];
  private activeStartSample = 0;
  private silentSamples = 0;
  private totalSamples = 0;

  constructor(
    private readonly threshold = 0.012,
    private readonly preRollSamples = 8_000,
    private readonly trailingSilenceSamples = 11_200,
  ) {}

  push(block: Float32Array): VoiceSegment[] {
    const start = this.totalSamples;
    this.totalSamples += block.length;
    const voiced = this.rms(block) >= this.threshold;
    if (!this.activeBlocks.length && voiced) {
      this.activeStartSample = start - this.preRollBlocks.reduce((sum, item) => sum + item.length, 0);
      this.activeBlocks.push(...this.preRollBlocks, block);
      this.preRollBlocks.length = 0;
      return [];
    }
    if (this.activeBlocks.length) {
      this.activeBlocks.push(block);
      this.silentSamples = voiced ? 0 : this.silentSamples + block.length;
      if (this.silentSamples >= this.trailingSilenceSamples) return [this.finish()!];
      return [];
    }
    this.preRollBlocks.push(block);
    let length = this.preRollBlocks.reduce((sum, item) => sum + item.length, 0);
    while (length > this.preRollSamples && this.preRollBlocks.length) length -= this.preRollBlocks.shift()!.length;
    return [];
  }

  flush(): VoiceSegment[] { return this.activeBlocks.length ? [this.finish()!] : []; }

  private finish(): VoiceSegment {
    const length = this.activeBlocks.reduce((sum, item) => sum + item.length, 0);
    const samples = new Float32Array(length);
    let offset = 0;
    for (const block of this.activeBlocks) { samples.set(block, offset); offset += block.length; }
    this.activeBlocks.length = 0;
    this.silentSamples = 0;
    return { samples, startSample: Math.max(0, this.activeStartSample) };
  }

  private rms(samples: Float32Array): number {
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
  }
}
