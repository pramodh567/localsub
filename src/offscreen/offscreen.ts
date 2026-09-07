let mediaStream: MediaStream | undefined;
let playbackContext: AudioContext | undefined;
let aiContext: AudioContext | undefined;
let audioWorkletNode: AudioWorkletNode | undefined;
let worker: Worker | undefined;

async function startCapture(streamId: string, language: string): Promise<void> {
  await stopCapture();
  
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } as any,
    video: false,
  });

  // 1. HIGH-DEF PLAYBACK CONTEXT
  // This connects the captured audio back to your speakers at native 48kHz quality so it doesn't sound muffled.
  playbackContext = new AudioContext();
  const playbackSource = playbackContext.createMediaStreamSource(mediaStream);
  playbackSource.connect(playbackContext.destination);

  // 2. AI 16kHz CONTEXT
  // This creates a second stream that forces the browser to safely downsample the audio to 16kHz for Whisper.
  aiContext = new AudioContext({ sampleRate: 16000 });
  await aiContext.audioWorklet.addModule(chrome.runtime.getURL('audio-worklet.js'));
  const aiSource = aiContext.createMediaStreamSource(mediaStream);
  audioWorkletNode = new AudioWorkletNode(aiContext, 'pcm-capture');
  
  // Notice we DO NOT connect this to the destination, so you don't hear a double echo!
  aiSource.connect(audioWorkletNode);

  worker = new Worker(new URL('../inference/inference-worker.ts', import.meta.url), { type: 'module' });
  
  worker.onmessage = ({ data }) => {
    chrome.runtime.sendMessage(data);
  };

  audioWorkletNode.port.onmessage = ({ data }) => {
    if (data.type === 'pcm' && data.samples) {
      worker?.postMessage({ type: 'PCM', samples: data.samples }, [data.samples]);
    }
  };

  worker.postMessage({ type: 'INITIALIZE', language });
}

async function stopCapture(): Promise<void> {
  audioWorkletNode?.port.postMessage({ type: 'flush' });
  audioWorkletNode?.disconnect();
  audioWorkletNode = undefined;

  worker?.postMessage({ type: 'STOP' });
  worker?.terminate();
  worker = undefined;

  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = undefined;

  await playbackContext?.close();
  playbackContext = undefined;

  await aiContext?.close();
  aiContext = undefined;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'START_CAPTURE') {
    startCapture(message.streamId, message.language).catch((error) =>
      chrome.runtime.sendMessage({
        type: 'CAPTURE_ERROR',
        message: error instanceof Error ? error.message : 'Unable to access tab audio.',
      })
    );
  }
  if (message.type === 'STOP_CAPTURE') {
    stopCapture();
  }
});