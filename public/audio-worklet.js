class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = [];
    this.pendingLength = 0;
    this.targetRate = 16000;
    this.sourceRate = sampleRate;
    this.port.onmessage = ({ data }) => { if (data.type === 'flush') this.flush(); };
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels || !channels.length) return true;
    const frames = channels[0].length;
    const mono = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (const channel of channels) sum += channel[i] || 0;
      mono[i] = sum / channels.length;
    }
    this.pending.push(mono);
    this.pendingLength += mono.length;
    if (this.pendingLength >= this.sourceRate) this.flush();
    return true;
  }
  flush() {
    if (!this.pendingLength) return;
    const source = new Float32Array(this.pendingLength);
    let offset = 0;
    for (const block of this.pending) { source.set(block, offset); offset += block.length; }
    const outputLength = Math.floor(source.length * this.targetRate / this.sourceRate);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const position = i * this.sourceRate / this.targetRate;
      const left = Math.floor(position);
      const right = Math.min(left + 1, source.length - 1);
      output[i] = source[left] + (source[right] - source[left]) * (position - left);
    }
    this.pending = []; this.pendingLength = 0;
    this.port.postMessage({ type: 'pcm', samples: output.buffer }, [output.buffer]);
  }
}
registerProcessor('pcm-capture', PcmCaptureProcessor);
