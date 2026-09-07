(() => {
  const ROOT_ID = "local-live-subtitles-root";
  let rootElement: HTMLElement | null = null;
  let textSpan: HTMLElement | null = null;
  let dragOffset = { x: 0, y: 0 };

  function createOverlay() {
    if (rootElement) return;
    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      rootElement = existing;
      textSpan = document.getElementById(ROOT_ID + "-text");
      return;
    }

    rootElement = document.createElement("div");
    rootElement.id = ROOT_ID;
    rootElement.style.cssText = "position:fixed;z-index:2147483647;left:0;right:0;bottom:10%;display:none;pointer-events:none;text-align:center;width:100%;display:flex;justify-content:center;";

    const container = document.createElement("div");
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    // ==========================================
    // UI TWEAK: Professional Line Breaking
    // text-wrap: balance guarantees perfectly centered, equal lines
    // max-width ensures sentences stack correctly
    // ==========================================
    container.style.cssText = "display:inline-flex;align-items:center;justify-content:center;max-width:75%;padding:12px 24px;border-radius:12px;background:rgba(0,0,0,0.85);color:white;font:600 24px/1.4 system-ui,sans-serif;text-shadow:0 2px 4px rgba(0,0,0,0.9);pointer-events:auto;cursor:move;box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); text-wrap: balance; text-align: center;";

    textSpan = document.createElement("span");
    textSpan.id = ROOT_ID + "-text";
    textSpan.style.cssText = "flex-grow:1; text-align:center;";

    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Stop Captions";
    closeBtn.style.cssText = "margin-left:24px; cursor:pointer; font-size:32px; line-height:20px; color:#9ca3af; transition:color 0.2s; user-select:none;";
    closeBtn.onmouseover = () => closeBtn.style.color = "white";
    closeBtn.onmouseout = () => closeBtn.style.color = "#9ca3af";
    
    closeBtn.onclick = () => {
      rootElement!.style.display = "none";
      chrome.runtime.sendMessage({ type: "STOP" }); 
    };

    container.addEventListener("pointerdown", (i) => {
      if (i.target === closeBtn) return;
      const r = container.getBoundingClientRect();
      dragOffset = { x: i.clientX - r.left, y: i.clientY - r.top };
      container.setPointerCapture(i.pointerId);
    });

    container.addEventListener("pointermove", (i) => {
      if (container.hasPointerCapture(i.pointerId)) {
        // Fix dragging to move the container freely
        rootElement!.style.left = `${i.clientX - dragOffset.x}px`;
        rootElement!.style.right = "auto";
        rootElement!.style.bottom = `${window.innerHeight - i.clientY + dragOffset.y}px`;
        rootElement!.style.width = "auto"; 
      }
    });

    container.appendChild(textSpan);
    container.appendChild(closeBtn);
    rootElement.appendChild(container);

    appendOverlayToDOM();
  }

  function appendOverlayToDOM() {
    if (!rootElement) return;
    let targetParent = document.fullscreenElement || document.body;
    if (targetParent.tagName.toLowerCase() === 'video') {
      targetParent = targetParent.parentElement || document.body;
    }
    targetParent.appendChild(rootElement);
  }

  document.addEventListener('fullscreenchange', appendOverlayToDOM);

  createOverlay();

  chrome.runtime.onMessage.addListener((t) => {
    if ((t.type === "HIDE_OVERLAY" || t.type === "STOP") && rootElement) {
        rootElement.style.display = "none";
        textSpan!.textContent = "";
    }
    
    if (t.type === "CUE" && textSpan && rootElement) {
      if (t.cue.text) {
          rootElement.style.display = "flex";
          textSpan.textContent = t.cue.text;
      } else {
          rootElement.style.display = "none";
      }
    }
  });
})();