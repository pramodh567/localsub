import type { ExtensionMessage, SessionSnapshot } from '../shared/types';
import './popup.css';

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `<section><h1>Local Live Subtitles</h1><p id="status">Checking local caption engine…</p><button id="toggle">Start captions</button><button id="export" disabled>Download SRT</button><p class="privacy">Audio and captions stay on this device. The model is downloaded once from its pinned public source.</p></section>`;
const status = document.querySelector<HTMLElement>('#status')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const exportButton = document.querySelector<HTMLButtonElement>('#export')!;

async function state(): Promise<SessionSnapshot> { return chrome.runtime.sendMessage({ type: 'GET_STATE' } satisfies ExtensionMessage); }
async function render(): Promise<void> {
  const current = await state();
  status.textContent = current.message ?? (current.status === 'running' ? 'Capturing current tab locally.' : 'Ready.');
  const active = current.status === 'running' || current.status === 'starting';
  toggle.textContent = active ? 'Stop captions' : 'Start captions';
  exportButton.disabled = !current.cues.some((cue) => !cue.provisional);
}
toggle.addEventListener('click', async () => {
  const current = await state();
  if (current.status === 'running' || current.status === 'starting') await chrome.runtime.sendMessage({ type: 'STOP' } satisfies ExtensionMessage);
  else { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab.id) await chrome.runtime.sendMessage({ type: 'START', tabId: tab.id } satisfies ExtensionMessage); }
  await render();
});
exportButton.addEventListener('click', () => { void chrome.runtime.sendMessage({ type: 'EXPORT_SRT' } satisfies ExtensionMessage); });
void render(); window.setInterval(() => void render(), 1_000);
