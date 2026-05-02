const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const browseBtn   = document.getElementById('browseBtn');
const previewWrap = document.getElementById('previewWrap');
const previewImg  = document.getElementById('previewImg');
const changeBtn   = document.getElementById('changeBtn');
const analyseBtn  = document.getElementById('analyseBtn');
const statusBar   = document.getElementById('statusBar');
const statusText  = document.getElementById('statusText');
const errorBox    = document.getElementById('errorBox');
const resultsSection = document.getElementById('resultsSection');
const dropTitle   = document.getElementById('dropTitle');

let selectedFile = null;

// Open file picker
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => { if (e.target !== browseBtn) fileInput.click(); });

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag & drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showError('Please upload a JPG, PNG, or WEBP image.');
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    previewImg.src = ev.target.result;
    previewWrap.style.display = 'block';
    dropZone.style.display = 'none';
    analyseBtn.disabled = false;
    clearError();
  };
  reader.readAsDataURL(file);
}

changeBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  previewWrap.style.display = 'none';
  previewImg.src = '';
  dropZone.style.display = 'block';
  analyseBtn.disabled = true;
  dropTitle.textContent = 'Drop prescription image here';
  resultsSection.innerHTML = '';
  clearError();
});

// Analyse
analyseBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  setLoading(true);
  clearError();
  resultsSection.innerHTML = '';

  const formData = new FormData();
  formData.append('prescription', selectedFile);

  const msgs = ['Reading handwriting...', 'Identifying medicines...', 'Structuring your results...'];
  let mi = 0;
  statusText.textContent = msgs[0];
  const ticker = setInterval(() => { mi = (mi + 1) % msgs.length; statusText.textContent = msgs[mi]; }, 2000);

  try {
    const res = await fetch('/analyse', { method: 'POST', body: formData });
    const json = await res.json();

    clearInterval(ticker);
    setLoading(false);

    if (!res.ok || json.error) {
      showError(json.error || 'Something went wrong. Please try again.');
      return;
    }

    renderResults(json.data);

  } catch (err) {
    clearInterval(ticker);
    setLoading(false);
    showError('Network error. Please check your connection and try again.');
  }
});

function setLoading(on) {
  analyseBtn.disabled = on;
  statusBar.classList.toggle('show', on);
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('show');
}
function clearError() {
  errorBox.textContent = '';
  errorBox.classList.remove('show');
}

function renderResults(rx) {
  let html = `<div class="results-header">
    <h2 class="results-title">Prescription breakdown</h2>
    <button class="new-scan-btn" onclick="resetApp()">New scan</button>
  </div>`;

  // Meta card
  let chips = '';
  if (rx.doctor)   chips += `<span class="meta-chip">Dr. ${rx.doctor}</span>`;
  if (rx.patient)  chips += `<span class="meta-chip">Patient: ${rx.patient}</span>`;
  if (rx.hospital) chips += `<span class="meta-chip">${rx.hospital}</span>`;
  if (rx.date)     chips += `<span class="meta-chip">${rx.date}</span>`;

  if (chips || rx.summary) {
    html += `<div class="meta-card">`;
    if (chips) html += `<div class="meta-chips">${chips}</div>`;
    if (rx.summary) html += `<div class="meta-summary">${rx.summary}</div>`;
    html += `</div>`;
  }

  // Diagnosis
  if (rx.diagnosis) {
    html += `<div class="info-card">
      <div class="info-card-label">Diagnosis / Condition</div>
      <div class="info-card-text">${rx.diagnosis}</div>
    </div>`;
  }

  // Medicines
  if (!rx.medicines || rx.medicines.length === 0) {
    html += `<div class="med-card"><div class="med-body"><p style="color:#757575;font-size:14px;">No medicines could be identified. Please try uploading a clearer image.</p></div></div>`;
  } else {
    rx.medicines.forEach((med, i) => {
      let tags = '';
      if (med.dosage)    tags += `<span class="tag tag-dose">${med.dosage}</span>`;
      if (med.frequency) tags += `<span class="tag tag-freq">${med.frequency}</span>`;
      if (med.duration)  tags += `<span class="tag tag-dur">${med.duration}</span>`;
      if (med.quantity)  tags += `<span class="tag tag-qty">Qty: ${med.quantity}</span>`;

      html += `<div class="med-card">
        <div class="med-num">${i + 1}</div>
        <div class="med-body">
          <div class="med-name">${med.name || 'Unknown medicine'}</div>
          ${tags ? `<div class="med-tags">${tags}</div>` : ''}
          ${med.instructions ? `<div class="med-instructions">Instructions: ${med.instructions}</div>` : ''}
        </div>
      </div>`;
    });
  }

  // Notes
  if (rx.notes) {
    html += `<div class="info-card">
      <div class="info-card-label">Additional Notes</div>
      <div class="info-card-text">${rx.notes}</div>
    </div>`;
  }

  resultsSection.innerHTML = html;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetApp() {
  selectedFile = null;
  fileInput.value = '';
  previewWrap.style.display = 'none';
  previewImg.src = '';
  dropZone.style.display = 'block';
  analyseBtn.disabled = true;
  resultsSection.innerHTML = '';
  clearError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
