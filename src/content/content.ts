import type { ExtensionMessage, SubtitleCue } from '../shared/types';

const ROOT_ID = 'local-live-subtitles-root';
let root: HTMLDivElement | undefined;
let caption: HTMLDivElement | undefined;
let dragOffset = { x: 0, y: 0 };

function createOverlay(): void {
  if (root) return;
  const existing = document.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (existing) {
    root = existing;
    caption = existing.firstElementChild as HTMLDivElement;
    return;
  }
  root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'position:fixed;z-index:2147483647;left:10%;right:10%;bottom:9%;display:none;pointer-events:none;font:600 20px/1.35 system-ui,sans-serif;text-align:center;color:white;text-shadow:0 2px 5px #000;';
  caption = document.createElement('div');
  caption.setAttribute('role', 'status'); caption.setAttribute('aria-live', 'polite');
  caption.style.cssText = 'display:inline-block;max-width:100%;padding:8px 13px;border-radius:7px;background:rgba(0,0,0,.78);pointer-events:auto;cursor:move;';
  caption.addEventListener('pointerdown', (event) => {
    const rect = root!.getBoundingClientRect(); dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    caption!.setPointerCapture(event.pointerId);
  });
  caption.addEventListener('pointermove', (event) => {
    if (!caption!.hasPointerCapture(event.pointerId)) return;
    root!.style.left = `${Math.max(0, event.clientX - dragOffset.x)}px`; root!.style.right = 'auto'; root!.style.bottom = `${Math.max(0, window.innerHeight - event.clientY + dragOffset.y)}px`;
  });
  root.append(caption); document.documentElement.append(root);
}

function primaryVideo(): HTMLVideoElement | undefined {
  return [...document.querySelectorAll('video')].filter((video) => video.offsetParent).sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
}

createOverlay();
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'SHOW_OVERLAY') root!.style.display = 'block';
  if (message.type === 'HIDE_OVERLAY') root!.style.display = 'none';
  if (message.type === 'CUE') {
    const cue: SubtitleCue = message.cue; caption!.textContent = cue.text;
  }
});

window.setInterval(() => {
  const video = primaryVideo();
  if (video) void chrome.runtime.sendMessage({ type: 'TIMELINE', currentTimeMs: video.currentTime * 1_000 } satisfies ExtensionMessage);
}, 1_000);
