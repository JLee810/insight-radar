/** InsightRadar — Background Service Worker */
import { CONFIG } from '../config.js';

const DEFAULT_SERVER = CONFIG.SERVER_URL;

// ─── Install / startup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('serverUrl', ({ serverUrl }) => {
    if (!serverUrl) chrome.storage.local.set({ serverUrl: DEFAULT_SERVER });
  });
  scheduleAlarm();
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarm();
  updateBadge();
});

// ─── Alarm — periodic unread count refresh ────────────────────────────────────

function scheduleAlarm() {
  chrome.alarms.create('refreshUnread', { periodInMinutes: 5 });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'refreshUnread') updateBadge();
});

async function updateBadge() {
  try {
    const { serverUrl = DEFAULT_SERVER } = await chrome.storage.local.get('serverUrl');
    const res = await fetch(`${serverUrl}/api/stats`);
    if (!res.ok) return;
    const { data } = await res.json();
    const count = data?.unreadCount || 0;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#00E5FF' });
  } catch {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── Messages from popup / content script ────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SAVE_ARTICLE') {
    saveArticle(msg.url).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true; // Keep message channel open for async response
  }
  if (msg.type === 'GET_STATS') {
    getStats().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === 'GET_RECENT') {
    getRecentArticles().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === 'REFRESH_BADGE') {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function saveArticle(url) {
  const { serverUrl = DEFAULT_SERVER } = await chrome.storage.local.get('serverUrl');
  const res = await fetch(`${serverUrl}/api/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to save article');
  updateBadge();
  return json.data;
}

async function getStats() {
  const { serverUrl = DEFAULT_SERVER } = await chrome.storage.local.get('serverUrl');
  const res = await fetch(`${serverUrl}/api/stats`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function getRecentArticles() {
  const { serverUrl = DEFAULT_SERVER } = await chrome.storage.local.get('serverUrl');
  const res = await fetch(`${serverUrl}/api/articles?limit=5&sort=discovered_at&order=DESC`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}
