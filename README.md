# Local Live Subtitles

A Manifest V3 extension for Chrome and Brave that captions the active tab locally. It captures tab audio only after a Start click, runs multilingual Whisper translation in the browser, displays English captions over the page, and can export finalized captions as SRT.

## Privacy

- No speech audio, captions, URLs, or analytics are sent to an application server.
- The only network request is the first model download from the pinned Hugging Face revision. Browser caching keeps later sessions offline.
- Audio and captions exist only in volatile extension memory. An SRT is created only when the user clicks **Download SRT**; starting another session replaces prior cues.
- The extension never captures a microphone, other tabs, or system audio.

The included model revision is fixed in `src/shared/model.ts`. The project contains SHA-256 verification utilities and tests for artifact validation; before a production store release, populate a release-owned artifact manifest with the SHA-256 values for every downloaded model file and make the downloader reject mismatches. The current Transformers.js loader uses the immutable model revision and the browser cache.

## Requirements

- Chrome or Brave based on Chromium 116 or newer
- Node.js 22+ and npm
- WebGPU is recommended. CPU/WASM fallback works but is slower.

`requirements.txt` is intentionally present to clarify that there are no Python packages. A `.venv` is optional and is created for workspace consistency only; it is not used by this extension.

## Develop

```powershell
py -3 -m venv .venv
npm.cmd install
npm.cmd run test
npm.cmd run build
```

Load `dist/` using **chrome://extensions** or **brave://extensions**, enable Developer mode, then click **Load unpacked**. Select a tab with playing audio and click the extension’s **Start captions** button.

## Architecture

- `service-worker.ts`: capture lifecycle, tab navigation cleanup, in-memory cues, SRT export.
- `offscreen.ts`: obtains the `tabCapture` stream, preserves speaker output, resamples audio, and hosts the inference worker.
- `inference-worker.ts`: loads pinned Whisper Tiny through ONNX Runtime Web, prefers WebGPU, falls back to WASM, translates audio to English, and emits cues.
- `content.ts`: overlay UI and primary-video detection.
- `popup.ts`: explicit Start/Stop, model status, and SRT download.

## Spoken-language selection

The popup saves only your preferred primary spoken-language hint: Auto-detect, English, Hindi, or Japanese. All options create English captions. Auto-detect is appropriate for unknown or heavily mixed languages. English uses a separately pinned English-only Whisper Tiny model; Hindi and Japanese use the multilingual model with a language hint. Occasional English words in Japanese audio will not crash the extension, though mixed-language transcription can be less accurate.

## Limitations

- Caption latency depends on the device and audio. The fast five-second overlapping window is designed for responsive local captions, not perfect transcription.
- DRM-protected services may expose silent audio to browser capture; this cannot be bypassed safely by an extension.
- The SRT timeline is session-relative. It is best for videos played without seeking; seek-aware alignment is a future enhancement.
- First use downloads a public open model. Installers who require zero network access can later package reviewed model artifacts in the extension release.
