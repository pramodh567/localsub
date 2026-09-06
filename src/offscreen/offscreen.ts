import type { ExtensionMessage, SpokenLanguage } from '../shared/types';

let stream: MediaStream | undefined;
let context: AudioContext | undefined;
let node: AudioWorkletNode | undefined;
let inference: Worker | undefined;

async function startCapture(streamId: string, language: SpokenLanguage): Promise<void> {
  await stopCapture();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } as MediaTrackConstraints,
    video: false
  });
  context = new AudioContext();
  await context.audioWorklet.addModule(chrome.runtime.getURL('audio-worklet.js'));
  const source = context.createMediaStreamSource(stream);
  node = new AudioWorkletNode(context, 'pcm-capture');
  // Re-route captured audio; tabCapture otherwise mutes the original tab playback.
  source.connect(node);
  source.connect(context.destination);
  inference = new Worker(new URL('../inference/inference-worker.ts', import.meta.url), { type: 'module' });
  inference.onmessage = ({ data }) => { void chrome.runtime.sendMessage(data); };
  node.port.onmessage = ({ data }) => {
    if (data.type === 'pcm') inference?.postMessage({ type: 'PCM', samples: data.samples }, [data.samples]);
  };
  inference.postMessage({ type: 'INITIALIZE', language });
}

async function stopCapture(): Promise<void> {
  node?.port.postMessage({ type: 'flush' });
  node?.disconnect(); node = undefined;
  inference?.postMessage({ type: 'STOP' }); inference?.terminate(); inference = undefined;
  stream?.getTracks().forEach((track) => track.stop()); stream = undefined;
  await context?.close(); context = undefined;
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'START_CAPTURE') void startCapture(message.streamId, message.language).catch((error) =>
    chrome.runtime.sendMessage({ type: 'CAPTURE_ERROR', message: error instanceof Error ? error.message : 'Unable to access tab audio.' })
  );
  if (message.type === 'STOP_CAPTURE') void stopCapture();
});
