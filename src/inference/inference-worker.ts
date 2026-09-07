import { env, pipeline } from '@huggingface/transformers';
import { mergeOverlap } from '../shared/captions';
import { MODEL_HOST, transcriptionProfile } from '../shared/model';
import type { SpokenLanguage, SubtitleCue } from '../shared/types';

type RecognitionPipeline = (audio: Float32Array, options: object) => Promise<{ text?: string }>;
type CreatePipeline = (task: string, model: string, options: Record<string, unknown>) => Promise<RecognitionPipeline>;
const createPipeline = pipeline as unknown as CreatePipeline;

const TARGET_SAMPLE_RATE = 16_000;
let inputSampleRate = 16_000; 

// ==========================================
// ACCURACY TWEAK: 6-Second Context Window
// ==========================================
const WINDOW_SAMPLES = TARGET_SAMPLE_RATE * 6; // 6 seconds for better grammatical context
const STEP_SAMPLES = TARGET_SAMPLE_RATE * 2;   // Updates every 2 seconds

let pendingBuffer = new Float32Array(0);
let totalProcessedSamples = 0;

let recognizer: RecognitionPipeline | undefined;
let lastText = '';
let isTranscribing = false;
let stopped = false;
let profile = transcriptionProfile('auto');

env.useBrowserCache = true;
env.allowLocalModels = false;
env.remoteHost = MODEL_HOST;

const extensionOrigin = self.location.origin;
env.backends.onnx!.wasm!.wasmPaths = extensionOrigin + '/wasm/';
env.backends.onnx!.wasm!.numThreads = 1;
env.backends.onnx!.wasm!.proxy = false; 

function post(message: object): void { self.postMessage(message); }

function getVolume(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

async function initialize(language: SpokenLanguage): Promise<void> {
  stopped = false;
  profile = transcriptionProfile(language);
  const useWebGpu = 'gpu' in navigator;
  const devices: Array<'webgpu' | 'wasm'> = useWebGpu ? ['webgpu', 'wasm'] : ['wasm'];

  for (const device of devices) {
    try {
      post({ type: 'INFERENCE_STATUS', backend: device, message: `Initializing ${device.toUpperCase()} backend...` });
      
      recognizer = await createPipeline('automatic-speech-recognition', profile.modelId, {
        revision: profile.revision,
        device,
        dtype: device === 'webgpu' ? 'fp32' : 'q8', 
        progress_callback: (progress: { status?: string; file?: string; progress?: number }) => {
          if (progress.status === 'downloading' && !progress.progress) {
              post({ type: 'INFERENCE_STATUS', backend: device, message: `Downloading model files...` });
          } else {
              const percent = progress.progress ? ` ${Math.round(progress.progress)}%` : '';
              post({ type: 'INFERENCE_STATUS', backend: device, message: `${progress.status ?? 'Loading'} ${progress.file ?? 'model'}${percent}` });
          }
        }
      });
      post({ type: 'INFERENCE_STATUS', backend: device, message: `Local ${device === 'webgpu' ? 'GPU' : 'CPU'} captions active!` });
      return;
    } catch (err) {
      console.warn(`[DEBUG] Backend ${device} failed...`, err);
    }
  }
}

async function processWindow(): Promise<void> {
  if (isTranscribing || stopped || pendingBuffer.length < WINDOW_SAMPLES) return;
  isTranscribing = true;

  if (pendingBuffer.length > WINDOW_SAMPLES * 2) {
     const dropAmount = pendingBuffer.length - WINDOW_SAMPLES;
     pendingBuffer = pendingBuffer.slice(dropAmount);
     totalProcessedSamples += dropAmount;
  }

  const currentWindow = pendingBuffer.slice(0, WINDOW_SAMPLES);
  const startSample = totalProcessedSamples;
  
  pendingBuffer = pendingBuffer.slice(STEP_SAMPLES);
  totalProcessedSamples += STEP_SAMPLES;

  try {
    if (getVolume(currentWindow) < 0.005) {
       lastText = ''; 
       post({ type: 'CUE', cue: { text: '' } }); 
       isTranscribing = false;
       void processWindow();
       return;
    }

    const isEnglishOnly = profile.modelId.endsWith('.en');
    
    // ==========================================
    // ACCURACY TWEAK: Beam Search
    // ==========================================
    const options: any = {
      return_timestamps: false,
      no_repeat_ngram_size: 2,
      num_beams: 2 // Evaluates multiple grammar paths for higher accuracy
    };

    if (!isEnglishOnly) {
      options.task = profile.task;
      if (profile.language) {
          options.language = profile.language;
      }
    }

    const result = await recognizer!(currentWindow, options);
    let rawText = result.text?.trim() ?? '';

    if (rawText && new Set(rawText.split(/\s+/)).size <= 2 && rawText.length > 15) {
      rawText = '';
    }

    const text = mergeOverlap(lastText, rawText) || rawText;

    // Formatting: Limit displayed text to the last ~16 words for clean 2-line formatting
    let displayText = text;
    const words = text.split(/\s+/);
    if (words.length > 16) {
        displayText = words.slice(-16).join(' ');
    }

    const cue: SubtitleCue = {
      id: String(startSample),
      startMs: (startSample / TARGET_SAMPLE_RATE) * 1_000,
      endMs: (startSample / TARGET_SAMPLE_RATE) * 1_000 + ((WINDOW_SAMPLES / TARGET_SAMPLE_RATE) * 1_000),
      text: displayText,
      provisional: false
    };
    
    post({ type: 'CUE', cue }); 
    
    // Store up to 10 words for overlapping context
    lastText = text ? words.slice(-10).join(' ') : '';
    
  } catch (error) {
    console.error("Transcription chunk error:", error);
    lastText = '';
  } finally {
    isTranscribing = false;
    void processWindow();
  }
}

self.onmessage = ({ data }: MessageEvent<any>) => {
  if (data.type === 'INITIALIZE') {
    void initialize(data.language ?? 'auto').catch((error) => 
      post({ type: 'CAPTURE_ERROR', message: error instanceof Error ? error.message : 'Model initialization failed.' })
    );
  }
  if (data.type === 'PCM' && data.samples) { 
    const newSamples = new Float32Array(data.samples);
    const combined = new Float32Array(pendingBuffer.length + newSamples.length);
    combined.set(pendingBuffer);
    combined.set(newSamples, pendingBuffer.length);
    pendingBuffer = combined;
    void processWindow();
  }
  if (data.type === 'STOP') {
    stopped = true;
    pendingBuffer = new Float32Array(0);
    lastText = '';
    post({ type: 'CUE', cue: { text: '' } }); 
  }
};