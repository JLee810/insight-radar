/** InsightRadar — Options Page Script */
import { CONFIG } from '../config.js';

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings, falling back to config defaults
  chrome.storage.local.get(['serverUrl', 'dashboardUrl'], ({ serverUrl, dashboardUrl }) => {
    document.getElementById('server-url').value = serverUrl || CONFIG.SERVER_URL;
    document.getElementById('dashboard-url').value = dashboardUrl || CONFIG.DASHBOARD_URL;
  });

  document.getElementById('btn-test').addEventListener('click', testConnection);
  document.getElementById('btn-save').addEventListener('click', saveSettings);
});

async function testConnection() {
  const url = document.getElementById('server-url').value.trim();
  const status = document.getElementById('conn-status');
  status.style.display = 'block';
  status.className = 'status';
  status.textContent = 'Testing…';

  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (json.success) {
      status.textContent = '✓ Connected successfully!';
    } else {
      throw new Error('Unexpected response');
    }
  } catch (err) {
    status.className = 'status error';
    status.textContent = `✗ Connection failed: ${err.message}`;
  }
}

function saveSettings() {
  const serverUrl = document.getElementById('server-url').value.trim();
  const dashboardUrl = document.getElementById('dashboard-url').value.trim();
  const status = document.getElementById('save-status');

  chrome.storage.local.set({ serverUrl, dashboardUrl }, () => {
    status.style.display = 'block';
    status.className = 'status';
    status.textContent = '✓ Settings saved!';
    setTimeout(() => { status.style.display = 'none'; }, 3000);
  });
}
