import { toSrt } from '../shared/captions';
import type { ExtensionMessage, SessionSnapshot, SpokenLanguage, SubtitleCue } from '../shared/types';

let session: SessionSnapshot = { status: 'idle', cues: [] };
let offscreenCreating: Promise<void> | undefined;

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  if (contexts.length) return;
  if (!offscreenCreating) {
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'src/offscreen/offscreen.html', reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Capture the active tab audio for on-device subtitles.'
    }).finally(() => { offscreenCreating = undefined; });
  }
  await offscreenCreating;
}

async function sendToTab(type: 'SHOW_OVERLAY' | 'HIDE_OVERLAY', tabId?: number): Promise<void> {
  if (!tabId) return;
  try { await chrome.tabs.sendMessage(tabId, { type }); } catch { /* the page may not allow injection */ }
}

async function start(tabId: number, language: SpokenLanguage): Promise<void> {
  if (session.status === 'running' || session.status === 'starting') return;
  session = { status: 'starting', tabId, language, startedAt: Date.now(), cues: [], message: 'Preparing local model…' };
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await ensureOffscreen();
  const streamId = await new Promise<string>((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve(id);
    });
  });
  await chrome.runtime.sendMessage({ type: 'START_CAPTURE', streamId, tabId, language } satisfies ExtensionMessage);
  session.status = 'running';
  await sendToTab('SHOW_OVERLAY', tabId);
}

async function stop(message = 'Stopped'): Promise<void> {
  const tabId = session.tabId;
  if (session.status === 'idle') return;
  session.status = 'stopping';
  await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' } satisfies ExtensionMessage).catch(() => undefined);
  await sendToTab('HIDE_OVERLAY', tabId);
  // Cues remain in volatile extension memory so the user can export after stopping.
  // A new session replaces them and nothing is written to persistent storage.
  session = { status: 'idle', cues: session.cues, message };
}

function exportSrt(): void {
  const text = toSrt(session.cues);
  const url = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
  void chrome.downloads.download({ url, filename: 'local-subtitles.srt', saveAs: true });
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, respond) => {
  void (async () => {
    try {
      if (message.type === 'START') await start(message.tabId, message.language);
      if (message.type === 'STOP') await stop();
      if (message.type === 'GET_STATE') { respond(session); return; }
      if (message.type === 'EXPORT_SRT') exportSrt();
      if (message.type === 'INFERENCE_STATUS') {
        session.backend = message.backend ?? session.backend;
        session.message = message.message;
      }
      if (message.type === 'CUE') {
        const cue: SubtitleCue = message.cue;
        const existing = session.cues.findIndex((item) => item.id === cue.id);
        if (existing >= 0) session.cues[existing] = cue; else session.cues.push(cue);
        await chrome.tabs.sendMessage(session.tabId!, message).catch(() => undefined);
      }
      if (message.type === 'CAPTURE_ERROR') {
        session.status = 'error'; session.message = message.message;
        await sendToTab('HIDE_OVERLAY', session.tabId);
      }
      respond(session);
    } catch (error) {
      session.status = 'error'; session.message = error instanceof Error ? error.message : 'Capture could not start.';
      respond(session);
    }
  })();
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => { if (tabId === session.tabId) void stop('Tab closed'); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === session.tabId && changeInfo.status === 'loading') void stop('Stopped after navigation');
});
