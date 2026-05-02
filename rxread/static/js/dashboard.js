// Dashboard logic
let selectedFile = null;
let currentResult = null;
let currentScanId = null;
let analyseLang = USER_LANG || 'en';
let voiceUtterance = null;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const previewArea = document.getElementById('previewArea');
const previewImg = document.getElementById('previewImg');
const changeBtn = document.getElementById('changeBtn');
const uploadActions = document.getElementById('uploadActions');
const analyseBtn = document.getElementById('analyseBtn');
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const errorBar = document.getElementById('errorBar');
const resultsSection = document.getElementById('resultsSection');

// ── File handling ──────────────────────────────────────────────────────────────
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => { if (e.target !== browseBtn) fileInput.click(); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag');
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});
changeBtn.addEventListener('click', resetFileOnly);

function loadFile(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    showError('Please upload a JPG, PNG or WEBP image.');
    return;
  }
  selectedFile = file;
  clearError();
  const reader = new FileReader();
  reader.onload = ev => {
    previewImg.src = ev.target.result;
    dropZone.style.display = 'none';
    previewArea.style.display = 'block';
    uploadActions.style.display = 'flex';
    syncLangPills();
  };
  reader.readAsDataURL(file);
}

function resetFileOnly() {
  selectedFile = null;
  fileInput.value = '';
  dropZone.style.display = 'block';
  previewArea.style.display = 'none';
  uploadActions.style.display = 'none';
  previewImg.src = '';
}

function resetScan() {
  resetFileOnly();
  resultsSection.style.display = 'none';
  currentResult = null;
  currentScanId = null;
  stopVoice();
  clearError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.resetScan = resetScan;

// ── Language pills ─────────────────────────────────────────────────────────────
function setAnalyseLang(lang) {
  analyseLang = lang;
  syncLangPills();
}
function syncLangPills() {
  document.querySelectorAll('.lang-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.lang === analyseLang);
  });
}
window.setAnalyseLang = setAnalyseLang;

// ── Analyse ───────────────────────────────────────────────────────────────────
analyseBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  setLoading(true);
  clearError();

  const messages = [
    getCurrentLang() === 'ta' ? 'மருத்துவச் சீட்டை படிக்கிறோம்...' : 'Reading prescription...',
    getCurrentLang() === 'ta' ? 'மருந்துகளை அடையாளம் காண்கிறோம்...' : 'Identifying medicines...',
    getCurrentLang() === 'ta' ? 'முடிவுகளை தயாரிக்கிறோம்...' : 'Preparing your results...'
  ];
  let mi = 0;
  statusText.textContent = messages[0];
  const ticker = setInterval(() => { mi = (mi + 1) % messages.length; statusText.textContent = messages[mi]; }, 2200);

  try {
    const formData = new FormData();
    formData.append('prescription', selectedFile);
    formData.append('language', analyseLang);
    const res = await fetch('/api/analyse', { method: 'POST', body: formData });
    const json = await res.json();
    clearInterval(ticker);
    setLoading(false);
    if (!res.ok || json.error) { showError(json.error || 'Something went wrong.'); return; }
    currentResult = json.data;
    currentScanId = json.scan_id;
    renderResults(json.data);
    if (IS_PRO) loadSideEffects();
  } catch (err) {
    clearInterval(ticker);
    setLoading(false);
    showError('Network error. Please check your connection.');
  }
});

// ── Render results ─────────────────────────────────────────────────────────────
function renderResults(data) {
  // Meta strip
  const metaStrip = document.getElementById('metaStrip');
  let chips = '';
  if (data.doctor) chips += `<span class="meta-chip">Dr. ${data.doctor}</span>`;
  if (data.patient) chips += `<span class="meta-chip">${data.patient}</span>`;
  if (data.hospital) chips += `<span class="meta-chip">${data.hospital}</span>`;
  if (data.date) chips += `<span class="meta-chip">${data.date}</span>`;
  if (data.diagnosis) chips += `<span class="meta-chip">${data.diagnosis}</span>`;
  let metaHtml = chips ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">${chips}</div>` : '';
  if (data.summary) metaHtml += `<div class="meta-summary">${data.summary}</div>`;
  metaStrip.innerHTML = metaHtml;
  metaStrip.style.display = metaHtml ? 'flex' : 'none';

  // Medicines
  const medsGrid = document.getElementById('medsGrid');
  if (!data.medicines || data.medicines.length === 0) {
    medsGrid.innerHTML = '<div style="color:var(--ink-3);font-size:14px;padding:1rem;">No medicines identified. Try a clearer image.</div>';
  } else {
    medsGrid.innerHTML = data.medicines.map((m, i) => `
      <div class="med-card" style="animation-delay:${i * 0.07}s">
        <div class="med-num">${i + 1}</div>
        <div class="med-body">
          <div class="med-name">${m.name || 'Unknown'}</div>
          <div class="med-tags">
            ${m.dosage ? `<span class="med-tag dose">${m.dosage}</span>` : ''}
            ${m.frequency ? `<span class="med-tag freq">${m.frequency}</span>` : ''}
            ${m.duration ? `<span class="med-tag dur">${m.duration}</span>` : ''}
            ${m.quantity ? `<span class="med-tag qty">Qty: ${m.quantity}</span>` : ''}
          </div>
          ${m.purpose ? `<div class="med-purpose">${m.purpose}</div>` : ''}
          ${m.instructions ? `<div class="med-instruction">📋 ${m.instructions}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Pro features ───────────────────────────────────────────────────────────────
let activeProTab = 'side-effects';

function showProTab(tab) {
  activeProTab = tab;
  document.querySelectorAll('.pro-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  ['sideEffectsPanel','interactionsPanel','askPanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (tab === 'side-effects') {
    document.getElementById('sideEffectsPanel').style.display = 'block';
    if (!document.getElementById('sideEffectsPanel').innerHTML.trim()) loadSideEffects();
  }
  if (tab === 'interactions') {
    document.getElementById('interactionsPanel').style.display = 'block';
    if (!document.getElementById('interactionsPanel').innerHTML.trim()) loadInteractions();
  }
  if (tab === 'ask') {
    document.getElementById('askPanel').style.display = 'block';
  }
}
window.showProTab = showProTab;

function showUpgradePrompt() {}
window.showUpgradePrompt = showUpgradePrompt;

async function loadSideEffects() {
  if (!currentResult || !IS_PRO) return;
  const panel = document.getElementById('sideEffectsPanel');
  if (!panel) return;
  const meds = (currentResult.medicines || []).map(m => m.name).filter(Boolean);
  if (!meds.length) { panel.innerHTML = '<p style="color:var(--ink-3);padding:1rem;font-size:14px;">No medicines found.</p>'; return; }
  panel.innerHTML = loadingSkeleton();
  try {
    const res = await fetch('/api/side-effects', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ medicines: meds, language: analyseLang })
    });
    const json = await res.json();
    if (!res.ok || json.error) { panel.innerHTML = proError(json.error); return; }
    const effects = json.data.side_effects || [];
    panel.innerHTML = effects.map(e => `
      <div class="se-card">
        <div class="se-header">
          <div class="se-name">${e.medicine}</div>
          <span class="se-badge ${e.severity || 'mild'}">${capitalize(e.severity || 'mild')}</span>
        </div>
        ${e.common && e.common.length ? `<div class="se-section"><div class="se-section-label">Common</div><div class="se-effects">${e.common.map(x=>`<span class="se-effect">${x}</span>`).join('')}</div></div>` : ''}
        ${e.serious && e.serious.length ? `<div class="se-section" style="margin-top:8px"><div class="se-section-label">Watch for</div><div class="se-effects">${e.serious.map(x=>`<span class="se-effect serious">${x}</span>`).join('')}</div></div>` : ''}
      </div>
    `).join('') || '<p style="color:var(--ink-3);padding:1rem;font-size:14px;">No side effects data found.</p>';
  } catch { panel.innerHTML = proError('Network error'); }
}

async function loadInteractions() {
  if (!currentResult || !IS_PRO) return;
  const panel = document.getElementById('interactionsPanel');
  if (!panel) return;
  const meds = (currentResult.medicines || []).map(m => m.name).filter(Boolean);
  if (meds.length < 2) { panel.innerHTML = '<div class="int-safe">✓ Only one medicine — no interactions to check.</div>'; return; }
  panel.innerHTML = loadingSkeleton();
  try {
    const res = await fetch('/api/interactions', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ medicines: meds, language: analyseLang })
    });
    const json = await res.json();
    if (!res.ok || json.error) { panel.innerHTML = proError(json.error); return; }
    const d = json.data;
    if (!d.interactions || d.interactions.length === 0) {
      panel.innerHTML = `<div class="int-safe">✓ ${d.safe_message || 'No dangerous interactions found. '}</div>`;
    } else {
      panel.innerHTML = d.interactions.map(i => `
        <div class="int-card ${i.severity || 'mild'}">
          <div class="int-drugs">${i.drug1} + ${i.drug2}</div>
          <div class="int-desc">${i.description}</div>
          <div class="int-advice">Advice: ${i.advice}</div>
        </div>
      `).join('');
    }
  } catch { panel.innerHTML = proError('Network error'); }
}

// Ask AI
document.addEventListener('keydown', e => {
  const input = document.getElementById('askInput');
  if (input && document.activeElement === input && e.key === 'Enter') sendAsk();
});

async function sendAsk() {
  const input = document.getElementById('askInput');
  const messages = document.getElementById('askMessages');
  if (!input || !messages || !input.value.trim()) return;
  const question = input.value.trim();
  input.value = '';
  // Remove hint if present
  const hint = messages.querySelector('.ask-hint');
  if (hint) hint.remove();
  messages.innerHTML += `<div class="ask-msg user">${escHtml(question)}</div>`;
  messages.innerHTML += `<div class="ask-msg ai" id="aiTyping"><span class="spinner" style="display:inline-block;width:14px;height:14px;border-width:1.5px;vertical-align:middle;margin-right:6px"></span>Thinking...</div>`;
  messages.scrollTop = messages.scrollHeight;
  try {
    const ctx = currentResult ? JSON.stringify({ medicines: currentResult.medicines, diagnosis: currentResult.diagnosis }) : '';
    const res = await fetch('/api/ask', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ question, context: ctx, language: analyseLang })
    });
    const json = await res.json();
    const typing = document.getElementById('aiTyping');
    if (typing) typing.remove();
    if (!res.ok || json.error) {
      messages.innerHTML += `<div class="ask-msg ai" style="color:var(--red)">Error: ${json.error}</div>`;
    } else {
      messages.innerHTML += `<div class="ask-msg ai">${escHtml(json.answer)}</div>`;
    }
    messages.scrollTop = messages.scrollHeight;
  } catch (err) {
    const typing = document.getElementById('aiTyping');
    if (typing) typing.textContent = 'Network error.';
  }
}
window.sendAsk = sendAsk;

// ── Voice ───────────────────────────────────────────────────────────────────────
function startVoice() {
  if (!currentResult || !window.speechSynthesis) {
    alert('Voice not supported in this browser.'); return;
  }
  stopVoice();
  const lang = analyseLang === 'ta' ? 'ta-IN' : 'en-IN';
  let text = '';
  if (currentResult.summary) text += currentResult.summary + '. ';
  (currentResult.medicines || []).forEach((m, i) => {
    text += `Medicine ${i+1}: ${m.name}. `;
    if (m.dosage) text += `Dosage: ${m.dosage}. `;
    if (m.frequency) text += `Frequency: ${m.frequency}. `;
    if (m.duration) text += `Duration: ${m.duration}. `;
    if (m.instructions) text += `Instructions: ${m.instructions}. `;
    if (m.purpose) text += `Purpose: ${m.purpose}. `;
  });
  if (currentResult.notes) text += 'Notes: ' + currentResult.notes;
  voiceUtterance = new SpeechSynthesisUtterance(text);
  voiceUtterance.lang = lang;
  voiceUtterance.rate = 0.9;
  voiceUtterance.onend = stopVoice;
  voiceUtterance.onerror = stopVoice;
  window.speechSynthesis.speak(voiceUtterance);
  document.getElementById('voiceBar').style.display = 'flex';
}
function stopVoice() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  const bar = document.getElementById('voiceBar');
  if (bar) bar.style.display = 'none';
}
window.startVoice = startVoice;
window.stopVoice = stopVoice;

// ── Load scan from history ─────────────────────────────────────────────────────
async function loadScan(id) {
  try {
    const res = await fetch(`/api/scan/${id}`);
    const json = await res.json();
    if (json.success) {
      currentResult = json.data;
      currentScanId = id;
      analyseLang = json.language || 'en';
      dropZone.style.display = 'none';
      previewArea.style.display = 'none';
      uploadActions.style.display = 'none';
      renderResults(json.data);
      if (IS_PRO) loadSideEffects();
    }
  } catch {}
}
window.loadScan = loadScan;

// Check if arriving from history link
const urlParams = new URLSearchParams(window.location.search);
const scanParam = urlParams.get('scan');
if (scanParam) loadScan(parseInt(scanParam));

// ── Helpers ────────────────────────────────────────────────────────────────────
function setLoading(on) {
  analyseBtn.disabled = on;
  statusBar.style.display = on ? 'flex' : 'none';
}
function showError(msg) {
  errorBar.textContent = msg;
  errorBar.style.display = 'block';
}
function clearError() { errorBar.style.display = 'none'; }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function loadingSkeleton() {
  return `<div style="display:flex;flex-direction:column;gap:12px;padding:.5rem 0">
    <div class="skeleton" style="height:80px;width:100%"></div>
    <div class="skeleton" style="height:80px;width:100%"></div>
  </div>`;
}
function proError(msg) {
  return `<div style="color:var(--red);font-size:14px;padding:1rem;">${msg || 'Something went wrong.'}</div>`;
}
