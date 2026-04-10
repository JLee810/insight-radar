/** InsightRadar — Popup Script */
import { CONFIG } from '../config.js';

const DASHBOARD_URL = CONFIG.DASHBOARD_URL;

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  loadToggleState();
  loadStats();
  loadRecentArticles();
  checkCurrentTab();

  document.getElementById('auto-track-toggle').addEventListener('change', onToggleChange);
  document.getElementById('btn-save').addEventListener('click', saveCurrentPage);
  document.getElementById('btn-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
  });
  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// ─── Auto-track toggle ────────────────────────────────────────────────────────

function loadToggleState() {
  chrome.storage.local.get('autoTrack', ({ autoTrack }) => {
    document.getElementById('auto-track-toggle').checked = autoTrack !== false;
  });
}

function onToggleChange(e) {
  chrome.storage.local.set({ autoTrack: e.target.checked });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (stats?.error) throw new Error(stats.error);
    document.getElementById('stat-total').textContent = stats.totalArticles ?? '—';
    document.getElementById('stat-unread').textContent = stats.unreadCount ?? '—';
    document.getElementById('stat-today').textContent = stats.articlesToday ?? '—';
  } catch {
    document.getElementById('stat-total').textContent = '!';
    document.getElementById('stat-unread').textContent = '—';
    document.getElementById('stat-today').textContent = '—';
  }
}

// ─── Current tab check ────────────────────────────────────────────────────────

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith('chrome://')) return;

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_IS_ARTICLE' }).catch(() => null);
    if (response?.isArticle) {
      const btn = document.getElementById('btn-save');
      btn.style.display = 'flex';
      btn.dataset.url = tab.url;
    }
  } catch {
    // Content script not injected on this page — that's fine
  }
}

// ─── Save current page ────────────────────────────────────────────────────────

async function saveCurrentPage() {
  const btn = document.getElementById('btn-save');
  const status = document.getElementById('save-status');
  const url = btn.dataset.url;
  if (!url) return;

  btn.disabled = true;
  showStatus('Analyzing with AI…', 'loading');

  try {
    const article = await chrome.runtime.sendMessage({ type: 'SAVE_ARTICLE', url });
    if (article?.error) throw new Error(article.error);
    showStatus(`✓ Saved! Relevance: ${Math.round(article.relevance_score)}%`, 'success');
    loadRecentArticles();
    loadStats();
  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
    btn.disabled = false;
  }
}

function showStatus(text, type) {
  const el = document.getElementById('save-status');
  el.textContent = text;
  el.className = `save-status ${type}`;
  el.style.display = 'block';
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─── Recent articles ──────────────────────────────────────────────────────────

async function loadRecentArticles() {
  const list = document.getElementById('articles-list');
  list.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const data = await chrome.runtime.sendMessage({ type: 'GET_RECENT' });
    if (data?.error) throw new Error(data.error);
    const articles = data?.articles || [];

    if (!articles.length) {
      list.innerHTML = '<div class="empty">No articles tracked yet.</div>';
      return;
    }

    list.innerHTML = '';
    for (const article of articles) {
      list.appendChild(buildArticleItem(article));
    }
  } catch (err) {
    list.innerHTML = `<div class="error-msg">Can't connect to server.<br/>Is it running on :3001?</div>`;
  }
}

function buildArticleItem(article) {
  const score = Math.round(article.relevance_score);
  const scoreClass = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
  const date = new Date(article.discovered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const el = document.createElement('div');
  el.className = 'article-item';
  el.innerHTML = `
    <div class="article-score ${scoreClass}">${score}</div>
    <div class="article-body">
      <div class="article-title">${escapeHtml(article.title)}</div>
      <div class="article-meta">${article.website_name || 'Manual'} · ${date}</div>
    </div>
  `;
  el.addEventListener('click', () => chrome.tabs.create({ url: article.url }));
  return el;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
