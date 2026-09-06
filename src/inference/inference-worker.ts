import { env, pipeline } from '@huggingface/transformers';
import { mergeOverlap } from '../shared/captions';
import { MODEL_HOST, MODEL_ID, MODEL_REVISION } from '../shared/model';
import type { SubtitleCue } from '../shared/types';

type RecognitionPipeline = (audio: Float32Array, options: object) => Promise<{ text?: string }>;
type CreatePipeline = (task: string, model: string, options: Record<string, unknown>) => Promise<RecognitionPipeline>;
const createPipeline = pipeline as unknown as CreatePipeline;

const SAMPLE_RATE = 16_000;
const WINDOW_SAMPLES = SAMPLE_RATE * 5;
const OVERLAP_SAMPLES = SAMPLE_RATE * 1_500 / 1_000;
let pending = new Float32Array();
let processedSamples = 0;
let recognizer: RecognitionPipeline | undefined;
let lastText = '';
let busy = false;
let stopped = false;

env.allowLocalModels = false;
env.useBrowserCache = true;
env.remoteHost = MODEL_HOST;

function post(message: object): void { self.postMessage(message); }

async function initialize(): Promise<void> {
  stopped = false;
  const useWebGpu = 'gpu' in navigator;
  const load = async (device: 'webgpu' | 'wasm') => {
    post({ type: 'INFERENCE_STATUS', backend: device, message: 'Downloading or loading the local speech model…' });
    recognizer = await createPipeline('automatic-speech-recognition', MODEL_ID, {
      revision: MODEL_REVISION,
      device,
      dtype: 'q8',
      progress_callback: (progress: { status?: string; file?: string; progress?: number }) => {
        const percent = progress.progress ? ` ${Math.round(progress.progress)}%` : '';
        post({ type: 'INFERENCE_STATUS', backend: device, message: `${progress.status ?? 'Loading'} ${progress.file ?? 'model'}${percent}` });
      }
    });
    post({ type: 'INFERENCE_STATUS', backend: device, message: `Local ${device === 'webgpu' ? 'GPU' : 'CPU'} captions ready` });
  };
  try {
    if (!useWebGpu) throw new Error('WebGPU unavailable');
    await load('webgpu');
  } catch {
    await load('wasm');
  }
}

function append(samples: Float32Array): void {
  const combined = new Float32Array(pending.length + samples.length);
  combined.set(pending); combined.set(samples, pending.length);
  pending = combined;
}

async function transcribeWindow(window: Float32Array, startSample: number): Promise<void> {
  if (!recognizer || stopped) return;
  busy = true;
  try {
    const result = await recognizer(window, {
      task: 'translate',
      language: null,
      return_timestamps: true,
      chunk_length_s: 5,
      stride_length_s: 1.5
    });
    const text = mergeOverlap(lastText, result.text ?? '');
    if (text) {
      const durationMs = window.length / SAMPLE_RATE * 1_000;
      const cue: SubtitleCue = {
        id: String(startSample),
        startMs: startSample / SAMPLE_RATE * 1_000,
        endMs: startSample / SAMPLE_RATE * 1_000 + durationMs,
        text,
        provisional: false
      };
      post({ type: 'CUE', cue });
      lastText = `${lastText} ${text}`.trim().split(/\s+/).slice(-12).join(' ');
    }
  } catch (error) {
    post({ type: 'INFERENCE_STATUS', message: error instanceof Error ? error.message : 'Local transcription failed.' });
  } finally {
    busy = false;
    void processPending();
  }
}

async function processPending(): Promise<void> {
  if (busy || pending.length < WINDOW_SAMPLES || stopped) return;
  const window = pending.slice(0, WINDOW_SAMPLES);
  const start = processedSamples;
  const advance = WINDOW_SAMPLES - OVERLAP_SAMPLES;
  pending = pending.slice(advance);
  processedSamples += advance;
  await transcribeWindow(window, start);
}

self.onmessage = ({ data }: MessageEvent<{ type: string; samples?: ArrayBuffer }>) => {
  if (data.type === 'INITIALIZE') void initialize().catch((error) => post({ type: 'CAPTURE_ERROR', message: error instanceof Error ? error.message : 'Model initialization failed.' }));
  if (data.type === 'PCM' && data.samples) { append(new Float32Array(data.samples)); void processPending(); }
  if (data.type === 'STOP') stopped = true;
};
