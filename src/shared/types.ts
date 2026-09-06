export type SessionStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';
export type SpokenLanguage = 'auto' | 'en' | 'hi' | 'ja';

export interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  provisional?: boolean;
}

export interface SessionSnapshot {
  status: SessionStatus;
  tabId?: number;
  startedAt?: number;
  backend?: 'webgpu' | 'wasm';
  language?: SpokenLanguage;
  message?: string;
  cues: SubtitleCue[];
}

export type ExtensionMessage =
  | { type: 'START'; tabId: number; language: SpokenLanguage }
  | { type: 'STOP' }
  | { type: 'GET_STATE' }
  | { type: 'EXPORT_SRT' }
  | { type: 'OFFSCREEN_READY' }
  | { type: 'OFFSCREEN_PING' }
  | { type: 'START_CAPTURE'; streamId: string; tabId: number; language: SpokenLanguage }
  | { type: 'CAPTURE_READY'; tabId: number }
  | { type: 'STOP_CAPTURE' }
  | { type: 'INFERENCE_STATUS'; backend?: 'webgpu' | 'wasm'; message: string }
  | { type: 'CUE'; cue: SubtitleCue }
  | { type: 'CAPTURE_ERROR'; message: string }
  | { type: 'SHOW_OVERLAY' }
  | { type: 'HIDE_OVERLAY' }
  | { type: 'TIMELINE'; currentTimeMs: number };
