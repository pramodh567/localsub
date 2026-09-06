export const MODEL_ID = 'onnx-community/whisper-tiny';
// Immutable revision pins the downloaded model to a known repository commit.
export const MODEL_REVISION = 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7';
export const MODEL_HOST = 'https://huggingface.co';

export async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function verifyArtifact(buffer: ArrayBuffer, expectedHash: string): Promise<boolean> {
  return (await sha256(buffer)) === expectedHash.toLowerCase();
}
