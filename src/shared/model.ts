export const MODEL_ID = 'onnx-community/whisper-tiny';
// Immutable revision pins the downloaded model to a known repository commit.
export const MODEL_REVISION = 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7';
export const ENGLISH_MODEL_ID = 'onnx-community/whisper-tiny.en';
export const ENGLISH_MODEL_REVISION = '2575352d61be1bf7225cf8f8b268a4678025fc58';
export const MODEL_HOST = 'https://huggingface.co';

export type TranscriptionProfile = {
  modelId: string;
  revision: string;
  task: 'translate' | 'transcribe';
  language?: 'english' | 'hindi' | 'japanese';
};

export function transcriptionProfile(language: import('./types').SpokenLanguage): TranscriptionProfile {
  if (language === 'en') return { modelId: ENGLISH_MODEL_ID, revision: ENGLISH_MODEL_REVISION, task: 'transcribe', language: 'english' };
  if (language === 'hi') return { modelId: MODEL_ID, revision: MODEL_REVISION, task: 'translate', language: 'hindi' };
  if (language === 'ja') return { modelId: MODEL_ID, revision: MODEL_REVISION, task: 'translate', language: 'japanese' };
  return { modelId: MODEL_ID, revision: MODEL_REVISION, task: 'translate' };
}

export async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function verifyArtifact(buffer: ArrayBuffer, expectedHash: string): Promise<boolean> {
  return (await sha256(buffer)) === expectedHash.toLowerCase();
}
