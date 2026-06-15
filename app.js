// --- APPLICATION STATE PROXIES ---
let database = [];
let activeCardIndexInStudy = null;
let temporaryIngestionObject = null;

// Initialize Application Lifecycle Hooks
window.onload = function() {
  synchronizeDatabaseFromCloud();
};

// --- READ OPERATION: REMOTE GOOGLE SHEET OVERLAY SYNCHRONIZER ---
async function synchronizeDatabaseFromCloud() {
  const target = document.getElementById('dashboard-queue-injection');
  const sheetEndpoint = localStorage.getItem('foundation_sheet_url');

  if (!sheetEndpoint) {
    target.innerHTML = `
      <div style="text-align:center; padding:48px 24px; color:var(--text-muted); font-size:0.9rem;">
        <p style="margin-bottom:16px;">App storage routing configurations required.</p>
        <button class="action-btn btn-dark" style="max-width:200px; margin:0 auto; padding:10px;" onclick="openSettingsModal()">Configure Vault</button>
      </div>
    `;
    return;
  }
  
  target.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.9rem;">Syncing review matrix queue...</div>`;
  
  try {
    const response = await fetch(sheetEndpoint);
    const result = await response.json();
    
    if (result.success) {
      database = result.data;
      renderDashboardQueue();
    } else {
      triggerSnackbar("warning", "Database sync failed: " + result.error);
    }
  } catch (error) {
    console.error("Network communication failure:", error);
    triggerSnackbar("warning", "Could not connect to database cloud engine.");
    target.innerHTML = `<div style="text-align:center; padding:32px; color:var(--accent-engraving); font-size:0.9rem;">Database Offline</div>`;
  }
}

// --- NAVIGATION VIEW MATRIX ROUTERS ---
function showDashboard() {
  document.getElementById('view-study').classList.remove('active');
  document.getElementById('view-add-verse').classList.remove('active');
  document.getElementById('view-dashboard').classList.add('active');
  document.getElementById('study-card').classList.remove('flipped');
  synchronizeDatabaseFromCloud();
}

function showAddVerse() {
  document.getElementById('view-dashboard').classList.remove('active');
  document.getElementById('view-add-verse').classList.add('active');
  resetIngestionForm();
}

// --- VIEW 1: DASHBOARD COMPILER ---
function renderDashboardQueue() {
  const target = document.getElementById('dashboard-queue-injection');
  const counterNode = document.getElementById('dashboard-pending-count');
  target.innerHTML = "";
  counterNode.innerText = database.length;

  if (database.length === 0) {
    target.innerHTML = `<div style="text-align:center; padding:48px 24px; color:var(--text-muted); font-size:0.9rem;">Your focus queue is clear. Click Add to queue a new text.</div>`;
    return;
  }

  database.forEach((item, index) => {
    // Safety fallback: if phase or dayCount are blank/undefined, handle them gracefully
    let phaseClean = (item.phase || 'engraving').toLowerCase();
    let dayCountClean = item.dayCount || 1;
    let metricsClean = item.metrics || (phaseClean === 'engraving' ? '15 Left' : 'Day 1 of 50');

    let titleLabel = phaseClean === 'engraving' ? `Engraving — Day ${dayCountClean}` : phaseClean === 'retention' ? `Retention — Day ${dayCountClean}` : `Matured`;
    
    let row = document.createElement('div');
    row.className = `queue-item item-${phaseClean}`;
    row.onclick = () => launchStudyMode(index);
    row.innerHTML = `
      <div class="item-content">
        <h3>${item.reference || 'Unknown Reference'}</h3>
        <div class="item-phase-lbl">${titleLabel}</div>
      </div>
      <div class="item-counter">${metricsClean}</div>
    `;
    target.appendChild(row);
  });
}

// --- VIEW 2: CARD FOCUS FLIP ENGINE ---
function launchStudyMode(index) {
  activeCardIndexInStudy = index;
  const targetItem = database[index];
  
  // Safety checks for layout items
  let phaseClean = (targetItem.phase || 'engraving').toLowerCase();
  let metricsClean = targetItem.metrics || (phaseClean === 'engraving' ? '15 Left' : 'Day 1 of 50');
  
  document.getElementById('card-reference-title').innerText = targetItem.reference || 'No Reference';
  document.getElementById('card-cipher-render').innerText = targetItem.text || 'No text found';

  const frontTheme = document.getElementById('card-front-theme');
  const label = document.getElementById('card-tag-label');
  const trackingAreaFront = document.getElementById('card-tracking-render-front');
  const trackingAreaBack = document.getElementById('card-tracking-render-back');
  
  frontTheme.className = "face";
  document.getElementById('study-card').classList.remove('flipped');

  if (phaseClean === 'engraving') {
    frontTheme.classList.add('face-engraving');
    label.innerText = "Engraving Mode";
    trackingAreaFront.innerHTML = `
      <div class="numeric-display" id="reps-display-box" style="color:var(--text-main); font-size:1.4rem; margin-bottom:4px;">${metricsClean}</div>
      <button class="action-btn btn-dark" style="padding:10px 16px; font-size:0.8rem; margin-top:8px;" onclick="handleInternalTicker(event)">Log Repetition (-1)</button>
    `;
  } else if (phaseClean === 'retention') {
    frontTheme.classList.add('face-retention');
    label.innerText = "Retention Mode";
    trackingAreaFront.innerHTML = `
      <div class="numeric-label-clean" style="font-size:1.1rem; color:var(--text-main); font-weight:600;">${metricsClean}</div>
      <div class="mini-ticker">Tap card to verify text alignment</div>
    `;
  } else {
    frontTheme.classList.add('face-matured');
    label.innerText = "Matured Maintenance";
    trackingAreaFront.innerHTML = `
      <div class="numeric-label-clean" style="font-size:1.1rem; color:var(--text-main); font-weight:600;">${metricsClean} Routine</div>
      <div class="mini-ticker">Tap card to review full text verification</div>
    `;
  }

  trackingAreaBack.innerHTML = `
    <button class="action-btn btn-accent-complete" style="width:100%; font-weight:700;" onclick="confirmCompletion(event)">Mark Review Complete</button>
  `;

  document.getElementById('view-dashboard').classList.remove('active');
  document.getElementById('view-study').classList.add('active');
}

function toggleCardFlip() {
  document.getElementById('study-card').classList.toggle('flipped');
}

function handleInternalTicker(event) {
  event.stopPropagation();
  let activeItem = database[activeCardIndexInStudy];
  
  if (activeItem) {
    let currentReps = parseInt(activeItem.metrics) || 15;
    if (currentReps > 1) {
      currentReps--;
      activeItem.metrics = `${currentReps} Left`;
      document.getElementById('reps-display-box').innerText = activeItem.metrics;
      triggerSnackbar("success", `Repetition logged. ${currentReps} remaining.`);
    } else {
      activeItem.metrics = `0 Left`;
      document.getElementById('reps-display-box').innerText = activeItem.metrics;
      triggerSnackbar("success", "Session complete! Tap card layout to flip.");
    }
  }
}

async function confirmCompletion(event) {
  event.stopPropagation();
  const sheetEndpoint = localStorage.getItem('foundation_sheet_url');
  let activeItem = database[activeCardIndexInStudy];
  
  if (!activeItem || !sheetEndpoint) return;
  
  triggerSnackbar("success", "Syncing progression metrics with sheet...");

  let phaseClean = (activeItem.phase || 'engraving').toLowerCase();

  if (phaseClean === 'engraving') {
    let currentReps = parseInt(activeItem.metrics);
    if (currentReps <= 1 || isNaN(currentReps) || activeItem.metrics === "0 Left") {
      activeItem.phase = "retention";
      activeItem.dayCount = 1;
      activeItem.metrics = "Day 1 of 50";
    } else {
      activeItem.dayCount = Number(activeItem.dayCount || 1) + 1;
    }
  } else if (phaseClean === 'retention') {
    let currentDay = Number(activeItem.dayCount || 1);
    if (currentDay >= 50) {
      activeItem.phase = "matured";
      activeItem.dayCount = 50;
      activeItem.metrics = "Monthly";
    } else {
      currentDay++;
      activeItem.dayCount = currentDay;
      activeItem.metrics = `Day ${currentDay} of 50`;
    }
  } else {
    activeItem.metrics = "Monthly";
  }

  try {
    await fetch(sheetEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activeItem)
    });
    
    triggerSnackbar("success", "Progress recorded successfully.");
    
    setTimeout(() => {
      showDashboard();
    }, 800);

  } catch (error) {
    console.error("Progression write failure:", error);
    triggerSnackbar("warning", "Could not sync progression metrics with cloud sheet.");
  }
}

// --- VIEW 3: LIVE ESV API AND PERSISTENCE WRITER ---
function generateFirstLetterCipher(text) {
  return text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()""’]/g, "")
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join(" ") + "...";
}

async function executeFetchPipeline() {
  const referenceInput = document.getElementById('verse-reference').value.trim();
  const apiKey = localStorage.getItem('esv_api_key');
  const sheetEndpoint = localStorage.getItem('foundation_sheet_url');
  
  if (!sheetEndpoint || !apiKey) {
    openSettingsModal();
    return;
  }

  if (!referenceInput) {
    triggerSnackbar("warning", "Please provide a verse reference.");
    return;
  }

  const verseExists = database.some(item => item.reference && item.reference.toLowerCase() === referenceInput.toLowerCase());
  if (verseExists) {
    triggerSnackbar("warning", "This text is already in your study queue.");
    return;
  }

  triggerSnackbar("success", "Contacting ESV Engine...");

  try {
    const url = `https://api.esv.org/v3/passage/text/?q=${encodeURIComponent(referenceInput)}&include-headings=false&include-footnotes=false&include-verse-numbers=false&include-short-copyright=false&include-passage-references=false`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Token ${apiKey}` }
    });
    
    const data = await response.json();
    
    if (!data.passages || data.passages.length === 0 || data.passages[0].trim() === "") {
      triggerSnackbar("warning", "Verse reference not found. Verify syntax.");
      return;
    }

    const cleanFetchedText = data.passages[0].trim().replace(/\s+/g, " ");
    const builtCipher = generateFirstLetterCipher(cleanFetchedText);

    document.getElementById('fetched-text-render').innerText = `"${cleanFetchedText}"`;
    document.getElementById('cipher-text-render').innerText = builtCipher;
    
    document.getElementById('ingestion-preview-panel').classList.add('active');
    document.getElementById('form-execution-footer').style.display = "flex";

    temporaryIngestionObject = {
      reference: referenceInput,
      phase: "engraving",
      text: cleanFetchedText,
      cipher: builtCipher,
      metrics: "15 Left",
      dayCount: 1
    };

  } catch (error) {
    console.error("API call error:", error);
    triggerSnackbar("warning", "Failed to retrieve text from ESV API endpoint.");
  }
}

async function commitVerseToDatabase() {
  const sheetEndpoint = localStorage.getItem('foundation_sheet_url');
  if (!temporaryIngestionObject || !sheetEndpoint) return;
  
  triggerSnackbar("success", "Saving text data...");
  
  try {
    await fetch(sheetEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(temporaryIngestionObject)
    });
    
    triggerSnackbar("success", `${temporaryIngestionObject.reference} added to study queue.`);
    
    setTimeout(() => {
      showDashboard();
    }, 800);

  } catch (error) {
    console.error("Write error:", error);
    triggerSnackbar("warning", "Failed to write record to remote cloud sheet.");
  }
}

function resetIngestionForm() {
  document.getElementById('verse-reference').value = "";
  document.getElementById('ingestion-preview-panel').classList.remove('active');
  document.getElementById('form-execution-footer').style.display = "none";
  temporaryIngestionObject = null;
}

// --- SYSTEM MODULE CONTROLLERS (MODALS & NOTIFICATIONS) ---
function openSettingsModal() {
  document.getElementById('modal-sheet-url-input').value = localStorage.getItem('foundation_sheet_url') || "";
  document.getElementById('modal-api-key-input').value = localStorage.getItem('esv_api_key') || "";
  document.getElementById('settings-modal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('active');
}

function saveSettingsCredentials() {
  const sheetUrlVal = document.getElementById('modal-sheet-url-input').value.trim();
  const apiKeyVal = document.getElementById('modal-api-key-input').value.trim();
  
  localStorage.setItem('foundation_sheet_url', sheetUrlVal);
  localStorage.setItem('esv_api_key', apiKeyVal);
  
  closeSettingsModal();
  triggerSnackbar("success", "Security vault credentials updated.");
  
  showDashboard();
}

function triggerSnackbar(type, message) {
  const bar = document.getElementById('global-notification-bar');
  const iconTarget = document.getElementById('snackbar-icon-target');
  const msgTarget = document.getElementById('snackbar-message-target');
  
  bar.className = `snackbar show snackbar-${type}`;
  msgTarget.innerText = message;

  if(type === 'success') {
    iconTarget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="#10b981"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
  } else {
    iconTarget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="#ef4444"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>`;
  }

  setTimeout(() => { bar.classList.remove('show'); }, 3000);
}
