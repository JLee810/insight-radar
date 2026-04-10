/** InsightRadar — Content Script */

(function () {
  // Only inject once
  if (window.__insightRadarInjected) return;
  window.__insightRadarInjected = true;

  /** Determine if the current page looks like an article */
  function isArticlePage() {
    const hasArticleTag = !!document.querySelector('article');
    const hasLongContent =
      (document.querySelector('main') || document.body)?.innerText?.length > 800;
    const hasTitle = !!document.querySelector('h1');
    const hasMeta = !!document.querySelector('meta[property="og:type"][content="article"]');
    return hasMeta || (hasArticleTag && hasTitle) || (hasLongContent && hasTitle);
  }

  /** Extract a short preview of the article */
  function getArticlePreview() {
    const title = document.title;
    const desc =
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      '';
    return { title, description: desc.substring(0, 120) };
  }

  /** Create and inject the save overlay */
  function injectOverlay() {
    if (document.getElementById('ir-overlay')) return;

    const { title, description } = getArticlePreview();

    const overlay = document.createElement('div');
    overlay.id = 'ir-overlay';
    overlay.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      background: #0D1F3C; border: 1px solid rgba(0,229,255,0.3);
      border-radius: 12px; padding: 12px 14px; max-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      animation: irSlideIn 0.3s ease;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes irSlideIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        #ir-overlay * { box-sizing: border-box; }
        #ir-save-btn { background:#00E5FF; color:#0A1628; border:none; border-radius:8px; padding:7px 14px; font-size:12px; font-weight:600; cursor:pointer; width:100%; margin-top:8px; }
        #ir-save-btn:hover { background:#00B8D4; }
        #ir-save-btn:disabled { background:#666; color:#aaa; cursor:not-allowed; }
        #ir-close-btn { position:absolute; top:8px; right:10px; background:none; border:none; color:#666; cursor:pointer; font-size:16px; line-height:1; }
        #ir-close-btn:hover { color:#fff; }
      </style>
      <button id="ir-close-btn">×</button>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20A14.5 14.5 0 0 0 12 2"/><path d="M2 12h20"/></svg>
        <span style="color:#00E5FF;font-size:11px;font-weight:600;letter-spacing:0.05em;">INSIGHTRADAR</span>
      </div>
      <p style="color:#e2e8f0;font-size:12px;font-weight:500;margin:0 0 2px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(title)}</p>
      ${description ? `<p style="color:#64748b;font-size:11px;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(description)}</p>` : ''}
      <button id="ir-save-btn">Save & Analyze with AI</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById('ir-close-btn').addEventListener('click', () => overlay.remove());

    document.getElementById('ir-save-btn').addEventListener('click', async () => {
      const btn = document.getElementById('ir-save-btn');
      btn.disabled = true;
      btn.textContent = 'Analyzing…';
      try {
        await chrome.runtime.sendMessage({ type: 'SAVE_ARTICLE', url: window.location.href });
        btn.textContent = '✓ Saved!';
        btn.style.background = '#22c55e';
        setTimeout(() => overlay.remove(), 2000);
      } catch (err) {
        btn.textContent = 'Error — retry';
        btn.disabled = false;
        btn.style.background = '#ef4444';
        btn.style.color = '#fff';
      }
    });

    // Auto-dismiss after 12 seconds
    setTimeout(() => overlay?.remove(), 12000);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Only show overlay on article-like pages
  if (isArticlePage()) {
    // Delay slightly to avoid showing on every page load instantly
    setTimeout(injectOverlay, 2000);
  }

  // Listen for manual trigger from popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SHOW_OVERLAY') injectOverlay();
    if (msg.type === 'CHECK_IS_ARTICLE') {
      return Promise.resolve({ isArticle: isArticlePage(), title: document.title, url: window.location.href });
    }
  });
})();
