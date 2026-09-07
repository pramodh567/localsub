const app = document.getElementById('app');

if (app) {
  // Force the entire body into Dark Mode so the text is readable
  document.body.style.cssText = "margin:0; min-width:320px; background:#111827; color:#f9fafb; font-family:system-ui,sans-serif;";

  app.innerHTML = `
    <style>
      section { padding: 16px; }
      h1 { margin: 0 0 10px; font-size: 18px; }
      p { font-size: 13px; color: #d1d5db; line-height: 1.4; margin-bottom: 12px; }
      label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
      select { width: 100%; padding: 8px; border-radius: 6px; background: #1f2937; color: white; border: 1px solid #374151; margin-bottom: 15px; outline: none; }
      .toggle-row { display: flex; align-items: center; justify-content: space-between; padding-top: 15px; border-top: 1px solid #374151; }
      .toggle-label { font-weight: 600; font-size: 14px; color: #f9fafb; }
      .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
      .switch input { opacity: 0; width: 0; height: 0; margin: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #4b5563; transition: .3s; border-radius: 24px; }
      .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
      input:checked + .slider { background-color: #2563eb; }
      input:checked + .slider:before { transform: translateX(20px); }
      #statusBox { margin-top: 15px; padding: 10px; border-radius: 6px; background: #1f2937; border: 1px solid #4b5563; font-size: 11px; color: #9ca3af; font-family: monospace; word-wrap: break-word; }
    </style>
    <section>
      <h1>Local Live Subtitles</h1>
      <p>Private, on-device AI transcription.</p>
      
      <label for="language">Primary spoken language</label>
      <select id="language">
        <option value="en">English — fast path</option>
        <option value="auto">Auto-detect (Multilingual)</option>
      </select>
      <p class="hint">For heavily mixed speech, use Auto-detect.</p>

      <div class="toggle-row">
        <span class="toggle-label">Enable Captions</span>
        <label class="switch">
          <input type="checkbox" id="captionsToggle">
          <span class="slider"></span>
        </label>
      </div>
      
      <div id="statusBox">Ready. Turn on to load model.</div>
    </section>
  `;

  const toggle = document.getElementById('captionsToggle') as HTMLInputElement;
  const languageSelect = document.getElementById('language') as HTMLSelectElement;
  const statusBox = document.getElementById('statusBox') as HTMLDivElement;

  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      languageSelect.disabled = true; 
      statusBox.textContent = "Starting audio capture...";
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.runtime.sendMessage({ type: 'START', tabId: tab.id, language: languageSelect.value });
      }
    } else {
      languageSelect.disabled = false; 
      statusBox.textContent = "Captions stopped.";
      chrome.runtime.sendMessage({ type: 'STOP' }); // Sends STOP to background
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'INFERENCE_STATUS') statusBox.textContent = message.message;
    if (message.type === 'STOP') {
      toggle.checked = false;
      languageSelect.disabled = false;
      statusBox.textContent = "Captions stopped.";
    }
  });

  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
    if (state && (state.status === 'running' || state.status === 'starting')) {
      toggle.checked = true;
      languageSelect.disabled = true;
      languageSelect.value = state.language || 'en';
      statusBox.textContent = "Captions are running actively.";
    } else {
      toggle.checked = false;
      languageSelect.disabled = false;
    }
  });
}