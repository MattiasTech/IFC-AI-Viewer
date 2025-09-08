// src/app.js
import { ViewerApp } from './viewer.js';
import { planFilterWithLLM } from './ai.js';
import { toCSV, downloadCSV } from './csv.js';
import { storeSecret, loadSecret, forgetSecret } from './utils/crypto.js';

console.log('[app] module loaded (docs)');

const viewer = new ViewerApp();
console.log('[app] ViewerApp created (docs)', viewer);

// UI
const fileInput = document.getElementById('ifc-file');
const askBtn = document.getElementById('ask');
const resetBtn = document.getElementById('reset');
const exportBtn = document.getElementById('export');
const promptInput = document.getElementById('query');

const apiKeyInput = document.getElementById('api-key');
const passphraseInput = document.getElementById('passphrase');
const saveKeyBtn = document.getElementById('save-key');
const forgetKeyBtn = document.getElementById('forget-key');
const strictChk = document.getElementById('strict');

const progressEl = document.getElementById('progress');
const resultsWrap = document.getElementById('results');
const matchCount = document.getElementById('match-count');
const matchRows = document.getElementById('match-rows');

// Restore non-encrypted key if present (dev convenience)
const stored = localStorage.getItem('openai_key');
if (stored) apiKeyInput.value = stored;

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  console.log('[app] file input change', file && file.name);
  if (!file) return;
  progressEl.hidden = false;
  await viewer.loadIFCFile(file, txt => {
    progressEl.textContent = txt || 'Ready';
    console.log('[app] loadIFCFile progress:', txt);
    if (!txt) setTimeout(() => progressEl.hidden = true, 500);
  });
  resultsWrap.hidden = true;
});

saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  const pass = passphraseInput.value.trim();
  if (!key) return alert('Enter your OpenAI API key first.');
  await storeSecret('openai_key', key, pass || null);
  alert(pass ? 'Key encrypted and saved locally.' : 'Key saved locally (not encrypted).');
});

forgetKeyBtn.addEventListener('click', () => {
  forgetSecret('openai_key');
  alert('Key removed from this browser.');
});

askBtn.addEventListener('click', onAsk);
resetBtn.addEventListener('click', () => { viewer.resetView(); renderResults([]); });
exportBtn.addEventListener('click', onExport);

async function onAsk() {
  console.log('[app] onAsk called', { hasModel: !!viewer.model, prompt: promptInput.value });
  if (!viewer.model) return alert('Load an IFC file first.');
  const userPrompt = promptInput.value.trim();
  if (!userPrompt) return;

  let apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    // Attempt to decrypt stored key
    const pass = passphraseInput.value.trim();
    try {
      apiKey = await loadSecret('openai_key', pass || null);
    } catch {
      apiKey = '';
    }
  }
  if (!apiKey) return alert('OpenAI API key is required. Enter or decrypt it with your passphrase.');

  try {
    progressEl.hidden = false; progressEl.textContent = 'Planning query with LLM…';
  console.log('[app] requesting planFilterWithLLM', { userPrompt, strict: strictChk.checked });
    const spec = await planFilterWithLLM({
      apiKey,
      model: 'gpt-4o-mini',
      userPrompt,
      index: viewer.index,
      strict: strictChk.checked
    });

    progressEl.textContent = 'Applying filter…';
  console.log('[app] received spec from LLM', spec);
    const matches = viewer.queryLocal(spec);
    viewer.isolateByExpressIDs(matches.map(m => m.expressID));
    renderResults(matches);
  } catch (err) {
  console.error('[app] onAsk error', err);
    alert('Query failed. Check console.');
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
