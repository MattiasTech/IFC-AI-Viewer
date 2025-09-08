// src/app.js
import { msalInstance, handleRedirect, getAccount, signIn, signOut } from './auth.js';
import { ViewerApp } from './viewer.js';
import { planFilterWithLLM } from './ai.js';
import { toCSV, downloadCSV } from './csv.js';
import { storeSecret, loadSecret } from './utils/crypto.js';

const viewer = new ViewerApp();

// UI refs
const signinBtn = document.getElementById('signin');
const signoutBtn = document.getElementById('signout');
const userEl = document.getElementById('user');

const fileInput = document.getElementById('ifc-file');
const askBtn = document.getElementById('ask');
const resetBtn = document.getElementById('reset');
const exportBtn = document.getElementById('export');
const promptInput = document.getElementById('query');
const apiKeyInput = document.getElementById('api-key');
const passphraseInput = document.getElementById('passphrase');
const saveKeyBtn = document.getElementById('save-key');
const strictChk = document.getElementById('strict');
const progressEl = document.getElementById('progress');

const resultsWrap = document.getElementById('results');
const matchCount = document.getElementById('match-count');
const matchRows = document.getElementById('match-rows');

init();

async function init() {
  await handleRedirect();
  updateAuthUI();

  // restore saved key if not encrypted
  const stored = localStorage.getItem('openai_key');
  if (stored) apiKeyInput.value = stored;

  signinBtn.addEventListener('click', () => signIn());
  signoutBtn.addEventListener('click', () => signOut());

  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const pass = passphraseInput.value.trim();
    if (!key) return alert('Enter your OpenAI API key first.');
    await storeSecret('openai_key', key, pass || null);
    alert('Key saved locally.');
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    progressEl.hidden = false;
    await viewer.loadIFCFile(file, txt => {
      progressEl.textContent = txt || 'Ready';
      if (!txt) setTimeout(() => progressEl.hidden = true, 500);
    });
    resultsWrap.hidden = true;
  });

  askBtn.addEventListener('click', onAsk);
  resetBtn.addEventListener('click', () => { viewer.resetView(); renderResults([]); });
  exportBtn.addEventListener('click', onExport);
}

function updateAuthUI() {
  const account = getAccount();
  if (account) {
    userEl.textContent = `Signed in as ${account.username || account.name || account.localAccountId}`;
    signinBtn.hidden = true;
    signoutBtn.hidden = false;
  } else {
    userEl.textContent = '';
    signinBtn.hidden = false;
    signoutBtn.hidden = true;
  }
}

async function onAsk() {
  const account = getAccount();
  if (!account) return alert('Please sign in first (Entra ID).');

  if (!viewer.model) return alert('Load an IFC file first.');
  const userPrompt = promptInput.value.trim();
  if (!userPrompt) return;

  let apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    // try to load decrypted
    const pass = passphraseInput.value.trim();
    apiKey = await loadSecret('openai_key', pass || null);
  }
  if (!apiKey) return alert('OpenAI API key is required (stored locally).');

  try {
    progressEl.hidden = false; progressEl.textContent = 'Planning query with LLM…';
    const spec = await planFilterWithLLM({
      apiKey,
      model: 'gpt-4o-mini',
      userPrompt,
      index: viewer.index,
      strict: strictChk.checked
    });

    progressEl.textContent = 'Applying filter…';
    const matches = viewer.queryLocal(spec);
    viewer.isolateByExpressIDs(matches.map(m => m.expressID));
    renderResults(matches);
  } catch (err) {
    console.error(err);
    alert('Query failed. See console for details.');
  } finally {
    progressEl.textContent = ''; progressEl.hidden = true;
  }
}

function onExport() {
  const ids = viewer.filteredIDs;
  if (!ids.length) return;
  const recs = ids.map(id => viewer.index.byExpressID.get(id)).filter(Boolean);
  const csv = toCSV(recs);
  downloadCSV(csv, 'filtered-elements.csv');
}

function renderResults(records) {
  matchCount.textContent = String(records.length);
  matchRows.innerHTML = records.slice(0, 1000).map(r => `
    <tr>
      <td>${r.globalId || ''}</td>
      <td>${r.ifcClass || ''}</td>
      <td>${escapeHTML(r.name || '')}</td>
      <td>${escapeHTML(r.predefinedType || '')}</td>
    </tr>
  `).join('');
  resultsWrap.hidden = records.length === 0;
}

function escapeHTML(s) {
  const div = document.createElement('div');
  div.innerText = s;
  return div.innerHTML;
}
